// Click through every screen and save screenshots: node tools/ui-test.mjs <outPrefix> [width] [height]
import puppeteer from 'puppeteer-core';
const [out = 'ui', w = '390', h = '844'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', `--window-size=${w},${h}`] });
const page = await browser.newPage(); await page.setViewport({ width: +w, height: +h, deviceScaleFactor: 1 });
page.on('console', (m) => { if (['error'].includes(m.type())) console.log('[error]', m.text().slice(0, 300)); }); page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 400)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const shot = async (n) => { await page.screenshot({ path: `${out}_${n}.png` }); };
const click = async (sel) => { await page.evaluate((s) => document.querySelector(s).click(), sel); await sleep(700); };
await page.goto('http://localhost:5173/?level=1', { waitUntil: 'load' }); await sleep(7000); await shot('1_play');
await click('#btnHint'); await shot('2_hintsheet');
await click('[data-act="reveal"]'); await sleep(500); await shot('3_hintmarks');
await click('#btnRotate'); await sleep(900); await shot('4_rotated');
await page.evaluate(() => { window.__game.moves = window.__game.data.solution_best.moves; window.__game.recompute(); }); await sleep(500);
await click('#btnPlay'); await sleep(16000); await shot('5_win');
const sheet = await page.evaluate(() => document.getElementById('sheet').className + '|' + document.getElementById('shTitle').textContent); console.log('after play:', sheet);
await page.evaluate(() => document.querySelector('[data-act="adBonus"]') && document.querySelector('[data-act="adBonus"]').click()); await sleep(700); await shot('6_adsim');
await page.evaluate(() => document.querySelector('#adSim .adClose') && (document.querySelector('#adSim .adClose').disabled = false)); await sleep(4800); await page.evaluate(() => document.querySelector('#adSim .adClose').click()); await sleep(600); await shot('7_afterad');
await page.evaluate(() => document.querySelector('[data-act="levels"]').click()); await sleep(1500); await shot('8_select');
await page.evaluate(() => document.getElementById('selBack').click()); await sleep(1500);
for (const [id, n] of [['dkShop', '9_shop'], ['dkDaily', '10_daily'], ['dkSettings', '11_settings']]) { await click('#' + id); await sleep(500); await shot(n); await page.evaluate(() => document.getElementById('sheet').classList.add('hidden')); }
await browser.close();
