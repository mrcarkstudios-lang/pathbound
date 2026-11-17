// Dev check: spikes colours, tile ripple, pinch/twist camera, result popup buttons.
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,720'] });
const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 200)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://localhost:5173/?level=3', { waitUntil: 'load' }); await wait(7000);
await page.evaluate(() => { document.getElementById('sheet').classList.add('hidden'); });
await page.screenshot({ path: 'cam_1_spikes.png' });
// tap the tile next to Maria through real pointer events
const p = await page.evaluate(() => { const g = window.__game; const info = g.hintInfo(1); const c = info.cells && info.cells[0]; return c ? window.__world.screenOf(c) : null; });
console.log('target px', JSON.stringify(p));
if (p) { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up(); await wait(120); await page.screenshot({ path: 'cam_2_ripple.png' }); await wait(1500); }
// two-finger gesture via CDP touch
const cdp = await page.createCDPSession();
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
await touch('touchStart', [[540, 360], [740, 360]]);
for (let i = 1; i <= 10; i++) await touch('touchMove', [[540 - i * 14, 360 - i * 6], [740 + i * 14, 360 + i * 6]]);
await touch('touchEnd', []); await wait(300);
console.log('zoom', await page.evaluate(() => window.__world.zoom), 'yaw', await page.evaluate(() => window.__world.viewYaw));
await page.screenshot({ path: 'cam_3_pinch.png' });
// result popup
await page.evaluate(() => { window.__ui.won(window.__game, 3, true); }); await wait(900);
await page.screenshot({ path: 'cam_4_popup.png' });
await browser.close();
