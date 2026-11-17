// Converts the generated backdrop PNGs (art_in/pathbound_pack/art_in/bg-wNN-*.png) into game webp files, plus the blurred "soft" version used behind the board.
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const SRC = path.resolve('../art_in/pathbound_pack/art_in'), OUT = path.resolve('public/art/backgrounds');
let n = 0;
for (const f of fs.readdirSync(SRC).filter((x) => /^bg-w\d\d-(landscape|portrait)\.png$/.test(x))) {
  const [, w, o] = f.match(/^bg-w(\d\d)-(landscape|portrait)\.png$/); const base = w === '00' ? `bg-title-${o}` : `bg-w${w}-${o}`;
  await sharp(path.join(SRC, f)).webp({ quality: 82 }).toFile(path.join(OUT, base + '.webp'));
  if (w !== '00') await sharp(path.join(SRC, f)).resize({ width: o === 'landscape' ? 960 : 540 }).blur(4).modulate({ brightness: 0.86, saturation: 0.9 }).webp({ quality: 72 }).toFile(path.join(OUT, base + '-soft.webp'));
  n++;
}
console.log('converted', n);
