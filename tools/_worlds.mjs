import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await browser.newPage(); await page.setViewport({ width: 960, height: 440 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
await page.goto('http://localhost:5173/?level=1&unlock=1', { waitUntil: 'load' }); await sleep(7000);
for (let w = 1; w <= 10; w++) {
  const id = (w - 1) * 10 + 5;
  await page.evaluate((i) => document.getElementById('btnBack').click() && 0, id).catch(() => {});
  await page.evaluate(async (i) => { const m = await import('/src/main.js'); }, id).catch(() => {});
  await page.goto(`http://localhost:5173/?level=${id}&unlock=1`, { waitUntil: 'load' }); await sleep(5500);
  await page.evaluate(() => document.getElementById('toast').classList.add('hidden'));
  await page.screenshot({ path: `../art_in/W${w}.png` });
}
await browser.close();
