import { expect, test } from '@playwright/test';

// Main Square, Kraków: a traveller standing in the Old Town
const IN_KRAKOW = { latitude: 50.0617, longitude: 19.9373 };

test.describe('home', () => {
  test('starts with the three doors and opens the map', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'KrakowLoop' })).toBeVisible();
    const doors = page.getByRole('button', { name: /Open the map|Plan my days|Time Lens/ });
    await expect(doors).toHaveCount(3);
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
  test('loads the map document and switches to the list', async ({ page }) => {
    await page.goto('/map');
    await expect(page.locator('iframe[title="Map"]')).toBeAttached();
    await page.getByRole('button', { name: 'Show list' }).click();
    await expect(page.getByRole('button', { name: /Wawel Royal Castle/ })).toBeVisible();
    // the covered map leaves the keyboard order and the floating buttons disappear
    await expect(page.locator('iframe[title="Map"]')).toHaveAttribute('tabindex', '-1');
    await expect(page.getByRole('button', { name: 'Show where I am' })).toHaveCount(0);
  });

  test('search narrows the list, accent-insensitive', async ({ page }) => {
    await page.goto('/map');
    await page.getByRole('button', { name: 'Show list' }).click();
    await page.getByLabel('Search places').fill('koscius');
    await expect(page.getByRole('button', { name: /Kościuszko Mound/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Wawel Royal Castle/ })).toHaveCount(0);
  });

  test('a place from the list opens a card with details', async ({ page }) => {
    await page.goto('/map');
    await page.getByRole('button', { name: 'Show list' }).click();
    await page.getByRole('button', { name: /Czartoryski Museum/ }).click();
    await expect(page.getByRole('heading', { name: 'Czartoryski Museum' })).toBeVisible();
    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByText("Home of Leonardo da Vinci's Lady with an Ermine.")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Official website' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Czartoryski Museum' }).click();
    await expect(page.getByRole('heading', { name: 'Czartoryski Museum' })).toHaveCount(0);
  });

  test('walk here shows minutes from the traveller', async ({ browser }) => {
    const context = await browser.newContext({ geolocation: IN_KRAKOW, permissions: ['geolocation'] });
    const page = await context.newPage();
    await page.goto('/map');
    await page.getByRole('button', { name: 'Show list' }).click();
    await page.getByRole('button', { name: /Barbican/ }).click();
    await page.getByRole('button', { name: 'Walk here' }).click();
    await expect(page.getByText(/\d+ min walk ·/)).toBeVisible({ timeout: 30_000 });
    await context.close();
  });
});

test.describe('planner', () => {
  const MONDAY_PLAN = '/plan?days=2&pace=steady&likes=history,museums&trips=1&date=2026-10-12';

  test('a plan link opens the plan first, with dated days and closures', async ({ page }) => {
    await page.goto(MONDAY_PLAN);
    await expect(page.getByText('2 days · Steady · History, Museums · from Mon 12 Oct')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Day 1 · Mon 12 Oct' })).toBeVisible();
    await expect(page.getByText('Closed that day, so left out: Czartoryski Museum.')).toBeVisible();
    await expect(page.getByText('How many days are you in Kraków?')).toHaveCount(0);
  });

  test('Change opens the form and Keep my plan closes it', async ({ page }) => {
    await page.goto(MONDAY_PLAN);
    await page.getByRole('button', { name: 'Change' }).click();
    await expect(page.getByText('How many days are you in Kraków?')).toBeVisible();
    await page.getByRole('button', { name: 'Keep my plan' }).click();
    await expect(page.getByText('How many days are you in Kraków?')).toHaveCount(0);
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

  test('share copies the link where there is no share sheet', async ({ browser }) => {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await page.goto(MONDAY_PLAN);
    await page.getByRole('button', { name: 'Share this plan' }).click();
    await expect(page.getByText('Link copied.')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('days=2');
    expect(copied).toContain('date=2026-10-12');
    await context.close();
  });
});

test.describe('Time Lens', () => {
  test('the list opens a viewpoint with its controls in reach', async ({ page }) => {
    await page.goto('/lens');
    await page.getByRole('button', { name: /^Cloth Hall/ }).click();
    // the list screen stays mounted underneath on web, so the viewer's caption is the last match
    await expect(page.getByText('Stand at: Main Square, facing the Cloth Hall').last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use my camera' })).toBeVisible();
    await expect(page.getByLabel('See-through')).toBeVisible();
  });

  test('the picture can be moved without dragging', async ({ page }) => {
    await page.goto('/lens/cloth-hall');
    await page.getByRole('button', { name: 'Adjust & sources' }).click();
    for (const name of ['Move picture left', 'Move picture up', 'Move picture down', 'Move picture right']) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Move picture left' }).click();
    await expect(page.getByText(/Ignacy Krieger/).first()).toBeVisible();
  });

  test('an unknown viewpoint explains what to do', async ({ page }) => {
    await page.goto('/lens/nope');
    await expect(page.getByText('This viewpoint doesn’t exist. Go back and pick one from the list.')).toBeVisible();
  });
});
