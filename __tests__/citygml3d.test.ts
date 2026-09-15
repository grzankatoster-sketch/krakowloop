import { describe, expect, it } from '@jest/globals';
import earcut from 'earcut';
import { buildMesh, distanceToPolygon, glb, localFrame, pointInPolygon, polygons, toPl1992, triangulate } from '../scripts/lib/citygml3d';

type P3 = [number, number, number];

describe('toPl1992', () => {
  // control points from an independent implementation: pyproj, EPSG:4326 → EPSG:2180
  it.each([
    [50.0617, 19.93736, 567071.178, 244247.196],
    [50.05464, 19.93548, 566946.484, 243460.793],
    [52.0, 19.0, 500000.0, 459309.209],
    [49.5, 23.5, 825684.01, 191129.797],
  ])('%f, %f → %f E, %f N', (lat, lon, e, n) => {
    const p = toPl1992(lat, lon);
    expect(Math.abs(p.e - e)).toBeLessThan(0.05);
    expect(Math.abs(p.n - n)).toBeLessThan(0.05);
  });
});

describe('localFrame', () => {
  const lat = 50.0617;
  const lon = 19.93736;
  const frame = localFrame(lat, lon);
  // metres per degree on GRS80 at this latitude, computed independently of the projection
  const e2 = (1 / 298.257222101) * (2 - 1 / 298.257222101);
  const s = Math.sin((lat * Math.PI) / 180);
  const rad = Math.PI / 180;
  const metresPerDegLat = ((6378137 * (1 - e2)) / (1 - e2 * s * s) ** 1.5) * rad;
  const metresPerDegLon = (6378137 / Math.sqrt(1 - e2 * s * s)) * Math.cos(lat * rad) * rad;

  it('takes out the grid convergence, about 0.72° in Kraków', () => {
    // east of the 19° meridian, true north lies west of grid north: a negative grid bearing
    expect(frame.convergenceDeg).toBeLessThan(-0.7);
    expect(frame.convergenceDeg).toBeGreaterThan(-0.75);
    expect(frame.scale).toBeCloseTo(0.99936, 4);
  });

  it('puts a point 100 m to the true north 100 m north, not sideways', () => {
    const p = toPl1992(lat + 100 / metresPerDegLat, lon);
    const [east, north] = frame.toLocal(p.e, p.n);
    expect(Math.abs(east)).toBeLessThan(0.02);
    expect(Math.abs(north - 100)).toBeLessThan(0.05);
  });

  it('puts a point 100 m to the true east 100 m east', () => {
    const p = toPl1992(lat, lon + 100 / metresPerDegLon);
    const [east, north] = frame.toLocal(p.e, p.n);
    expect(Math.abs(east - 100)).toBeLessThan(0.05);
    expect(Math.abs(north)).toBeLessThan(0.02);
  });
});

describe('ground polygons with a courtyard', () => {
  const ring = (pts: [number, number][]): P3[] => [...pts, pts[0]].map(([e, n]) => [e, n, 200]);
  const polygon = {
    outer: ring([[0, 0], [30, 0], [30, 30], [0, 30]]),
    holes: [ring([[10, 10], [20, 10], [20, 20], [10, 20]])],
  };

  it('counts a point in the courtyard as outside the building', () => {
    expect(pointInPolygon(15, 15, polygon)).toBe(false);
    expect(distanceToPolygon(15, 15, polygon)).toBeCloseTo(5);
  });

  it('counts a point in the wings as inside', () => {
    expect(pointInPolygon(5, 15, polygon)).toBe(true);
    expect(distanceToPolygon(5, 15, polygon)).toBe(0);
  });

  it('reads the hole from CityGML', () => {
    const pos = (pts: P3[]) => pts.map((p) => `<gml:pos srsDimension="3">${p.join(' ')}</gml:pos>`).join('');
    const xml =
      `<gml:Polygon><gml:exterior><gml:LinearRing>${pos(polygon.outer)}</gml:LinearRing></gml:exterior>` +
      `<gml:interior><gml:LinearRing>${pos(polygon.holes[0])}</gml:LinearRing></gml:interior></gml:Polygon>`;
    const [read] = polygons(xml);
    expect(read.outer).toEqual(polygon.outer);
    expect(read.holes).toEqual(polygon.holes);
  });
});

const area = (pts: P3[], tris: number[]) => {
  let sum = 0;
  for (let k = 0; k < tris.length; k += 3) {
    const [a, b, c] = [pts[tris[k]], pts[tris[k + 1]], pts[tris[k + 2]]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    sum += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
  }
  return sum;
};

describe('triangulate', () => {
  it('covers a concave floor with a hole exactly once', () => {
    // an L of 20 × 20 minus a 10 × 10 corner (300 m²), with a 2 × 2 hole: 296 m²
    const outer: P3[] = [[0, 0, 0], [20, 0, 0], [20, 10, 0], [10, 10, 0], [10, 20, 0], [0, 20, 0], [0, 0, 0]];
    const hole: P3[] = [[2, 2, 0], [4, 2, 0], [4, 4, 0], [2, 4, 0], [2, 2, 0]];
    const { pts, tris } = triangulate(outer, [hole], earcut);
    expect(area(pts as P3[], tris)).toBeCloseTo(296);
  });

  it('handles a vertical wall', () => {
    const wall: P3[] = [[0, 0, 0], [10, 0, 0], [10, 0, 6], [0, 0, 6]];
    const { pts, tris, normal } = triangulate(wall, [], earcut);
    expect(area(pts as P3[], tris)).toBeCloseTo(60);
    expect(Math.abs(normal[1])).toBeCloseTo(1);
  });
});

describe('buildMesh', () => {
  const frame = { turn: (e: number, n: number) => [e, n], toLocal: (e: number, n: number) => [e, n] };
  // a roof pitched towards the south, written in both ring orders
  const roof: P3[] = [[0, 0, 10], [10, 0, 10], [10, 5, 13], [0, 5, 13]];
  const reversed = [...roof].reverse();

  it.each([
    ['as written', roof],
    ['reversed', reversed],
  ])('makes a roof face the sky with every triangle wound to its normal (%s)', (_, ring) => {
    const { prims, triangles } = buildMesh([{ kind: 'roof', outer: ring, holes: [] }], frame, 10, earcut);
    expect(triangles).toBe(2);
    const { positions, normals, indices } = prims.roof;
    const at = (i: number) => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
    for (let k = 0; k < indices.length; k += 3) {
      const [a, b, c] = [at(indices[k]), at(indices[k + 1]), at(indices[k + 2])];
      const n = [normals[3 * indices[k]], normals[3 * indices[k] + 1], normals[3 * indices[k] + 2]];
      expect(n[1]).toBeGreaterThan(0); // +Y is up
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      expect(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2]).toBeGreaterThan(0);
    }
    // north (+N) becomes −Z, ground becomes Y = 0
    expect(Math.min(...positions.filter((_, i) => i % 3 === 2))).toBeCloseTo(-5);
    expect(Math.min(...positions.filter((_, i) => i % 3 === 1))).toBeCloseTo(0);
  });
});

describe('glb', () => {
  const frame = { turn: (e: number, n: number) => [e, n], toLocal: (e: number, n: number) => [e, n] };
  const wall: P3[] = [[0, 0, 0], [10, 0, 0], [10, 0, 6], [0, 0, 6]];
  const { prims } = buildMesh([{ kind: 'wall', outer: wall, holes: [] }], frame, 0, earcut);
  const bytes = glb([{ ...prims.wall, colour: [1, 1, 1, 1] }, { ...prims.roof, colour: [1, 0, 0, 1] }], 'Test', 'GUGiK, CC BY 4.0');

  it('has a valid header and 4-byte aligned chunks', () => {
    expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
    expect(bytes.readUInt32LE(4)).toBe(2);
    expect(bytes.readUInt32LE(8)).toBe(bytes.length);
    const jsonLength = bytes.readUInt32LE(12);
    expect(jsonLength % 4).toBe(0);
    const binLength = bytes.readUInt32LE(20 + jsonLength);
    expect(binLength % 4).toBe(0);
    expect(20 + jsonLength + 8 + binLength).toBe(bytes.length);
  });

  it('keeps indices inside the vertex count and leaves out empty primitives', () => {
    const jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
    expect(json.meshes[0].primitives).toHaveLength(1);
    const binStart = 20 + jsonLength + 8;
    for (const prim of json.meshes[0].primitives) {
      const vertices = json.accessors[prim.attributes.POSITION].count;
      const acc = json.accessors[prim.indices];
      const view = json.bufferViews[acc.bufferView];
      const idx = new Uint32Array(bytes.buffer.slice(bytes.byteOffset + binStart + view.byteOffset, bytes.byteOffset + binStart + view.byteOffset + view.byteLength));
      expect(Math.max(...idx)).toBeLessThan(vertices);
      expect(view.byteOffset % 4).toBe(0);
    }
    expect(json.asset.copyright).toBe('GUGiK, CC BY 4.0');
  });
});
