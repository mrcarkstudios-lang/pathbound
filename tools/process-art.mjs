// Turns the raw Gemini images (art_in/z) into game-ready files in public/art (WebP with alpha) and public/icons.
//   node tools/process-art.mjs [raw folder]
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const RAW = path.resolve(process.argv[2] || path.resolve(import.meta.dirname, '../../art_in/z'));
const OUT = path.resolve(import.meta.dirname, '../public/art');
const ICONS = path.resolve(import.meta.dirname, '../public/icons');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(ICONS, { recursive: true });
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const rel = (f) => path.relative(RAW, f).split(path.sep).join('/');

/** Removes the flat magenta background by flood-filling inwards from the border, then cleans the fringe. */
async function keyMagenta(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H; const bg = new Uint8Array(N);
  const isBg = (i) => { const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]; const m = Math.min(r, b); return m > 110 && g < m * 0.66 && Math.abs(r - b) < 80; };
  const stack = [];
  const push = (i) => { if (!bg[i] && isBg(i)) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); } for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
  while (stack.length) { const i = stack.pop(); const x = i % W, y = (i / W) | 0; if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W); }
  // alpha: 0 on background, then soften the one-pixel edge and remove the pink halo
  let a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = bg[i] ? 0 : 1;
  const edge = new Uint8Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (bg[i]) continue; if (bg[i - 1] || bg[i + 1] || bg[i - W] || bg[i + W] || bg[i - W - 1] || bg[i + W + 1] || bg[i - W + 1] || bg[i + W - 1]) edge[i] = 1; }
  for (let i = 0; i < N; i++) if (edge[i]) { const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]; const m = Math.min(r, b); if (m > 90 && g < m * 0.85) a[i] = 0.35; }
  if (/(scenery\/|ui\/tile-level-locked)/.test(file.split(path.sep).join('/'))) { // pockets of background enclosed by roots and rocks cannot be reached from the border
    for (let i = 0; i < N; i++) if (!bg[i]) { const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]; if (r > 185 && b > 185 && g < 105) { a[i] = 0; bg[i] = 1; } }
  }
  const soft = new Float32Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += a[i + dy * W + dx]; soft[i] = (a[i] * 4 + s) / 13; }
  const out = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    let r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]; const al = bg[i] ? 0 : soft[i];
    if (al > 0 && al < 1 || edge[i]) { const k = Math.max(0, Math.min(r, b) - g) * 0.75; r -= k; b -= k; } // despill the magenta
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = Math.round(al * 255);
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } });
}
/** Black-background glow sprite: brightness becomes alpha (works with normal and additive blending). */
async function keyBlack(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const N = info.width * info.height; const out = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) { const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2]; const a = Math.max(r, g, b); const k = a ? 255 / a : 0; out[i * 4] = Math.min(255, r * k); out[i * 4 + 1] = Math.min(255, g * k); out[i * 4 + 2] = Math.min(255, b * k); out[i * 4 + 3] = a; }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
}
/** Makes a texture tile seamlessly: blends the image with a half-shifted copy of itself. */
async function seamless(file, size) {
  const { data, info } = await sharp(file).resize(size, size).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(size * size * 3); const h = size / 2;
  const w = (v) => { const t = 1 - Math.abs(v - h) / h; return t * t * (3 - 2 * t); }; // 1 in the middle, 0 on the edges
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const m = w(x) * w(y); const sx = (x + h) % size, sy = (y + h) % size; const i = (y * size + x) * 3, j = (sy * size + sx) * 3;
    for (let c = 0; c < 3; c++) out[i + c] = data[i + c] * m + data[j + c] * (1 - m);
  }
  return sharp(out, { raw: { width: size, height: size, channels: 3 } });
}
const KEY_MAGENTA = (r) => /^(brand\/(logo-|app-icon-foreground)|ui\/|shop\/|scenery\/|fx\/fx-(petal|leaf|smoke))/.test(r);
const KEY_BLACK = (r) => /^fx\/fx-(glow|sparkle|ember|firefly|star|snow|coin-burst)/.test(r);
const MAXPX = (r) => r.startsWith('ui/icon-') || r.startsWith('ui/rune-') ? 256 : r.startsWith('fx/') ? 192 : r.startsWith('brand/logo') ? 1024 : 512;
const log = []; let n = 0;
const save = async (img, name, w, q = 84) => { const f = path.join(OUT, name); fs.mkdirSync(path.dirname(f), { recursive: true }); await img.resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).webp({ quality: q, alphaQuality: 95 }).toFile(f); n++; log.push(name); };

for (const f of walk(RAW).filter((x) => x.endsWith('.png')).sort()) {
  const r = rel(f); const base = r.replace(/\.png$/, '');
  try {
    if (r.startsWith('textures/')) { const s = await seamless(f, 512); if (/overlay|runes/.test(r)) { await save(s, base + '.webp', 512, 80); } else await save(s, base + '.webp', 512, 80); continue; }
    if (r.startsWith('backgrounds/') || r.startsWith('worldcards/') || r === 'brand/splash-loading.png' || r === 'brand/social-share-1200x630.png' || r === 'brand/store-feature-1024x500.png' || r === 'brand/app-icon-1024.png') {
      const im = sharp(f); await save(im, base + '.webp', r.startsWith('backgrounds/') ? 1376 : 1200, r.startsWith('backgrounds/') ? 78 : 84);
      if (/^backgrounds\/bg-w\d\d-/.test(r)) { // a calmer copy for play: out of focus and a little dimmer, so the board is the sharpest thing on screen
        const soft = await sharp(f).resize({ width: 960 }).blur(5).modulate({ brightness: 0.82, saturation: 0.82 }).webp({ quality: 70 }).toBuffer();
        const o = path.join(OUT, base + '-soft.webp'); fs.writeFileSync(o, soft); n++; log.push(base + '-soft.webp');
      }
      continue;
    }
    let im = KEY_MAGENTA(r) ? await keyMagenta(f) : KEY_BLACK(r) ? await keyBlack(f) : sharp(f);
    if (r === 'ui/icon-undo.png') { const buf = await im.png().toBuffer(); im = sharp(buf).flop(); } // the generated arrow pointed forward
    if (KEY_MAGENTA(r) || KEY_BLACK(r)) { const buf = await im.png().toBuffer(); im = sharp(await sharp(buf).trim({ threshold: 4 }).toBuffer()); } // crop to the artwork
    await save(im, base + '.webp', MAXPX(r), 88);
  } catch (e) { console.log('FAILED', r, e.message); }
}

// ---- app icons and favicons from the generated master icon
const master = path.join(RAW, 'brand/app-icon-1024.png');
for (const [s, name] of [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'apple-touch-icon.png'], [64, 'favicon-64.png'], [1024, 'icon-1024.png']]) await sharp(master).resize(s, s).png().toFile(path.join(ICONS, name));
// adaptive-icon foreground: the cut-out emblem centred inside the safe zone of a 432 px canvas
{ const cut = await (await keyMagenta(path.join(RAW, 'brand/app-icon-foreground.png'))).png().toBuffer(); const t = await sharp(cut).trim({ threshold: 4 }).resize(250, 250, { fit: 'inside' }).toBuffer();
  await sharp({ create: { width: 432, height: 432, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: t, gravity: 'centre' }]).png().toFile(path.join(ICONS, 'adaptive-foreground-432.png')); }
// logo PNG for sharing
await (await keyMagenta(path.join(RAW, 'brand/logo-full.png'))).trim({ threshold: 4 }).png().toFile(path.join(OUT, 'brand/logo-full.png')).catch(() => {});
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(log, null, 0));
console.log(n, 'files written to', OUT);
