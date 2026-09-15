// Cuts landmark buildings out of the GUGiK LoD2 CityGML sheets and writes one binary glTF per
// landmark, ready for a 3D map layer. Run: node scripts/3d/extract-landmarks.mjs
//
// Input:  ../02_dane/gugik_3d/arkusze/*.gml  (EPSG:2180 PL-1992 plus KRON86 heights; E N H per point)
// Output: ../02_dane/gugik_3d/modele/<id>.glb and index.json; copy the .glb files to public/models.
//
// The sheets carry no building names, only BDOT10k ids, so a landmark is the building whose ground
// outline contains its point (courtyard holes excluded); when no outline does, the `take` nearest
// outlines within the landmark's radius are used. The fortifications (Barbican, St Florian's Gate) are
// not BDOT10k buildings: the nearest outlines are neighbouring houses, so they have no model.
// Models are in true metres around the landmark point (+X east, +Y up, −Z north, ground at Y = 0),
// corrected for the grid's convergence and scale. Source: GUGiK, CC BY 4.0.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import earcut from 'earcut';
import { buildMesh, distanceToPolygon, glb, localFrame, polygons, surfacesOf } from '../lib/citygml3d.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(here, '../../../02_dane/gugik_3d');
const SHEETS = path.join(DATA, 'arkusze');
const OUT = path.join(DATA, 'modele');
const LICENCE = 'GUGiK, CC BY 4.0';

/** [id, name, lat, lon, fallback radius in metres, how many nearest outlines the fallback takes] */
const LANDMARKS = [
  ['cloth-hall', 'Cloth Hall', 50.0617, 19.93736, 25, 1],
  ['st-marys', "St Mary's Basilica", 50.06165, 19.93945, 25, 1],
  ['town-hall-tower', 'Town Hall Tower', 50.06147, 19.93641, 15, 1],
  ['wawel-cathedral', 'Wawel Cathedral', 50.05464, 19.93548, 25, 1],
  // the point is the arcaded courtyard: the two wings around it, not the sheds further out
  ['wawel-castle', 'Wawel Royal Castle', 50.05441, 19.93656, 30, 2],
];

const COLOURS = {
  roof: [0.62, 0.23, 0.16, 1], // Wawel brick
  wall: [0.85, 0.78, 0.75, 1], // sandstone
};

/** Buildings of all sheets: id, ground polygons (with holes) and raw XML, parsed further only when chosen. */
function* buildings() {
  for (const file of readdirSync(SHEETS).filter((f) => f.endsWith('.gml'))) {
    const xml = readFileSync(path.join(SHEETS, file), 'utf8');
    let at = 0;
    for (;;) {
      const start = xml.indexOf('<bldg:Building ', at);
      if (start < 0) break;
      const end = xml.indexOf('</bldg:Building>', start);
      const chunk = xml.slice(start, end + 16);
      at = end + 16;
      const id = /name="buildingId">\s*<gen:value>([^<]+)</.exec(chunk)?.[1] ?? /gml:id="([^"]+)"/.exec(chunk)[1];
      const grounds = [...chunk.matchAll(/<bldg:GroundSurface[\s\S]*?<\/bldg:GroundSurface>/g)]
        .flatMap((g) => polygons(g[0]))
        .filter((p) => p.outer.length >= 4);
      yield { id, sheet: file, grounds, xml: chunk };
    }
  }
}

const targets = LANDMARKS.map(([id, name, lat, lon, radius, take]) => {
  const frame = localFrame(lat, lon);
  return { id, name, lat, lon, radius, take, frame, e: frame.origin.e, n: frame.origin.n, inside: new Map(), near: new Map() };
});

for (const b of buildings()) {
  for (const t of targets) {
    for (const polygon of b.grounds) {
      const d = distanceToPolygon(t.e, t.n, polygon);
      if (d === 0) t.inside.set(b.id, b);
      else if (d <= t.radius && !(t.near.get(b.id)?.distance <= d)) t.near.set(b.id, { building: b, distance: d });
    }
  }
}

mkdirSync(OUT, { recursive: true });
const index = [];
for (const t of targets) {
  const nearest = [...t.near.values()].sort((a, b) => a.distance - b.distance).slice(0, t.take).map((x) => x.building);
  const chosen = t.inside.size ? [...t.inside.values()] : nearest;
  if (!chosen.length) {
    console.log(`${t.id}: no building found within ${t.radius} m`);
    continue;
  }
  const surfaces = chosen.flatMap((b) => surfacesOf(b.xml));
  const heights = surfaces.flatMap((s) => s.outer.map((p) => p[2]));
  const ground = Math.min(...heights);
  const { prims, triangles } = buildMesh(surfaces, t.frame, ground, earcut);
  const bytes = glb(
    [
      { ...prims.wall, colour: COLOURS.wall },
      { ...prims.roof, colour: COLOURS.roof },
    ],
    t.name,
    LICENCE,
  );
  const file = `${t.id}.glb`;
  writeFileSync(path.join(OUT, file), bytes);
  const height = Math.max(...heights) - ground;
  index.push({
    id: t.id,
    name: t.name,
    file,
    origin: { lat: t.lat, lon: t.lon, e: +t.e.toFixed(2), n: +t.n.toFixed(2), groundKron86: +ground.toFixed(2) },
    gridConvergenceDeg: +t.frame.convergenceDeg.toFixed(4),
    gridScale: +t.frame.scale.toFixed(6),
    matchedBy: t.inside.size ? 'outline contains the point' : `${t.take} nearest outline(s) within ${t.radius} m`,
    buildingIds: chosen.map((b) => b.id),
    sheets: [...new Set(chosen.map((b) => b.sheet))],
    triangles,
    heightMetres: +height.toFixed(1),
    bytes: bytes.length,
  });
  console.log(`${t.id}: ${chosen.length} building(s) (${index.at(-1).matchedBy}), ${triangles} triangles, ${height.toFixed(1)} m tall, ${(bytes.length / 1024).toFixed(0)} KB`);
}

writeFileSync(
  path.join(OUT, 'index.json'),
  JSON.stringify(
    {
      source: 'GUGiK, Modele 3D budynków LoD2 (2017), powiat m. Kraków (TERYT 1261)',
      licence: 'CC BY 4.0',
      axes: '+X east, +Y up, -Z north; true metres around origin (grid convergence and scale removed); ground at Y = 0',
      landmarks: index,
    },
    null,
    2,
  ) + '\n',
);
console.log(`${index.length} models -> ${OUT}`);
