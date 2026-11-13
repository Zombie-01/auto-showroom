// Dev helper: render a page in Chromium and print its visible text.
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' });
await page.goto(process.argv[2], { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(Number(process.env.WAIT ?? 12000));
for (const sel of (process.env.CLICK ?? '').split('|').filter(Boolean)) { await page.getByText(sel, { exact: false }).first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(2000); }
console.log(await page.evaluate(() => document.body.innerText));
await browser.close();
