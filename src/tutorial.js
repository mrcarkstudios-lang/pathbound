// Teaching without a manual:
//   guided coach  - levels 1 and 2: Maria's speech bubble plus a tapping hand that points at the next tile or button
//   lesson cards  - the first time a rule appears (coins, stairs, keys, spikes, monsters ...) a short "NEW" card explains it
//   say()         - a speech bubble for the level's tip
import { GUIDED, CARDS, COPY, say as pickLine } from './copy.js';

export function createTutorial({ world, game, sheet, closeSheet, act, A, eco, $, levels = [], skip = false }) {
  const bubble = $('coach'), ptr = $('pointer');
  let guided = null; let target = null; let timer = 0; let glow = null; let nextCard = null;

  const setBubble = (title, text, { skipBtn = false, ms = 0 } = {}) => {
    bubble.querySelector('b').textContent = title; bubble.querySelector('span').textContent = text;
    bubble.querySelector('.skip').classList.toggle('hidden', !skipBtn); bubble.classList.remove('hidden'); bubble.classList.remove('in'); void bubble.offsetWidth; bubble.classList.add('in');
    clearTimeout(timer); if (ms) timer = setTimeout(hideBubble, ms);
  };
  const hideBubble = () => { bubble.classList.add('hidden'); clearTimeout(timer); };
  const unglow = () => { if (glow) glow.classList.remove('coachglow'); glow = null; };
  const hidePointer = () => { ptr.classList.add('hidden'); target = null; unglow(); };
  const point = (t) => {
    if (!t) { hidePointer(); return; }
    target = t; ptr.classList.remove('hidden'); unglow();
    if (t.el) { glow = document.querySelector(t.el); if (glow) glow.classList.add('coachglow'); }
    place();
  };
  const place = () => {
    if (!target) return; let x, y, r = 36;
    if (target.cell) { const p = world.screenOf(target.cell); x = p.x; y = p.y; r = Math.max(30, Math.min(window.innerWidth, window.innerHeight * 1.8) * 0.045); }
    else { const el = document.querySelector(target.el); if (!el) return; const b = el.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; r = Math.max(b.width, b.height) / 2 + 8; }
    ptr.classList.toggle('flip', y > window.innerHeight * 0.7); // near the bottom edge the hand points down from above
    ptr.style.transform = `translate(${x}px, ${y}px)`; ptr.style.setProperty('--r', r + 'px');
  };

  const end = () => { guided = null; hideBubble(); hidePointer(); };
  const finish = () => { if (guided) eco.markLesson(guided.id); end(); };
  bubble.querySelector('.skip').onclick = (e) => { e.stopPropagation(); finish(); };
  bubble.addEventListener('pointerdown', (e) => { if (!guided && !e.target.closest('.skip')) hideBubble(); });

  /** Called after every change of the route. */
  const refresh = () => {
    if (!guided) return;
    if (game.playing) { hideBubble(); hidePointer(); return; }
    const g = (game.mode === 'live' && guided.live) ? guided.live : guided;
    if (game.status === 'win') { setBubble(g.done[0], g.done[1], { skipBtn: true }); point({ el: '#btnPlay' }); return; }
    const info = game.hintInfo(1);
    if (info.off) { setBubble(g.off[0], g.off[1], { skipBtn: true }); point({ el: '#btnUndo' }); return; }
    const cell = info.cells && info.cells[0];
    const [title, text] = game.moves.length === 0 ? g.start : g.go;
    setBubble(title, text, { skipBtn: true }); point(cell ? { cell } : null);
  };

  const iconHtml = (icon) => {
    if (/^rune-/.test(icon)) return `<img src="${A('ui/' + icon)}" alt="">`;
    if (/^[a-z-]+$/.test(icon) && icon !== 'coin') return `<img src="${A('ui/icon-' + icon)}" alt="">`;
    return `<span class="emo">${icon === 'coin' ? '🪙' : icon}</span>`;
  };
  const cardKeys = (level) => {
    const keys = [];
    if (level.rune === 'wind' || level.rune === 'ward') keys.push(level.rune);
    if (level.needs_wait) keys.push('wait');
    for (const m of level.mechanics || []) if (CARDS[m]) keys.push(m);
    for (const mo of level.monsters || []) if (CARDS[mo.type]) keys.push(mo.type);
    return [...new Set(keys)];
  };
  const firstLevel = {}; for (const l of levels) for (const k of cardKeys(l)) if (!(k in firstLevel)) firstLevel[k] = l.id;
  const pendingCards = (level) => {
    const done = Math.max(0, ...levels.filter((l) => eco.stars(l.id) > 0).map((l) => l.id)); // a player who got past a rule's first level already knows it
    return cardKeys(level).filter((k) => !eco.lessonSeen(k) && !(done >= (firstLevel[k] ?? 1e9))).slice(0, 2); // never more than two cards before a level
  };
  const showCards = (keys) => new Promise((resolve) => {
    let i = 0;
    nextCard = () => {
      if (i >= keys.length) { nextCard = null; return resolve(); }
      const k = keys[i++]; eco.markLesson(k); const c = CARDS[k];
      sheet(`NEW: ${c.title}`, `<div class="lesson">${iconHtml(c.icon)}</div><p>${c.text}</p><button class="pb gold" data-act="gotit">Got it!</button>`, { dismiss: false });
    };
    nextCard();
  });
  act('gotit', () => { closeSheet(); setTimeout(() => nextCard && nextCard(), 180); });

  return {
    get active() { return !!guided; },
    refresh, tick: () => { if (target) place(); }, end,
    /** A speech bubble with the level's tip. */
    say(text, ms = 9000) { if (guided) return; setBubble(pickLine('hintIntro'), text, { ms }); },
    /** Start-of-level teaching: new-rule cards first, then the guided coach (levels 1-2) or the tip bubble. */
    async begin(level, firstVisit) {
      end(); if (skip) return;
      const keys = pendingCards(level); if (keys.length) await showCards(keys);
      const g = GUIDED[level.id];
      if (g && !eco.lessonSeen(g.id) && eco.stars(level.id) === 0) { guided = g; refresh(); return; }
      if (firstVisit) this.say(level.hint, 9500);
    },
    /** The level was won: a finished lesson is not shown again. */
    complete() { if (guided) eco.markLesson(guided.id); end(); },
  };
}
