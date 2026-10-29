import { expect, test } from '@playwright/test';

test('player investigates, resumes, requests a hint, and submits one final accusation', async ({ page }) => {
  await page.goto('/');
  const initialTheme = await page.locator('html').getAttribute('data-theme');
  expect(['light', 'dark']).toContain(initialTheme);
  const initialSurface = await page.locator('html').evaluate((element) => getComputedStyle(element).getPropertyValue('--bg').trim());
  const alternateTheme = initialTheme === 'dark' ? 'light' : 'dark';
  await page.getByRole('button', { name: 'Switch to ' + alternateTheme + ' mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', alternateTheme);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', alternateTheme);
  await page.getByRole('button', { name: 'Switch to ' + initialTheme + ' mode' }).click();
  await expect(page.getByRole('heading', { name: /Every Mystery/i })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-landing.png`, fullPage: true });
  await page.getByLabel('Your premise').fill('A silver compass vanishes from a locked observatory after a storm.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Generate Mystery/i }).click();
  await expect(page).toHaveURL(/\/case\/[A-Za-z0-9_-]{32}$/);
  await expect(page.getByRole('heading', { name: 'The Vanishing Moonstone' })).toBeVisible();
  const caseTheme = await page.locator('html').getAttribute('data-theme');
  const caseAlternate = caseTheme === 'dark' ? 'light' : 'dark';
  await page.getByRole('button', { name: 'Switch to ' + caseAlternate + ' mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', caseAlternate);
  await page.getByRole('button', { name: 'Switch to ' + caseTheme + ' mode' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-case-room.png`, fullPage: true });

  await page.getByRole('tab', { name: 'Suspects' }).click();
  await expect(page.getByRole('button', { name: /Mira Vale/ })).toBeVisible();
  await page.getByRole('button', { name: /Mira Vale/ }).click();

  await page.getByRole('tab', { name: 'Evidence' }).click();
  await page.getByRole('button', { name: /E-01.*Closing guide’s note/ }).click();
  await expect(page.getByRole('dialog')).toContainText(/fictional evidence/i);
  await page.getByRole('dialog').getByRole('button', { name: 'Close evidence', exact: true }).last().click();
  await expect(page.locator('.progress-box strong')).toContainText('1');

  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(page.getByText('The final gallery tour ends.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The Vanishing Moonstone' })).toBeVisible();
  await expect(page.locator('.progress-box strong')).toContainText('1');

  await page.getByRole('tab', { name: 'Briefing' }).click();
  await page.getByRole('button', { name: /Request a hint/i }).click();
  await expect(page.getByText('Compare who remained in the gallery after the tour.')).toBeVisible();
  await page.getByLabel('Select a suspect').selectOption('S-02');
  await page.getByRole('button', { name: /Submit accusation/i }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Submit your final accusation?');
  await page.getByRole('button', { name: 'Confirm accusation' }).click();
  await expect(page.getByText('FINAL FINDING')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Jonas Reed' })).toBeVisible();
  await expect(page.getByText('CASE SOLVED')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Jonas Reed' })).toBeVisible();
});
