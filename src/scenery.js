// Everything around the board: the painted backdrop (DOM), floating islands and clouds (camera-facing sprites drawn
// behind the board, so they slide past it when the view rotates) and weather particles (drawn in the main scene).
import * as THREE from 'three';
import { artUrl } from './textures.js';

const ISLAND = { 1: 'grass', 2: 'ruins', 3: 'sky', 4: 'temple', 5: 'forest', 6: 'castle', 7: 'crystal', 8: 'lava', 9: 'ice', 10: 'cosmic' };
// particle look per world: sprite, colour, blend, size (px), fall speed (+ rises, - falls), sideways drift, count
const WEATHER = {
  2: { sprite: 'fx-smoke', color: 0xc9d0d8, additive: false, size: 34, vy: 0.05, vx: 0.25, n: 12, opacity: 0.18 },
  3: { sprite: 'fx-sparkle', color: 0xcff4ff, additive: true, size: 16, vy: 0.2, vx: 0.2, n: 24 },
  4: { sprite: 'fx-ember', color: 0xffb060, additive: true, size: 12, vy: 0.35, vx: 0.1, n: 30 },
  5: { sprite: 'fx-firefly', color: 0xd8ff7a, additive: true, size: 15, vy: 0.08, vx: 0.15, n: 34, wander: 1 },
  6: { sprite: 'fx-ember', color: 0xffd08a, additive: true, size: 10, vy: 0.3, vx: 0.3, n: 24 },
  7: { sprite: 'fx-star', color: 0xe08aff, additive: true, size: 18, vy: 0.1, vx: 0.05, n: 36, twinkle: 1 },
  8: { sprite: 'fx-ember', color: 0xff7a30, additive: true, size: 13, vy: 0.9, vx: 0.2, n: 46 },
  9: { sprite: 'fx-snow', color: 0xdff0ff, additive: true, size: 13, vy: -0.5, vx: 0.15, n: 40 },
  10: { sprite: 'fx-star', color: 0xffe8a0, additive: true, size: 18, vy: 0.04, vx: 0.04, n: 44, twinkle: 1 },
};
// falling pieces that tumble and sway (real quads, not flat dots): world -> list of kinds
const FLUTTER = {
  1: [{ sprite: 'fx-petal', n: 44, size: [0.34, 0.66], fall: [0.55, 1.2], sway: [0.5, 1.4] }],
  2: [{ sprite: 'fx-leaf', n: 9, size: [0.4, 0.7], fall: [0.7, 1.2], sway: [0.6, 1.3], tint: 0xa8b8a0 }],
  5: [{ sprite: 'fx-leaf', n: 12, size: [0.4, 0.72], fall: [0.6, 1.1], sway: [0.7, 1.5], tint: 0x6f9a68 }],
};
// cloud tint per world (dark worlds get dark, glowing clouds)
const CLOUD = { 1: 0xffffff, 2: 0xc8ced8, 3: 0xffffff, 4: 0x6a5a58, 5: 0x4d6a5e, 6: 0xffc8c0, 7: 0xb890ff, 8: 0x6a3a30, 9: 0x8aa8d8, 10: 0xb89ae8 };
const CLOUD_WORLDS = new Set([1, 2, 3, 6, 9]);
const rand = (() => { let s = 12345; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();

const texLoader = new THREE.TextureLoader(); const texCache = new Map();
function tex(p) { if (!texCache.has(p)) { const t = texLoader.load(artUrl(p)); t.colorSpace = THREE.SRGBColorSpace; texCache.set(p, t); } return texCache.get(p); }
function sprite(p, width, color = 0xffffff, opacity = 1) {
  const t = tex(p); const m = new THREE.SpriteMaterial({ map: t, color, transparent: true, opacity, depthWrite: false });
  const s = new THREE.Sprite(m); s.scale.set(width, width, 1);
  const fit = () => { const im = t.image; if (im && im.width) s.scale.set(width, width * im.height / im.width, 1); };
  if (t.image && t.image.width) fit(); else { const old = t.onUpdate; t.onUpdate = () => { fit(); old && old(); }; setTimeout(fit, 300); setTimeout(fit, 1500); }
  return s;
}

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

/** Petals or leaves drifting down: every piece sways on its own rhythm, tumbles in 3D, and a slow wind gusts across them. */
class Flutter {
  constructor(cfg, cx, cz, span) {
    this.cfg = cfg; this.cx = cx; this.cz = cz; this.span = span; this.top = 13; this.bottom = -3.5; this.tint = new THREE.Color(cfg.tint ?? 0xffffff);
    const mat = new THREE.MeshBasicMaterial({ map: tex(`fx/${cfg.sprite}.webp`), transparent: true, alphaTest: 0.04, side: THREE.DoubleSide, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, cfg.n); this.mesh.frustumCulled = false;
    this.items = Array.from({ length: cfg.n }, () => this.spawn(true));
  }
  spawn(first = false) {
    const c = this.cfg;
    return { x0: this.cx + (rand() * 2 - 1) * this.span, z0: this.cz + (rand() * 2 - 1) * this.span, y: first ? lerp(this.bottom, this.top, rand()) : this.top + rand() * 3,
      vy: lerp(c.fall[0], c.fall[1], rand()), sa: lerp(c.sway[0], c.sway[1], rand()), sf: lerp(0.8, 1.7, rand()), ph: rand() * 6.28, size: lerp(c.size[0], c.size[1], rand()),
      rx: lerp(1.2, 3.2, rand()), ry: lerp(0.8, 2.4, rand()) * (rand() < 0.5 ? -1 : 1), rz: lerp(0.8, 2.0, rand()) };
  }
  update(dt, t) {
    const wind = 0.45 + 0.35 * Math.sin(t * 0.23) + 0.15 * Math.sin(t * 0.71); // gusts push the whole shower sideways now and then
    for (let i = 0; i < this.items.length; i++) {
      let it = this.items[i];
      it.y -= it.vy * dt * (1 + 0.15 * Math.max(0, Math.sin(t * 0.23)));
      it.x0 += wind * dt * (0.5 + it.sf * 0.25);
      if (it.x0 > this.cx + this.span) it.x0 -= this.span * 2;
      if (it.y < this.bottom) { it = this.items[i] = this.spawn(); }
      const x = it.x0 + Math.sin(t * it.sf + it.ph) * it.sa, z = it.z0 + Math.cos(t * it.sf * 0.8 + it.ph) * it.sa * 0.7;
      const ex = 1.0 + Math.sin(t * it.rx + it.ph) * 1.1, ey = t * it.ry + it.ph, ez = Math.sin(t * it.rz + it.ph * 2) * 0.8 + wind * 0.4;
      _e.set(ex, ey, ez); _q.setFromEuler(_e);
      const fade = smooth((it.y - this.bottom) / 2.5) * smooth((this.top + 3 - it.y) / 1.5) ; // shrink in and out so nothing pops
      const sc = it.size * fade * (0.85 + 0.15 * Math.abs(Math.sin(t * it.rx + it.ph)));
      _p.set(x, it.y, z); _s.set(sc, sc, sc); _m.compose(_p, _q, _s); this.mesh.setMatrixAt(i, _m);
      const shade = 0.7 + 0.3 * Math.abs(Math.cos(ex) * Math.cos(ez)); this.mesh.setColorAt(i, _c.copy(this.tint).multiplyScalar(shade));
    }
    this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/** A short celebration: pieces fly up from the board, spin, and rain back down. */
class Burst {
  constructor(sprite, additive, color, cx, cz, n = 70) {
    const mat = new THREE.MeshBasicMaterial({ map: tex(`fx/${sprite}.webp`), transparent: true, alphaTest: 0.03, side: THREE.DoubleSide, depthWrite: false, color, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, n); this.mesh.frustumCulled = false; this.age = 0; this.life = 3.6;
    this.items = Array.from({ length: n }, () => { const a = rand() * 6.28, sp = lerp(1.5, 5, rand()); return { x: cx + (rand() - 0.5) * 3, y: 1 + rand(), z: cz + (rand() - 0.5) * 3, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: lerp(5, 11, rand()), size: lerp(0.3, 0.6, rand()), rx: lerp(2, 7, rand()), ry: lerp(2, 7, rand()), ph: rand() * 6.28, delay: rand() * 0.35 }; });
  }
  update(dt) {
    this.age += dt; const g = -9.5;
    this.items.forEach((it, i) => {
      const a = Math.max(0, this.age - it.delay); it.vx *= 1 - 0.8 * dt; it.vz *= 1 - 0.8 * dt;
      const k = a > 0 ? 1 : 0; it.x += it.vx * dt * k; it.z += it.vz * dt * k; it.y += it.vy * dt * k; if (k) it.vy = (it.vy + g * dt) * (it.vy < 0 ? 1 - 1.6 * dt : 1); // falls slowly once it drops: a flutter, not a stone
      _e.set(a * it.rx + it.ph, a * it.ry, 0); _q.setFromEuler(_e);
      const sc = k ? it.size * smooth(a / 0.2) * smooth((this.life - this.age) / 0.8) : 0; _p.set(it.x, it.y, it.z); _s.set(sc, sc, sc); _m.compose(_p, _q, _s); this.mesh.setMatrixAt(i, _m);
    });
    this.mesh.instanceMatrix.needsUpdate = true; return this.age < this.life;
  }
}

export class Scenery {
  constructor() {
    this.bg = new THREE.Scene();          // drawn first, behind the board
    this.fg = new THREE.Group();          // added to the main scene by the World
    this.t = 0; this.items = []; this.weather = null; this.theme = null; this.flutters = []; this.bursts = [];
    this.el = document.getElementById('bg');
    window.addEventListener('resize', () => this.paintBackdrop());
  }

  /** The painted background behind the canvas: world art in the right orientation. */
  setBackdrop(key, soft = false) { this.key = key; this.soft = soft; this.paintBackdrop(); }
  paintBackdrop() {
    if (!this.el || !this.key) return; const portrait = window.innerHeight > window.innerWidth * 1.05;
    const name = this.key === 'title' ? 'bg-title' : `bg-w${String(this.key).padStart(2, '0')}`;
    const url = artUrl(`backgrounds/${name}-${portrait ? 'portrait' : 'landscape'}${this.soft && this.key !== 'title' ? '-soft' : ''}.webp`);
    if (this.url === url) return; this.url = url;
    const next = this.el.querySelector('.layer.next'); const cur = this.el.querySelector('.layer.cur');
    next.style.backgroundImage = `url("${url}")`;
    // cross-fade between worlds: the new layer fades in, then becomes the current one
    next.style.opacity = '1';
    setTimeout(() => { cur.style.backgroundImage = next.style.backgroundImage; next.style.opacity = '0'; }, 600);
  }

  /** Rebuild the islands, clouds and weather for a world and a board of w x h tiles. */
  set(worldNo, w, h, tile, rockY) {
    for (const c of [...this.bg.children]) { this.bg.remove(c); c.material && c.material.dispose && c.material.dispose(); }
    for (const c of [...this.fg.children]) { this.fg.remove(c); c.dispose && c.dispose(); c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); }
    this.items = []; this.weather = null; this.flutters = []; this.bursts = [];
    const cx = (w - 1) * tile / 2, cz = (h - 1) * tile / 2; const R = Math.hypot(cx, cz) + 4; this.center = new THREE.Vector3(cx, 0, cz); this.R = R;
    // floating islands ring the board
    const isl = `scenery/island-${ISLAND[worldNo]}.webp`; const count = 3; let a0 = rand() * 6;
    for (let i = 0; i < count; i++) {
      const size = 3.6 + rand() * 2.6; const ang = a0 + i * (Math.PI * 2 / count) + rand() * 0.5; const rad = R + 5 + size * 0.6 + rand() * 5;
      const s = sprite(isl, size, 0xe4e8f2, worldNo === 9 || worldNo === 10 ? 0.95 : 1);
      s.userData = { ang, rad, y: -4 + rand() * 6, bob: rand() * 6, spd: 0.35 + rand() * 0.4, amp: 0.25 + rand() * 0.3, drift: 0 };
      s.position.set(cx + Math.cos(ang) * rad, s.userData.y, cz + Math.sin(ang) * rad); this.bg.add(s); this.items.push(s);
    }
    // clouds drift slowly around the board
    for (let i = 0; i < (CLOUD_WORLDS.has(worldNo) ? 3 : 0); i++) { // dark worlds have no clouds: pale puffs look wrong there
      const s = sprite(`scenery/cloud-${1 + (i % 3)}.webp`, 4.5 + rand() * 4.5, CLOUD[worldNo], worldNo >= 7 || worldNo === 4 || worldNo === 5 ? 0.5 : 0.85);
      const ang = rand() * 6.28, rad = R + 2 + rand() * 12; s.userData = { ang, rad, y: -4 + rand() * 12, bob: rand() * 6, spd: 0.2 + rand() * 0.3, amp: 0.15, drift: (0.01 + rand() * 0.02) * (rand() < 0.5 ? -1 : 1) };
      s.position.set(cx + Math.cos(ang) * rad, s.userData.y, cz + Math.sin(ang) * rad); this.bg.add(s); this.items.push(s);
    }
    // falling petals / leaves
    for (const cfg of FLUTTER[worldNo] || []) { const f = new Flutter(cfg, cx, cz, Math.max(w, h) * tile * 0.5 + 9); this.fg.add(f.mesh); this.flutters.push(f); }
    // weather
    const W = WEATHER[worldNo]; if (W) {
      const n = W.n; const pos = new Float32Array(n * 3); const span = Math.max(w, h) * tile * 0.5 + 9;
      for (let i = 0; i < n; i++) { pos[i * 3] = cx + (rand() * 2 - 1) * span; pos[i * 3 + 1] = rand() * 14 - 1; pos[i * 3 + 2] = cz + (rand() * 2 - 1) * span; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ map: tex(`fx/${W.sprite}.webp`), color: W.color, size: W.size, sizeAttenuation: true, transparent: true, opacity: W.opacity ?? 0.9, depthWrite: false, blending: W.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
      const p = new THREE.Points(g, m); p.frustumCulled = false; this.fg.add(p); this.weather = { p, W, span, cx, cz, phase: Array.from({ length: n }, () => rand() * 6.28) };
    }
  }

  /** Petals (world 1) or golden sparkles (other worlds) burst over the board when a level is won. */
  celebrate(worldNo) {
    const petals = worldNo === 1; const b = new Burst(petals ? 'fx-petal' : 'fx-sparkle', !petals, petals ? 0xffffff : 0xffd870, this.center.x, this.center.z, petals ? 70 : 60);
    this.fg.add(b.mesh); this.bursts.push(b);
  }

  update(dt) {
    this.t += dt; const t = this.t;
    for (const f of this.flutters) f.update(dt, t);
    for (let i = this.bursts.length - 1; i >= 0; i--) if (!this.bursts[i].update(dt)) { const b = this.bursts.splice(i, 1)[0]; this.fg.remove(b.mesh); b.mesh.dispose(); b.mesh.material.dispose(); b.mesh.geometry.dispose(); }
    for (const s of this.items) { const u = s.userData; u.ang += u.drift * dt; s.position.set(this.center.x + Math.cos(u.ang) * u.rad, u.y + Math.sin(t * u.spd + u.bob) * u.amp, this.center.z + Math.sin(u.ang) * u.rad); }
    const k = this.weather; if (k) {
      const a = k.p.geometry.attributes.position; const W = k.W; const top = 13, bottom = -2;
      for (let i = 0; i < a.count; i++) {
        let x = a.getX(i), y = a.getY(i), z = a.getZ(i); const ph = k.phase[i];
        y += W.vy * dt; x += (W.vx + (W.wander ? Math.sin(t * 0.9 + ph) * 0.5 : Math.sin(t * 0.6 + ph) * 0.25)) * dt; z += (W.wander ? Math.cos(t * 0.7 + ph) * 0.5 : Math.cos(t * 0.5 + ph) * 0.18) * dt;
        if (y > top) y = bottom; else if (y < bottom) y = top;
        if (x > k.cx + k.span) x -= k.span * 2; else if (x < k.cx - k.span) x += k.span * 2;
        a.setXYZ(i, x, y, z);
      }
      a.needsUpdate = true; if (W.twinkle) k.p.material.opacity = 0.65 + Math.sin(t * 2.2) * 0.25;
    }
  }
}
