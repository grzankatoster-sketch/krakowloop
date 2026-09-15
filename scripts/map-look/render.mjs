// Builds the web app once per map look (basemap style or pin style), photographs the map screen
// at the start zoom and zoomed in, and puts the results on comparison boards in ../05_podglad/mapy/.
// Run: node scripts/map-look/render.mjs   (needs the Mapbox token in .env, internet, and Edge)
// src/config/mapLook.ts is restored afterwards, whatever happens.
import { chromium } from '@playwright/test';
import { execSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '../..');
const CHOICE = path.join(APP, 'src/config/mapLook.ts');
const OUT = path.resolve(APP, '../05_podglad/mapy');
const TMP = path.join(os.tmpdir(), 'krakowloop-looks');
const PORT = 5111;

const STYLES = [
  ['standard', 'Mapbox Standard'],
  ['standard-faded', 'Standard · faded'],
  ['standard-monochrome', 'Standard · monochrome'],
  ['streets', 'Mapbox Streets'],
  ['outdoors', 'Mapbox Outdoors'],
  ['light', 'Mapbox Light'],
];
const PINS = [
  ['dots', 'Kropki (dotychczas)'],
  ['badges', 'Odznaki z ikoną'],
  ['teardrop', 'Pinezki z ikoną'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const original = readFileSync(CHOICE, 'utf8');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

function setLook(style, pins) {
  writeFileSync(CHOICE, original.replace(/\{ style: '[^']*', pins: '[^']*' \}/, `{ style: '${style}', pins: '${pins}' }`));
}

async function serve(dir) {
  const child = spawn('npx', ['--yes', 'serve', '-s', dir, '-l', String(PORT)], { shell: true, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) return child;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error('preview server did not start');
}

function stop(child) {
  try {
    execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
  } catch {
    child.kill();
  }
}

async function photograph(browser, name) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`http://localhost:${PORT}/map`);
  await page.waitForTimeout(18000);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  // zoom into the Main Square to show labels and pin detail
  await page.mouse.move(195, 470);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, -250);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT, `${name}_zoom.png`) });
  await page.close();
}

async function board(browser, file, title, items) {
  const uri = (n) => `data:image/png;base64,${readFileSync(path.join(OUT, `${n}.png`)).toString('base64')}`;
  const cells = items
    .map(([name, label]) => `<figure><div class="pair"><img src="${uri(name)}"><img src="${uri(`${name}_zoom`)}"></div><figcaption>${label}</figcaption></figure>`)
    .join('');
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:28px;background:#DFE4EE;font:18px/1.3 system-ui,sans-serif;color:#1C2550}
    h1{margin:0 0 20px;font-size:26px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
    figure{margin:0}.pair{display:flex;gap:8px}img{width:50%;border-radius:12px;border:1px solid #BCC5D8}
    figcaption{font-weight:700;margin-top:8px}</style><h1>${title}</h1><div class="grid">${cells}</div>`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  await page.close();
}

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const jobs = [
    ...STYLES.map(([style]) => ({ name: `styl_${style}`, style, pins: 'badges' })),
    ...PINS.filter(([p]) => p !== 'badges').map(([pins]) => ({ name: `pins_${pins}`, style: 'standard', pins })),
  ];
  for (const job of jobs) {
    setLook(job.style, job.pins);
    const dir = path.join(TMP, job.name);
    console.log(`building ${job.name}…`);
    execSync(`npx expo export --platform web --output-dir "${dir}"`, { cwd: APP, stdio: 'ignore' });
    const server = await serve(dir);
    try {
      await photograph(browser, job.name);
    } finally {
      stop(server);
      await sleep(1000);
    }
  }
  await board(browser, 'porownanie_stylow.png', 'KrakowLoop · style mapy Mapbox (z pinezkami „odznaki”)', STYLES.map(([s, l]) => [`styl_${s}`, l]));
  await board(
    browser,
    'porownanie_pinezek.png',
    'KrakowLoop · wygląd pinezek (Mapbox Standard)',
    PINS.map(([p, l]) => [p === 'badges' ? 'styl_standard' : `pins_${p}`, l]),
  );
} finally {
  writeFileSync(CHOICE, original);
  await browser.close();
}
console.log(`boards -> ${OUT}`);
