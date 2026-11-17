// PATHBOUND rules engine. Line-for-line port of design/pathbound_sim.py.
// tools/replay-test.mjs proves it matches by replaying every stored solution.
export const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
const STAIR = { '^': [0, -1], 'v': [0, 1], '<': [-1, 0], '>': [1, 0] };
const PLAIN = '.SGTH*kjL_~xXpqr';
const K = (x, y) => x + ',' + y;
const P = (k) => k.split(',').map(Number);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const lcm = (a, b) => (a * b) / gcd(a, b);

function pp(path, t, loop) {
  const n = path.length;
  if (n === 1) return path[0];
  if (loop) return path[t % n];
  const i = t % (2 * (n - 1));
  return path[i < n ? i : 2 * (n - 1) - i];
}

export class Level {
  constructor(data) {
    this.data = data;
    this.hero = data.sim_hero;
    this.rune = data.rune;
    this.w = data.width; this.h = data.height;
    this.m = new Map(); this.ht = new Map();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      this.m.set(K(x, y), data.map[y][x]);
      this.ht.set(K(x, y), +data.heights[y][x]);
    }
    const find = (ch) => [...this.m].filter(([, c]) => c === ch).map(([k]) => k);
    this.start = find('S')[0]; this.goal = find('G')[0];
    this.twin0 = find('T')[0] || null; this.twinGoal = find('H')[0] || null;
    this.coins = new Set(find('*'));
    this.plates = new Set(find('_'));
    this.boxes0 = find('b');
    this.tele = new Map();
    for (const ch of 'pqr') { const ps = find(ch); if (ps.length === 2) { this.tele.set(ps[0], ps[1]); this.tele.set(ps[1], ps[0]); } }
    this.monsters = (data.monsters || []).map((mo) => ({ ...mo, path: mo.path ? mo.path.map((c) => K(c[0], c[1])) : null, at: mo.at ? K(mo.at[0], mo.at[1]) : null }));
    this.platforms = (data.platforms || []).map((p) => p.path.map((c) => K(c[0], c[1])));
    this.patrolCells = new Set();
    this.patrolDefs = this.monsters.filter((mo) => mo.type === 'minion' || mo.type === 'rogue');
    this.sentryDefs = this.monsters.filter((mo) => mo.type === 'sentry');
    this.hunterDefs = this.monsters.filter((mo) => mo.type === 'hunter' || mo.type === 'boss');
    for (const mo of this.patrolDefs) for (const c of mo.path) this.patrolCells.add(c);
    this.period = data.period || 1;
  }
  ch(k) { return this.m.get(k); }
  patrols(t) { return this.patrolDefs.map((mo) => pp(mo.path, t, mo.mode === 'loop')); }
  plats(t) { return this.platforms.map((p) => pp(p, t, false)); }
  sentryLook(mo, t) { return mo.look[Math.floor(t / (mo.hold || 2)) % mo.look.length]; }
  sentryDanger(t) {
    const out = new Set();
    for (const mo of this.sentryDefs) {
      const [x, y] = P(mo.at); out.add(mo.at);
      const d = DIRS[this.sentryLook(mo, t)];
      for (let r = 1; r <= (mo.range || 2); r++) {
        const c = K(x + d[0] * r, y + d[1] * r);
        const ch = this.m.get(c) ?? '#';
        if ('#WKc|J'.includes(ch)) break;
        out.add(c);
      }
    }
    return out;
  }
  spikesUp(k, t) { const ch = this.m.get(k); return (ch === 'x' && t % 4 >= 2) || (ch === 'X' && t % 4 < 2); }
  edge(k, d) {
    const ch = this.m.get(k);
    if (ch in STAIR) {
      const s = STAIR[ch];
      if (d[0] === s[0] && d[1] === s[1]) return this.ht.get(k) + 1;
      if (d[0] === -s[0] && d[1] === -s[1]) return this.ht.get(k);
      return null;
    }
    return this.ht.get(k);
  }
  solid(k, t1, st, gateOpen, who = 'hero') {
    const ch = this.m.get(k);
    if (ch === undefined) return false;
    if (st.crumbled.has(k)) return false;
    if (ch === '#') return who === 'hero' && this.plats(t1).includes(k);
    if (PLAIN.includes(ch) || ch in STAIR || ch === 'b') return true;
    if (ch === '=') return st.lever;
    if (ch === '-') return !st.lever;
    if (ch === '|') return gateOpen;
    if (ch === 'K' || ch === 'J') {
      if (st.opened.has(k)) return true;
      return who === 'hero' && (ch === 'K' ? st.gold : st.silver) > 0;
    }
    if (ch === 'c') return (who === 'hero' && this.hero === 'barbarian') || st.opened.has(k);
    return false;
  }
  initial() {
    return { pos: this.start, t: 0, gold: 0, silver: 0, lever: false, opened: new Set(), coins: new Set(), crumbled: new Set(),
      boxes: new Set(this.boxes0), hunters: this.hunterDefs.map((m) => m.at), twin: this.twin0, events: [] };
  }
  // returns { state, status, events } ; status: ok | win | dead | blocked
  step(st, a) {
    const p = st.pos, t = st.t, t1 = t + 1;
    const boxes = new Set(st.boxes);
    const mons1 = this.patrols(t1);
    const ev = [];
    let np = p, leap = false;
    const d = DIRS[a] || null;
    const [px, py] = P(p);
    if (a === 'W') {
      if (this.m.get(p) === '#') for (const path of this.platforms) if (pp(path, t, false) === p) np = pp(path, t1, false);
    } else {
      np = K(px + d[0], py + d[1]);
      if (!this.m.has(np)) return { status: 'blocked' };
    }
    if (d && boxes.has(np)) {
      if (this.hero !== 'knight' && this.hero !== 'barbarian') return { status: 'blocked' };
      const [nx, ny] = P(np); const bx = K(nx + d[0], ny + d[1]);
      const bch = this.m.get(bx) ?? '#';
      if (!'._b'.includes(bch) || boxes.has(bx) || this.ht.get(bx) !== this.ht.get(np) || this.patrolCells.has(bx) || bx === st.twin || st.hunters.includes(bx) || st.crumbled.has(bx)) return { status: 'blocked' };
      boxes.delete(np); boxes.add(bx);
      ev.push({ type: 'push', from: np, to: bx });
    }
    const baseOcc = new Set([...boxes, ...mons1, ...st.hunters]);
    const tw = st.twin; let ntw = tw;
    if (tw && d) {
      const md = [-d[0], d[1]]; const [tx, ty] = P(tw); const c = K(tx + md[0], ty + md[1]);
      const twinGate = [...this.plates].some((k) => baseOcc.has(k) || k === np);
      if (this.m.has(c) && !boxes.has(c) && this.m.get(c) !== '#' && this.solid(c, t1, st, twinGate, 'twin')
        && this.edge(tw, md) !== null && this.edge(tw, md) === this.edge(c, [-md[0], -md[1]])) ntw = c;
    }
    const gateOpen = [...this.plates].some((k) => baseOcc.has(k) || k === np || (tw && k === ntw));
    if (d) {
      let ok = this.solid(np, t1, st, gateOpen) && this.edge(p, d) !== null && this.edge(p, d) === this.edge(np, [-d[0], -d[1]]);
      if (!ok && this.hero === 'rogue' && !boxes.has(np)) {
        const land = K(px + 2 * d[0], py + 2 * d[1]);
        const gap = !this.solid(np, t1, st, gateOpen) && '#=-~'.includes(this.m.get(np));
        if (gap && this.m.has(land) && !boxes.has(land) && this.solid(land, t1, st, gateOpen)
          && !(this.m.get(p) in STAIR) && !(this.m.get(land) in STAIR) && this.m.get(p) !== '#' && this.ht.get(p) === this.ht.get(land)) {
          np = land; leap = true; ok = true;
        }
      }
      if (!ok) return { status: 'blocked' };
    }
    const ns = { ...st, t: t1, events: ev, opened: st.opened, coins: st.coins, crumbled: st.crumbled };
    const ch = this.m.get(np);
    if (leap) ev.push({ type: 'leap' });
    if (ch === '*' && !st.coins.has(np)) { ns.coins = new Set(st.coins).add(np); ev.push({ type: 'coin', at: np }); }
    if (ch === 'k' && !st.opened.has(np)) { ns.gold++; ns.opened = new Set(ns.opened).add(np); ev.push({ type: 'key', at: np }); }
    if (ch === 'j' && !st.opened.has(np)) { ns.silver++; ns.opened = new Set(ns.opened).add(np); ev.push({ type: 'key', at: np }); }
    if ((ch === 'K' || ch === 'J') && !st.opened.has(np)) { if (ch === 'K') ns.gold--; else ns.silver--; ns.opened = new Set(ns.opened).add(np); ev.push({ type: 'door', at: np }); }
    if (ch === 'c' && !st.opened.has(np)) { ns.opened = new Set(ns.opened).add(np); ev.push({ type: 'smash', at: np }); }
    if (ch === 'L' && np !== p) { ns.lever = !st.lever; ev.push({ type: 'lever', at: np }); }
    if (ch === '|') ev.push({ type: 'gate', at: np });
    if (this.m.get(p) === '~' && np !== p) { ns.crumbled = new Set(st.crumbled).add(p); ev.push({ type: 'crumble', at: p }); }
    if (this.m.get(p) === '#' && np !== p && a !== 'W') ev.push({ type: 'alight' });
    if (ch === '#' && a !== 'W') ev.push({ type: 'board' });
    if (this.tele.has(np) && np !== p) { ev.push({ type: 'teleport', from: np, to: this.tele.get(np) }); np = this.tele.get(np); }
    ns.pos = np; ns.boxes = boxes;
    if (tw) ns.twin = ntw;
    const hs = [];
    this.hunterDefs.forEach((mo, i) => {
      let hp = st.hunters[i];
      if (t1 % (mo.every || 2) === 0) {
        const [hx, hy] = P(hp); const [nx, ny] = P(np);
        const dx = nx - hx, dy = ny - hy, sx = Math.sign(dx), sy = Math.sign(dy);
        const cands = Math.abs(dx) >= Math.abs(dy) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]];
        for (const c of cands) {
          if (c[0] === 0 && c[1] === 0) continue;
          const q = K(hx + c[0], hy + c[1]);
          if (this.m.has(q) && '.*_SGkjLxXpqr~'.includes(this.m.get(q)) && !ns.crumbled.has(q) && !boxes.has(q) && this.ht.get(q) === this.ht.get(hp) && !hs.includes(q)) { hp = q; break; }
        }
      }
      hs.push(hp);
    });
    ns.hunters = hs;
    const occ2 = new Set([...boxes, ...mons1, ...hs, np]); if (tw) occ2.add(ns.twin);
    const open2 = [...this.plates].some((k) => occ2.has(k));
    ns.gateOpen = open2;
    const bodies = tw ? [np, ns.twin] : [np];
    const mons0 = this.patrols(t);
    const danger = this.sentryDanger(t1);
    let death = null;
    bodies.forEach((b, i) => {
      if (death) return;
      const prev = i === 0 ? p : tw;
      if (this.m.get(b) === '|' && !open2) death = { cause: 'gate', who: i, at: b };
      else if (this.spikesUp(b, t1) && !(this.hero === 'mage' && i === 0)) death = { cause: 'trap', who: i, at: b };
      else if (mons1.includes(b) || hs.includes(b)) death = { cause: 'monster', who: i, at: b };
      else if (danger.has(b)) death = { cause: 'gaze', who: i, at: b };
      else {
        mons0.forEach((m0, j) => { if (mons1[j] === prev && m0 === b && m0 !== mons1[j]) death = { cause: 'monster', who: i, at: b }; });
        st.hunters.forEach((h0, j) => { if (hs[j] === prev && h0 === b && h0 !== hs[j]) death = { cause: 'monster', who: i, at: b }; });
      }
    });
    if (death) { ns.death = death; return { state: ns, status: 'dead' }; }
    if (this.hero === 'mage' && this.spikesUp(np, t1)) ev.push({ type: 'ward', at: np });
    if (tw && ns.twin === np) return { status: 'blocked' };
    if (np === this.goal && (!tw || ns.twin === this.twinGoal)) return { state: ns, status: 'win' };
    return { state: ns, status: 'ok' };
  }
  // Run a whole move string. Returns the list of states (index = beat) and the final status.
  run(moves) {
    const states = [this.initial()]; let status = 'ok';
    for (const a of moves) {
      const r = this.step(states[states.length - 1], a);
      status = r.status;
      if (status === 'blocked') break;
      states.push(r.state);
      if (status !== 'ok') break;
    }
    return { states, status };
  }
}
export { K, P, pp, STAIR };
