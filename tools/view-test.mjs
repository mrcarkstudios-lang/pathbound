// Dev check: shows a route that doubles back and waits, then rotates the camera.
import puppeteer from 'puppeteer-core';
const [query, out] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5173/' + query); await new Promise((r) => setTimeout(r, 6000));
await page.evaluate(() => document.getElementById('toast').classList.add('hidden'));
await page.screenshot({ path: out + '_a.png' });
await page.click('#btnRotate'); await new Promise((r) => setTimeout(r, 900)); await page.screenshot({ path: out + '_b.png' });
const pos = (cell) => page.evaluate((c) => { const w = window.__game.world; const v = w.cellPos(c).project(w.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, cell);
const before = await page.evaluate(() => window.__game.moves.length);
const end = await page.evaluate(() => window.__game.end.pos); const [x, y] = await pos(end); await page.mouse.click(x, y); await new Promise((r) => setTimeout(r, 300));
console.log('tap after rotating adds a wait:', before, '->', await page.evaluate(() => window.__game.moves.length));
await browser.close();
