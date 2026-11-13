import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const url of process.argv.slice(2)) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.waitForTimeout(25_000);
  const t = await page.evaluate(() => new Promise((r) => { const s = performance.now(); let n = 0; const f = () => (++n < 5 ? requestAnimationFrame(f) : r((performance.now() - s) / 5)); requestAnimationFrame(f); }));
  const st = await page.evaluate(() => { const s = globalThis.__engine?.getState(); return s && { loaded: s.loaded, failed: s.failed, q: s.quality }; });
  console.log(url, 'ms/frame', Math.round(t), JSON.stringify(st));
}
await browser.close();
