import { Page, expect, test } from '@playwright/test';

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

async function openPlaceFromList(page: Page, name: RegExp) {
  await page.goto('/map');
  await page.getByRole('button', { name: 'Show list' }).click();
  await page.getByRole('button', { name }).click();
}

test.describe('home', () => {
  test('starts with the three doors and opens the map', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'KrakowLoop' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open the map|Plan my days|Time Lens/ })).toHaveCount(3);
    await page.getByRole('button', { name: /Open the map/ }).click();
    await expect(page).toHaveURL(/\/map$/);
  });

  test('links to sources and privacy', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'About, sources and privacy' }).click();
    await expect(page.getByText('KrakowLoop has no accounts and no analytics.', { exact: false })).toBeVisible();
  });
});

test.describe('map', () => {
  test('the map really draws, without an error message', async ({ page }) => {
    await page.goto('/map');
    await expect(page.frameLocator('iframe[title="Map"]').locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('The map didn’t load')).toHaveCount(0);
  });

  test('switches to the list and takes the covered map out of the focus order', async ({ page }) => {
    await page.goto('/map');
    await page.getByRole('button', { name: 'Show list' }).click();
    await expect(page.getByRole('button', { name: /Wawel Royal Castle/ })).toBeVisible();
    await expect(page.locator('iframe[title="Map"]')).toHaveAttribute('tabindex', '-1');
    await expect(page.getByRole('button', { name: 'Show where I am' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Show map' }).click();
    await expect(page.locator('iframe[title="Map"]')).toHaveAttribute('tabindex', '0');
  });

  test('search narrows the list, accent-insensitive', async ({ page }) => {
    await page.goto('/map');
    await page.getByRole('button', { name: 'Show list' }).click();
    await page.getByLabel('Search places').fill('koscius');
    await expect(page.getByRole('button', { name: /Kościuszko Mound/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Wawel Royal Castle/ })).toHaveCount(0);
  });

  test('a place from the list opens a card with details', async ({ page }) => {
    await openPlaceFromList(page, /Czartoryski Museum/);
    await expect(page.getByRole('heading', { name: 'Czartoryski Museum' })).toBeVisible();
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByText("Home of Leonardo da Vinci's Lady with an Ermine.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Official website' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Czartoryski Museum' }).click();
    await expect(page.getByRole('heading', { name: 'Czartoryski Museum' })).toHaveCount(0);
  });

  test('walk here shows the route answer: exact minutes and distance, from the traveller', async ({ browser }) => {
    const context = await browser.newContext({ geolocation: IN_KRAKOW, permissions: ['geolocation'] });
    const page = await context.newPage();
    const requests = await answerDirections(page);
    await openPlaceFromList(page, /Barbican/);
    await page.getByRole('button', { name: 'Walk here' }).click();
    await expect(page.getByText('10 min walk · 850 m', { exact: true })).toBeVisible({ timeout: 30_000 });
    expect(requests).toHaveLength(1);
    // the route starts at the traveller and ends at the Barbican
    expect(requests[0]).toContain('/walking/19.93730,50.06170;19.94163,50.06546');
    await context.close();
  });

  test('walk here falls back to an estimate when routing fails', async ({ browser }) => {
    const context = await browser.newContext({ geolocation: IN_KRAKOW, permissions: ['geolocation'] });
    const page = await context.newPage();
    await page.route(DIRECTIONS, (route) => route.abort());
    await openPlaceFromList(page, /Barbican/);
    await page.getByRole('button', { name: 'Walk here' }).click();
    await expect(page.getByText(/\d+ min walk · .+ \(estimate\)/)).toBeVisible({ timeout: 30_000 });
    await context.close();
  });

  test('walk here without location access explains why, and the list still works', async ({ browser }) => {
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    const requests = await answerDirections(page);
    await openPlaceFromList(page, /Barbican/);
    await page.getByRole('button', { name: 'Walk here' }).click();
    await expect(page.getByText(/Location access|Your location could not be found/).first()).toBeVisible({ timeout: 30_000 });
    expect(requests).toHaveLength(0);
    await page.getByRole('button', { name: 'Show list' }).click();
    await expect(page.getByRole('button', { name: /Wawel Royal Castle/ })).toBeVisible();
    await context.close();
  });

  test('walk here from outside Kraków draws no route', async ({ browser }) => {
    const context = await browser.newContext({ geolocation: IN_WARSAW, permissions: ['geolocation'] });
    const page = await context.newPage();
    const requests = await answerDirections(page);
    await openPlaceFromList(page, /Barbican/);
    await page.getByRole('button', { name: 'Walk here' }).click();
    await expect(page.getByText('You seem to be outside Kraków, so there is no walking route to show.')).toBeVisible();
    expect(requests).toHaveLength(0);
    await context.close();
  });
});

test.describe('planner', () => {
  const MONDAY_PLAN = '/plan?days=2&pace=steady&likes=history,museums&trips=1&date=2026-10-12';
  const SUMMARY = '2 days · Steady · History, Museums · from Mon 12 Oct';

  test('a plan link opens the plan first, with dated days and closures', async ({ page }) => {
    await page.goto(MONDAY_PLAN);
    await expect(page.getByText(SUMMARY, { exact: true })).toBeVisible();
    await expect(page.getByText('Closed that day, so left out: Czartoryski Museum.')).toBeVisible();
    await expect(page.getByText('How many days are you in Kraków?')).toHaveCount(0);
  });

  test('switching days shows the other day and back', async ({ page }) => {
    await page.goto(MONDAY_PLAN);
    const day1Title = await page.getByRole('heading').nth(1).textContent();
    await page.getByRole('button', { name: 'Day 2 · Tue 13 Oct' }).click();
    // with day trips on and no mountains or remembrance chosen, day 2 is the Wieliczka trip
    await expect(page.getByRole('heading', { name: 'Wieliczka Salt Mine' })).toBeVisible();
    await expect(page.getByText(/Full day out of Kraków · about \d+ min each way by road/)).toBeVisible();
    await page.getByRole('button', { name: 'Day 1 · Mon 12 Oct' }).click();
    await expect(page.getByRole('heading', { name: day1Title ?? '' })).toBeVisible();
  });

  test('changing settings: Keep my plan discards them, Rebuild applies them and survives a reload', async ({ page }) => {
    await page.goto(MONDAY_PLAN);
    await page.getByRole('button', { name: 'Change' }).click();
    await page.getByRole('button', { name: 'Easy' }).click();
    await page.getByRole('button', { name: 'Keep my plan' }).click();
    await expect(page.getByText(SUMMARY, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Change' }).click();
    await page.getByRole('button', { name: 'Easy' }).click();
    await page.getByRole('button', { name: 'Views & parks' }).click();
    await page.getByRole('button', { name: 'Rebuild my loops' }).click();
    const changed = '2 days · Easy · History, Museums, Views & parks · from Mon 12 Oct';
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
    await page.getByRole('button', { name: '1 day' }).click();
    await page.getByRole('button', { name: 'Build my loops' }).click();
    await expect(page).toHaveURL(/days=1/);
    await expect(page.getByText(/^1 day · Steady/)).toBeVisible();
  });

  test('a copied share link opens the same plan', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
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
      days: '2',
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

test.describe('Time Lens', () => {
  const OVERLAY = '[aria-label="Cloth Hall with cabs and market stalls"]';
  const transformOf = (page: Page) => page.locator(OVERLAY).last().evaluate((el) => getComputedStyle(el).transform);

  test('the list opens a viewpoint with its controls in reach', async ({ page }) => {
    await page.goto('/lens');
    await page.getByRole('button', { name: /^Cloth Hall/ }).click();
    // the list screen stays mounted underneath on web, so the viewer's caption is the last match
    await expect(page.getByText('Stand at: Main Square, facing the Cloth Hall').last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use my camera' })).toBeVisible();
    await expect(page.getByLabel('See-through')).toBeVisible();
  });

  test('move buttons really move the picture, and Reset puts it back', async ({ page }) => {
    await page.goto('/lens/cloth-hall');
    await page.getByRole('button', { name: 'Adjust & sources' }).click();
    const start = await transformOf(page);
    const seen = new Set([start]);
    for (const name of ['Move picture left', 'Move picture up', 'Move picture right', 'Move picture down']) {
      await page.getByRole('button', { name }).click();
      await expect.poll(() => transformOf(page)).not.toBe([...seen].pop());
      seen.add(await transformOf(page));
    }
    await page.getByRole('button', { name: 'Move picture left' }).click();
    await expect.poll(() => transformOf(page)).not.toBe(start);
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect.poll(() => transformOf(page)).toBe(start);
  });

  test('an unknown viewpoint explains what to do', async ({ page }) => {
    await page.goto('/lens/nope');
    await expect(page.getByText('This viewpoint doesn’t exist. Go back and pick one from the list.')).toBeVisible();
  });
});
