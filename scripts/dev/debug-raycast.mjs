// Dev helper: click into the story canvas and report engine hover/selection state.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(process.argv[2]);
await page.waitForTimeout(9000);
const state = () => page.evaluate(() => { const s = globalThis.__engine.getState(); return { mode: s.mode, interactive: s.interactive, loaded: s.loaded, hovered: s.hovered, selected: s.selected, at: s.storyAt }; });
console.log('before', await state());
for (const [x, y] of [[720, 470], [900, 450], [600, 400]]) {
  await page.mouse.move(x, y); await page.waitForTimeout(300);
  console.log('hover', x, y, (await state()).hovered, 'top element:', await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e.tagName + '.' + (e.className?.toString?.() ?? '').slice(0, 60); }, [x, y]));
  await page.mouse.click(x, y); await page.waitForTimeout(300);
  console.log('selected', (await state()).selected);
}
await browser.close();
