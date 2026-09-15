'use strict';
// GUGiK LoD2 CityGML → landmark meshes and binary glTF. Pure: file reading and the earcut
// triangulator are passed in, so the geometry is tested on fixed values (__tests__/citygml3d.test.ts).
// Used by scripts/3d/extract-landmarks.mjs.
const { Buffer } = require('node:buffer');

const GRS80 = { a: 6378137, f: 1 / 298.257222101 };

/** WGS84 lat/lon → EPSG:2180 (PL-1992): Transverse Mercator on GRS80, lon0 19°, k0 0.9993, FE 500 000, FN −5 300 000. */
function toPl1992(latDeg, lonDeg) {
  const { a, f } = GRS80;
  const k0 = 0.9993;
  const lon0 = (19 * Math.PI) / 180;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const T = Math.tan(lat) ** 2;
  const C = ep2 * Math.cos(lat) ** 2;
  const A = (lon - lon0) * Math.cos(lat);
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const M =
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * lat -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * lat) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * lat) -
      ((35 * e6) / 3072) * Math.sin(6 * lat));
  const x = k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5) / 120);
  const y =
    k0 *
    (M +
      N * Math.tan(lat) * ((A * A) / 2 + ((5 - T + 9 * C + 4 * C * C) * A ** 4) / 24 + ((61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6) / 720));
  return { e: x + 500000, n: y - 5300000 };
}

/** Metres along the meridian per radian of latitude, at a latitude in degrees. */
function meridianRadius(latDeg) {
  const { a, f } = GRS80;
  const e2 = f * (2 - f);
  const s = Math.sin((latDeg * Math.PI) / 180);
  return (a * (1 - e2)) / (1 - e2 * s * s) ** 1.5;
}

/**
 * A local frame at a point: grid offsets in EPSG:2180 → true metres east and north. The grid is
 * turned against true north by the meridian convergence (about 0.7° in Kraków) and scaled by the
 * projection, so plain subtraction would turn and stretch a model.
 */
function localFrame(latDeg, lonDeg) {
  const origin = toPl1992(latDeg, lonDeg);
  const step = 1e-4; // degrees
  const north = toPl1992(latDeg + step, lonDeg);
  const dE = north.e - origin.e;
  const dN = north.n - origin.n;
  const trueMetres = meridianRadius(latDeg) * ((step * Math.PI) / 180);
  const scale = Math.hypot(dE, dN) / trueMetres;
  const gamma = Math.atan2(dE, dN); // grid bearing of true north
  const cos = Math.cos(gamma);
  const sin = Math.sin(gamma);
  return {
    origin,
    convergenceDeg: (gamma * 180) / Math.PI,
    scale,
    /** grid E, N → true metres [east, north] from the point */
    toLocal(e, n) {
      const dx = e - origin.e;
      const dy = n - origin.n;
      return [(dx * cos - dy * sin) / scale, (dx * sin + dy * cos) / scale];
    },
    /** a grid direction [E, N] → the same direction in true east, north */
    turn(dx, dy) {
      return [dx * cos - dy * sin, dx * sin + dy * cos];
    },
  };
}

// ---------------------------------------------------------------- CityGML parsing

const posList = (xml) => [...xml.matchAll(/<gml:pos[^>]*>([^<]+)<\/gml:pos>/g)].map((m) => m[1].trim().split(/\s+/).map(Number));

/** Every polygon of a surface: an exterior ring and its holes, each a list of [E, N, H]. */
function polygons(surfaceXml) {
  return [...surfaceXml.matchAll(/<gml:Polygon[\s\S]*?<\/gml:Polygon>/g)].map((p) => {
    const ext = /<gml:exterior>([\s\S]*?)<\/gml:exterior>/.exec(p[0]);
    const holes = [...p[0].matchAll(/<gml:interior>([\s\S]*?)<\/gml:interior>/g)].map((h) => posList(h[1]));
    return { outer: ext ? posList(ext[1]) : [], holes };
  });
}

/** The surfaces of one bldg:Building, split into roofs and everything else. */
function surfacesOf(buildingXml) {
  return [...buildingXml.matchAll(/<bldg:(GroundSurface|WallSurface|RoofSurface)[\s\S]*?<\/bldg:\1>/g)].flatMap((m) =>
    polygons(m[0]).map((p) => ({ kind: m[1] === 'RoofSurface' ? 'roof' : 'wall', ground: m[1] === 'GroundSurface', ...p })),
  );
}

function pointInRing(e, n, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ei, ni] = ring[i];
    const [ej, nj] = ring[j];
    if (ni > n !== nj > n && e < ((ej - ei) * (n - ni)) / (nj - ni) + ei) inside = !inside;
  }
  return inside;
}

/** Inside the exterior ring and outside every hole: a courtyard is not the building. */
function pointInPolygon(e, n, polygon) {
  return pointInRing(e, n, polygon.outer) && !polygon.holes.some((h) => pointInRing(e, n, h));
}

function distanceToRing(e, n, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = dx || dy ? Math.max(0, Math.min(1, ((e - x1) * dx + (n - y1) * dy) / (dx * dx + dy * dy))) : 0;
    best = Math.min(best, Math.hypot(e - (x1 + t * dx), n - (y1 + t * dy)));
  }
  return best;
}

/** Distance to the nearest edge of the polygon, holes included (0 when the point is on the building). */
function distanceToPolygon(e, n, polygon) {
  if (pointInPolygon(e, n, polygon)) return 0;
  return Math.min(distanceToRing(e, n, polygon.outer), ...polygon.holes.map((h) => distanceToRing(e, n, h)));
}

// ---------------------------------------------------------------- triangulation

/** Newell's normal of a ring of 3D points, unit length ([0, 0, 0] for a degenerate ring). */
function newellNormal(ring) {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1, z1] = ring[i];
    const [x2, y2, z2] = ring[(i + 1) % ring.length];
    nx += (y1 - y2) * (z1 + z2);
    ny += (z1 - z2) * (x1 + x2);
    nz += (x1 - x2) * (y1 + y2);
  }
  const len = Math.hypot(nx, ny, nz);
  return len ? [nx / len, ny / len, nz / len] : [0, 0, 0];
}

/**
 * Triangulates a planar 3D polygon with holes by projecting it on the axis plane it faces most.
 * @returns {{ pts: number[][], tris: number[], normal: number[] }} indices into pts; normal from the ring order
 */
function triangulate(outer, holes, earcut) {
  const open = (r) => (r.length > 1 && r[0].every((v, i) => v === r[r.length - 1][i]) ? r.slice(0, -1) : r);
  const rings = [outer, ...holes].map(open);
  if (rings[0].length < 3) return { pts: [], tris: [], normal: [0, 0, 1] };
  const normal = newellNormal(rings[0]);
  const [ax, ay, az] = normal.map(Math.abs);
  const pts = rings.flat();
  const flat = pts.flatMap(([x, y, z]) => (az >= ax && az >= ay ? [x, y] : ax >= ay ? [y, z] : [x, z]));
  const holeIndex = [];
  let count = rings[0].length;
  for (const h of rings.slice(1)) {
    holeIndex.push(count);
    count += h.length;
  }
  return { pts, tris: earcut(flat, holeIndex.length ? holeIndex : undefined, 2), normal };
}

const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];

/**
 * Meshes surfaces in glTF axes around a local frame: +X east, +Y up, −Z north, metres, `ground` at 0.
 * Roofs always face the sky; every triangle is wound to face its normal, since renderers light a
 * back face with the normal flipped.
 */
function buildMesh(surfaces, frame, ground, earcut) {
  const prims = {
    wall: { name: 'wall', positions: [], normals: [], indices: [] },
    roof: { name: 'roof', positions: [], normals: [], indices: [] },
  };
  let triangles = 0;
  for (const s of surfaces) {
    const { pts, tris, normal } = triangulate(s.outer, s.holes, earcut);
    if (!tris.length) continue;
    const up = s.kind === 'roof' && normal[2] < 0 ? -1 : 1;
    const [ne, nn] = frame.turn(normal[0] * up, normal[1] * up);
    const faceNormal = [ne, normal[2] * up, -nn];
    const local = pts.map(([e, n, h]) => {
      const [x, north] = frame.toLocal(e, n);
      return [x, h - ground, -north];
    });
    const prim = prims[s.kind];
    const base = prim.positions.length / 3;
    for (const p of local) {
      prim.positions.push(...p);
      prim.normals.push(...faceNormal);
    }
    for (let k = 0; k < tris.length; k += 3) {
      const [i, j, l] = [tris[k], tris[k + 1], tris[k + 2]];
      const facing = dot(cross(sub(local[j], local[i]), sub(local[l], local[i])), faceNormal);
      if (facing < 0) prim.indices.push(base + i, base + l, base + j);
      else prim.indices.push(base + i, base + j, base + l);
    }
    triangles += tris.length / 3;
  }
  return { prims, triangles };
}

// ---------------------------------------------------------------- glTF writing

/**
 * One mesh, one node, one material per primitive, in a binary glTF 2.0 container.
 * @param {{ name: string, colour: number[], positions: number[], normals: number[], indices: number[] }[]} primitives
 */
function glb(primitives, name, copyright) {
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  const materials = [];
  const gltfPrimitives = [];
  let offset = 0;
  const push = (typed, target) => {
    const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    chunks.push(bytes, Buffer.alloc(pad));
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    offset += bytes.length + pad;
    return bufferViews.length - 1;
  };
  for (const prim of primitives) {
    if (!prim.indices.length) continue;
    const positions = new Float32Array(prim.positions);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], positions[i + k]);
        max[k] = Math.max(max[k], positions[i + k]);
      }
    }
    const pos = accessors.push({ bufferView: push(positions, 34962), componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max }) - 1;
    const nor = accessors.push({ bufferView: push(new Float32Array(prim.normals), 34962), componentType: 5126, count: prim.normals.length / 3, type: 'VEC3' }) - 1;
    const idx = accessors.push({ bufferView: push(new Uint32Array(prim.indices), 34963), componentType: 5125, count: prim.indices.length, type: 'SCALAR' }) - 1;
    const material =
      materials.push({ name: prim.name, pbrMetallicRoughness: { baseColorFactor: prim.colour, metallicFactor: 0, roughnessFactor: 0.9 }, doubleSided: true }) - 1;
    gltfPrimitives.push({ attributes: { POSITION: pos, NORMAL: nor }, indices: idx, material });
  }
  const bin = Buffer.concat(chunks);
  const json = {
    asset: { version: '2.0', generator: 'KrakowLoop extract-landmarks', copyright },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives: gltfPrimitives }],
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: bin.length }],
  };
  let jsonBytes = Buffer.from(JSON.stringify(json));
  jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc((4 - (jsonBytes.length % 4)) % 4, 0x20)]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // "glTF"
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBytes.length + 8 + bin.length, 8);
  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(jsonBytes.length, 0);
  jsonHead.writeUInt32LE(0x4e4f534a, 4); // "JSON"
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(bin.length, 0);
  binHead.writeUInt32LE(0x004e4942, 4); // "BIN\0"
  return Buffer.concat([header, jsonHead, jsonBytes, binHead, bin]);
}

module.exports = {
  toPl1992,
  localFrame,
  polygons,
  surfacesOf,
  pointInPolygon,
  distanceToPolygon,
  triangulate,
  buildMesh,
  glb,
};
