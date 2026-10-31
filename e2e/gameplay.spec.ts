import { expect, test } from '@playwright/test';

test('player investigates, resumes, requests a hint, and submits one final accusation', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
  await expect(page.getByRole('heading', { name: /Look closer/ })).toHaveCount(1);
  await expect(page.locator('#about')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-landing.png`, fullPage: true });
  const createScreen = page.locator('.create-card');
  if (initialTheme !== 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await createScreen.screenshot({ path: `test-results/${test.info().project.name}-create-dark.png` });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await createScreen.screenshot({ path: `test-results/${test.info().project.name}-create-light.png` });
  if (initialTheme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, document.getElementById('new-case')?.offsetTop ?? 0); });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByText('Need a spark?')).toBeVisible();
  await page.getByRole('button', { name: 'Restaurant', exact: true }).click();
  await expect(page.getByLabel('Your premise')).toHaveValue(/celebrated chef/);
  await expect(page.getByText(/\d+ \/ 1,500/)).toBeVisible();
  await page.getByLabel('Your premise').fill('A silver compass vanishes from a locked observatory after a storm.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Generate Mystery/i }).click();
  await expect(page).toHaveURL(/\/case\/[A-Za-z0-9_-]{32}$/);
  await expect(page.getByRole('heading', { name: 'The Vanishing Moonstone' })).toBeVisible();
  const caseTheme = await page.locator('html').getAttribute('data-theme');
  const initialProgress = await page.locator('.progress-box strong').innerText();
  const caseAlternate = caseTheme === 'dark' ? 'light' : 'dark';
  await page.getByRole('button', { name: 'Switch to ' + caseAlternate + ' mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', caseAlternate);
  await expect(page.locator('.progress-box strong')).toHaveText(initialProgress);
  await page.getByRole('button', { name: 'Switch to ' + caseTheme + ' mode' }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-case-room.png`, fullPage: true });
  const caseScreen = page.locator('.case-layout');
  const currentCaseTheme = await page.locator('html').getAttribute('data-theme');
  if (currentCaseTheme !== 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await caseScreen.screenshot({ path: `test-results/${test.info().project.name}-case-dark.png` });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await caseScreen.screenshot({ path: `test-results/${test.info().project.name}-case-light.png` });
  if (currentCaseTheme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();

  await page.getByRole('tab', { name: 'Suspects' }).click();
  await expect(page.getByRole('button', { name: /Mira Vale/ })).toBeVisible();
  await page.getByRole('button', { name: /Mira Vale/ }).click();
  await expect(page.getByRole('button', { name: /Mira Vale/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Her restoration proposal was delayed.')).toBeVisible();

  await page.getByRole('tab', { name: 'Evidence' }).click();
  await page.getByRole('button', { name: /E-01.*Closing guide’s note/ }).click();
  await expect(page.getByRole('dialog')).toContainText(/fictional evidence/i);
  const drawerCloseButtons = page.getByRole('dialog').getByRole('button', { name: 'Close evidence', exact: true });
  await page.keyboard.press('Shift+Tab');
  await expect(drawerCloseButtons.last()).toBeFocused();
  await drawerCloseButtons.last().click();
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
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Confirm accusation' })).toBeFocused();
  await page.getByRole('button', { name: 'Confirm accusation' }).click();
  await expect(page.getByText('CASE CLOSED · ' + (await page.locator('.case-reference').innerText()).split('\n').pop(), { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Jonas Reed' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'You found the truth.' })).toBeVisible();
  await expect(page.getByText('CASE SOLVED')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const verdictScreen = page.locator('.reveal-card');
  const verdictTheme = await page.locator('html').getAttribute('data-theme');
  if (verdictTheme !== 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await verdictScreen.screenshot({ path: `test-results/${test.info().project.name}-verdict-dark.png` });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await verdictScreen.screenshot({ path: `test-results/${test.info().project.name}-verdict-light.png` });
  if (verdictTheme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.getByText('evidence reviewed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review the evidence' }).click();
  await expect(page.getByRole('tabpanel', { name: 'Evidence' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return to the verdict' })).toBeVisible();
  await page.getByRole('button', { name: 'Return to the verdict' }).click();
  await expect(page.getByRole('heading', { name: 'Jonas Reed' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Jonas Reed' })).toBeVisible();
});

test('case creation gives inline guidance and focuses the invalid field', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, document.getElementById('new-case')?.offsetTop ?? 0); });
  const premise = page.getByLabel('Your premise');
  await premise.fill('Too short');
  await page.getByRole('button', { name: /Generate Mystery/i }).click();
  await expect(page.getByRole('alert').filter({ hasText: /at least 20 characters/i })).toBeVisible();
  await expect(premise).toBeFocused();
  await premise.fill('A locked observatory loses its only telescope during a storm.');
  await page.getByRole('button', { name: /Generate Mystery/i }).click();
  await expect(page.getByRole('alert').filter({ hasText: /confirm that this case is fictional/i })).toBeVisible();
  await expect(page.getByRole('checkbox')).toBeFocused();
});

test('slow generation can keep waiting or retry with the same inputs', async ({ page }) => {
  test.setTimeout(45_000);
  await page.clock.install();
  let creates = 0;
  const submitted: unknown[] = [];
  await page.route('**/api/v1/cases', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    submitted.push(route.request().postDataJSON());
    creates += 1;
    const id = String.fromCharCode(64 + creates).repeat(32);
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ caseId: id, accessToken: 'test-access', status: 'generating', generation: { stage: 'building_mystery' } }) });
  });
  await page.route(/\/api\/v1\/cases\/[A-Z]{32}$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ caseId: route.request().url().split('/').pop(), status: 'generating', generation: { stage: 'building_mystery' } }) }));
  await page.goto('/');
  const startTheme = await page.locator('html').getAttribute('data-theme');
  if (startTheme !== 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.getByLabel('Your premise').fill('A rare map vanishes from a locked mountain lodge.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Generate Mystery/i }).click();
  await expect(page).toHaveURL(/\/case\/[A-Z]{32}$/);
  await expect(page.getByRole('heading', { name: 'Putting the pieces in place.' })).toBeVisible();
  await page.locator('.state-screen.is-generating').screenshot({ path: `test-results/${test.info().project.name}-generating-dark.png` });
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.locator('.state-screen.is-generating').screenshot({ path: `test-results/${test.info().project.name}-generating-light.png` });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await page.clock.fastForward(25_100);
  await expect(page.getByText('This is taking longer than usual.')).toBeVisible();
  await page.getByRole('button', { name: 'Keep waiting' }).click();
  await expect(page.getByRole('button', { name: 'Cancel & retry' })).toHaveCount(0);
  await page.clock.fastForward(25_100);
  await expect(page.getByRole('button', { name: 'Cancel & retry' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel & retry' }).click();
  await expect(page).toHaveURL(/\/case\/B{32}$/);
  expect(creates).toBe(2);
  expect(submitted[1]).toEqual(submitted[0]);
});

test('failed generation offers the existing retry endpoint', async ({ page }) => {
  let retryCount = 0;
  let caseReads = 0;
  await page.route('**/api/v1/cases', (route) => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ caseId: 'C'.repeat(32), accessToken: 'test-access', status: 'generating', generation: { stage: 'building_mystery' } }) }));
  await page.route(/\/api\/v1\/cases\/C{32}(?:\/retry)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      retryCount += 1;
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ caseId: 'C'.repeat(32), status: 'generating', generation: { stage: 'building_mystery' } }) });
    }
    caseReads += 1;
    const body = caseReads === 1
      ? { caseId: 'C'.repeat(32), status: 'failed', generation: { errorCode: 'GENERATION_INVALID' }, retryAvailable: true }
      : { caseId: 'C'.repeat(32), status: 'generating', generation: { stage: 'building_mystery' } };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByLabel('Your premise').fill('A rare map vanishes from a locked mountain lodge.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Generate Mystery/i }).click();
  await expect(page.getByRole('heading', { name: 'This case file is unavailable.' })).toBeVisible();
  await page.getByRole('button', { name: 'Retry case generation' }).click();
  await expect(page.getByRole('heading', { name: 'Putting the pieces in place.' })).toBeVisible();
  expect(retryCount).toBe(1);
});

test('creation recovers from a request error using the same form', async ({ page }) => {
  let failed = false;
  await page.route('**/api/v1/cases', async (route) => {
    if (route.request().method() === 'POST' && !failed) { failed = true; await route.abort(); return; }
    await route.continue();
  });
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, document.getElementById('new-case')?.offsetTop ?? 0); });
  await page.getByLabel('Your premise').fill('A rare map vanishes from a locked mountain lodge.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Generate Mystery/i }).click();
  await expect(page.getByRole('alert').filter({ hasText: /failed|network|fetch/i })).toBeVisible();
  await expect(page.getByLabel('Your premise')).toHaveValue('A rare map vanishes from a locked mountain lodge.');
  await page.getByRole('button', { name: /Generate Mystery/i }).click();
  await expect(page).toHaveURL(/\/case\/[A-Za-z0-9_-]{32}$/);
});

test('landing scene supports accessible clue inspection, reduced motion, and its WebGL fallback', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const canvas = page.locator('.investigation-scene canvas');
  await expect(canvas).toBeVisible();
  await expect(page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).resolves.toBe(true);
  if ((page.viewportSize()?.width ?? 1280) < 500) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('link', { name: 'How it works' })).toBeVisible();
    await page.getByRole('button', { name: 'Close navigation' }).click();
  }

  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('The investigation scene canvas has no visible bounds.');
  const mobile = (page.viewportSize()?.width ?? 1280) < 500;
  await page.mouse.move(bounds.x + bounds.width * (mobile ? .75 : .65), bounds.y + bounds.height * (mobile ? .47 : .43));
  await expect(page.locator('.scene-tooltip')).toContainText('click to inspect');
  await page.mouse.click(bounds.x + bounds.width * (mobile ? .75 : .65), bounds.y + bounds.height * (mobile ? .47 : .43));
  await expect(page.getByRole('dialog')).toContainText('Timeline');
  await page.getByRole('button', { name: 'Close clue preview' }).click();

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('button', { name: 'Inspect suspect photograph' })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect suspect photograph' }).click();
  await expect(page.getByRole('dialog')).toContainText('Person of interest');
  await page.getByRole('button', { name: 'Close clue preview' }).click();
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect(page.locator('.investigation-scene')).toHaveAttribute('data-chapter', '1');
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
  await expect(page.locator('.investigation-scene')).toHaveAttribute('data-chapter', '2');
  await page.locator('.hero-cta').click();
  await expect(page.locator('#premise')).toBeInViewport();

  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind: string, ...args: unknown[]) {
      if (kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl') return null;
      return original.call(this, kind as '2d', ...(args as []));
    };
  });
  await page.reload();
  await expect(page.locator('.investigation-scene')).toHaveClass(/webgl-unavailable/);
  await expect(page.locator('.scene-fallback')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open case file' })).toBeEnabled();
});

test('desktop cursor follows the pointer and camera travels through story chapters', async ({ page }) => {
  test.setTimeout(30_000);
  test.skip((page.viewportSize()?.width ?? 1280) < 500, 'Custom cursor is desktop-only.');
  await page.goto('/');
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
  await expect(page.locator('.investigation-scene canvas')).toBeVisible();
  const action = page.locator('.hero-cta');
  const bounds = await action.boundingBox();
  if (!bounds) throw new Error('The primary action has no visible bounds.');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page.locator('.interactive-cursor')).toHaveClass(/is-hot/);
  await expect.poll(() => page.locator('.interactive-cursor').evaluate((element) => (element as HTMLElement).style.transform)).not.toBe('');
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect(page.locator('.investigation-scene')).toHaveAttribute('data-chapter', '1');
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 4));
  await expect(page.locator('.investigation-scene')).toHaveAttribute('data-chapter', '4');
});
