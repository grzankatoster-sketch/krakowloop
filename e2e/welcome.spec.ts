import { expect, test } from '@playwright/test';

// The welcome on a first start: "Next" walks its three pages, the last button closes it for good.
// The other specs skip it by setting kl.welcome.v1; this one starts as a brand new traveller.
test('the welcome walks its pages with Next and closes with the last button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Kraków in your pocket')).toBeVisible();
  const next = page.getByRole('button', { name: 'Next' });
  await next.click();
  await expect(page.getByText('Turn it on')).toBeVisible();
  await next.click();
  // on the last page the button says it starts the app
  await expect(page.getByRole('button', { name: 'Let’s go' })).toBeVisible();
  await expect(next).toHaveCount(0);
  await page.getByRole('button', { name: 'Let’s go' }).click();
  await expect(page.getByText('Kraków in your pocket')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Kraków in your pocket')).toHaveCount(0);
});
