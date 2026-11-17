// Wall textures for the floating stone blocks: one generated texture per world (public/art/textures).
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map();
export function artUrl(p) { return `${import.meta.env.BASE_URL}art/${p}`.replace('//', '/'); }

/** Loads a tiling colour texture once. */
export function loadTexture(p, { repeat = 1 } = {}) {
  if (cache.has(p)) return cache.get(p);
  const t = loader.load(artUrl(p)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.repeat.set(repeat, repeat);
  cache.set(p, t); return t;
}
/** Material for tile bodies in world n. The texture is also used as a bump map, so the stone has a little relief. */
export function wallMaterial(worldNo, tint = 0xffffff) {
  const t = loadTexture(`textures/tex-w${String(worldNo).padStart(2, '0')}-wall.webp`);
  return new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 1.4, color: tint, roughness: 0.95, metalness: 0 });
}
/** BoxGeometry whose side faces repeat the texture along their height, so tall columns do not smear it. */
export function texturedBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv;
  for (const f of [0, 1, 4, 5]) for (let i = 0; i < 4; i++) { const idx = f * 4 + i; uv.setY(idx, uv.getY(idx) * h / w); } // +x, -x, +z, -z
  uv.needsUpdate = true; return g;
}

// ---- painted flagstone / plank floors, drawn once per world (no files to download)
const FLOOR = {
  1: { base: [150, 140, 96], grout: [70, 62, 40], moss: [96, 150, 60], style: 'stone' },
  2: { base: [150, 156, 166], grout: [70, 74, 86], moss: [110, 140, 120], style: 'stone' },
  3: { base: [176, 184, 204], grout: [92, 100, 130], moss: null, style: 'stone' },
  4: { base: [128, 102, 80], grout: [48, 34, 26], moss: null, style: 'stone' },
  5: { base: [92, 112, 78], grout: [36, 48, 34], moss: [120, 170, 70], style: 'stone' },
  6: { base: [170, 120, 70], grout: [60, 38, 22], moss: null, style: 'wood' },
  7: { base: [112, 96, 176], grout: [40, 30, 80], moss: null, style: 'stone' },
  8: { base: [110, 70, 60], grout: [36, 16, 12], moss: null, style: 'stone' },
  9: { base: [140, 160, 196], grout: [60, 76, 112], moss: null, style: 'stone' },
  10: { base: [124, 100, 150], grout: [44, 30, 64], moss: null, style: 'stone' },
};
const floorCache = new Map();
function rng(seed) { let s = seed | 0; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffff) / 0xffff; }; }
export function floorMaterial(worldNo, variant = 0) {
  const key = worldNo + ':' + variant; if (floorCache.has(key)) return floorCache.get(key);
  const F = FLOOR[worldNo] || FLOOR[1]; const S = 256; const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); const r = rng(worldNo * 97 + variant * 31 + 7);
  const col = (a, k) => `rgb(${Math.max(0, Math.min(255, a[0] * k)) | 0},${Math.max(0, Math.min(255, a[1] * k)) | 0},${Math.max(0, Math.min(255, a[2] * k)) | 0})`;
  g.fillStyle = col(F.grout, 1); g.fillRect(0, 0, S, S);
  const slab = (x, y, w, h, k) => { // one stone: lit top-left edge, darker bottom-right edge, speckle
    g.fillStyle = col(F.base, k); g.fillRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x + 3, y + 3, w - 6, 3); g.fillRect(x + 3, y + 3, 3, h - 6);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 3, y + h - 6, w - 6, 3); g.fillRect(x + w - 6, y + 3, 3, h - 6);
    for (let i = 0; i < 30; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'; g.fillRect(x + 6 + r() * (w - 14), y + 6 + r() * (h - 14), 2 + r() * 3, 2 + r() * 3); }
  };
  if (F.style === 'wood') { for (let i = 0; i < 4; i++) { const k = 0.85 + r() * 0.3; const y = i * 64; g.fillStyle = col(F.base, k); g.fillRect(0, y + 2, S, 60); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let j = 0; j < 6; j++) g.fillRect(r() * S, y + 8 + r() * 46, 40 + r() * 80, 2); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y + 2, S, 3); const off = r() * 200; g.fillStyle = col(F.grout, 1); g.fillRect(off, y, 3, 64); } }
  else { const cols = [[0, 128], [128, 128]]; const rows = variant % 2 ? [[0, 90], [90, 70], [160, 96]] : [[0, 128], [128, 128]]; for (const [ry, rh] of rows) { const split = 60 + r() * 136; slab(0, ry, split, rh, 0.88 + r() * 0.26); slab(split, ry, S - split, rh, 0.88 + r() * 0.26); } void cols; }
  if (F.moss) for (let i = 0; i < 26; i++) { const x = r() * S, y = r() * S; g.fillStyle = col(F.moss, 0.8 + r() * 0.5); for (let b = 0; b < 4; b++) g.fillRect(x + b * 2 - 3, y - b * 3, 2, 5 + b * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0, color: 0xffffff }); m.color.setRGB(1.25, 1.25, 1.25);
  floorCache.set(key, m); return m;
}
