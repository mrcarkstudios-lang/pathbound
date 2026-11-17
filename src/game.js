import { Level, DIRS, P, K } from './sim.js';
import { loadClips, loadChar, manifest } from './assets.js';
import { sfx } from './audio.js';
import { say } from './copy.js';

const BEAT = 0.42;
const ACTION = new Set(['smash', 'smash_through', 'door_cut', 'lever', 'lever_low', 'kick_crate', 'kick_chest', 'gate_slide', 'cast']);
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const MONSTER_CHAR = { minion: 'zombie', rogue: 'vampire', sentry: 'maw', hunter: 'mutant', boss: 'warrok' };

export class Game {
  constructor(world, ui) { this.world = world; this.ui = ui; this.fast = false; this.busy = false; this.leverFlip = false; this.mode = 'live'; this.queue = []; this.moving = false; this.pumping = false; }
  /** 'live': every tap moves Maria one beat at once. 'plan': draw the whole route, then press PLAY. */
  setMode(mode) { this.mode = mode; this.queue = []; if (this.L && !this.playing) { this.moves = ''; this.resetBoard(0); } }

  async load(levelData) {
    this.data = levelData; this.L = new Level(levelData);
    this.moves = ''; this.busy = false; this.playing = false;
    const chars = [...new Set(this.L.monsters.map((m) => MONSTER_CHAR[m.type]))];
    await Promise.all(chars.map((c) => loadChar(c).then(() => loadClips(c, ['idle', 'walk', 'run', 'spawn']))));
    for (const c of chars) loadClips(c, manifest.creature); // rest in the background
    this.world.build(this.L, levelData);
    this.maria = this.world.maria; this.twin = this.world.twin;
    this.resetBoard(0);
    this.maria.face(1, 1, true); this.maria.play('idle');
    if (this.twin) { this.twin.face(-1, 1, true); this.twin.play('idle'); }
    this.idleTimer = 0;
  }

  // ------------------------------------------------------------ planning
  /** Planning is blind: the route is simulated only to know which steps are possible. Nothing on the board moves until PLAY. */
  recompute() {
    const states = [this.L.initial()]; let status = 'ok'; let n = 0;
    for (const a of this.moves) {
      const r = this.L.step(states[states.length - 1], a);
      if (r.status === 'blocked') break;
      states.push(r.state); n++;
      if (r.status === 'win') { status = 'win'; break; }
    }
    this.states = states; this.status = status; this.moves = this.moves.slice(0, n);
    this.world.showRoute(this.mode === 'live' ? [] : this.states, this.status); this.world.clearHint();
    this.ui.hud(this);
  }
  /** What a hint can say right now: the next steps of the stored best route, or where the player's route left it. */
  hintInfo(n = 3) {
    if (!this.data) return { done: true };
    const sol = this.data.solution_best; const mv = sol.moves; let i = 0;
    while (i < this.moves.length && i < mv.length && this.moves[i] === mv[i]) i++;
    if (i < this.moves.length) return { off: true, at: i, cell: K(...sol.cells[i]) };
    if (i >= mv.length) return { done: true };
    const cells = []; let prev = K(...sol.cells[i]); // a wait stays on its tile, so it adds no new marker
    for (let j = i + 1; j <= Math.min(mv.length, i + n); j++) { const c = K(...sol.cells[j]); if (c !== prev) cells.push(c); prev = c; }
    return { off: false, at: i, cells };
  }
  /** Put the board and everyone on it back to beat 0. */
  resetBoard(dur = 0) {
    const s0 = this.L.initial(); const W = this.world;
    W.applyState(s0, dur, { quiet: true });
    W.placeActor(this.maria, s0.pos, dur);
    if (this.twin) W.placeActor(this.twin, s0.twin, dur);
    if (W.chestLid) W.chestLid.rotation.x = 0;
    for (const m of W.monsters) m.actor.play('idle');
    if (dur > 0) { this.maria.play('run_back', { len: dur, then: { name: 'idle' } }); if (this.twin) this.twin.play('run_back', { len: dur, then: { name: 'idle' } }); }
    else { this.maria.play('idle'); if (this.twin) this.twin.play('idle'); }
    this.recompute();
  }
  get end() { return this.states[this.states.length - 1]; }
  get length() { return this.moves.length; }

  tap(cell, dragging = false) {
    if (this.mode === 'live') return this.tapLive(cell, dragging);
    if (this.busy || this.playing || !cell) return;
    const st = this.end; const [px, py] = P(st.pos); const [cx, cy] = P(cell);
    const dx = cx - px, dy = cy - py;
    let move = null;
    if (cell === st.pos) { if (dragging) return; move = 'W'; }
    else if (Math.abs(dx) + Math.abs(dy) === 1 || ((dx === 0 || dy === 0) && Math.abs(dx) + Math.abs(dy) === 2 && this.L.hero === 'rogue')) {
      move = Object.keys(DIRS).find((k) => DIRS[k][0] === Math.sign(dx) && DIRS[k][1] === Math.sign(dy));
    } else if (!dragging) {
      // tapping an earlier tile of the route rewinds the route to it
      for (let i = this.states.length - 2; i >= 0; i--) if (this.states[i].pos === cell) { this.moves = this.moves.slice(0, i); sfx('undo'); this.recompute(); return; }
      return;
    } else return;
    if (this.status !== 'ok') { if (!dragging) this.ui.toast('The route already reaches the chest. Press PLAY.'); return; }
    if (this.length >= this.data.move_limit) { this.ui.toast('Out of route energy'); return; }
    const r = this.L.step(st, move);
    if (r.status === 'blocked') { if (!dragging) { this.ui.toast(this.blockReason(cell)); sfx('deny'); } return; }
    if (move !== 'W' && Math.abs(dx) + Math.abs(dy) === 2 && r.state.pos !== cell && !this.L.tele.has(K(px + Math.sign(dx) * 2, py + Math.sign(dy) * 2))) { /* leap not possible: it was a normal step */ if (!dragging) this.ui.toast('Too far'); return; }
    this.moves += move;
    sfx(move === 'W' ? 'wait' : 'step');
    this.recompute();
    if (this.status === 'win' && !(this.ui.guided && this.ui.guided())) this.ui.toast(say('routeDone'));
  }
  // ------------------------------------------------------------ live walking: a tap is a step
  /** Which move a tap on `cell` means from state `st`, or null (with a toast) if it means nothing. */
  moveFor(st, cell, dragging) {
    const [px, py] = P(st.pos); const [cx, cy] = P(cell); const dx = cx - px, dy = cy - py;
    let move = null;
    if (cell === st.pos) { if (dragging) return null; move = 'W'; }
    else if (Math.abs(dx) + Math.abs(dy) === 1 || ((dx === 0 || dy === 0) && Math.abs(dx) + Math.abs(dy) === 2 && this.L.hero === 'rogue')) move = Object.keys(DIRS).find((k) => DIRS[k][0] === Math.sign(dx) && DIRS[k][1] === Math.sign(dy));
    else { if (!dragging) this.ui.toast('Tap a tile next to Maria'); return null; }
    const r = this.L.step(st, move);
    if (r.status === 'blocked') { if (!dragging) { this.ui.toast(this.blockReason(cell)); sfx('deny'); this.world.ripple(cell, false); } return null; }
    if (move !== 'W' && Math.abs(dx) + Math.abs(dy) === 2 && r.state.pos !== cell && !this.L.tele.has(K(px + Math.sign(dx) * 2, py + Math.sign(dy) * 2))) { if (!dragging) this.ui.toast('Too far'); return null; }
    return move;
  }
  tapLive(cell, dragging = false) {
    if (!cell || this.playing) return;
    if (this.queue.length >= 3) return; // a drag can line up a few steps ahead, no more
    this.queue.push({ cell, dragging }); this.pump();
  }
  async pump() {
    if (this.pumping) return; this.pumping = true; this.moving = true; this.ui.hud(this);
    try {
      while (this.queue.length && !this.playing) {
        const { cell, dragging } = this.queue.shift();
        if (this.status !== 'ok') { this.queue.length = 0; break; }
        if (this.length >= this.data.move_limit) { this.ui.toast('Out of energy. Undo a step or restart.'); this.queue.length = 0; break; }
        const st = this.end; const mv = this.moveFor(st, cell, dragging); if (!mv) continue;
        const r = this.L.step(st, mv);
        this.moves += mv; this.recompute();
        if (this.moves.length === 1 || !this.facing) { if (DIRS[mv]) this.facing = [DIRS[mv][0], DIRS[mv][1]]; this.prevClip = 'idle'; }
        await this.beatAnim(this.states.length - 2, this.states);
        if (r.status === 'win') { this.playing = true; this.queue.length = 0; await this.win(this.states); break; }
        if (r.status === 'dead') { this.playing = true; this.queue.length = 0; await this.die(this.end); break; }
      }
    } finally { this.pumping = false; this.moving = false; this.ui.hud(this); }
  }
  undoLive() {
    if (this.playing || this.moving || !this.moves) return;
    this.moves = this.moves.slice(0, -1); sfx('undo'); this.recompute(); this.restoreTo(0.3);
  }
  /** After a death: take back the fatal step and stand Maria up where she was. */
  undoAfterFail() { this.moves = this.moves.slice(0, -1); this.queue = []; this.recompute(); this.restoreTo(0.4); }
  /** Put the board, monsters and Maria back to the state at the end of the current route. */
  restoreTo(dur = 0.3) {
    const st = this.end; const W = this.world;
    W.applyState(st, dur, { quiet: true }); W.placeActor(this.maria, st.pos, dur); if (this.twin) W.placeActor(this.twin, st.twin, dur);
    if (W.chestLid) W.chestLid.rotation.x = 0;
    for (const mo of W.monsters) mo.actor.play('idle');
    this.maria.play('idle'); if (this.twin) this.twin.play('idle'); this.facing = null; this.prevClip = 'idle'; this.ui.hud(this);
  }

  blockReason(cell) {
    const ch = this.L.ch(cell);
    if (ch === 'K' || ch === 'J') return `Locked. Find the ${ch === 'K' ? 'gold' : 'silver'} key first`;
    if (ch === '|') return 'Gate is shut. Something must stand on a plate';
    if (ch === 'c') return 'Cracked wall: needs the Might rune';
    if (ch === '=' || ch === '-') return 'No bridge there right now';
    if (ch === 'b') return this.data.rune === 'might' ? 'The crate is stuck' : 'This rune cannot push crates';
    if (ch === '#') return this.data.rune === 'wind' ? 'Nothing to land on' : 'No floor there';
    return 'Cannot step there (height or wall)';
  }
  undo() { if (this.mode === 'live') return this.undoLive(); if (this.busy || this.playing || !this.moves) return; this.moves = this.moves.slice(0, -1); sfx('undo'); this.recompute(); }
  clearRoute() { if (this.mode === 'live') { if (this.playing || this.moving) return; this.queue = []; this.moves = ''; this.resetBoard(0.5); return; } if (this.busy || this.playing) return; this.moves = ''; this.recompute(); }

  tick(dt) {
    if (this.playing || this.busy || !this.maria) return;
    this.idleTimer += dt;
    if (this.idleTimer > 4.5) { const pool = ['idle_2', 'idle_3', 'idle_4', 'idle_5'].filter((n) => n !== this.lastIdle); const v = pool[Math.floor(Math.random() * pool.length)]; this.lastIdle = v;
      for (const a of [this.maria, this.twin]) if (a) a.play(v, { loop: false, fade: 0.5, then: { name: 'idle', opts: { fade: 0.5 } } });
      this.idleTimer = -3;
      for (const m of this.world.monsters) if (Math.random() < 0.5) m.actor.play(Math.random() < 0.5 ? 'idle_long' : 'idle_2', { fade: 0.4 }); }
  }

  // ------------------------------------------------------------ playback
  nearMonster(st, k, range = 2) {
    const [x, y] = P(k); const cells = [...this.L.patrols(st.t), ...st.hunters, ...this.L.sentryDefs.map((m) => m.at)];
    let best = null;
    for (const c of cells) { const [mx, my] = P(c); const d = Math.abs(mx - x) + Math.abs(my - y); if (d <= range && (!best || d < best.d)) best = { d, dx: mx - x, dy: my - y, cell: c }; }
    return best;
  }
  /** Pick Maria's clip for one beat. Every one of her 51 clips is reachable from here or from the intro/outro code. */
  choose(i) {
    const prev = this.states[i], next = this.states[i + 1], move = this.moves[i], nextMove = this.moves[i + 1];
    const ev = new Set(next.events.map((e) => e.type)); const L = this.L;
    const onFerry = L.ch(next.pos) === '#', onCrumble = L.ch(next.pos) === '~';
    const d = DIRS[move]; const fast = this.fast;
    if (ev.has('smash')) return { clip: nextMove === move ? 'smash_through' : 'smash', face: d };
    if (ev.has('door')) return { clip: 'door_cut', face: d };
    if (ev.has('push')) { this.kickFlip = !this.kickFlip; return { clip: this.kickFlip ? 'kick_crate' : 'kick_chest', face: d }; }
    if (ev.has('lever')) { this.leverFlip = !this.leverFlip; return { clip: this.prevClip === 'crouch_hold' || this.leverFlip ? 'lever_low' : 'lever', face: d }; }
    if (ev.has('gate')) return { clip: 'gate_slide', face: d };
    if (ev.has('teleport')) return { clip: 'cast', face: d, teleport: next.events.find((e) => e.type === 'teleport') };
    if (ev.has('leap')) return { clip: 'leap', face: d, arc: 1.3 };
    if (ev.has('board') || ev.has('alight')) return { clip: 'hop', face: d, arc: 0.5 };
    if (L.hero === 'mage' && 'xX'.includes(L.ch(next.pos))) {
      if (ev.has('ward')) return { clip: 'guard_hit', face: d, once: true };
      return { clip: 'guard_hold', lead: this.prevClip && this.prevClip.startsWith('guard') ? null : 'guard_in', face: d };
    }
    const outOf = this.prevClip === 'guard_hold' || this.prevClip === 'guard_hit' ? 'guard_out' : this.prevClip === 'crouch_hold' ? 'crouch_out' : this.prevClip === 'brace_hold' ? 'brace_out' : null;
    if (move === 'W') {
      if (onFerry || onCrumble) return { clip: 'brace_hold', lead: this.prevClip === 'brace_hold' ? null : (this.prevClip === 'crouch_hold' ? 'brace_in' : 'crouch_in') };
      if (this.nearMonster(next, next.pos)) return { clip: 'crouch_hold', lead: this.prevClip === 'crouch_hold' ? null : (this.prevClip === 'brace_hold' ? 'brace_out' : 'crouch_in') };
      return { clip: 'idle', lead: outOf };
    }
    // plain movement
    const near = this.nearMonster(prev, prev.pos);
    const f = this.facing || [0, 1];
    if (near && near.d >= 1 && (near.dx * d[0] + near.dy * d[1]) === 0 && (near.dx === 0 || near.dy === 0)) {
      // sidestep while watching a monster straight ahead
      const toM = [Math.sign(near.dx), Math.sign(near.dy)]; const right = toM[0] * d[1] - toM[1] * d[0] < 0;
      return { clip: (right ? 'strafe_a' : 'strafe_b') + (fast ? '_fast' : ''), face: toM, keepFace: true, lead: outOf };
    }
    if (nextMove && DIRS[nextMove] && d[0] === -f[0] && d[1] === -f[1] && DIRS[nextMove][0] === f[0] && DIRS[nextMove][1] === f[1]) return { clip: 'walk_back', face: f, keepFace: true, lead: outOf };
    if (d[0] === -f[0] && d[1] === -f[1]) return { clip: fast ? 'run' : 'walk', face: d, lead: fast ? 'turn_180_fast' : 'turn_180' };
    if (d[0] !== f[0] || d[1] !== f[1]) return { clip: fast ? 'run' : 'walk', face: d, lead: outOf || ((f[0] * d[1] - f[1] * d[0]) > 0 ? 'turn_a' : 'turn_b'), leadShort: true };
    return { clip: fast ? 'run' : 'walk', face: d, lead: outOf };
  }

  /** Animates ONE beat of the route: Maria's clip, the board, the monsters and the sounds. Used by PLAY and by live walking. */
  async beatAnim(i, states) {
    const W = this.world, m = this.maria, tw = this.twin;
    const prev = states[i], next = states[i + 1];
    const c = this.choose(i);
    const beat = (this.fast ? 0.22 : BEAT) * (ACTION.has(c.clip) ? 1.7 : 1);
    if (c.face) { if (!c.keepFace) this.facing = [c.face[0], c.face[1]]; m.face(c.face[0], c.face[1]); if (tw) tw.face(-c.face[0], c.face[1]); }
    const loop = !(ACTION.has(c.clip) || ['leap', 'hop', 'guard_hit'].includes(c.clip));
    const main = { name: c.clip, opts: { loop, len: loop && !['idle', 'crouch_hold', 'brace_hold', 'guard_hold'].includes(c.clip) ? beat * (c.clip.startsWith('run') ? 1 : 2) : (loop ? undefined : beat), then: loop ? undefined : { name: 'idle' } } };
    for (const a of [m, tw]) { if (!a) continue; if (c.lead) a.play(c.lead, { loop: false, len: beat * (c.leadShort ? 0.3 : 0.45), then: main }); else a.play(main.name, main.opts); }
    this.prevClip = c.clip;
    // world + bodies
    W.applyState(next, beat, { fast: this.fast, arrive: true });
    if (c.teleport) { W.placeActor(m, c.teleport.from, beat * 0.45); W.tween(beat * 0.5, () => {}, () => { W.placeActor(m, next.pos, 0); m.play('hop', { loop: false, len: beat * 0.5, then: { name: 'idle' } }); }); }
    else W.placeActor(m, next.pos, beat, c.arc || 0);
    if (tw) W.placeActor(tw, next.twin, beat);
    if (c.clip === 'run' || c.clip === 'walk' || c.clip === 'walk_back') setTimeout(() => this.world.burst('dust', next.pos, 0.7, 0.15), beat * 700);
    for (const e of next.events) {
      sfx(e.type); this.eventFx(e, next, beat);
      if (['smash', 'push', 'lever'].includes(e.type)) for (const mo of W.monsters) { const near = this.nearMonster(next, e.at || next.pos, 2); if (near && mo.kind !== 'sentry') mo.actor.play('startle', { loop: false, len: 0.5, then: { name: 'idle' } }); }
    }
    if (this.moves[i] !== 'W' && !next.events.length) sfx('step');
    this.ui.hud(this, i + 1);
    await wait(beat);
    if ((this.mode === 'live' || i === states.length - 2) && !next.death) W.setTraps(next, 0.25, false); // at rest, show what the next step would meet
  }

  /** Particles that go with a simulation event. */
  eventFx(e, next, beat) {
    const W = this.world, at = e.at ?? next.pos; const later = (fn, f = 0.8) => setTimeout(fn, beat * 1000 * f);
    if (e.type === 'coin') later(() => W.burst('coin', at, 1, 0.9), 0.7);
    else if (e.type === 'key') later(() => W.burst('key', at, 1, 0.9), 0.7);
    else if (e.type === 'smash') later(() => { W.burst('debris', at, 1.2, 0.8); W.burst('dust', at, 1.4, 0.4); }, 0.5);
    else if (e.type === 'push') later(() => W.burst('dust', next.pos, 1, 0.2), 0.5);
    else if (e.type === 'lever') later(() => W.burst('spark', at, 0.8, 0.8), 0.5);
    else if (e.type === 'gate') later(() => W.burst('dust', at, 1.2, 0.3), 0.5);
    else if (e.type === 'crumble') later(() => { W.burst('debris', at, 1, 0.2); W.burst('dust', at, 1.3, 0.2); }, 0.3);
    else if (e.type === 'teleport') { W.burst('magic', e.from, 1.2, 0.3); later(() => W.burst('magic', next.pos, 1.2, 0.3), 0.6); }
    else if (e.type === 'leap') later(() => W.burst('dust', next.pos, 1, 0.2), 0.9);
    else if (e.type === 'ward') W.burst('magic', at, 0.9, 0.7);
    else if (e.type === 'door') later(() => W.burst('spark', at, 1, 0.9), 0.5);
  }

  async play() {
    if (this.mode === 'live') return;
    if (this.busy || this.playing || !this.moves) { if (!this.moves) this.ui.toast('Tap tiles to draw a route first'); return; }
    this.playing = true; this.ui.hud(this);
    const W = this.world, L = this.L, m = this.maria, tw = this.twin;
    const full = this.L.run(this.moves); const states = full.states; const status = full.status;
    const d0 = DIRS[this.moves.split('').find((c) => c !== 'W')] || [0, 1];
    this.facing = [d0[0], d0[1]]; m.face(d0[0], d0[1]); if (tw) tw.face(-d0[0], d0[1]);
    sfx('draw');
    m.play('draw_1', { loop: false, len: 0.35, then: { name: 'draw_2', opts: { loop: false, len: 0.5, then: { name: 'idle' } } } });
    if (tw) tw.play('draw_1', { loop: false, len: 0.35, then: { name: 'draw_2', opts: { loop: false, len: 0.5, then: { name: 'idle' } } } });
    for (const mo of W.monsters) if (mo.def.type === 'boss') mo.actor.play('roar', { loop: false, len: 1.0, then: { name: 'idle' } });
    await wait(0.95);
    this.prevClip = 'idle';
    for (let i = 0; i < states.length - 1; i++) {
      if (!this.playing) return;
      await this.beatAnim(i, states);
    }
    if (!this.playing) return;
    if (status === 'win') await this.win(states);
    else if (status === 'dead') await this.die(states[states.length - 1]);
    else { m.play('idle'); if (tw) tw.play('idle'); this.ui.toast('The route stops short of the chest. Extend it and press PLAY again.'); await wait(0.9); this.playing = false; this.resetBoard(0.5); }
  }

  async die(st) {
    const m = st.death.who === 0 ? this.maria : this.twin; const W = this.world; const cause = st.death.cause;
    sfx(cause === 'trap' ? 'trap' : 'hit'); sfx('fail'); W.burst('blood', st.death.at, 1.1, 0.8);
    // the killer attacks
    let killer = null; for (const mo of W.monsters) { const p = mo.actor.root.position; const mp = W.cellPos(st.death.at); if (Math.abs(p.x - mp.x) + Math.abs(p.z - mp.z) < 2.6 && (!killer || mo.kind !== 'sentry')) killer = mo; }
    if (cause === 'gaze') killer = W.monsters.find((mo) => mo.kind === 'sentry') || killer;
    if (killer && cause !== 'trap' && cause !== 'gate') {
      const atk = killer.def.type === 'boss' ? 'slam' : killer.kind === 'hunter' ? (Math.random() < 0.5 ? 'swipe' : 'lunge') : killer.kind === 'sentry' ? 'roar' : 'punch';
      killer.actor.face(m.root.position.x - killer.actor.root.position.x, m.root.position.z - killer.actor.root.position.z);
      killer.actor.play(atk, { loop: false, len: 0.9, then: { name: 'taunt', opts: { loop: false, then: { name: 'idle' } } } });
    }
    const hit = cause === 'trap' ? 'hit_trap' : this.prevClip === 'crouch_hold' ? 'hit_crouch' : this.prevClip === 'brace_hold' ? 'hit_braced' : 'hit_monster';
    const death = cause === 'trap' || cause === 'gate' ? 'death_front' : 'death_back';
    m.play(hit, { loop: false, len: 0.45, then: { name: death, opts: { loop: false } } });
    await wait(2.4);
    this.playing = false;
    this.ui.failed(this, cause);
  }

  async win(states) {
    const W = this.world, m = this.maria, tw = this.twin; const last = states[states.length - 1];
    const coinsAll = last.coins.size === this.data.coins.length; const len = this.moves.length;
    let stars = 1;
    if (this.data.coins.length) { if (coinsAll) stars = len <= this.data.par ? 3 : 2; }
    else stars = len <= this.data.par ? 3 : (len <= this.data.par + 3 ? 2 : 1);
    // she strikes the chest open with the great sword
    m.face(-1, -1);
    m.play('lever', { loop: false, len: 1.0 }); sfx('smash');
    await wait(0.55);
    if (W.chestLid) { const lid = W.chestLid; W.tween(0.4, (a) => { lid.rotation.x = -1.9 * a; }); }
    for (const mo of W.monsters) mo.actor.play('die', { loop: false });
    await wait(0.5);
    const boss = W.monsters.find((mo) => mo.def.type === 'boss');
    if (boss) { m.face(boss.actor.root.position.x - m.root.position.x, boss.actor.root.position.z - m.root.position.z); m.play('boss_strike', { loop: false, len: 1.5 }); sfx('smash'); await wait(1.5); }
    sfx('win'); { const cp = W.chestLid ? W.cellPos(this.L.goal, W.topY(this.L.goal) + 1.3) : null; if (cp) { W.burst('glow', cp, 1); W.burst('confetti', cp, 1); setTimeout(() => W.burst('confetti', cp, 1.2), 500); } }
    const worldEnd = this.data.id % 10 === 0;
    const seq = [];
    if (stars === 3) seq.push(['flourish', 1.3]);
    seq.push(worldEnd ? ['rune_award', 3.2] : ['victory', 2.2]);
    m.face(1, 1); if (tw) tw.face(-1, 1);
    for (const [clip, t] of seq) { m.play(clip, { loop: false, len: t }); if (tw) tw.play(clip, { loop: false, len: t }); await wait(Math.min(t, 1.4)); }
    this.playing = false;
    this.ui.won(this, stars, coinsAll);
  }
  stop() { this.playing = false; }
}
