import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
await page.goto(process.argv[2], { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => globalThis.__engine?.getState().loaded.includes('exterior'), null, { timeout: 120000 });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => { const g = globalThis.__gl; return { calls: g.info.render.calls, tris: g.info.render.triangles, geoms: g.info.memory.geometries, tex: g.info.memory.textures, programs: g.info.programs?.length, pixelRatio: g.getPixelRatio(), q: globalThis.__engine.getState().quality }; }));
await browser.close();
