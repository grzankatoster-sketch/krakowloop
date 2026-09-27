import { readFileSync } from 'node:fs';
import { Page, expect, test } from '@playwright/test';

// The welcome shows once, on the first launch: every test starts as a traveller who has seen it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kl.welcome.v1', '1'));
});

/**
 * Exact Directions answers only reach the app when the build has a Mapbox token. Expo takes it from
 * the environment first and from .env otherwise: check both the same way, with or without quotes.
 */
const HAS_MAPBOX_TOKEN = (() => {
  if (/^pk\./.test(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '')) return true;
  try {
    return /^\s*EXPO_PUBLIC_MAPBOX_TOKEN\s*=\s*["']?pk\./m.test(readFileSync('.env', 'utf8'));
  } catch {
    return false;
  }
})();

type MapDebug = {
  ready: boolean;
  points: number;
  route: number;
  models: number;
  routeDrawn: () => number;
  project: (lon: number, lat: number) => { x: number; y: number } | null;
  hit: (x: number, y: number) => string[];
  rendered: () => string[];
};

/** State the map document exposes for tests (window.__krk in mapHtml.ts); route = drawn route vertices. */
async function mapState(page: Page): Promise<{ ready: boolean; points: number; route: number }> {
  const frame = page.frames().find((f) => f.url().startsWith('blob:'));
  if (!frame) return { ready: false, points: 0, route: 0 };
  return frame.evaluate(() => {
    const k = (window as unknown as { __krk?: MapDebug }).__krk;
    return { ready: !!k?.ready, points: k?.points ?? 0, route: k?.route ?? 0 };
  });
}

/**
 * Waits until the ready map shows a route line on screen (true), or has neither route data nor a
 * drawn line (false). A missing or unready map never counts as "no route".
 */
async function expectRouteLine(page: Page, drawn: boolean) {
  const look = expect.poll(
    async () => {
      const frame = page.frames().find((f) => f.url().startsWith('blob:'));
      if (!frame) return 'no map';
      return frame.evaluate(() => {
        const k = (window as unknown as { __krk?: MapDebug }).__krk;
        if (!k?.ready) return 'no map';
        return k.route > 1 && k.routeDrawn() > 0 ? 'line' : k.route === 0 && k.routeDrawn() === 0 ? 'none' : 'partial';
      });
    },
    { timeout: 15_000 },
  );
  await look.toBe(drawn ? 'line' : 'none');
}

/** Ids of the pins the map has actually drawn in view (not the data it was given). */
async function renderedPins(page: Page): Promise<string[]> {
  const frame = page.frames().find((f) => f.url().startsWith('blob:'));
  if (!frame) return [];
  return frame.evaluate(() => (window as unknown as { __krk?: MapDebug }).__krk?.rendered() ?? []);
}

// Main Square, Kraków: a traveller standing in the Old Town
const IN_KRAKOW = { latitude: 50.0617, longitude: 19.9373 };
// Warsaw: far outside the city
const IN_WARSAW = { latitude: 52.2297, longitude: 21.0122 };
const DIRECTIONS = /api\.mapbox\.com\/directions\//;

/** Answers Mapbox walking directions with a fixed route: 10 minutes, 850 metres. */
async function answerDirections(page: Page) {
  const requests: string[] = [];
  await page.route(DIRECTIONS, async (route) => {
    requests.push(route.request().url());
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'Ok',
        routes: [
          {
            distance: 850,
            geometry: { coordinates: [[19.9373, 50.0617], [19.9416, 50.0655]] },
            legs: [{ duration: 600 }],
          },
        ],
      }),
    });
  });
  return requests;
}

/** Discover, sights door: the list lives in the drawer under the map; tap its handle to raise it. */
async function openDrawer(page: Page, path = '/map') {
  await page.goto(path);
  await page.getByRole('button', { name: 'Show more of the list' }).click();
}

/** Scrolls a control to the middle of the screen first: the place page keeps a bar over its bottom edge. */
async function tapClear(target: ReturnType<Page['getByRole']>) {
  await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await target.click();
}

async function openPlaceFromList(page: Page, name: RegExp) {
  await openDrawer(page);
  await page.getByRole('button', { name }).first().click();
}

test.describe('home', () => {
  test('opens on stories of what is near now, with the wish and the map one tap away', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/^KRAKÓW · \d\d:\d\d$/)).toBeVisible();
    await expect(page.getByText('Around the Main Square')).toBeVisible();
    // a story: its name as a heading, and the walk to it as the first thing to tap
    await expect(page.getByRole('heading').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Walk to / }).first()).toBeVisible();
    // the Time Lens tab counts its pages the same way and stays mounted underneath on the web
    await expect(page.getByText(/^1 \/ \d+$/).filter({ visible: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Open the map' }).click();
    await expect(page).toHaveURL(/\/map/);
    await page.goto('/');
    await page.getByRole('button', { name: 'Say what you would like' }).click();
    await expect(page).toHaveURL(/\/wish$/);
  });

  test('"What Kraków is known for" tells seven things, with sources', async ({ page }) => {
    await page.goto('/discover');
    await page.getByRole('link', { name: /^What Kraków is known for\./ }).click();
    await expect(page).toHaveURL(/\/city$/);
    for (const name of ['The royal city', 'World Heritage since 1978', 'The hejnał', 'The Wawel dragon', 'Jewish Kazimierz', 'Obwarzanek', 'Christmas cribs']) {
      await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
    }
    await expect(page.getByRole('link', { name: 'UNESCO World Heritage List: Historic Centre of Kraków' })).toBeVisible();
  });

  test('links to sources and privacy', async ({ page }) => {
    await page.goto('/discover');
    await page.getByRole('link', { name: 'About, sources and privacy' }).click();
    await expect(page.getByText('KrakowLoop has no accounts and no analytics.', { exact: false })).toBeVisible();
  });
});

// The language follows the phone: the browser's language list, the same one it sends as Accept-Language.
test.describe('language from the phone', () => {
  test.describe('German phone', () => {
    test.use({ locale: 'de-DE' });
    test('shows the app in German without any language buttons', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Sag, worauf du Lust hast' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'de');
      await page.getByRole('tab', { name: 'Mein Plan', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Deine Tage in Krakau' })).toBeVisible();
      await page.getByRole('tab', { name: 'Entdecken', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Entdecken' })).toBeVisible();
    });
  });

  test.describe('Polish phone', () => {
    test.use({ locale: 'pl-PL' });
    test('shows the app in Polish', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Powiedz, na co masz ochotę' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Mój plan', exact: true })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Odkrywaj', exact: true })).toBeVisible();
    });
  });

  test.describe('phone in an unsupported language', () => {
    test.use({ locale: 'ja-JP' });
    test('falls back to English', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Say what you would like' })).toBeVisible();
    });
  });
});

test.describe('map', () => {
  test('the map loads its style and draws the places, without an error message', async ({ page }) => {
    await page.goto('/map');
    await expect(page.frameLocator('iframe[title="Map"]').locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await mapState(page)).ready, { timeout: 30_000 }).toBe(true);
    // the data reached the map…
    await expect.poll(async () => (await mapState(page)).points).toBeGreaterThan(40);
    // …and pins were really drawn in view, the Main Square among them (the Cloth Hall stands on it
    // and can give way to the square's own pin when the two would overlap)
    await expect.poll(async () => (await renderedPins(page)).some((id) => id === 'cloth-hall' || id === 'main-square'), { timeout: 20_000 }).toBe(true);
    // the first view is close to the Main Square: only the pins around it are in view
    expect((await renderedPins(page)).length).toBeGreaterThan(3);
    await expect(page.getByText('The map didn’t load')).toHaveCount(0);
  });

  test('tapping a pin on the map opens that place', async ({ page }) => {
    await page.goto('/map');
    await expect.poll(async () => (await mapState(page)).points, { timeout: 30_000 }).toBeGreaterThan(40);
    // the map is ready before its opening flight ends: wait until the camera has come down to the
    // close start view, then a moment for the pins to be placed, before asking where they are
    const map = page.frames().find((f) => f.url().startsWith('blob:'))!;
    await expect.poll(() => map.evaluate(() => (window as unknown as { __krk: { zoom: () => number } }).__krk.zoom()), { timeout: 15_000 }).toBeGreaterThan(16);
    await page.waitForTimeout(1500);

    // Candidates spread over the Old Town. The test taps the first one that is on screen, clear of
    // the edges and the floating buttons, and alone under its point, so it doesn't depend on the
    // start view or on neighbouring pins.
    const candidates = [
      { id: 'st-adalbert', name: "St Adalbert's Church", lon: 19.93774, lat: 50.06089 },
      { id: 'town-hall-tower', name: 'Town Hall Tower', lon: 19.93641, lat: 50.06147 },
      { id: 'small-square', name: 'Small Market Square', lon: 19.94032, lat: 50.06121 },
      { id: 'hipolit-house', name: 'Hipolit House', lon: 19.94012, lat: 50.06195 },
      { id: 'collegium-maius', name: 'Collegium Maius', lon: 19.9337, lat: 50.06165 },
      { id: 'barbican', name: 'Barbican', lon: 19.94163, lat: 50.06546 },
      { id: 'slowacki-theatre', name: 'Słowacki Theatre', lon: 19.94305, lat: 50.06395 },
      { id: 'planty', name: 'Planty Park', lon: 19.94191, lat: 50.06021 },
      { id: 'franciscan', name: 'Franciscan Basilica', lon: 19.9361, lat: 50.05921 },
      { id: 'dominican', name: 'Dominican Basilica', lon: 19.93943, lat: 50.0593 },
      { id: 'dragons-den', name: "Dragon's Den", lon: 19.93358, lat: 50.05342 },
    ];
    const frame = page.frames().find((f) => f.url().startsWith('blob:'))!;
    // pins are placed a little after the map is ready (labels, collisions): ask again until one is found
    const findPick = () => frame.evaluate((list) => {
      const k = (window as unknown as { __krk: MapDebug }).__krk;
      for (const c of list) {
        const p = k.project(c.lon, c.lat);
        if (!p || p.x < 40 || p.y < 40 || p.x > innerWidth - 40 || p.y > innerHeight - 130) continue;
        if (p.x > innerWidth - 170 && p.y < 100) continue;
        const hits = k.hit(p.x, p.y);
        if (hits.length === 1 && hits[0] === c.id) return { ...c, x: p.x, y: p.y };
      }
      return null;
    }, candidates);
    await expect.poll(findPick, { timeout: 15_000 }).not.toBeNull();
    const pick = await findPick();
    expect(pick, 'no candidate pin was alone and on screen at the start view').not.toBeNull();

    const box = (await page.locator('iframe[title="Map"]').boundingBox())!;
    await page.mouse.click(box.x + pick!.x, box.y + pick!.y);
    await expect(page).toHaveURL(new RegExp(`/place/${pick!.id}$`));
    await expect(page.getByRole('heading', { name: pick!.name }).last()).toBeVisible();
  });

  test('raising the drawer over the map takes the covered map out of the focus order', async ({ page }) => {
    await openDrawer(page);
    await expect(page.getByRole('button', { name: /Czartoryski Museum/ })).toBeVisible();
    await page.getByRole('button', { name: 'Show more of the list' }).click();
    await expect(page.locator('iframe[title="Map"]')).toHaveAttribute('tabindex', '-1');
    await expect(page.getByRole('button', { name: 'Near me', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Show the map' }).click();
    await expect(page.locator('iframe[title="Map"]')).toHaveAttribute('tabindex', '0');
  });

  test('a word the app cannot filter by searches the names, accent-insensitive', async ({ page }) => {
    await openDrawer(page);
    await page.getByLabel('Write what you would like to do or eat').fill('koscius');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /Kościuszko Mound/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Wawel Royal Castle/ })).toHaveCount(0);
    await expect(page.getByText(/^Found: 1/)).toBeVisible();
  });

  test('a place from the list opens its page, with the photo and the description', async ({ page }) => {
    await openPlaceFromList(page, /Czartoryski Museum/);
    await expect(page).toHaveURL(/\/place\/czartoryski$/);
    await expect(page.getByRole('heading', { name: 'Czartoryski Museum' }).last()).toBeVisible();
    await expect(page.getByText("Home of Leonardo da Vinci's Lady with an Ermine.")).toBeVisible();
  });

  test('the four doors are tabs that say which one is open, and filters say whether they are on', async ({ page }) => {
    await page.goto('/map');
    const see = page.getByRole('tab', { name: 'See', exact: true });
    const eat = page.getByRole('tab', { name: 'Eat', exact: true });
    await expect(see).toHaveAttribute('aria-selected', 'true');
    await eat.click();
    await expect(eat).toHaveAttribute('aria-selected', 'true');
    await expect(see).toHaveAttribute('aria-selected', 'false');
    const open = page.getByRole('button', { name: 'Open now', exact: true });
    await expect(open).toHaveAttribute('aria-pressed', 'false');
    await open.click();
    await expect(open).toHaveAttribute('aria-pressed', 'true');
  });

  test('"sushi" finds the sushi places, shows what it understood and opens a place card', async ({ page }) => {
    await page.goto('/map');
    await page.getByLabel('Write what you would like to do or eat').fill('sushi');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Eat', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Understood as')).toBeVisible();
    const chip = page.getByRole('button', { name: 'Remove: Sushi' });
    await expect(chip).toBeVisible();
    await page.getByRole('button', { name: /^Megami/ }).click();
    await expect(page.getByRole('heading', { name: 'Megami' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Take me there' })).toBeVisible();
    await expect(page.getByText(/© OpenStreetMap contributors/).first()).toBeVisible();
    // taking the chip back widens the list again
    await page.getByRole('button', { name: 'Back to the list' }).click();
    await chip.click();
    await expect(page.getByRole('button', { name: /^Remove: / })).toHaveCount(0);
  });

  test('the do door lists activities and the stay door offers rooms', async ({ page }) => {
    await openDrawer(page, '/map?mode=do');
    // the Discover tab stays mounted underneath on the web: only the visible list counts
    await expect(page.getByText('Shooting range').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dates and prices on GetYourGuide' }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Stay', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Check prices and free rooms' })).toBeVisible();
  });

  test('keyboard users can reach every place through the list', async ({ page }) => {
    await openDrawer(page);
    const row = page.getByRole('button', { name: /Czartoryski Museum/ });
    await row.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/place\/czartoryski$/);
  });

  test('the stops switch shows tram and bus stops on the map', async ({ page }) => {
    await page.goto('/map');
    await expect.poll(async () => (await mapState(page)).points, { timeout: 30_000 }).toBeGreaterThan(40);
    const before = (await mapState(page)).points;
    await page.getByRole('button', { name: 'Tram and bus stops', exact: true }).click();
    // several hundred bus stops join the tram stops, none of them cut off by the map's point limit
    await expect.poll(async () => (await mapState(page)).points, { timeout: 15_000 }).toBeGreaterThan(before + 900);
  });

  test('the first view is close and tilted, so the buildings read as 3D', async ({ page }) => {
    test.skip(!HAS_MAPBOX_TOKEN, '3D buildings need Mapbox');
    await page.goto('/map');
    await expect.poll(async () => (await mapState(page)).ready, { timeout: 30_000 }).toBe(true);
    const frame = page.frames().find((f) => f.url().startsWith('blob:'))!;
    await expect.poll(() => frame.evaluate(() => (window as unknown as { __krk: { zoom: () => number } }).__krk.zoom()), { timeout: 10_000 }).toBeGreaterThan(16);
  });

  test('the 3D view loads the landmark models', async ({ page }) => {
    test.skip(!HAS_MAPBOX_TOKEN, 'the models need Mapbox: MapLibre has no model layer');
    const glb: string[] = [];
    page.on('response', (r) => {
      if (/\/models\/[\w-]+\.glb$/.test(r.url()) && r.ok()) glb.push(r.url());
    });
    await page.goto('/map');
    await expect.poll(async () => (await mapState(page)).ready, { timeout: 30_000 }).toBe(true);
    const frame = page.frames().find((f) => f.url().startsWith('blob:'))!;
    expect(await frame.evaluate(() => (window as unknown as { __krk: MapDebug }).__krk.models)).toBe(5);
    // the map is always 3D: the files load without pressing anything
    await expect.poll(() => new Set(glb).size, { timeout: 30_000 }).toBeGreaterThan(0);
  });
});

test.describe('planner', () => {
  test('a wish written in the traveller’s own words sets the plan up', async ({ page }) => {
    await page.goto('/plan');
    await page.getByRole('button', { name: 'Set the details first' }).click();
    await page.getByLabel('Tell us what you would like').fill('two calm days, quads and a shooting range, good dinners, we do not want to walk much');
    // the note says who reads it: the phone, or (with a proxy in .env) the language model behind it
    await expect(page.getByText(/^Read on your phone, nothing is sent anywhere\.$|^Your words go to our server/)).toBeVisible();
    await page.getByRole('button', { name: 'Read my wish' }).click();
    await expect(page.getByText('Read. The choices below were set from it', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: '2 days' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('radio', { name: 'Easy' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Build my plan' }).click();
    // the wishes travel in the link, so the plan can be shared and rebuilt
    await expect(page).toHaveURL(/walk=low/);
    await expect(page).toHaveURL(/dine=1/);
    // both activities, in whichever order they were read
    await expect(page).toHaveURL(/acts=[^&]*1(%3A|:)quads/);
    await expect(page).toHaveURL(/acts=[^&]*1(%3A|:)shooting/);
    // the activities asked for wait in the day, and a place to eat is in the stops
    await expect(page.getByRole('heading', { name: 'To arrange for this day' })).toBeVisible();
    // the Discover tab lists the same activities and stays mounted underneath on the web
    await expect(page.getByText('Shooting range').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('Quad biking off-road').filter({ visible: true }).first()).toBeVisible();
  });

  test('a wish the app cannot read changes nothing and says so', async ({ page }) => {
    await page.goto('/plan');
    await page.getByRole('button', { name: 'Set the details first' }).click();
    await page.getByLabel('Tell us what you would like').fill('surprise me completely');
    await page.getByRole('button', { name: 'Read my wish' }).click();
    await expect(page.getByText('Nothing in there matched what the app can do. Choose below instead.')).toBeVisible();
    await expect(page.getByRole('button', { name: '2 days' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('"Show me another plan" gives different days, and the link keeps them', async ({ page }) => {
    await page.goto('/plan?days=2&pace=steady&likes=history&trips=0');
    const stopNames = async () => Promise.all((await page.getByRole('link', { name: /^Open / }).all()).map((l) => l.getAttribute('aria-label')));
    await expect(page.getByRole('button', { name: 'Show me another plan' })).toBeVisible();
    const before = (await stopNames()).join('|');
    let after = before;
    // one shuffle can land on the same days by chance; three in a row practically never do
    for (let i = 0; i < 3 && after === before; i++) {
      await page.getByRole('button', { name: 'Show me another plan' }).click();
      await expect(page).toHaveURL(/[?&]seed=\d+/);
      await expect.poll(async () => (await stopNames()).length).toBeGreaterThan(0);
      after = (await stopNames()).join('|');
    }
    expect(after).not.toBe(before);
    // the same link, opened again, shows the same days
    await page.goto(page.url());
    await expect.poll(async () => (await stopNames()).join('|')).toBe(after);
  });

  test('a taxi leg hands the ride to Uber with the destination filled in', async ({ page }) => {
    // record what the page asks the browser to open instead of leaving the test
    await page.addInitScript(() => {
      const opened: string[] = [];
      (window as unknown as { __opened: string[] }).__opened = opened;
      window.open = ((url?: string | URL) => {
        opened.push(String(url));
        return null;
      }) as typeof window.open;
    });
    // day 3 of this plan reaches Zakrzówek by taxi (the lake is far from any tram)
    await page.goto('/plan?days=3&pace=easy&likes=views&trips=0');
    await page.getByRole('button', { name: 'Day 3', exact: true }).click();
    await expect(page.getByText(/^Taxi, about/).first()).toBeVisible();
    await expect(page.getByText('Uber and Bolt receive this destination.', { exact: false }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Order an Uber' }).first().click();
    const opened = await expect
      .poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened))
      .toHaveLength(1)
      .then(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened[0]));
    const url = new URL(opened);
    expect(url.origin + url.pathname).toBe('https://m.uber.com/looking');
    expect(url.searchParams.has('pickup')).toBe(false);
    expect(JSON.parse(url.searchParams.get('drop[0]') ?? '{}')).toMatchObject({ addressLine1: 'Zakrzówek' });
  });

  // three days: the day trip takes the middle one, so Monday and Wednesday are city days
  const MONDAY_PLAN = '/plan?days=3&pace=steady&likes=history,museums&trips=1&date=2026-10-12';
  const SUMMARY = '3 days · Steady · History, Museums · from Mon 12 Oct';

  test('a plan link opens the plan first, with dated days and closures', async ({ page }) => {
    await page.goto(MONDAY_PLAN);
    await expect(page.getByText(SUMMARY, { exact: true })).toBeVisible();
    // other museums closed on Mondays may be listed too; the Czartoryski Museum must be among them
    await expect(page.getByText(/^Closed that day, so left out: .*\bCzartoryski Museum\b/)).toBeVisible();
    await expect(page.getByText('How many days are you in Kraków?')).toHaveCount(0);
  });

  test('switching days shows the other day and back', async ({ page }) => {
    await page.goto(MONDAY_PLAN);
    const day1Title = await page.getByRole('heading').nth(1).textContent();
    await page.getByRole('button', { name: 'Day 2 · Tue 13 Oct' }).click();
    // with day trips on and no mountains or remembrance chosen, the middle day is the Wieliczka trip
    await expect(page.getByRole('heading', { name: 'Wieliczka Salt Mine' })).toBeVisible();
    await expect(page.getByText(/^About \d+ min each way by road · /)).toBeVisible();
    await page.getByRole('button', { name: 'Day 1 · Mon 12 Oct' }).click();
    await expect(page.getByRole('heading', { name: day1Title ?? '' })).toBeVisible();
  });

  test('changing settings: Keep my plan discards them, Rebuild applies them and survives a reload', async ({ page }) => {
    await page.goto(MONDAY_PLAN);
    await page.getByRole('button', { name: 'Change' }).click();
    await page.getByRole('radio', { name: 'Easy' }).click();
    await page.getByRole('button', { name: 'Keep my plan' }).click();
    await expect(page.getByText(SUMMARY, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Change' }).click();
    await page.getByRole('radio', { name: 'Easy' }).click();
    // interests sit behind Preferences, closed at first so the form is three short questions
    await page.getByRole('button', { name: /^Preferences/ }).click();
    await page.getByRole('checkbox', { name: 'Views & parks' }).click();
    await page.getByRole('button', { name: 'Build a new plan' }).click();
    const changed = '3 days · Easy · History, Museums, Views & parks · from Mon 12 Oct';
    await expect(page.getByText(changed, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(changed, { exact: true })).toBeVisible();
  });

  test('skipping a stop rebuilds the plan and can be undone', async ({ page }) => {
    await page.goto(MONDAY_PLAN);
    const firstSkip = page.getByRole('button', { name: /^Skip / }).first();
    const skipped = ((await firstSkip.getAttribute('aria-label')) ?? '').replace(/^Skip /, '');
    await firstSkip.click();
    await expect(page).toHaveURL(/skip=/);
    await expect(page.getByRole('button', { name: `Skip ${skipped}` })).toHaveCount(0);
    await page.getByRole('button', { name: 'Bring back skipped (1)' }).click();
    await expect(page.getByRole('button', { name: `Skip ${skipped}` })).toBeVisible();
  });

  test('a broken date in a link is ignored instead of crashing', async ({ page }) => {
    await page.goto('/plan?days=4&pace=full&likes=history&trips=1&date=0100-01-01');
    // the summary names no start date at all: it ends right after the interests
    await expect(page.getByText('4 days · Full · History', { exact: true })).toBeVisible();
  });

  test('building a plan from the form puts it in the URL', async ({ page }) => {
    await page.goto('/plan');
    await page.getByRole('button', { name: 'Set the details first' }).click();
    await page.getByRole('button', { name: '1 day' }).click();
    await page.getByRole('button', { name: 'Build my plan' }).click();
    await expect(page).toHaveURL(/days=1/);
    await expect(page.getByText(/^1 day · Steady/)).toBeVisible();
  });

  test('a copied share link opens the same plan', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    await context.addInitScript(() => localStorage.setItem('kl.welcome.v1', '1'));
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await page.goto(MONDAY_PLAN);
    await page.getByRole('button', { name: 'Share this plan' }).click();
    await expect(page.getByText('Link copied.')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const url = new URL(copied);
    expect(url.pathname).toBe('/plan');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      days: '3',
      pace: 'steady',
      likes: 'history,museums',
      trips: '1',
      date: '2026-10-12',
    });
    const reopened = await context.newPage();
    await reopened.goto(copied);
    await expect(reopened.getByText(SUMMARY, { exact: true })).toBeVisible();
    await context.close();
  });
});

test.describe('place page', () => {
  test('one button opens the ride choices, and they close again', async ({ page }) => {
    await page.goto('/place/wawel-castle');
    const toggle = page.getByRole('button', { name: 'Get a ride' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Order an Uber' })).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Order an Uber' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Bolt' })).toBeVisible();
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Order an Uber' })).toHaveCount(0);
  });

  test('shows the week of opening hours, trams and buses nearby, and links', async ({ page }) => {
    await page.goto('/place/czartoryski');
    await expect(page.getByRole('heading', { name: 'Czartoryski Museum' }).last()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Opening hours' })).toBeVisible();
    // closed on Mondays in every month of the data
    const monday = page.getByText(/^Monday/).locator('..');
    await expect(monday).toContainText('Closed');
    await expect(page.getByText('Tuesday', { exact: false }).locator('..')).toContainText('10:00–18:00');
    await expect(page.getByRole('heading', { name: 'Trams and buses nearby' })).toBeVisible();
    await expect(page.getByText(/^Tram \d/).first()).toBeVisible();
    await expect(page.getByText(/^Bus \d/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Official website' })).toBeVisible();
  });

  test('"Walk here" hands the walk to the phone’s maps app, with the place as the destination', async ({ page }) => {
    await page.addInitScript(() => {
      const opened: string[] = [];
      (window as unknown as { __opened: string[] }).__opened = opened;
      window.open = ((url?: string | URL) => {
        opened.push(String(url));
        return null;
      }) as typeof window.open;
    });
    await page.goto('/place/barbican');
    await page.getByRole('button', { name: 'Walk to Barbican', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toHaveLength(1);
    const url = new URL(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened[0]));
    // a desktop test browser is not an iPhone, so Google Maps
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('destination')).toBe('50.065460,19.941630');
    expect(url.searchParams.get('travelmode')).toBe('walking');
  });

  test('the route on the place page map: shown, and gone again after a failed retry', async ({ browser }) => {
    test.skip(!HAS_MAPBOX_TOKEN, 'needs a Mapbox token in .env: without one the app never asks for a route');
    const context = await browser.newContext({ geolocation: IN_KRAKOW, permissions: ['geolocation'] });
    await context.addInitScript(() => localStorage.setItem('kl.welcome.v1', '1'));
    const page = await context.newPage();
    const requests = await answerDirections(page);
    await page.goto('/place/barbican');
    await tapClear(page.getByRole('button', { name: 'Show the route on this map' }));
    await expect(page.getByText('10 min walk · 850 m', { exact: true })).toBeVisible({ timeout: 30_000 });
    expect(requests[0]).toContain('/walking/19.93730,50.06170;19.94163,50.06546');
    await expectRouteLine(page, true);
    // location access is taken away and the traveller tries again: the old route must not stay
    await context.clearPermissions();
    await tapClear(page.getByRole('button', { name: 'Show the route on this map' }));
    await expect(page.getByText(/Location access|Your location could not be found/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('10 min walk · 850 m', { exact: true })).toHaveCount(0);
    await expectRouteLine(page, false);
    await context.close();
  });

  test('walk here on the place page falls back to an estimate when routing fails', async ({ browser }) => {
    const context = await browser.newContext({ geolocation: IN_KRAKOW, permissions: ['geolocation'] });
    await context.addInitScript(() => localStorage.setItem('kl.welcome.v1', '1'));
    const page = await context.newPage();
    let aborted = 0;
    await page.route(DIRECTIONS, (route) => {
      aborted += 1;
      return route.abort();
    });
    await page.goto('/place/barbican');
    await tapClear(page.getByRole('button', { name: 'Show the route on this map' }));
    await expect(page.getByText(/\d+ min walk · .+ \(estimate\)/)).toBeVisible({ timeout: 30_000 });
    if (HAS_MAPBOX_TOKEN) expect(aborted).toBe(1);
    await context.close();
  });

  test('the route from outside Kraków is not drawn, and says why', async ({ browser }) => {
    const context = await browser.newContext({ geolocation: IN_WARSAW, permissions: ['geolocation'] });
    await context.addInitScript(() => localStorage.setItem('kl.welcome.v1', '1'));
    const page = await context.newPage();
    const requests = await answerDirections(page);
    await page.goto('/place/barbican');
    await tapClear(page.getByRole('button', { name: 'Show the route on this map' }));
    await expect(page.getByText('You seem to be outside Kraków, so there is no walking route to show.')).toBeVisible();
    expect(requests).toHaveLength(0);
    await context.close();
  });

  test('says so when the place has no hours in the data', async ({ page }) => {
    await page.goto('/place/main-square');
    await expect(page.getByText('We have no opening hours for this place. The official website has them.')).toBeVisible();
  });

  test('an unknown place explains what to do', async ({ page }) => {
    await page.goto('/place/nope');
    await expect(page.getByText('This place isn’t in KrakowLoop. Go back and pick one from the map.')).toBeVisible();
  });

  test('opens from the map list and from a plan stop', async ({ page }) => {
    await openPlaceFromList(page, /Czartoryski Museum/);
    await expect(page).toHaveURL(/\/place\/czartoryski$/);

    await page.goto('/plan?days=1&pace=steady&likes=history&trips=0');
    const firstStop = page.getByRole('link', { name: /^Open / }).first();
    const name = ((await firstStop.getAttribute('aria-label')) ?? '').replace(/^Open /, '');
    await firstStop.click();
    await expect(page).toHaveURL(/\/place\//);
    await expect(page.getByRole('heading', { name }).last()).toBeVisible();
  });
});

test.describe('day trips', () => {
  test('lists trips with road time and opens their place page', async ({ page }) => {
    await page.goto('/discover');
    await page.getByRole('link', { name: /^Day trips\./ }).click();
    await expect(page).toHaveURL(/\/trips$/);
    await expect(page.getByText(/^About \d+( h)?( \d+)? min each way|^About \d+ h each way/).first()).toBeVisible();
    await page.getByRole('link', { name: 'Open Wieliczka Salt Mine' }).click();
    await expect(page).toHaveURL(/\/place\/wieliczka$/);
  });

  test('the memorial is linked only to its official website', async ({ page }) => {
    // record what the page asks the browser to open instead of leaving the test
    await page.addInitScript(() => {
      const opened: string[] = [];
      (window as unknown as { __opened: string[] }).__opened = opened;
      window.open = ((url?: string | URL) => {
        opened.push(String(url));
        return null;
      }) as typeof window.open;
    });
    await page.goto('/trips');
    const name = page.getByRole('link', { name: 'Open Auschwitz-Birkenau Memorial' });
    await expect(name).toBeVisible();
    await expect(name).toHaveAttribute('href', '/place/auschwitz');
    // the smallest block holding both the name and its button is the memorial's card
    const card = page
      .locator('div')
      .filter({ has: name })
      .filter({ has: page.getByRole('button', { name: 'Reserve on the official website' }) })
      .last();
    await expect(card).not.toContainText('Advertising (affiliate) link');
    await card.getByRole('button', { name: 'Reserve on the official website' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __opened: string[] }).__opened))
      .toEqual([expect.stringMatching(/^https:\/\/visit\.auschwitz\.org(\/|$)/)]);
  });
});

test.describe('open now', () => {
  /** The row of a place in the list: its name link and status line. */
  const row = (page: Page, name: string) =>
    page.locator('div').filter({ has: page.getByRole('link', { name: `Open ${name}` }) }).filter({ hasText: ' · ' }).last();

  // every moment carries its UTC offset, so neither the test process nor the browser zone changes it
  test('on a Tuesday morning the Czartoryski Museum is open until 18:00', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-13T11:00:00+02:00'));
    await page.goto('/now');
    await expect(page).toHaveURL(/\/now$/);
    await expect(page.getByRole('heading', { name: /^Open now · \d+$/ })).toBeVisible();
    await expect(row(page, 'Czartoryski Museum')).toContainText(/Museums\s*(·\s*)?Closes 18:00/);
  });

  test('on a Monday it is closed all day, and the museum filter keeps it', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-12T11:00:00+02:00'));
    await page.goto('/now');
    await expect(row(page, 'Czartoryski Museum')).toContainText('Closed today');
    await page.getByRole('button', { name: 'Museums' }).click();
    await expect(row(page, 'Czartoryski Museum')).toContainText('Closed today');
    // only museums remain
    await expect(page.getByText(/^Sights · /)).toHaveCount(0);
  });

  test('shortly before closing it says how long is left', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-13T17:20:00+02:00'));
    await page.goto('/now');
    await expect(row(page, 'Czartoryski Museum')).toContainText('Closes 18:00, in 40 min');
  });

  test('a phone still on New York time sees Kraków hours', async ({ browser }) => {
    const context = await browser.newContext({ timezoneId: 'America/New_York' });
    await context.addInitScript(() => localStorage.setItem('kl.welcome.v1', '1'));
    const page = await context.newPage();
    // 18:20 in Kraków is 12:20 in New York: the museum closed 20 minutes ago
    await page.clock.setFixedTime(new Date('2026-10-13T18:20:00+02:00'));
    await page.goto('/now');
    await expect(page.getByText(/18:20 in Kraków/)).toBeVisible();
    await expect(row(page, 'Czartoryski Museum')).toContainText('Closed for the rest of today');
    await context.close();
  });

  test('keyboard focus stays on a place when the clock moves it to another group', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-13T17:59:30+02:00') });
    await page.goto('/now');
    const link = page.getByRole('link', { name: 'Open Czartoryski Museum' });
    await link.focus();
    await expect(link).toBeFocused();
    await page.clock.runFor(35_000);
    await expect(row(page, 'Czartoryski Museum')).toContainText('Closed for the rest of today');
    await expect(page.getByRole('link', { name: 'Open Czartoryski Museum' })).toBeFocused();
  });

  test('the list moves on by itself when a place closes', async ({ page }) => {
    // open the screen in the middle of the last minute
    await page.clock.install({ time: new Date('2026-10-13T17:59:30+02:00') });
    await page.goto('/now');
    await expect(row(page, 'Czartoryski Museum')).toContainText('Closes 18:00, in 1 min');
    await page.clock.runFor(35_000);
    await expect(row(page, 'Czartoryski Museum')).toContainText('Closed for the rest of today');
  });
});

test.describe('about', () => {
  test('jumps to a section and opens the place photo credits on demand', async ({ page }) => {
    await page.goto('/about');
    await page.getByRole('button', { name: 'Go to Images' }).click();
    // focus follows the jump, so the keyboard and screen readers carry on from the section
    await expect(page.getByRole('heading', { name: 'Images' })).toBeFocused();
    const placePhotos = page.getByRole('button', { name: /Place photos \(\d+\)/ });
    await expect(page.getByRole('heading', { name: 'Images' })).toBeInViewport();
    await placePhotos.scrollIntoViewIfNeeded();
    await expect(placePhotos).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Barbican', { exact: true })).toHaveCount(0);
    await placePhotos.click();
    await expect(placePhotos).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Barbican', { exact: true })).toBeVisible();
    await placePhotos.click();
    await expect(placePhotos).toHaveAttribute('aria-expanded', 'false');
    // closed credits leave the page, and with them the keyboard order
    await expect(page.getByText('Barbican', { exact: true })).toHaveCount(0);
  });
});

test.describe('Time Lens', () => {
  test('the list opens a place on its oldest photo, with the camera as an extra', async ({ page }) => {
    await page.goto('/lens');
    await page.getByRole('button', { name: /^Cloth Hall/ }).click();
    // the list screen stays mounted underneath on web, so the viewer's caption is the last match
    await expect(page.getByText('Stand at: Main Square, facing the Cloth Hall').last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Photo from 1870' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Cloth Hall with cabs and market stalls').last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Compare with my camera' })).toBeVisible();
  });

  test('year buttons switch between then and now', async ({ page }) => {
    await page.goto('/lens/cloth-hall');
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('The Cloth Hall and the Main Square today, seen from above')).toBeVisible();
    await page.getByRole('button', { name: 'Photo from c.1880' }).click();
    await expect(page.getByLabel('Cloth Hall, west side')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Today', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });

  test('engravings are shown as artist views, and a refused camera is explained', async ({ browser }) => {
    const context = await browser.newContext({ permissions: [] });
    await context.addInitScript(() => localStorage.setItem('kl.welcome.v1', '1'));
    const page = await context.newPage();
    await page.goto('/lens/wawel');
    await expect(page.getByRole('heading', { name: 'Artist’s views' })).toBeVisible();
    await expect(page.getByText('1617 · Wawel at the end of the 16th century')).toBeVisible();
    await page.getByRole('button', { name: 'Compare with my camera' }).click();
    await expect(page.getByText(/Camera access was not allowed|does not offer a camera|could not be started/)).toBeVisible({ timeout: 20_000 });
    await context.close();
  });

  test('an unknown place explains what to do', async ({ page }) => {
    await page.goto('/lens/nope');
    await expect(page.getByText('This place isn’t in the list. Go back and pick one.')).toBeVisible();
  });
});
