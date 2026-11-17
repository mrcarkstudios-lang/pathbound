// Dev helper: open the game in headless Chrome, wait, save screenshots, print console errors.
// node tools/shot.mjs "<query>" <outPrefix> <seconds,seconds,...> [width] [height]
import puppeteer from 'puppeteer-core';
const [query = '', out = 'shot', times = '6', w = '1280', h = '720'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', `--window-size=${w},${h}`] });
const page = await browser.newPage(); await page.setViewport({ width: +w, height: +h });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[' + m.type() + ']', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)));
await page.goto('http://localhost:5173/' + query, { waitUntil: 'load' });
let last = 0;
for (const t of times.split(',').map(Number)) { await new Promise((r) => setTimeout(r, (t - last) * 1000)); last = t; await page.screenshot({ path: `${out}_${t}.png` }); 
  const info = await page.evaluate(() => { const g = window.__game; return g && g.states ? { status: g.status, moves: g.moves.length, playing: g.playing, sheet: document.getElementById('sheet').className, title: document.getElementById('shTitle').textContent, load: document.getElementById('loadText').textContent } : { load: document.getElementById('loadText').textContent }; });
  console.log('t=' + t, JSON.stringify(info)); }
await browser.close();
