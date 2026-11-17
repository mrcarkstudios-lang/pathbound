import puppeteer from 'puppeteer-core';
const [W, H] = [+process.argv[2] || 800, +process.argv[3] || 360];
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.setViewport({ width: W, height: H }); p.on('pageerror', (e) => console.log('[err]', e.message));
await p.goto('http://localhost:5173/', { waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 8000));
await p.evaluate(() => { document.documentElement.style.setProperty('--banner-h', '56px'); document.querySelector('#dkShop').click(); });
await new Promise((r) => setTimeout(r, 800)); await p.screenshot({ path: `shop_${W}.png` }); await b.close();
