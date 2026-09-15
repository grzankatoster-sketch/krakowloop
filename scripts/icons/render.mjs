// Renders the app icon variants from scripts/icons/icon.html with the installed Microsoft Edge.
// Run: node scripts/icons/render.mjs [variant-to-install]
//   no argument: renders every variant into ../05_podglad/ikony/ plus a comparison board
//   with a variant name (loop | spire | monogram): also writes that variant into assets/
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '../..');
const PREVIEW = path.resolve(APP, '../05_podglad/ikony');
const PAGE = pathToFileURL(path.join(here, 'icon.html')).href;
const VARIANTS = ['loop', 'spire', 'monogram'];
const GROUND = { loop: '#1C2550', spire: '#DFE4EE', monogram: '#1C2550' };
const install = process.argv[2];
if (install && !VARIANTS.includes(install)) throw new Error(`unknown variant ${install}`);

mkdirSync(PREVIEW, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });

async function shot(variant, mode, file, size = 1024, transparent = false) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: size / 1024 });
  await page.goto(`${PAGE}?v=${variant}&mode=${mode}`);
  await page.waitForSelector('body[data-ready="1"]');
  await page.locator('#out').screenshot({ path: file, omitBackground: transparent });
  await page.close();
}

for (const v of VARIANTS) {
  await shot(v, 'icon', path.join(PREVIEW, `${v}_icon.png`), 512);
}

// comparison board: each variant large, as a phone home-screen tile and at favicon size.
// Images are inlined as data URIs: a page set with setContent can't load file:// URLs.
const board = await browser.newPage({ viewport: { width: 1200, height: 760 } });
const dataUri = (v) => `data:image/png;base64,${readFileSync(path.join(PREVIEW, `${v}_icon.png`)).toString('base64')}`;
const tiles = VARIANTS.map(
  (v) => `<figure><img class="big" src="${dataUri(v)}">
    <div class="small"><img class="app" src="${dataUri(v)}"><span>KrakowLoop</span>
    <img class="fav" src="${dataUri(v)}"></div>
    <figcaption>${{ loop: 'A · Loop', spire: 'B · Mariacki', monogram: 'C · Monogram' }[v]}</figcaption></figure>`,
).join('');
await board.setContent(`<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:32px;background:#DFE4EE;font:18px/1.3 system-ui,sans-serif;color:#1C2550}
  h1{margin:0 0 24px;font-size:26px} .row{display:flex;gap:40px}
  figure{margin:0;display:flex;flex-direction:column;gap:14px;align-items:center}
  .big{width:300px;height:300px;border-radius:66px;box-shadow:0 10px 30px rgba(28,37,80,.25)}
  .small{display:flex;align-items:center;gap:12px;background:#1C2550;color:#fff;padding:12px 16px;border-radius:16px}
  .app{width:64px;height:64px;border-radius:15px}.fav{width:16px;height:16px}
  figcaption{font-weight:700;font-size:20px}
</style><h1>KrakowLoop · ikona aplikacji: 3 warianty</h1><div class="row">${tiles}</div>`);
await board.waitForTimeout(500);
await board.screenshot({ path: path.join(PREVIEW, 'porownanie_ikon.png') });
await board.close();

if (install) {
  const assets = path.join(APP, 'assets');
  await shot(install, 'icon', path.join(assets, 'icon.png'), 1024);
  await shot(install, 'foreground', path.join(assets, 'android-icon-foreground.png'), 1024, true);
  await shot(install, 'mono', path.join(assets, 'android-icon-monochrome.png'), 1024, true);
  await shot(install, 'foreground', path.join(assets, 'splash-icon.png'), 1024, true);
  await shot(install, 'icon', path.join(assets, 'favicon.png'), 48);
  console.log(`installed "${install}" into assets/ (Android background colour ${GROUND[install]})`);
}

await browser.close();
console.log(`variants and board -> ${PREVIEW}`);
