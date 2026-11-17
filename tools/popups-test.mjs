import puppeteer from 'puppeteer-core';
const [W, H] = [+process.argv[2] || 800, +process.argv[3] || 360];
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: W, height: H }); p.on('pageerror', (e) => console.log('[err]', e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await p.goto('http://localhost:5173/?level=3', { waitUntil: 'load' }); await wait(9000);
await p.evaluate(() => document.documentElement.style.setProperty('--banner-h', '56px'));
const snap = async (n) => { await wait(700); await p.screenshot({ path: `po_${n}.png` }); };
await snap('lesson');
const closeAll = () => p.evaluate(() => window.__closeSheet());
await closeAll();
await p.evaluate(() => window.__ui.won(window.__game, 3, true)); await snap('win'); await closeAll();
await p.evaluate(() => window.__ui.won(window.__game, 2, false)); await snap('win2'); await closeAll();
await p.evaluate(() => window.__ui.failed(window.__game, 'monster')); await snap('fail'); await closeAll();
await p.evaluate(() => document.getElementById('btnHint').click()); await snap('hint'); await closeAll();
await p.evaluate(() => document.getElementById('btnBack').click()); await wait(1200);
for (const [n, s] of [['shop', '#dkShop'], ['daily', '#dkDaily'], ['settings', '#dkSettings']]) { await p.evaluate((x) => document.querySelector(x).click(), s); await snap(n); await closeAll(); }
await b.close();
