// usage: node tools/_sheet.mjs out.png cols tile file1 file2 ...   (files relative to art_in/z)
import sharp from 'sharp'; import path from 'node:path';
const [out, cols, tile, ...files] = process.argv.slice(2); const C = +cols, T = +tile;
const root = path.resolve(import.meta.dirname, '../../art_in/z');
const rows = Math.ceil(files.length / C);
const comps = [];
for (let i = 0; i < files.length; i++) {
  const buf = await sharp(path.join(root, files[i])).resize(T, T, { fit: 'contain', background: '#444' }).png().toBuffer();
  comps.push({ input: buf, left: (i % C) * T, top: Math.floor(i / C) * T });
}
await sharp({ create: { width: C * T, height: rows * T, channels: 3, background: '#333' } }).composite(comps).png().toFile(path.resolve(import.meta.dirname, '../../art_in', out));
