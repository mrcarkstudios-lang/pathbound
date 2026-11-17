// node tools/_montage.mjs out.png cols h file...  (art_in files)
import sharp from 'sharp'; import path from 'node:path';
const [out, cols, hh, ...files] = process.argv.slice(2); const base = path.resolve(import.meta.dirname, '../../art_in'); const H = +hh;
const bufs = await Promise.all(files.map((f) => sharp(path.join(base, f)).resize({ height: H }).png().toBuffer()));
const metas = await Promise.all(bufs.map((b) => sharp(b).metadata())); const C = +cols; const rows = Math.ceil(files.length / C);
const colW = Array.from({ length: C }, (_, c) => Math.max(...metas.filter((_, i) => i % C === c).map((m) => m.width)));
const comps = bufs.map((b, i) => ({ input: b, left: colW.slice(0, i % C).reduce((a, x) => a + x + 6, 0), top: Math.floor(i / C) * (H + 6) }));
await sharp({ create: { width: colW.reduce((a, x) => a + x + 6, 0), height: rows * (H + 6), channels: 3, background: '#222' } }).composite(comps).png().toFile(path.join(base, out));
