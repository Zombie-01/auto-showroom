// Dev helper: configurator cabin view with each interior colour package.
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => globalThis.__engine?.getState().loaded.includes('interior'), null, { timeout: 180000 });
await page.getByRole('tab', { name: 'Салон' }).click();
await page.waitForTimeout(15000);
for (const [i, name] of [null, 'Цайвар шаргал', 'Хүрэн'].entries()) {
  if (name) { await page.getByRole('button', { name: new RegExp('^' + name) }).click(); await page.waitForTimeout(12000); }
  await page.screenshot({ path: `${out}/cabin-${i}.png`, timeout: 180000 });
}
await browser.close();
