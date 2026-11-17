// Tutorial flow: node tools/tut-test.mjs <outPrefix> [w] [h]
import puppeteer from 'puppeteer-core';
const [out = 'tut', w = '844', h = '390'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: +w, height: +h });
page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300))); page.on('console', (m) => m.type() === 'error' && console.log('[error]', m.text().slice(0, 200)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const shot = (n) => page.screenshot({ path: `${out}_${n}.png` });
await page.goto('http://localhost:5173/?level=1&ads=off&mode=plan', { waitUntil: 'load' }); await sleep(7000); await shot('1_start');
const tapNext = async () => { await page.evaluate(() => { const g = window.__game; const i = g.hintInfo(1); if (i.cells) g.tap(i.cells[0]); }); await sleep(500); };
await tapNext(); await shot('2_go');
await tapNext(); await tapNext(); await tapNext(); await sleep(300); await shot('3_done');
await page.evaluate(() => document.getElementById('btnPlay').click()); await sleep(7500); await shot('4_burst'); await sleep(3500); await shot('5_win');
await page.evaluate(() => document.querySelector('[data-act="next"]').click()); await sleep(5500); await shot('6_level2');
await page.goto('http://localhost:5173/?level=3&unlock=1&ads=off', { waitUntil: 'load' }); await sleep(6500); await shot('7_card_coins');
await page.evaluate(() => document.querySelector('[data-act="gotit"]') && document.querySelector('[data-act="gotit"]').click()); await sleep(900); await shot('8_after_card');
await page.goto('http://localhost:5173/?level=15&unlock=1&ads=off', { waitUntil: 'load' }); await sleep(6500); await shot('9_card_wait');
await browser.close();
