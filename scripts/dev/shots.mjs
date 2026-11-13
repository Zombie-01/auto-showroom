// Dev helper: screenshots of the story at given timeline positions + home + configurator.
import { chromium } from 'playwright';
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
const loaded = () => page.waitForFunction(() => { const v = document.querySelector('[role=status][aria-live=polite]'); return !!v && !!v.closest('[aria-hidden=true]'); }, null, { timeout: 90_000 });
await page.goto(`${base}/?quality=low`); await loaded(); await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/r-home.png` });
await page.goto(`${base}/vehicles/land-cruiser-300?quality=low`, { waitUntil: 'domcontentloaded', timeout: 90_000 }); await loaded();
const total = await page.evaluate(() => document.querySelector('[style*="svh"]').getBoundingClientRect().height);
for (const at of (process.env.AT ?? '0.05,0.5,1.85,2.85,5.3,5.85').split(',').map(Number)) {
  await page.evaluate((y) => scrollTo(0, y), (at / 7) * (total - 900));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/r-story-${at}.png`, timeout: 120000 });
}
await page.goto(`${base}/vehicles/land-cruiser-300/configure?quality=low`, { waitUntil: 'domcontentloaded', timeout: 90_000 }); await loaded();
await page.getByRole('button', { name: /^Gray Metallic/ }).click().catch(() => {});
await page.waitForTimeout(2500); await page.screenshot({ path: `${out}/r-config.png` });
await page.getByRole('tab', { name: 'Салон' }).click(); await page.getByRole('button', { name: /^Цайвар шаргал/ }).click().catch(() => {}); await page.waitForTimeout(4500);
await page.screenshot({ path: `${out}/r-config-int.png` });
await browser.close();
