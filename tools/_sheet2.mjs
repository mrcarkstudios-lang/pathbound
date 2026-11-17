// usage: node tools/_sheet2.mjs out.png cols tile file1 file2 ...   (files relative to public/art, on a green-grey backdrop to expose halos)
import sharp from 'sharp'; import path from 'node:path';
const [out, cols, tile, ...files] = process.argv.slice(2); const C = +cols, T = +tile;
const root = path.resolve(import.meta.dirname, '../public/art');
const rows = Math.ceil(files.length / C); const comps = [];
for (let i = 0; i < files.length; i++) {
  const buf = await sharp(path.join(root, files[i])).resize(T - 8, T - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  comps.push({ input: buf, left: (i % C) * T + 4, top: Math.floor(i / C) * T + 4 });
}
await sharp({ create: { width: C * T, height: rows * T, channels: 3, background: '#2d5a4a' } }).composite(comps).png().toFile(path.resolve(import.meta.dirname, '../../art_in', out));
