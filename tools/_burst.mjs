import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 844, height: 390 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://localhost:5173/?level=3&unlock=1&ads=off', { waitUntil: 'load' }); await sleep(6000);
await page.evaluate(() => document.querySelector('[data-act="gotit"]') && document.querySelector('[data-act="gotit"]').click()); await sleep(600);
await page.evaluate(() => { document.getElementById('coach').classList.add('hidden'); window.__game.world.scenery.celebrate(1); });
for (const t of [0.6, 1.4, 2.4]) { await sleep(t === 0.6 ? 600 : 900); await page.screenshot({ path: `../art_in/B_${t}.png` }); }
await browser.close();
