// Dev helper: load a page, optionally scroll through it, print page errors with stacks.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.stack?.slice(0, 2000)));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 600)); });
for (const url of process.argv.slice(2)) {
  console.log('GOTO', url);
  await page.goto(url);
  await page.waitForTimeout(8000);
  if (process.env.SCROLL) for (let i = 1; i <= 14; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(400); }
  await page.waitForTimeout(1000);
  console.log('alive:', await page.evaluate(() => document.getElementById('root').children.length));
}
await browser.close();
