// Dev check: real pointer taps on tiles build a route, Undo works, PLAY wins level 1.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 390, height: 780, hasTouch: true, isMobile: true });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5173/?level=1'); await new Promise((r) => setTimeout(r, 6000));
const pos = (cell) => page.evaluate((c) => { const w = window.__game.world; const v = w.cellPos(c).project(w.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, cell);
const info = () => page.evaluate(() => ({ moves: window.__game.moves, status: window.__game.status }));
for (const c of ['1,1', '2,1', '2,1', '3,1']) { const [x, y] = await pos(c); await page.touchscreen.tap(x, y); await new Promise((r) => setTimeout(r, 350)); }
console.log('after 4 taps (one is a wait)', JSON.stringify(await info()));
await page.tap('#btnUndo'); await new Promise((r) => setTimeout(r, 300)); await page.tap('#btnUndo'); await new Promise((r) => setTimeout(r, 300));
console.log('after 2 undos', JSON.stringify(await info()));
for (const c of ['3,1', '4,1']) { const [x, y] = await pos(c); await page.touchscreen.tap(x, y); await new Promise((r) => setTimeout(r, 350)); }
console.log('route to chest', JSON.stringify(await info()));
await page.tap('#btnPlay'); await new Promise((r) => setTimeout(r, 9000));
console.log('after PLAY:', await page.evaluate(() => document.getElementById('mTitle').textContent + ' | ' + document.getElementById('mStars').textContent + ' | saved ' + localStorage.getItem('pathbound_v1')));
await page.screenshot({ path: process.argv[2] });
await browser.close();
