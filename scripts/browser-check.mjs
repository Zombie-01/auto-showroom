/**
 * End-to-end browser check (Playwright, headless Chromium with software WebGL).
 * Requires the API and web dev server running. Usage:
 *   BASE=http://dealer-a.localhost:5173 OUT=./test-results node scripts/browser-check.mjs
 */
import { chromium } from 'playwright';
import { mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Use Playwright's bundled browser if installed, otherwise any cached headless shell. */
async function executablePath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (existsSync(chromium.executablePath())) return undefined;
  const root = path.join(os.homedir(), '.cache/ms-playwright');
  const dirs = (await readdir(root).catch(() => [])).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse();
  for (const d of dirs) { const p = path.join(root, d, 'chrome-headless-shell-linux64/chrome-headless-shell'); if (existsSync(p)) return p; }
  return undefined;
}

const BASE = process.env.BASE ?? 'http://dealer-a.localhost:5173';
const OUT = process.env.OUT ?? 'test-results';
const PASSWORD = process.env.SEED_PASSWORD ?? 'showroom-demo-2026';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: await executablePath(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];
const errors = [];
const step = async (name, fn) => {
  const t = Date.now();
  try { await fn(); results.push(`✓ ${name} (${Date.now() - t} ms)`); }
  catch (e) { results.push(`✗ ${name}: ${e.message.split('\n')[0]}`); }
};
const watch = (page, label) => {
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_ABORTED|status of 401/.test(m.text())) errors.push(`[${label}] ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message.slice(0, 300)}`));
};
const exteriorLoaded = (page) => page.waitForFunction(() => {
  const veil = document.querySelector('[role=status][aria-live=polite]');
  return !!veil && !!veil.closest('[aria-hidden=true]');
}, null, { timeout: 180_000 });

// Desktop
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.setDefaultTimeout(120_000);
watch(page, 'desktop');

await step('home hero renders 3D', async () => {
  await page.goto(`${BASE}/?quality=low`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.locator('canvas').waitFor({ timeout: 20_000 });
  await exteriorLoaded(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/01-home.png` });
});

await step('catalog lists brands and vehicles', async () => {
  await page.goto(`${BASE}/vehicles`);
  await page.getByRole('link', { name: /Toyota Land Cruiser 300 — дэлгэрэнгүй/ }).waitFor();
  await page.getByRole('tab', { name: 'BYD' }).click();
  await page.getByRole('link', { name: /BYD Song Plus DM-i — дэлгэрэнгүй/ }).waitFor();
  await page.getByRole('tab', { name: 'Бүгд' }).click();
  await page.screenshot({ path: `${OUT}/02-catalog.png` });
});

await step('vehicle story: scroll through all sections', async () => {
  await page.goto(`${BASE}/vehicles/land-cruiser-300?quality=low`);
  await exteriorLoaded(page);
  const total = await page.evaluate(() => document.querySelector('[style*="svh"]').getBoundingClientRect().height);
  const sections = ['exterior', 'exploded', 'engine', 'transmission', 'suspension', 'interior', 'final'];
  const vh = 900;
  for (let i = 0; i < sections.length; i++) {
    // Middle-to-late in each section, where explode states are most visible.
    const at = i + (i === sections.length - 1 ? 0.4 : 0.8);
    const y = (at / sections.length) * (total - vh);
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(i === 0 ? 4000 : 9000);
    await page.screenshot({ path: `${OUT}/03-story-${i + 1}-${sections[i]}.png` });
  }
});

await step('scroll back reverses to the exploded state', async () => {
  const total = await page.evaluate(() => document.querySelector('[style*="svh"]').getBoundingClientRect().height);
  await page.evaluate((top) => window.scrollTo(0, top), (1.8 / 7) * (total - 900));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/04-reverse-exploded.png` });
});

await step('engine: select component from list and show info panel', async () => {
  const total = await page.evaluate(() => document.querySelector('[style*="svh"]').getBoundingClientRect().height);
  await page.evaluate((top) => window.scrollTo(0, top), (2.9 / 7) * (total - 900));
  await page.waitForTimeout(2600);
  await page.getByRole('group', { name: /Хөдөлгүүр — эд ангиуд/ }).getByRole('button', { name: 'Турбо цэнэглэгч' }).click();
  const panel = page.getByRole('complementary', { name: /Турбо цэнэглэгч — дэлгэрэнгүй/ });
  await panel.waitFor();
  await panel.getByText('Лавлагаа').first().waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/05-engine-selected.png` });
  await page.keyboard.press('Escape');
});

await step('exterior: click a part in the 3D view (raycast)', async () => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => globalThis.__engine?.getState().storyAt < 0.01, null, { timeout: 60_000 });
  await page.waitForTimeout(2500);
  // Hover first (as a user would), then click; any exterior part is a valid hit.
  await page.mouse.move(820, 450);
  await page.waitForTimeout(300);
  await page.mouse.click(820, 450);
  await page.locator('aside[aria-label$="дэлгэрэнгүй"]').waitFor({ timeout: 5000 });
  await page.screenshot({ path: `${OUT}/06-raycast-select.png` });
  await page.keyboard.press('Escape');
});

await step('specifications show verification status', async () => {
  await page.locator('#specifications').scrollIntoViewIfNeeded();
  await page.getByRole('radio', { name: '3.3 Diesel Twin Turbo' }).click();
  await page.getByText('F33A-FTV, V6, хос турботой дизель').waitFor();
  await page.screenshot({ path: `${OUT}/07-specs.png` });
});

let shareUrl;
await step('configurator: change colours, wheels, interior; screenshot; share', async () => {
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`${BASE}/vehicles/land-cruiser-300/configure?quality=low`);
  await exteriorLoaded(page);
  await page.getByRole('button', { name: /^Gray Metallic/ }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/08-configurator-exterior.png` });
  await page.getByRole('tab', { name: 'Салон' }).click();
  await page.getByRole('button', { name: /^Цайвар шаргал/ }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/09-configurator-interior.png` });
  await page.getByRole('tab', { name: 'Дүгнэлт' }).click();
  await page.getByText(/Gray Metallic/).first().waitFor();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Зураг авах' }).click()]);
  await download.saveAs(`${OUT}/10-capture.png`);
  await page.getByRole('button', { name: 'Хуваалцах' }).click();
  shareUrl = await page.evaluate(() => navigator.clipboard.readText());
  if (!shareUrl.includes('?c=')) throw new Error('no share url');
});

await step('share link restores configuration', async () => {
  await page.evaluate(() => localStorage.clear());
  await page.goto(shareUrl);
  await page.getByRole('tab', { name: 'Дүгнэлт' }).click();
  await page.getByText(/Gray Metallic/).first().waitFor();
  await page.getByText('Цайвар шаргал').first().waitFor();
});

await step('submit a quotation lead', async () => {
  await page.getByRole('button', { name: 'Үнийн санал авах' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('Овог нэр').fill('Browser Test');
  await dlg.getByLabel('Утасны дугаар').fill('+976 9900 1122');
  await dlg.getByRole('button', { name: 'Үнийн санал авах' }).click();
  await dlg.getByText('Хүсэлт илгээгдлээ').waitFor();
  await page.screenshot({ path: `${OUT}/11-lead-sent.png` });
});

await step('compare page', async () => {
  await page.goto(`${BASE}/compare?v=land-cruiser-300,lx-600,t2`);
  await page.getByRole('table').waitFor();
  await page.screenshot({ path: `${OUT}/12-compare.png`, fullPage: true });
});

await step('every catalogue vehicle opens (3D story or spec fallback)', async () => {
  for (const slug of ['lx-600', 'gx-550', 'land-cruiser-250', 't2', 'dashing', 'song-plus']) {
    await page.goto(`${BASE}/vehicles/${slug}?quality=low`);
    await page.locator('#specifications').waitFor();
  }
});

await step('dealer dashboard: login, see lead, update status', async () => {
  await page.goto(`${BASE}/dealer`);
  await page.getByLabel('И-мэйл').fill('owner@dealer-a.example.com');
  await page.getByLabel('Нууц үг').fill(PASSWORD);
  await page.getByRole('button', { name: 'Нэвтрэх' }).click();
  await page.getByRole('heading', { name: 'Тойм' }).waitFor();
  await page.screenshot({ path: `${OUT}/13-dealer-overview.png` });
  await page.getByRole('link', { name: 'Хүсэлтүүд' }).click();
  await page.getByText('Browser Test').first().waitFor();
  await page.getByRole('button', { name: 'Нээх' }).first().click();
  await page.locator('select[name=status]').selectOption('contacted');
  await page.getByRole('button', { name: 'Хадгалах' }).click();
  await page.getByText('Хадгаллаа').waitFor();
  await page.screenshot({ path: `${OUT}/14-dealer-leads.png` });
  for (const [name, file] of [['Үзүүлэлт', '15-dealer-specs'], ['3D загвар', '16-dealer-assets'], ['Статистик', '17-dealer-analytics']]) {
    await page.getByRole('link', { name, exact: true }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${file}.png` });
  }
});

await step('tenant B is isolated: does not see tenant A leads after login', async () => {
  const b = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pb = await b.newPage();
  watch(pb, 'tenant-b');
  const baseB = BASE.replace('dealer-a', 'dealer-b');
  await pb.goto(`${baseB}/dealer`);
  await pb.getByLabel('И-мэйл').fill('owner@dealer-a.example.com');
  await pb.getByLabel('Нууц үг').fill(PASSWORD);
  await pb.getByRole('button', { name: 'Нэвтрэх' }).click();
  await pb.getByText('И-мэйл эсвэл нууц үг буруу байна').waitFor();
  await pb.getByLabel('И-мэйл').fill('owner@dealer-b.example.com');
  await pb.getByRole('button', { name: 'Нэвтрэх' }).click();
  await pb.getByRole('link', { name: 'Хүсэлтүүд' }).click();
  await pb.waitForTimeout(800);
  if (await pb.getByText('Browser Test').count()) throw new Error('tenant B sees tenant A lead');
  await pb.goto(`${baseB}/`);
  await pb.waitForTimeout(1500);
  await pb.screenshot({ path: `${OUT}/18-tenant-b-home.png` });
  await b.close();
});

await step('no-WebGL fallback', async () => {
  await page.goto(`${BASE}/vehicles/land-cruiser-300?nowebgl`);
  await page.getByText(/WebGL туршилтаар унтраасан/).first().waitFor();
});

// Mobile
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await m.newPage();
mp.setDefaultTimeout(120_000);
watch(mp, 'mobile');
await step('mobile: home, story, configurator', async () => {
  await mp.goto(`${BASE}/?quality=low`);
  await exteriorLoaded(mp);
  await mp.waitForTimeout(1200);
  await mp.screenshot({ path: `${OUT}/19-mobile-home.png` });
  await mp.goto(`${BASE}/vehicles/land-cruiser-300?quality=low`);
  await exteriorLoaded(mp);
  const total = await mp.evaluate(() => document.querySelector('[style*="svh"]').getBoundingClientRect().height);
  await mp.evaluate((top) => window.scrollTo(0, top), (2.85 / 7) * (total - 844));
  await mp.waitForTimeout(3000);
  await mp.screenshot({ path: `${OUT}/20-mobile-engine.png` });
  await mp.goto(`${BASE}/vehicles/land-cruiser-300/configure?quality=low`);
  await exteriorLoaded(mp);
  await mp.waitForTimeout(1500);
  await mp.screenshot({ path: `${OUT}/21-mobile-configurator.png`, fullPage: true });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (overflow) throw new Error('horizontal overflow on mobile');
});

await browser.close();
console.log(results.join('\n'));
console.log(errors.length ? `\nConsole errors (${errors.length}):\n${[...new Set(errors)].join('\n')}` : '\nNo console errors.');
process.exit(results.some((r) => r.startsWith('✗')) ? 1 : 0);
