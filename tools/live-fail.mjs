import puppeteer from 'puppeteer-core';
const [out = 'lf', lvl = '4'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 844, height: 390 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto(`http://localhost:5173/?level=${lvl}&unlock=1&ads=off`, { waitUntil: 'load' }); await sleep(6500);
await page.evaluate(() => { for (let i = 0; i < 3; i++) { const b = document.querySelector('[data-act="gotit"]'); b && b.click(); } document.getElementById('coach').classList.add('hidden'); }); await sleep(600);
const death = await page.evaluate(() => { // shortest sequence of moves that ends in death
  const g = window.__game; const L = g.L; let frontier = [{ s: L.initial(), path: '' }];
  for (let d = 0; d < 9; d++) { const next = []; for (const { s, path } of frontier) for (const m of 'UDLRW') { const r = L.step(s, m); if (r.status === 'dead') return path + m; if (r.status === 'ok') next.push({ s: r.state, path: path + m }); } frontier = next.slice(0, 4000); }
  return null; });
console.log('fatal route', death);
await page.evaluate(async (path) => { const g = window.__game; const dirs = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const m of path) { const [x, y] = g.end.pos.split(',').map(Number); const c = m === 'W' ? g.end.pos : `${x + dirs[m][0]},${y + dirs[m][1]}`; g.tap(c); while (g.moving || g.queue.length) await sleep(50); if (g.playing) break; } }, death);
await sleep(3500); await page.screenshot({ path: `${out}_fail.png` });
console.log('sheet:', await page.evaluate(() => document.getElementById('shTitle').textContent + ' | ' + [...document.querySelectorAll('#shBody button')].map((b) => b.textContent.trim()).join(' / ')));
await page.evaluate(() => document.querySelector('[data-act="undoStep"]').click()); await sleep(1500); await page.screenshot({ path: `${out}_undone.png` });
console.log('after undo', await page.evaluate(() => JSON.stringify({ moves: window.__game.moves, playing: window.__game.playing, status: window.__game.status, sheetHidden: document.getElementById('sheet').classList.contains('hidden') })));
await browser.close();
