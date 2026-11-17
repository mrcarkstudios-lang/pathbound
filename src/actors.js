import * as THREE from 'three';
import { cloneChar, getClip, loadClip } from './assets.js';

const LOCOMOTION = new Set(['walk', 'run', 'walk_back', 'strafe_a', 'strafe_b', 'strafe_a_fast', 'strafe_b_fast']);

/** An animated character: Maria, her twin, or a creature. */
export class Actor {
  constructor(charId, { scale = 1, ghost = false } = {}) {
    this.charId = charId;
    this.root = new THREE.Group();
    this.root.visible = false;
    this.ready = cloneChar(charId).then((model) => {
      this.model = model;
      model.scale.multiplyScalar(scale);
      if (ghost) model.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; o.material.color.set(0x8fd0ff); o.material.emissive.set(0x1a4f8a); } });
      this.root.add(model);
      this.mixer = new THREE.AnimationMixer(model);
      this.root.visible = true;
      if (this.pending) { const p = this.pending; this.pending = null; this.play(p.name, p.opts); }
    });
    this.current = null; this.currentName = '';
    this.targetYaw = 0; this.queue = null; this.queueAt = 0;
  }
  /** Sword glow (Maria only). */
  setGlow(hex) {
    this.ready.then(() => this.model.traverse((o) => {
      if (o.isMesh && /sword/i.test(o.name)) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(hex); o.material.emissiveIntensity = 0.9; }
    }));
  }
  /**
   * opts: loop (default true), fade seconds, len = play the clip so that it lasts this many seconds,
   * then = { name, opts } to chain after `len` (or the clip's end), hold = clamp on last frame.
   */
  play(name, opts = {}) {
    if (!this.mixer) { this.pending = { name, opts }; return; }
    let clip = getClip(this.charId, name);
    if (!clip) {
      // not downloaded yet: use a sensible stand-in now, real clip next time
      loadClip(this.charId, name);
      clip = getClip(this.charId, opts.fallback || (opts.loop === false ? 'idle' : 'idle')) || getClip(this.charId, 'idle');
      if (!clip) { this.pending = { name, opts }; setTimeout(() => { if (this.pending) { const p = this.pending; this.pending = null; this.play(p.name, p.opts); } }, 150); return; }
    }
    const loop = opts.loop !== false;
    if (this.currentName === name && loop && this.current && !opts.restart) { this.current.timeScale = opts.len ? clip.duration / opts.len : (opts.speed || 1); this.queue = null; return; }
    const act = this.mixer.clipAction(clip);
    act.reset();
    act.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    act.clampWhenFinished = true;
    act.timeScale = opts.len ? clip.duration / opts.len : (opts.speed || 1);
    const fade = opts.fade ?? 0.12;
    if (this.current && this.current !== act) { act.crossFadeFrom(this.current, fade, false); }
    act.play();
    this.current = act; this.currentName = name;
    this.queue = opts.then || null;
    this.queueAt = opts.then ? (opts.len ?? clip.duration) : 0;
    this.elapsed = 0;
  }
  face(dx, dz, instant = false) {
    if (dx === 0 && dz === 0) return;
    this.targetYaw = Math.atan2(dx, dz);
    if (instant) this.root.rotation.y = this.targetYaw;
  }
  update(dt) {
    // A walking clip only plays while the body actually travels: stand still for a moment and settle into idle.
    const p = this.root.position;
    if (!this.lastPos) this.lastPos = p.clone();
    const moved = p.distanceToSquared(this.lastPos) > 1e-6; this.lastPos.copy(p);
    if (moved) this.still = 0;
    else if (LOCOMOTION.has(this.currentName) && !this.queue) { this.still = (this.still || 0) + dt; if (this.still > 0.16) { this.still = 0; this.play('idle', { fade: 0.25 }); } }
    if (this.mixer) this.mixer.update(dt);
    let d = this.targetYaw - this.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * 14);
    if (this.queue) {
      this.elapsed += dt;
      if (this.elapsed >= this.queueAt) { const q = this.queue; this.queue = null; this.play(q.name, q.opts || {}); }
    }
  }
}
