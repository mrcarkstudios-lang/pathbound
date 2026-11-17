import puppeteer from 'puppeteer-core';
const [out = 'live', w = '844', h = '390'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: +w, height: +h });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300))); page.on('console', (m) => m.type() === 'error' && console.log('[error]', m.text().slice(0, 200)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const shot = (n) => page.screenshot({ path: `${out}_${n}.png` });
await page.goto('http://localhost:5173/?level=1&ads=off', { waitUntil: 'load' }); await sleep(7000); await shot('1_start');
// tap the next tile like a player: the hint cell
await page.evaluate(() => { const g = window.__game; g.tap(g.hintInfo(1).cells[0]); }); await sleep(250); await shot('2_walking'); await sleep(700);
const st = await page.evaluate(() => { const g = window.__game; return { moves: g.moves, status: g.status, moving: g.moving, playing: g.playing, mode: g.mode }; }); console.log('after one tap', JSON.stringify(st));
for (let i = 0; i < 3; i++) { await page.evaluate(() => { const g = window.__game; const i = g.hintInfo(1); if (i.cells) g.tap(i.cells[0]); }); await sleep(900); }
await sleep(2500); await shot('3_win');
console.log('win sheet:', await page.evaluate(() => document.getElementById('sheet').className + '|' + document.getElementById('shTitle').textContent));
// a level with a trap: step straight on it
await page.goto('http://localhost:5173/?level=3&unlock=1&ads=off', { waitUntil: 'load' }); await sleep(6500);
await page.evaluate(() => document.querySelector('[data-act="gotit"]') && document.querySelector('[data-act="gotit"]').click()); await sleep(500);
await page.evaluate(() => { const g = window.__game; const L = g.L; const t = [...L.m.keys ? L.m.keys() : []]; window.__trap = Object.entries(Object.fromEntries(L.m)).find(([k, c]) => 'xX'.includes(c)); });
console.log('trap tile', await page.evaluate(() => window.__trap));
// walk the solution until the move before the trap, then step on it at a deadly beat by brute force: try moves until dead
const res = await page.evaluate(async () => {
  const g = window.__game; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const dirs = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  for (let k = 0; k < 40 && !g.playing; k++) {
    const [x, y] = g.end.pos.split(',').map(Number); let moved = false;
    for (const m of 'RDLU') { const r = g.L.step(g.end, m); if (r.status === 'dead') { g.tap(`${x + dirs[m][0]},${y + dirs[m][1]}`); moved = true; break; } }
    if (!moved) { for (const m of 'RDLU') { const r = g.L.step(g.end, m); if (r.status !== 'blocked') { g.tap(`${x + dirs[m][0]},${y + dirs[m][1]}`); break; } } }
    await sleep(700);
  }
  return { moves: g.moves, playing: g.playing };
});
console.log('walk result', JSON.stringify(res)); await sleep(3500); await shot('4_fail');
console.log('fail sheet:', await page.evaluate(() => document.getElementById('sheet').className + '|' + document.getElementById('shTitle').textContent + '|' + [...document.querySelectorAll('#shBody button')].map((b) => b.textContent.trim()).join(' / ')));
await page.evaluate(() => document.querySelector('[data-act="undoStep"]') && document.querySelector('[data-act="undoStep"]').click()); await sleep(1200); await shot('5_undone');
console.log('after undo', await page.evaluate(() => JSON.stringify({ moves: window.__game.moves, playing: window.__game.playing, sheet: document.getElementById('sheet').className })));
await browser.close();
