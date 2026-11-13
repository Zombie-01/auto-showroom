// Dev helper: configurator view of each vehicle, default paint and one body colour.
import { chromium } from 'playwright';
const [base, out, ...slugs] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
page.setDefaultTimeout(180000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
for (const slug of slugs) {
  await page.goto(`${base}/vehicles/${slug}/configure?quality=low`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.__engine?.getState().loaded.includes('exterior'), null, { timeout: 240000 });
  await page.waitForTimeout(10000);
  await page.screenshot({ path: `${out}/v-${slug}-a.png` });
  const btn = page.getByRole('button', { name: /^(Хар|Цэнхэр|Ногоон)/ }).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(9000); await page.screenshot({ path: `${out}/v-${slug}-b.png` }); }
  console.log('done', slug);
}
await browser.close();
