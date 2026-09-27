// Cuts every building around a point out of the GUGiK LoD2 CityGML sheets into one binary glTF:
// the stage for a reconstruction of the city in the past (the Main Square around 1800, rendered in
// Blender by scripts/3d/render-rynek-1800.py). Run: node scripts/3d/extract-area.mjs [radius m]
//
// Input:  ../02_dane/gugik_3d/arkusze/*.gml (EPSG:2180, KRON86 heights)
// Output: ../02_dane/gugik_3d/modele/rynek-area.glb (+X east, +Y up, −Z north, metres, every building
// on its own lowest point = 0; groups wall/roof, tower-*, cloth-*, stmarys-*) and rynek-area.json.
// Source: GUGiK, CC BY 4.0.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import earcut from 'earcut';
import { buildMesh, distanceToPolygon, glb, localFrame, polygons, surfacesOf, toPl1992 } from '../lib/citygml3d.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(here, '../../../02_dane/gugik_3d');
const SHEETS = path.join(DATA, 'arkusze');
const OUT = path.join(DATA, 'modele');
const LICENCE = 'GUGiK, CC BY 4.0';

// the middle of the Main Square, between the Cloth Hall and the Town Hall Tower
const CENTRE = { lat: 50.06165, lon: 19.93705 };
const RADIUS = Number(process.argv[2] ?? 230);

const frame = localFrame(CENTRE.lat, CENTRE.lon);
// landmarks keep their own groups, so the render can give them brick or stone instead of plaster
// with windows: the building whose outline contains the point
const LANDMARKS = [
  ['tower', 50.06147, 19.93641],
  ['stmarys', 50.06165, 19.93945],
  ['cloth', 50.0617, 19.93736],
].map(([group, lat, lon]) => ({ group, ...toPl1992(lat, lon) }));
const chosen = [];
for (const file of readdirSync(SHEETS).filter((f) => f.endsWith('.gml'))) {
  const xml = readFileSync(path.join(SHEETS, file), 'utf8');
  let at = 0;
  for (;;) {
    const start = xml.indexOf('<bldg:Building ', at);
    if (start < 0) break;
    const end = xml.indexOf('</bldg:Building>', start);
    const chunk = xml.slice(start, end + 16);
    at = end + 16;
    const grounds = [...chunk.matchAll(/<bldg:GroundSurface[\s\S]*?<\/bldg:GroundSurface>/g)]
      .flatMap((g) => polygons(g[0]))
      .filter((p) => p.outer.length >= 4);
    if (grounds.some((p) => distanceToPolygon(frame.origin.e, frame.origin.n, p) <= RADIUS)) {
      const id = /name="buildingId">\s*<gen:value>([^<]+)</.exec(chunk)?.[1] ?? /gml:id="([^"]+)"/.exec(chunk)[1];
      const landmark = LANDMARKS.find((l) => grounds.some((g) => distanceToPolygon(l.e, l.n, g) === 0));
      chosen.push({ id, sheet: file, xml: chunk, group: landmark?.group ?? 'house' });
    }
  }
}

// Each building stands on its own lowest point: the square slopes by a few metres, and one common
// ground left the higher houses floating over the flat stage with a dark gap beneath them.
const COLOUR = { wall: [0.85, 0.8, 0.72, 1], roof: [0.55, 0.25, 0.17, 1] };
const groups = new Map();
let triangles = 0;
for (const b of chosen) {
  const surfaces = surfacesOf(b.xml);
  const hs = surfaces.flatMap((x) => x.outer.map((pt) => pt[2]));
  if (!hs.length) continue;
  const { prims, triangles: t } = buildMesh(surfaces, frame, Math.min(...hs), earcut);
  triangles += t;
  for (const kind of ['wall', 'roof']) {
    const name = b.group === 'house' ? kind : `${b.group}-${kind}`;
    const g = groups.get(name) ?? { name, colour: COLOUR[kind], positions: [], normals: [], indices: [] };
    const base = g.positions.length / 3;
    g.positions.push(...prims[kind].positions);
    g.normals.push(...prims[kind].normals);
    g.indices.push(...prims[kind].indices.map((i) => i + base));
    groups.set(name, g);
  }
}
const bytes = glb([...groups.values()].filter((g) => g.indices.length), 'Main Square area', LICENCE);
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'rynek-area.glb'), bytes);
writeFileSync(
  path.join(OUT, 'rynek-area.json'),
  JSON.stringify({ source: 'GUGiK LoD2 2017, Kraków', licence: LICENCE, centre: CENTRE, radiusMetres: RADIUS, buildings: chosen.length, triangles, groups: [...groups.keys()], gridConvergenceDeg: +frame.convergenceDeg.toFixed(4) }, null, 2),
);
console.log(`${chosen.length} buildings within ${RADIUS} m, ${triangles} triangles, ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);
