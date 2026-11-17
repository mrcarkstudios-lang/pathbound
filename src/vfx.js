// Particle effects: dust, sparkles, debris, confetti. One pooled sprite system, textures from public/art/fx.
import * as THREE from 'three';
import { loadTexture } from './textures.js';

const KINDS = {
  dust:    { tex: 'fx/fx-smoke.webp',   color: 0xcdbf9a, count: 5,  speed: 1.0, up: 0.8, life: 0.55, size: 0.55, grow: 1.6, gravity: -1, fade: 0.6 },
  spark:   { tex: 'fx/fx-sparkle.webp', color: 0xffe27a, count: 14, speed: 3.2, up: 2.4, life: 0.8,  size: 0.38, grow: 0.5, gravity: 5,  fade: 1, add: true },
  coin:    { tex: 'fx/fx-star.webp',    color: 0xffd23a, count: 16, speed: 3.6, up: 3.4, life: 0.9,  size: 0.42, grow: 0.4, gravity: 6,  fade: 1, add: true },
  debris:  { tex: 'fx/fx-smoke.webp',   color: 0x8a7a66, count: 16, speed: 4.2, up: 3.8, life: 0.9,  size: 0.4,  grow: 0.2, gravity: 11, fade: 0.8 },
  magic:   { tex: 'fx/fx-glow.webp',    color: 0x55e6ff, count: 22, speed: 1.6, up: 3.2, life: 1.0,  size: 0.5,  grow: 0.2, gravity: -1.5, fade: 1, add: true, swirl: true },
  blood:   { tex: 'fx/fx-ember.webp',   color: 0xff4a2a, count: 18, speed: 3.8, up: 3.0, life: 0.7,  size: 0.4,  grow: 0.3, gravity: 9,  fade: 1, add: true },
  key:     { tex: 'fx/fx-sparkle.webp', color: 0xffffff, count: 12, speed: 2.4, up: 2.4, life: 0.8,  size: 0.34, grow: 0.5, gravity: 2,  fade: 1, add: true },
  confetti:{ tex: 'fx/fx-star.webp',    color: 0xffffff, count: 46, speed: 4.6, up: 7.0, life: 1.9,  size: 0.34, grow: 0,   gravity: 7,  fade: 0.5, add: true, rainbow: true },
  glow:    { tex: 'fx/fx-glow.webp',    color: 0xffd060, count: 4,  speed: 0.2, up: 0.4, life: 0.8,  size: 1.8,  grow: 1.3, gravity: 0,  fade: 1, add: true },
};
const RAINBOW = [0xff5a5a, 0xffc23a, 0x6aff9a, 0x4aa8ff, 0xd86aff, 0xffffff];

export class Vfx {
  constructor(scene) {
    this.group = new THREE.Group(); scene.add(this.group); this.live = []; this.pool = []; this.mats = new Map();
  }
  mat(kind) {
    if (this.mats.has(kind)) return this.mats.get(kind); const K = KINDS[kind];
    const m = new THREE.SpriteMaterial({ map: loadTexture(K.tex), color: K.color, transparent: true, depthWrite: false, blending: K.add ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.mats.set(kind, m); return m;
  }
  /** Burst of `kind` at a world position. */
  emit(kind, pos, scale = 1, n = null) {
    const K = KINDS[kind]; if (!K) return; const count = n ?? K.count;
    for (let i = 0; i < count; i++) {
      let s = this.pool.pop(); if (!s) { s = new THREE.Sprite(); } s.material = this.mat(kind).clone(); if (K.rainbow) s.material.color.setHex(RAINBOW[i % RAINBOW.length]);
      const a = Math.random() * Math.PI * 2, sp = K.speed * (0.4 + Math.random() * 0.8) * scale;
      s.position.copy(pos); s.position.x += (Math.random() - 0.5) * 0.4; s.position.z += (Math.random() - 0.5) * 0.4;
      const size = K.size * scale * (0.6 + Math.random() * 0.7); s.scale.setScalar(size); s.material.opacity = 1; s.visible = true;
      this.group.add(s);
      this.live.push({ s, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: K.up * (0.5 + Math.random() * 0.7) * scale, t: 0, life: K.life * (0.7 + Math.random() * 0.6), size, K, swirl: K.swirl ? (Math.random() > 0.5 ? 1 : -1) : 0, rot: (Math.random() - 0.5) * 6 });
    }
  }
  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]; p.t += dt; const a = p.t / p.life;
      if (a >= 1) { this.group.remove(p.s); p.s.material.dispose(); this.pool.push(p.s); this.live.splice(i, 1); continue; }
      p.vy -= p.K.gravity * dt; p.s.position.x += p.vx * dt; p.s.position.z += p.vz * dt; p.s.position.y += p.vy * dt;
      if (p.swirl) { const c = Math.cos(p.swirl * dt * 4), sn = Math.sin(p.swirl * dt * 4); const x = p.vx, z = p.vz; p.vx = x * c - z * sn; p.vz = x * sn + z * c; }
      p.vx *= 1 - dt * 1.4; p.vz *= 1 - dt * 1.4; p.s.material.rotation += p.rot * dt;
      p.s.scale.setScalar(p.size * (1 + p.K.grow * a)); p.s.material.opacity = Math.min(1, (1 - a) / (p.K.fade || 1));
    }
  }
  clear() { for (const p of this.live) { this.group.remove(p.s); p.s.material.dispose(); } this.live = []; }
}
