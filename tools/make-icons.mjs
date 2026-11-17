// Builds every app icon from the one master picture: node tools/make-icons.mjs <master.png>
import sharp from 'sharp'; import fs from 'fs';
const src = process.argv[2]; const out = 'public/icons';
const sq = (n) => sharp(src).resize(n, n, { fit: 'cover' }).png();
fs.copyFileSync(src, 'public/art/brand/icon-main.png');
await sq(1024).toFile(`${out}/icon-1024.png`); await sq(512).toFile(`${out}/icon-512.png`); await sq(192).toFile(`${out}/icon-192.png`);
await sq(180).toFile(`${out}/apple-touch-icon.png`); await sq(64).toFile(`${out}/favicon-64.png`);
// adaptive foreground: a blurred, zoomed copy fills the corners; the picture sits on top at 88% so the round/squircle mask never cuts the face or sword
const bg = await sharp(src).resize(432, 432, { fit: 'cover' }).blur(18).modulate({ brightness: 0.9 }).png().toBuffer();
const fg = await sharp(src).resize(380, 380).png().toBuffer();
await sharp(bg).composite([{ input: fg, gravity: 'center' }]).png().toFile(`${out}/adaptive-foreground-432.png`);
await sharp(src).resize(1280, 720, { fit: 'cover', position: 'attention' }).webp({ quality: 88 }).toFile('public/art/brand/icon-landscape.webp');
console.log('icons written');
