import * as THREE from 'three';
import { env, fit } from './assets.js';
import { Actor } from './actors.js';
import { DIRS, K, P, STAIR } from './sim.js';
import { wallMaterial, texturedBox, floorMaterial } from './textures.js';
import { Scenery } from './scenery.js';
import { Vfx } from './vfx.js';

export const TILE = 2;
const THEMES = {
  1: { bg: ['#bfe3f2', '#f6ecd0'], tint: 0xfff2a8, body: 0x8a7a5c, tops: ['floor_dirt_small_A', 'floor_dirt_small_B', 'floor_dirt_small_C', 'floor_dirt_small_weeds', 'floor_tile_small_weeds_A', 'floor_tile_small_weeds_B'], sun: 0xfff1d0, amb: 0xbfd8ff },
  2: { bg: ['#8e9aa8', '#c9cfd6'], body: 0x6f7480, tops: ['floor_tile_small', 'floor_tile_small', 'floor_tile_small_weeds_A', 'floor_tile_small_corner'], sun: 0xe6ecff, amb: 0xa9b4c8 },
  3: { bg: ['#3f8fe0', '#bfe6ff'], body: 0x8d94a6, tops: ['floor_tile_small', 'floor_tile_small_weeds_A', 'floor_tile_small_weeds_B'], sun: 0xffffff, amb: 0xcfe6ff },
  4: { bg: ['#1b1410', '#4a2f1c'], body: 0x5c4a3c, tops: ['floor_tile_small'], sun: 0xffc98a, amb: 0x6a5a66 },
  5: { bg: ['#0f1f17', '#2f4a36'], body: 0x4c4a3a, tops: ['floor_dirt_small_A', 'floor_dirt_small_B', 'floor_dirt_small_C', 'floor_dirt_small_D'], sun: 0xd8ffd0, amb: 0x4f7a5c },
  6: { bg: ['#2a2148', '#8a5a6a'], body: 0x5a4636, tops: ['floor_wood_small', 'floor_wood_small_dark', 'floor_wood_small'], sun: 0xffe2a8, amb: 0x7a6aa8 },
  7: { bg: ['#12062e', '#5a1f7a'], body: 0x4a3a7a, tops: ['floor_tile_small'], tint: 0xc9b0ff, sun: 0xff9cf0, amb: 0x5ac8ff },
  8: { bg: ['#1a0704', '#b33a10'], body: 0x4a2a22, tops: ['floor_tile_small', 'floor_dirt_small_C'], tint: 0xffc4a8, sun: 0xffb070, amb: 0x8a3a2a },
  9: { bg: ['#0a1430', '#3a5a9a'], body: 0x56607a, tops: ['floor_tile_small'], tint: 0xd8e6ff, sun: 0xcfe0ff, amb: 0x5a78c0 },
  10: { bg: ['#1a0a30', '#6a3a8a'], body: 0x5a4a6a, tops: ['floor_tile_small', 'floor_wood_small_dark', 'floor_dirt_small_A'], sun: 0xffe08a, amb: 0x8a6ad0 },
};
const MONSTER_CHAR = { minion: 'zombie', rogue: 'vampire', sentry: 'maw', hunter: 'mutant', boss: 'warrok' };
const MONSTER_SCALE = { zombie: 0.95, vampire: 0.95, maw: 0.85, mutant: 1.0, warrok: 1.25 };
export const RUNE_COLOR = { might: 0xffc23a, wind: 0x4be07a, ward: 0x4aa8ff };
const TELE_COLOR = { p: 0x35e0ff, q: 0xff4ad2, r: 0xffe14a };
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0); };
const ease = (a) => a * a * (3 - 2 * a);

export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, -100, 300);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x666688, 1.7);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.scenery = new Scenery(); this.scene.add(this.scenery.fg);
    this.renderer.autoClear = false;
    this.board = new THREE.Group(); this.scene.add(this.board);
    this.vfx = new Vfx(this.scene);
    this.tweens = []; this.actors = []; this.spinners = []; this.picks = [];
    this.ray = new THREE.Raycaster();
    this.clock = new THREE.Clock();
    this.bottomPad = 0.13; this.topPad = 0.08; this.bottomPx = 0; // bottomPx: room kept for a banner ad
    this.viewYaw = Math.PI / 4; // camera heading; rotate() turns it in quarter steps
    window.addEventListener('resize', () => this.resize());
  }

  // ------------------------------------------------------------ helpers
  topY(k) { return this.L.ht.get(k) * TILE + (this.L.ch(k) in STAIR ? TILE / 2 : 0); }
  cellPos(k, y) { const [x, z] = P(k); return new THREE.Vector3(x * TILE, y ?? this.topY(k), z * TILE); }
  tween(dur, fn, done) { if (dur <= 0) { fn(1); done && done(); return; } this.tweens.push({ t: 0, dur, fn, done }); }
  moveTo(obj, to, dur, arc = 0) {
    const from = obj.position.clone();
    this.tween(dur, (a) => { const e = ease(a); obj.position.lerpVectors(from, to, e); if (arc) obj.position.y += Math.sin(a * Math.PI) * arc; });
  }
  /** Where a tile appears on screen, in CSS pixels (for tutorial pointers). */
  screenOf(k) { const v = this.cellPos(k, this.topY(k) + 0.25).project(this.camera); return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight }; }
  walkable(k) { const c = this.L.ch(k); return c !== undefined && c !== '#' && c !== 'W'; }
  /** Doors, gates and cracked walls face along the corridor they block. */
  alongX(k) { const [x, y] = P(k); return this.walkable(K(x - 1, y)) || this.walkable(K(x + 1, y)); }

  clear() {
    this.board.clear(); this.tweens = []; this.actors = []; this.spinners = []; this.picks = [];
    this.dyn = { coins: new Map(), keys: new Map(), doors: new Map(), cracked: new Map(), bridges: [], crumble: new Map(), traps: [], plates: [], gates: [], boxes: [], ferries: [], teles: [], lever: [], danger: [] };
    this.monsters = []; this.maria = null; this.twin = null; this.routeGroup = null;
  }

  // ------------------------------------------------------------ build
  build(L, levelData) {
    this.clear(); this.vfx.clear(); this.zoom = 1; this.panX = 0; this.panY = 0;
    this.L = L; this.level = levelData;
    const th = THEMES[levelData.world]; this.theme = th;
    document.body.style.background = `linear-gradient(${th.bg[0]}, ${th.bg[1]})`;
    this.scenery.setBackdrop(levelData.world); this.scenery.set(levelData.world, L.w, L.h, TILE);
    this.hemi.color.set(th.amb); this.sun.color.set(th.sun);
    const bodyMat = wallMaterial(levelData.world, 0xffffff); bodyMat.color.setRGB(1.55, 1.5, 1.4); // lifted so the stone is not darker than the painted sky
    const darkMat = wallMaterial(levelData.world, 0xb0b0ba); darkMat.color.setRGB(1.0, 0.98, 0.95);
    const fire = levelData.world === 8;
    const add = (o, k, y) => { o.position.copy(this.cellPos(k, y)); this.board.add(o); return o; };
    const body = (k, top, depth, mat = bodyMat, w = 1.94, topMat = null) => {
      const m = new THREE.Mesh(texturedBox(w, depth, w), topMat ? [mat, mat, topMat, mat, mat, mat] : mat);
      m.castShadow = true; m.receiveShadow = true;
      const g = new THREE.Group(); m.position.y = -depth / 2 - 0.02; g.add(m);
      return add(g, k, top);
    };
    const topTile = (name, k, y, tint) => { const t = env(name, tint ?? th.tint); t.rotation.y = (hash(...P(k), 3) % 4) * Math.PI / 2; t.position.y = -0.1; const g = new THREE.Group(); g.add(t); g.position.y = 0.1; const w = new THREE.Group(); w.add(g); return add(w, k, y); };
    // Which side is each tile entered from? Breadth-first walk from the start over every floor tile.
    const dist = new Map([[L.start, 0]]); const queue = [L.start];
    while (queue.length) { const c = queue.shift(); const [cx, cy] = P(c); for (const d of Object.values(DIRS)) { const n = K(cx + d[0], cy + d[1]); if (this.walkable(n) && !dist.has(n)) { dist.set(n, dist.get(c) + 1); queue.push(n); } } }
    const entryDir = (k) => { // unit step from the tile toward the neighbour the player comes from
      const [x, y] = P(k); let best = null;
      for (const d of Object.values(DIRS)) { const n = K(x + d[0], y + d[1]); if (dist.has(n) && (!best || dist.get(n) < best.d)) best = { d: dist.get(n), dir: d }; }
      if (best && dist.has(k) && best.d < dist.get(k)) return best.dir;
      return this.alongX(k) ? [-1, 0] : [0, -1];
    };
    const blocker = (name, k, tint, tall) => { // 4-wide wall piece scaled to one tile; doors and gates are taller than Maria
      const o = env(name, tint); o.scale.set(tall ? 0.6 : 0.5, tall ? 0.86 : 0.5, 0.9);
      const g = new THREE.Group(); g.add(o);
      const e = entryDir(k);
      if (e[0] !== 0) g.rotation.y = Math.PI / 2; // the piece is built across X; turn it to face a player arriving along X
      const w = add(g, k, L.ht.get(k) * TILE);
      w.position.x += e[0] * 0.72; w.position.z += e[1] * 0.72; // stand on the tile edge she arrives at
      return w;
    };

    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const k = K(x, y), ch = L.ch(k), h = L.ht.get(k), top = h * TILE;
      // pick target for every grid cell (void cells too: ferries pass over them)
      const pick = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.3, TILE), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.copy(this.cellPos(k, top + (ch in STAIR ? 1 : 0))); pick.userData.cell = k; this.board.add(pick); this.picks.push(pick);
      if (ch === '#') continue;
      const depth = 2.4 + h * TILE + (hash(x, y, 1) % 5) * 0.12;
      if (ch === 'W') { body(k, top + 1.7, depth + 1.7, darkMat); const t = add(fit(env('torch_lit'), { height: 0.9 }), k, top + 1.7); if (hash(x, y, 9) % 2) t.visible = false; continue; }
      if (ch === '=' || ch === '-') {
        const g = new THREE.Group(); const plank = env('floor_wood_small', ch === '=' ? 0xbfd8ff : 0xffd9a8); g.add(plank);
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 1.7), new THREE.MeshStandardMaterial({ color: 0x6b4a2e })); b.position.y = -0.22; b.castShadow = true; g.add(b);
        add(g, k, top);
        const ghost = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.8), new THREE.MeshBasicMaterial({ color: ch === '=' ? 0x7ab8ff : 0xffb060, wireframe: true, transparent: true, opacity: 0.45 }));
        add(ghost, k, top - 0.05);
        this.dyn.bridges.push({ k, obj: g, ghost, on: ch === '=' });
        continue;
      }
      if (ch === '~') { const g = new THREE.Group(); const b = body(k, 0, 0.45, darkMat, 1.8); this.board.remove(b); b.position.set(0, 0, 0); g.add(b); const t = env(hash(x, y, 2) % 2 ? 'floor_tile_small_broken_A' : 'floor_tile_small_broken_B', fire ? 0xffb090 : th.tint); g.add(t); add(g, k, top); this.dyn.crumble.set(k, g); continue; }
      body(k, top, depth, bodyMat, 1.94, (ch in STAIR) ? null : floorMaterial(levelData.world, hash(x, y, 5) % 4));
      if (ch in STAIR) {
        const d = STAIR[ch]; const g = new THREE.Group();
        for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.5 * (i + 1), 0.485), bodyMat); s.position.set(0, 0.25 * (i + 1), -0.73 + i * 0.485); s.castShadow = s.receiveShadow = true; g.add(s); }
        g.rotation.y = Math.atan2(d[0], d[1]); add(g, k, top); continue;
      }
      const isTrap = ch === 'x' || ch === 'X';
      if (isTrap) topTile('floor_tile_grate', k, top, fire ? 0xff9a70 : 0xd0d0e0);
      if (isTrap) {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial(fire ? { color: 0xff7a20, emissive: 0xff3a00, emissiveIntensity: 1.6 } : { color: 0xd8dde6, metalness: 0.6, roughness: 0.3 });
        for (const [sx, sz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0, 0]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(fire ? 0.28 : 0.16, fire ? 1.5 : 1.1, 8), mat); c.position.set(sx, fire ? 0.75 : 0.55, sz); c.castShadow = true; g.add(c); }
        add(g, k, top);
        // one clear signal: the tile glows RED while stepping on it would hurt, ORANGE when it is about to rise, GREEN when it is safe
        const mark = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ color: 0x44dd66, transparent: true, opacity: 0.35, depthWrite: false })); mark.rotation.x = -Math.PI / 2; add(mark, k, top + 0.05);
        this.dyn.traps.push({ k, obj: g, top, mark });
      }
      if (ch === '*') { const c = fit(env('coin'), { width: 0.7 }); c.children[0].rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(c); c.position.y = 0.75; add(g, k, top); this.spinners.push(g); this.dyn.coins.set(k, g); }
      if (ch === 'k' || ch === 'j') { const o = fit(env('key', ch === 'j' ? 0xc8d8f0 : 0xffd24a), { width: 0.8 }); const g = new THREE.Group(); o.position.y = 0.6; o.rotation.z = Math.PI / 2; g.add(o); add(g, k, top); this.spinners.push(g); this.dyn.keys.set(k, g); }
      if (ch === 'K' || ch === 'J') { const g = blocker('wall_doorway', k, ch === 'J' ? 0xb8cdf0 : 0xffd98a, true); let door = null; g.traverse((o) => { if (o.name === 'wall_doorway_door') door = o; }); this.dyn.doors.set(k, { obj: g, door }); }
      if (ch === 'c') this.dyn.cracked.set(k, blocker('wall_cracked', k));
      if (ch === '|') { const g = blocker('wall_gated', k, undefined, true); this.dyn.gates.push({ k, obj: g, y0: g.position.y }); }
      if (ch === '_') { const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.14, 1.4), new THREE.MeshStandardMaterial({ color: 0xb04a3a, roughness: 0.6 })); p.receiveShadow = true; add(p, k, top + 0.07); this.dyn.plates.push({ k, obj: p, y0: top + 0.07 }); }
      if (ch === 'L') { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.5), darkMat); b.position.y = 0.1; const piv = new THREE.Group(); piv.position.y = 0.15; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9), new THREE.MeshStandardMaterial({ color: 0x3a3a44 })); st.position.y = 0.45; const kn = new THREE.Mesh(new THREE.SphereGeometry(0.14), new THREE.MeshStandardMaterial({ color: 0xff4a3a, emissive: 0x7a1a10 })); kn.position.y = 0.9; piv.add(st, kn); g.add(b, piv); g.position.x = 0.55; const w = new THREE.Group(); w.add(g); add(w, k, top); this.dyn.lever.push(piv); }
      if (ch === 'b') { /* crate objects are created below from the state */ }
      if (L.tele.has(k)) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.09, 10, 32), new THREE.MeshStandardMaterial({ color: TELE_COLOR[ch], emissive: TELE_COLOR[ch], emissiveIntensity: 2 })); r.rotation.x = Math.PI / 2; const g = new THREE.Group(); g.add(r); r.position.y = 0.12; const r2 = r.clone(); r2.scale.setScalar(0.6); r2.position.y = 0.5; g.add(r2); add(g, k, top); this.spinners.push(r2); this.dyn.teles.push(g); }
      if (ch === 'G') { const c = fit(env('chest_gold'), { width: 0.95 }); add(c, k, top); c.position.x -= 0.5; c.position.z -= 0.5; c.traverse((o) => { if (o.name === 'chest_gold_lid') this.chestLid = o; }); c.rotation.y = Math.PI / 4; }
      if (ch === 'H') { const r = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 32), new THREE.MeshBasicMaterial({ color: 0x7ac8ff, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; add(r, k, top + 0.05); }
    }
    for (const k of L.boxes0) { const b = fit(env('box_large'), { width: 1.35 }); add(b, k, L.ht.get(k) * TILE); this.dyn.boxes.push({ obj: b, k }); }
    for (const path of L.platforms) { const g = new THREE.Group(); g.add(env('floor_wood_small_dark')); const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 1.8), new THREE.MeshStandardMaterial({ color: 0x4a3626 })); b.position.y = -0.28; b.castShadow = true; g.add(b); add(g, path[0], L.ht.get(path[0]) * TILE); this.dyn.ferries.push({ obj: g, path }); }

    // actors
    this.maria = this.addActor(new Actor('maria', { scale: 1.3 })); this.maria.setGlow(RUNE_COLOR[levelData.rune]);
    if (L.twin0) this.twin = this.addActor(new Actor('maria', { ghost: true, scale: 1.3 }));
    let pi = 0, hi = 0;
    for (const mo of L.monsters) {
      const cid = MONSTER_CHAR[mo.type];
      const a = this.addActor(new Actor(cid, { scale: MONSTER_SCALE[cid] * (mo.type === 'boss' ? 1.25 : 1) }));
      const rec = { def: mo, actor: a, kind: mo.type === 'sentry' ? 'sentry' : (mo.path ? 'patrol' : 'hunter') };
      if (rec.kind === 'patrol') rec.index = pi++; if (rec.kind === 'hunter') rec.index = hi++;
      if (rec.kind === 'sentry') a.root.position.copy(this.cellPos(mo.at));
      a.play('spawn', { loop: false, then: { name: 'idle' } });
      this.monsters.push(rec);
    }
    // faint markers on every tile a patrol walks, so its route can be read while planning
    const patMat = new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const mo of L.patrolDefs) for (const c of mo.path) { const r = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.9, 4, 1, Math.PI / 4), patMat); r.rotation.x = -Math.PI / 2; r.position.copy(this.cellPos(c)).y += 0.03; this.board.add(r); }
    this.dangerMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
    this.routeGroup = new THREE.Group(); this.board.add(this.routeGroup);
    this.hintGroup = new THREE.Group(); this.board.add(this.hintGroup);
    { // the board floats: a rough rock hangs beneath it
      const mat = wallMaterial(levelData.world, 0xb8b8c4); mat.bumpMap = null; mat.flatShading = true; mat.emissive = new THREE.Color(th.body).multiplyScalar(0.22);
      const prof = [[1, 0], [0.97, -0.7], [0.84, -1.7], [0.64, -2.8], [0.4, -3.8], [0.18, -4.6], [0, -5.2]].map(([r, y]) => new THREE.Vector2(r, y));
      const rock = new THREE.Mesh(new THREE.LatheGeometry(prof, 11), mat); rock.rotation.y = 0.4; // a rounded chunk of earth, scaled to the board's own footprint
      const rr = Math.min(Math.sqrt(L.w * L.h) * TILE * 0.42, Math.min(L.w, L.h) * TILE * 0.8 + 1.5); // round, not as long as a long board
      rock.scale.set(Math.max(1.6, rr), 1, Math.max(1.6, rr));
      const pos = rock.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y > -0.01) continue; const j = 1 + 0.1 * Math.sin(i * 12.9898 + y * 3); pos.setX(i, pos.getX(i) * j); pos.setZ(i, pos.getZ(i) * j); }
      rock.geometry.computeVertexNormals(); rock.position.set((L.w - 1) * TILE / 2, -2.5, (L.h - 1) * TILE / 2); rock.castShadow = false; this.board.add(rock);
    }
    this.frame();
  }
  addActor(a) { this.board.add(a.root); this.actors.push(a); return a; }

  // ------------------------------------------------------------ camera
  frame() {
    const L = this.L; if (!L) return;
    const cx = (L.w - 1) * TILE / 2, cz = (L.h - 1) * TILE / 2;
    const center = new THREE.Vector3(cx, 1, cz);
    const dir = new THREE.Vector3(Math.SQRT2 * Math.sin(this.viewYaw), 0.86, Math.SQRT2 * Math.cos(this.viewYaw)).normalize();
    this.camera.position.copy(center).addScaledVector(dir, 60); this.camera.lookAt(center); this.camera.updateMatrixWorld();
    this.sun.position.copy(center).add(new THREE.Vector3(-7, 18, 9)); this.sun.target.position.copy(center);
    const inv = this.camera.matrixWorldInverse; let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const x of [-1.2, (L.w - 1) * TILE + 1.2]) for (const z of [-1.2, (L.h - 1) * TILE + 1.2]) for (const y of [-0.8, 3.6]) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(inv); minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const W = window.innerWidth, H = window.innerHeight, aspect = W / H;
    let bw = maxX - minX, bh = maxY - minY;
    const bp = this.bottomPad + this.bottomPx / H; const usable = 1 - bp - this.topPad; const side = 1 - 2 * (this.sidePad || 0);
    let viewH = Math.max(bh / usable, bw / (aspect * side)) * 1.02, viewW = viewH * aspect;
    const z = this.zoom || 1; viewH /= z; viewW /= z; this.viewW = viewW; this.viewH = viewH;
    const lx = Math.max(0, (bw / 2) * (1 - 1 / z) + bw * 0.15), ly = Math.max(0, (bh / 2) * (1 - 1 / z) + bh * 0.15); // how far the view may slide
    this.panX = Math.max(-lx, Math.min(lx, this.panX || 0)); this.panY = Math.max(-ly, Math.min(ly, this.panY || 0));
    const midX = (minX + maxX) / 2 + this.panX, midY = (minY + maxY) / 2 + viewH * z * (this.topPad - bp) / 2 + this.panY;
    this.camera.left = midX - viewW / 2; this.camera.right = midX + viewW / 2; this.camera.top = midY + viewH / 2; this.camera.bottom = midY - viewH / 2;
    this.camera.updateProjectionMatrix();
    const s = Math.max(L.w, L.h) * TILE * 0.8 + 6; const sc = this.sun.shadow.camera; sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 1; sc.far = 80; sc.updateProjectionMatrix();
    this.renderer.setSize(W, H, false);
  }
  resize() { this.frame(); }
  /** Two-finger / wheel camera: zoom factor, twist (radians), and slide in screen pixels. */
  gesture({ zoom = 1, twist = 0, dx = 0, dy = 0 } = {}) {
    if (this.rotating) return;
    this.zoom = Math.max(0.55, Math.min(2.8, (this.zoom || 1) * zoom));
    this.viewYaw += twist;
    if (this.viewW) { this.panX = (this.panX || 0) - dx / window.innerWidth * this.viewW; this.panY = (this.panY || 0) + dy / window.innerHeight * this.viewH; }
    this.frame();
  }
  resetView() { this.zoom = 1; this.panX = 0; this.panY = 0; this.frame(); }
  /** A ripple on a tapped tile: a gold ring that spreads and fades, plus a quick lift of the tile's glow. ok=false shows red. */
  ripple(k, ok = true) {
    if (!this.L || !this.L.ht.has(k)) return;
    const col = ok ? 0xffe27a : 0xff5a4a; const y = this.topY(k) + 0.12;
    const mk = (geo, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, depthTest: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 20; m.position.copy(this.cellPos(k, y)); this.board.add(m); return m; };
    const ring = mk(new THREE.RingGeometry(0.55, 0.78, 40), 0.95), fill = mk(new THREE.PlaneGeometry(1.8, 1.8), 0.55);
    this.tween(0.5, (a) => { const e = 1 - Math.pow(1 - a, 3); ring.scale.setScalar(0.5 + e * 1.1); ring.material.opacity = 0.95 * (1 - a); fill.scale.setScalar(1 - 0.12 * Math.sin(a * Math.PI)); fill.material.opacity = 0.55 * (1 - a) * (1 - a); }, () => { this.board.remove(ring, fill); ring.geometry.dispose(); fill.geometry.dispose(); ring.material.dispose(); fill.material.dispose(); });
  }
  /** Turn the camera a quarter turn around the board (dir = 1 or -1). */
  rotate(dir = 1) {
    if (this.rotating) return; this.rotating = true;
    const from = this.viewYaw, to = from + dir * Math.PI / 2;
    this.tween(0.45, (a) => { this.viewYaw = from + (to - from) * ease(a); this.frame(); }, () => { this.viewYaw = Math.atan2(Math.sin(to), Math.cos(to)); this.frame(); this.rotating = false; });
  }
  pick(clientX, clientY) {
    const v = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const hit = this.ray.intersectObjects(this.picks, false)[0];
    return hit ? hit.object.userData.cell : null;
  }

  // ------------------------------------------------------------ state -> scene
  actorY(k, t) { return this.topY(k); }
  /** Show simulation state `st`. dur > 0 animates from the current picture. prev is the state before (for facing). */
  applyState(st, dur = 0, opts = {}) {
    const L = this.L, t = st.t, d = this.dyn;
    for (const [k, o] of d.coins) o.visible = !st.coins.has(k);
    for (const [k, o] of d.keys) o.visible = !st.opened.has(k);
    for (const [k, r] of d.doors) { const open = st.opened.has(k); if (r.door) { const from = r.door.rotation.y, to = open ? 1.9 : 0; this.tween(dur, (a) => { r.door.rotation.y = from + (to - from) * ease(a); }); } }
    for (const [k, o] of d.cracked) o.visible = !st.opened.has(k);
    for (const b of d.bridges) { const on = b.on ? st.lever : !st.lever; const from = b.obj.scale.x, to = on ? 1 : 0.001; b.obj.visible = true; this.tween(dur, (a) => { const s = from + (to - from) * ease(a); b.obj.scale.set(s, 1, s); }, () => { b.obj.visible = on; }); }
    for (const piv of d.lever) { const to = st.lever ? -0.6 : 0.6, from = piv.rotation.z; this.tween(dur, (a) => { piv.rotation.z = from + (to - from) * ease(a); }); }
    for (const [k, o] of d.crumble) { const gone = st.crumbled.has(k); if (gone && o.visible && dur > 0) { const y0 = this.topY(k); this.tween(dur * 1.5, (a) => { o.position.y = y0 - a * a * 6; }, () => { o.visible = false; }); } else { o.visible = !gone; o.position.y = this.topY(k); } }
    this.setTraps(st, dur, !!opts.arrive);
    const occ = new Set([...st.boxes, ...L.patrols(t), ...st.hunters, st.pos]); if (st.twin) occ.add(st.twin);
    const gateOpen = [...L.plates].some((k) => occ.has(k));
    for (const p of d.plates) p.obj.position.y = p.y0 - (occ.has(p.k) ? 0.09 : 0);
    for (const g of d.gates) { const from = g.obj.position.y, to = g.y0 - (gateOpen ? 3.3 : 0); this.tween(dur * 0.7, (a) => { g.obj.position.y = from + (to - from) * ease(a); }); }
    // crates: keep objects on unchanged cells, move the rest
    const want = [...st.boxes]; const free = d.boxes.filter((b) => !st.boxes.has(b.k)); const missing = want.filter((k) => !d.boxes.some((b) => b.k === k));
    missing.forEach((k, i) => { const b = free[i]; if (!b) return; b.k = k; this.moveTo(b.obj, this.cellPos(k, L.ht.get(k) * TILE), dur); });
    const plats = L.plats(t); d.ferries.forEach((f, i) => this.moveTo(f.obj, this.cellPos(plats[i], L.ht.get(plats[i]) * TILE), dur));
    // danger tiles of watchers
    for (const q of d.danger) this.board.remove(q); d.danger = [];
    for (const mo of L.sentryDefs) { const [x, y] = P(mo.at); const dd = DIRS[L.sentryLook(mo, t)]; for (let r = 1; r <= (mo.range || 2); r++) { const c = K(x + dd[0] * r, y + dd[1] * r); if ('#WKc|J'.includes(L.ch(c) ?? '#')) break; const q = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), this.dangerMat); q.rotation.x = -Math.PI / 2; q.position.copy(this.cellPos(c)).y += 0.06; this.board.add(q); d.danger.push(q); } }
    // monsters
    const pats = L.patrols(t);
    // two monsters on one tile stand in separate corners instead of inside each other
    const cellOf = (m) => m.kind === 'patrol' ? pats[m.index] : m.kind === 'hunter' ? st.hunters[m.index] : m.def.at;
    const crowd = new Map(); for (const m of this.monsters) { const k = cellOf(m); (crowd.get(k) || crowd.set(k, []).get(k)).push(m); }
    const CORNERS = [[-0.42, -0.42], [0.42, 0.42], [0.42, -0.42], [-0.42, 0.42]];
    const offsetOf = (m) => { const g = crowd.get(cellOf(m)); if (g.length < 2) return [0, 0]; const movers = g.filter((o) => o.kind !== 'sentry'); const i = movers.indexOf(m); return i < 0 ? [0, 0] : CORNERS[i % 4]; };
    for (const m of this.monsters) {
      const a = m.actor; const fast = opts.fast;
      if (m.kind === 'sentry') { const dd = DIRS[L.sentryLook(m.def, t)]; const newYaw = Math.atan2(dd[0], dd[1]); if (dur > 0 && Math.abs(newYaw - a.targetYaw) > 0.1 && !opts.quiet) { const left = Math.sin(newYaw - a.targetYaw) > 0; a.play(left ? (t % 4 < 2 ? 'turn_l' : 'turn_l2') : (t % 4 < 2 ? 'turn_r' : 'turn_r2'), { loop: false, len: Math.max(dur, 0.35), then: { name: 'roar', opts: { loop: false, len: 1.2, then: { name: 'idle' } } } }); } a.face(dd[0], dd[1], dur === 0); continue; }
      const k = m.kind === 'patrol' ? pats[m.index] : st.hunters[m.index];
      const to = this.cellPos(k); { const [ox, oz] = offsetOf(m); to.x += ox; to.z += oz; } const from = a.root.position.clone(); const moved = from.distanceToSquared(to) > 0.01;
      if (moved && dur > 0) {
        const dx = to.x - from.x, dz = to.z - from.z; const reversing = m.kind === 'patrol' && m.lastDir && (m.lastDir[0] * dx + m.lastDir[1] * dz) < 0;
        a.face(dx, dz); m.lastDir = [dx, dz];
        if (!opts.quiet) a.play(reversing ? 'turn_r90' : (m.kind === 'hunter' || fast ? 'run' : 'walk'), { len: reversing ? dur : undefined, loop: !reversing, then: reversing ? { name: 'walk' } : undefined });
        this.moveTo(a.root, to, dur); m.moving = true;
      } else {
        a.root.position.copy(to);
        if (m.moving && !opts.quiet) { a.play('idle'); m.moving = false; }
        if (dur === 0 && m.kind === 'patrol' && m.def.path.length > 1) { const nx = this.cellPos(pp1(L, m, t)); a.face(nx.x - to.x, nx.z - to.z, true); }
      }
    }
  }
  /** Spikes. arrive=true: show the beat Maria is walking into (what actually hurts her). Otherwise show what the NEXT step would meet. The tile glows red / orange / green for that next step. */
  setTraps(st, dur, arrive) {
    const L = this.L, t = st.t;
    for (const tr of this.dyn.traps) {
      const up = L.spikesUp(tr.k, arrive ? t : t + 1), nextUp = L.spikesUp(tr.k, t + 1), soon = !nextUp && L.spikesUp(tr.k, t + 2);
      const from = tr.obj.position.y, to = tr.top + (up ? 0 : -1.7); this.tween(dur * 0.6, (a) => { tr.obj.position.y = from + (to - from) * ease(a); });
      tr.mark.material.color.set(nextUp ? 0xff3a2a : soon ? 0xffa020 : 0x44dd66); tr.mark.material.opacity = nextUp ? 0.55 : soon ? 0.5 : 0.28; tr.soon = soon; tr.up = nextUp;
    }
  }
  /** A burst of particles on tile k (or at a world position). */
  burst(kind, k, scale = 1, lift = 0.4) { const pos = k instanceof THREE.Vector3 ? k.clone() : this.cellPos(k, this.topY(k) + lift); this.vfx.emit(kind, pos, scale); }
  placeActor(actor, k, dur = 0, arc = 0) { const to = this.cellPos(k); if (dur <= 0) actor.root.position.copy(to); else this.moveTo(actor.root, to, dur, arc); }

  showRoute(states, status) {
    const g = this.routeGroup; g.clear();
    if (states.length < 2) return;
    // the path is painted on the tiles: it is depth-tested, so walls, props and characters cover it
    const pts = states.map((s) => this.cellPos(s.pos).add(new THREE.Vector3(0, 0.035, 0)));
    const col = status === 'win' ? 0x6aff9a : RUNE_COLOR[this.level.rune];
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x14102a, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const waits = new Map(); const visits = new Map(); const passes = new Map();
    const X = new THREE.Vector3(1, 0, 0), UP = new THREE.Vector3(0, 1, 0);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]; const len = a.distanceTo(b);
      if (len < 0.01) { // a WAIT: one more ring around the tile for every beat waited there
        const n = (waits.get(states[i].pos) || 0) + 1; waits.set(states[i].pos, n);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.3 + n * 0.11, 0.37 + n * 0.11, 24), mat); ring.rotation.x = -Math.PI / 2; ring.position.copy(b); ring.position.y += 0.01; g.add(ring);
        continue;
      }
      if (len > 2.9) continue; // leaps and teleports draw no strip
      // each extra pass over the same stretch is drawn in its own lane, so going back and forth stays readable
      const key = [states[i - 1].pos, states[i].pos].sort().join('|'); const n = passes.get(key) || 0; passes.set(key, n + 1);
      const lane = n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.24;
      const dirv = b.clone().sub(a).normalize(); const fwdKey = states[i - 1].pos < states[i].pos ? 1 : -1;
      const side = new THREE.Vector3().crossVectors(UP, dirv).setY(0).normalize().multiplyScalar(lane * fwdKey);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(len, 0.012, 0.13), mat);
      seg.position.copy(a).lerp(b, 0.5).add(side); seg.quaternion.setFromUnitVectors(X, dirv); g.add(seg);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.34, 3), dark); // flat arrowhead showing the direction of this pass
      arrow.scale.set(1, 1, 0.05); arrow.position.copy(seg.position); arrow.position.y += 0.012;
      arrow.quaternion.setFromUnitVectors(UP, dirv); g.add(arrow);
    }
    states.forEach((s, i) => { // a dot per visit; a tile walked over again gets a wider ring each time
      if (i === 0 || s.pos === states[i - 1].pos) return;
      const n = (visits.get(s.pos) || 0) + 1; visits.set(s.pos, n);
      const dot = new THREE.Mesh(n === 1 ? new THREE.CircleGeometry(0.17, 16) : new THREE.RingGeometry(0.14 + n * 0.09, 0.2 + n * 0.09, 20), mat);
      dot.rotation.x = -Math.PI / 2; dot.position.copy(pts[i]); dot.position.y += 0.008; g.add(dot);
    });
    const endMark = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.74, 28), mat); endMark.rotation.x = -Math.PI / 2; endMark.position.copy(pts[pts.length - 1]); endMark.position.y += 0.012; g.add(endMark);
  }

  /** Pulsing numbered markers on the tiles a hint wants the player to walk next. kind 'back' marks where the route left the best line. */
  showHint(cells, kind = 'next') {
    const g = this.hintGroup; if (!g) return; g.clear(); this.hintT = 0;
    cells.forEach((k, i) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
      c.fillStyle = kind === 'back' ? '#ff9a3a' : '#ffe14a'; c.beginPath(); c.arc(64, 64, 58, 0, 6.3); c.fill(); c.lineWidth = 8; c.strokeStyle = '#2a1250'; c.stroke();
      c.fillStyle = '#2a1250'; c.font = 'bold 64px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(kind === 'back' ? '↩' : String(i + 1), 64, 70);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.46, 28), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -8 }));
      m.rotation.x = -Math.PI / 2; m.position.copy(this.cellPos(k)); m.position.y += 0.07; m.userData.i = i; g.add(m);
    });
  }
  clearHint() { if (this.hintGroup) this.hintGroup.clear(); }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    for (let i = this.tweens.length - 1; i >= 0; i--) { const tw = this.tweens[i]; tw.t += dt; const a = Math.min(1, tw.t / tw.dur); tw.fn(a); if (a >= 1) { this.tweens.splice(i, 1); tw.done && tw.done(); } }
    for (const s of this.spinners) s.rotation.y += dt * 2.2;
    this.spikeT = (this.spikeT || 0) + dt;
    if (this.dyn && this.dyn.traps) for (const tr of this.dyn.traps) if (tr.soon) tr.mark.material.opacity = 0.3 + 0.28 * (0.5 + 0.5 * Math.sin(this.spikeT * 9)); else if (tr.up) tr.mark.material.opacity = 0.45 + 0.12 * Math.sin(this.spikeT * 4);
    if (this.hintGroup && this.hintGroup.children.length) { this.hintT = (this.hintT || 0) + dt; for (const m of this.hintGroup.children) m.scale.setScalar(1 + 0.16 * Math.sin(this.hintT * 5 + m.userData.i)); }
    for (const a of this.actors) a.update(dt);
    this.scenery.update(dt); this.vfx.update(dt);
    if (this.dyn && (this.sparkT = (this.sparkT || 0) - dt) < 0) { this.sparkT = 0.5 + Math.random() * 0.6; const all = [...this.dyn.coins.values(), ...this.dyn.keys.values()].filter((o) => o.visible); if (all.length) { const o = all[Math.floor(Math.random() * all.length)]; this.vfx.emit('key', o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.5, 0)), 0.5, 2); } }
    this.renderer.clear(); this.renderer.render(this.scenery.bg, this.camera); this.renderer.clearDepth(); this.renderer.render(this.scene, this.camera);
    return dt;
  }
}
function pp1(L, m, t) { const path = m.def.path, n = path.length; const loop = m.def.mode === 'loop'; const idx = (tt) => { if (loop) return tt % n; const i = tt % (2 * (n - 1)); return i < n ? i : 2 * (n - 1) - i; }; return path[idx(t + 1)]; }
