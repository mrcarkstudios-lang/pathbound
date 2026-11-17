import levelsData from './data/levels.json';
import { World } from './world.js';
import { Game } from './game.js';
import { loadManifest, loadEnv, loadChar, loadClips } from './assets.js';
import { sfx, introSting, unlockAudio, setMuted, setMusicOn, playMusic, pauseMusic, resumeMusic } from './audio.js';
import * as audioMod from './audio.js'; window.__audio = audioMod;
import { ads } from './ads.js';
import { ADS } from './ads-config.js';
import { iap } from './iap.js';
import * as eco from './economy.js';
import { createTutorial } from './tutorial.js';
import { say, sayFail } from './copy.js';

const $ = (id) => document.getElementById(id);
const levels = levelsData.levels;
// the monster cast is the five Mixamo creatures: reword the hints written for the earlier skeleton cast
for (const l of levels) l.hint = l.hint.replace(/Skeleton Mage/g, 'Watcher').replace(/Mage(s?)/g, 'Watcher$1').replace(/Skeleton Warrior/g, 'Hunter').replace(/Warrior(s?)/g, 'Hunter$1').replace(/Bone King/g, 'Warrok').replace(/skeleton/g, 'ghoul').replace(/Skeleton/g, 'Ghoul');
const params = new URLSearchParams(location.search);
const WORLDS = ['Forgotten Garden', 'Broken Ruins', 'Floating Islands', 'Ancient Temple', 'Monster Territory', 'Lost Kingdom', 'Portal Dimension', 'Burning Path', 'Twin Souls', 'Final Dimension'];
const RUNE_TEXT = { might: 'Might: push crates, cut cracked walls', wind: 'Wind: leap one-tile gaps', ward: 'Ward: immune to traps' };
const RUNE_ICON = { might: 'might', wind: 'wind', ward: 'ward' };
const A = (p) => `/art/${p}.webp`;
const ic = (n, cls = '') => `<img class="${cls}" src="${A('ui/icon-' + n)}" alt="" />`;
setMuted(!eco.sound()); setMusicOn(eco.music());
document.addEventListener('pointerdown', () => unlockAudio(), true); // browsers start sound only after a touch

const unlocked = (id) => params.has('unlock') || id === 1 || eco.stars(id - 1) > 0;

// ---------------------------------------------------------------- sheets (popups)
let sheetClose = null;
function sheet(title, html, { onClose, dismiss = true, light = false } = {}) {
  $('sheet').classList.toggle('light', light);
  $('shTitle').textContent = title; $('shBody').innerHTML = html; $('sheet').classList.remove('hidden'); sheetClose = onClose || null; $('sheet').dataset.dismiss = dismiss ? '1' : ''; $('shClose').classList.toggle('hidden', !dismiss);
  $('sheet').querySelector('.card').scrollTop = 0;
}
function closeSheet() { $('sheet').classList.add('hidden'); const f = sheetClose; sheetClose = null; f && f(); }
$('shClose').onclick = () => { sfx('click'); closeSheet(); };
$('sheet').addEventListener('pointerdown', (e) => { if (e.target === $('sheet') && $('sheet').dataset.dismiss) closeSheet(); });
const act = (name, fn) => { actions[name] = fn; };
const actions = {};
$('sheet').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) { sfx('click'); actions[b.dataset.act] && actions[b.dataset.act](b); } });
const btn = (a, cls, label, extra = '') => { // every popup button uses the same glossy style: gold = main action, green = watch a video, purple = the rest
  const kind = cls.includes('gold') ? 'gold' : cls.includes('green') ? 'watch' : cls.includes('red') ? 'danger' : 'plain'; const sm = cls.includes('small') ? ' sm' : '';
  return `<button class="pb ${kind}${sm}" data-act="${a}" ${extra}>${label}</button>`;
};

// ---------------------------------------------------------------- toast
let toastTimer = 0;
const toast = (msg, ms = 2600) => { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), ms); };

// ---------------------------------------------------------------- rewarded actions
let adBusy = false;
/** Shows a rewarded video; grants only if the player watched. */
async function watch(placement) {
  if (adBusy) return false; adBusy = true;
  try { const ok = await ads.rewarded(placement); if (ok) eco.noteRewardWatched(); else toast('Watch the whole video to get the reward'); return ok; } finally { adBusy = false; }
}
const watchLabel = (text) => `${ic('watch-ad')} ${text}`;

// ---------------------------------------------------------------- game UI callbacks
let tutorial = null;
const ui = {
  toast,
  guided: () => !!(tutorial && tutorial.active),
  hud(g, beat) {
    const d = g.data; const st = beat !== undefined ? g.states[Math.min(beat, g.states.length - 1)] : g.end;
    $('lvName').textContent = `${d.id}. ${d.name}`;
    $('lvMeta').textContent = `World ${d.world}: ${WORLDS[d.world - 1]}`;
    $('chipRune').innerHTML = `<img src="${A('ui/rune-' + RUNE_ICON[d.rune])}" alt="" style="width:18px;height:18px;vertical-align:-4px"> ${d.rune[0].toUpperCase() + d.rune.slice(1)}`; $('chipRune').title = RUNE_TEXT[d.rune];
    $('chipCoins').textContent = d.coins.length ? `🪙 ${st.coins.size}/${d.coins.length}` : '🪙 none';
    const keys = (st.gold ? ` 🔑${st.gold}` : '') + (st.silver ? ` 🗝${st.silver}` : '');
    $('chipSteps').textContent = `👣 ${g.length} · par ${d.par}${keys}`;
    $('chipSteps').classList.toggle('over', g.length > d.par);
    $('btnPlay').classList.toggle('ready', g.status === 'win' && !g.playing);
    for (const b of ['btnUndo', 'btnClear', 'btnPlay', 'btnHint']) $(b).disabled = g.playing || g.moving;
    $('btnWait').disabled = g.playing;
    if (beat === undefined && tutorial) tutorial.refresh();
  },
  won(g, nStars, coinsAll) {
    const d = g.data; const first = eco.stars(d.id) === 0;
    eco.setStars(d.id, nStars); eco.noteLevelWon(); eco.clearFails(d.id);
    let bonus = 0; if (nStars === 3) { bonus = eco.CONFIG.winHintEvery3Stars; eco.addHints(bonus); }
    tutorial.complete(); if (nStars >= 2) world.scenery.celebrate(d.world);
    const title = say(nStars === 3 ? 'win3' : nStars === 2 ? 'win2' : 'win1'); const sub = say(nStars === 3 ? 'win3sub' : nStars === 2 ? 'win2sub' : 'win1sub');
    let msg = `${g.length} steps · par ${d.par}. ${sub}`;
    if (d.coins.length && !coinsAll) msg += ' Grab every coin for two stars.'; else if (nStars === 2 && !sub.includes('third')) msg += ` Finish in ${d.par} or fewer for three stars.`;
    if (d.id === 20) msg += ' New rune: WIND. Maria can now leap one-tile gaps.';
    if (d.id === 60) msg += ' New rune: WARD. Spikes and flames cannot hurt Maria.';
    const worldEnd = d.id % 10 === 0 && first;
    const starsHtml = `<div class="stars">${[1, 2, 3].map((i) => `<img class="${i <= nStars ? '' : 'off'}" src="${A('ui/icon-star-' + (i <= nStars ? 'full' : 'empty'))}" alt="" />`).join('')}</div>`;
    let left = `${starsHtml}<p>${msg}</p>`;
    if (bonus) left += `<div class="reward">${say('perfectBonus').replace('hint', '')} ${ic('hint', 'inl')} hint</div>`;
    let right = '';
    const pb = (a, cls, icon, label, sub = '') => `<button class="pb ${cls}" data-act="${a}"><span class="pi">${icon}</span><span class="pt"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`;
    if (worldEnd) { left = `<img class="chest small" src="${A('shop/daily-chest-closed')}" alt="" />${starsHtml.replace('class="stars"', 'class="stars mini"')}<div class="reward">World cleared! Bonus chest</div>`; right += pb('worldBonus', 'gold', '🎁', 'Open chest', `+${eco.CONFIG.worldBonusHints} hints`) + pb('worldBonus2', 'watch', ic('watch-ad'), 'Open it x2', `watch · +${eco.CONFIG.worldBonusHints * 2} hints`); }
    else right += pb('adBonus', 'watch', ic('watch-ad'), 'Watch', `+${eco.CONFIG.rewardedBonusOnWin} free hints`);
    right += (d.id < 100 ? pb('next', 'next', '▶', 'NEXT LEVEL') : '') + `<div class="pbrow">${pb('retry', 'ghost', '↻', 'Replay')}${pb('levels', 'ghost', '▦', 'Levels')}</div>`;
    const html = `<div class="res"><div class="resL">${left}</div><div class="resR">${right}</div></div><div id="shNative"></div>`;
    sheet(d.id === 100 ? 'PATHBOUND!' : title, html, { dismiss: false, light: true }); refreshPills(); fillNative('shNative');
  },
  failed(g, cause) {
    const fails = eco.recordFail(g.data.id); const stuck = fails >= eco.CONFIG.stuckAfterFails;
    const live = g.mode === 'live';
    // left: what happened; right: one big main action, the hint, then the small ones side by side
    let left = `<img class="chest small" src="${A('ui/rune-' + RUNE_ICON[g.data.rune])}" alt="" /><p><b>${sayFail(cause)}</b></p><p class="fine">${say(live ? 'failTipLive' : 'failTip')}</p>`;
    if (stuck) left += `<div class="fine">${say('stuck')}</div>`;
    let right = live ? btn('undoStep', 'gold', 'Undo last step') : btn('retryKeep', 'gold', say('retry'));
    right += btn('hint', 'green small', eco.hints() > 0 ? `${ic('hint')} Show me the way (${eco.hints()})` : watchLabel('Watch: free hint'));
    if (stuck && eco.skipsLeft() > 0 && g.data.id < 100) right += btn('skip', 'purple small', watchLabel('Stuck? Skip this level'));
    right += `<div class="pbrow">${live ? btn('restart', 'purple small', 'Restart') : ''}${btn('levels', 'purple small', 'Levels')}</div>`;
    sheet(say('failTitle'), `<div class="res"><div class="resL">${left}</div><div class="resR">${right}</div></div>`, { dismiss: false });
  },
};

// ---------------------------------------------------------------- boot objects
const world = new World($('c'));
const game = new Game(world, ui);
game.mode = params.get('mode') === 'plan' ? 'plan' : params.get('mode') === 'live' ? 'live' : eco.mode(); document.body.classList.toggle('live', game.mode === 'live');
tutorial = createTutorial({ world, game, sheet, closeSheet, act, A, eco, $, levels, skip: params.has('auto') || params.has('moves') });
let current = null; let screen = 'loading'; let selWorld = 1;
window.__closeSheet = closeSheet; window.__game = game; window.__world = world; window.__ui = ui; // handy for debugging

function setBanner() { const on = !eco.noAds() && ads.provider !== 'none' && !(screen === 'play' && window.innerHeight < 560); ads.banner(on); } // a phone held sideways is too short for a banner while planning
ads.onBannerHeight = (h) => { document.documentElement.style.setProperty('--banner-h', h + 'px'); world.bottomPx = h; world.frame(); };

function applyPads() {
  const short = window.innerHeight < 560; const name = screen;
  if (name === 'play') { world.bottomPad = short ? 0.17 : 0.13; world.topPad = short ? 0.12 : 0.09; }
  else if (name === 'title') { const wide = window.innerWidth > window.innerHeight; world.bottomPad = wide ? 0.06 : 0.36; world.topPad = wide ? 0.06 : 0.34; world.sidePad = wide ? 0.3 : 0; }
  else { world.bottomPad = 0.34; world.topPad = 0.05; world.sidePad = 0; }
  if (name !== 'title') world.sidePad = 0;
}
window.addEventListener('resize', () => { applyPads(); world.frame(); });
function show(name) {
  screen = name;
  for (const s of ['loading', 'title', 'select']) $(s).classList.toggle('hidden', s !== name);
  $('hud').classList.toggle('hidden', name !== 'play');
  $('sheet').classList.add('hidden'); sheetClose = null;
  if (name !== 'play' && tutorial) tutorial.end();
  if (name === 'title') $('tagline').textContent = say('tagline');
  applyPads(); setBanner();
  if (name !== 'loading') playMusic(name === 'play' && current ? current.world : 0);
  if (name === 'title' || name === 'select') world.scenery.setBackdrop(name === 'title' ? 'title' : selWorld, false);
  if (name === 'title') { refreshPills(); world.spin = true; } else world.spin = false;
  world.frame();
}
function refreshPills() {
  $('pillStars').innerHTML = `${ic('star-full')} ${eco.totalStars()}`; $('pillHints').innerHTML = `${ic('hint')} ${eco.hints()}`; $('selStars').innerHTML = `${ic('star-full')} ${eco.totalStars()} / 300`;
  $('hintBadge').textContent = eco.hints();
  $('dailyDot').classList.toggle('hidden', !eco.dailyReady()); $('dkNoAds').classList.toggle('hidden', eco.noAds());
  const next = levels.find((l) => !(eco.stars(l.id) > 0)); $('startLabel').textContent = eco.totalStars() > 0 && next ? `Play · Lv ${next.id}` : 'Play';
}
eco.onChange(() => { if ($('title') && !$('title').classList.contains('hidden')) refreshPills(); $('hintBadge').textContent = eco.hints(); });

async function breakpoint(levelId) { // a natural pause: a pop-up ad may appear here, never in the middle of a plan
  if (eco.mayShowInterstitial(levelId)) { if (await ads.interstitial('level_break')) eco.noteInterstitialShown(); }
}

async function startLevel(id) {
  const d = levels.find((l) => l.id === id); if (!d) return;
  current = d; game.stop(); show('play'); world.scenery.setBackdrop(d.world, true);
  await game.load(d); world.frame();
  const first = !eco.seen(id); if (first) eco.markSeen(id);
  tutorial.begin(d, first);
  if (params.has('auto') || params.has('moves')) { game.moves = params.get('moves') || d.solution_best.moves; game.recompute(); setTimeout(() => game.play(), 600); }
}

async function titleScene() {
  await game.load(levels[8]); world.scenery.setBackdrop('title'); world.frame();
  const loop = () => { if (screen !== 'title') return; game.maria.play('showcase', { loop: false, then: { name: 'idle_5', opts: { fade: 0.4 } } }); setTimeout(loop, 11500); };
  loop();
}

// ---------------------------------------------------------------- level select
function renderSelect() {
  $('selTitle').textContent = `World ${selWorld}: ${WORLDS[selWorld - 1]}`;
  refreshPills();
  $('worldCards').innerHTML = WORLDS.map((n, i) => { const w = i + 1; const got = levels.filter((l) => l.world === w).reduce((a, l) => a + eco.stars(l.id), 0); return `<div class="wcard ${w === selWorld ? 'on' : ''}" data-w="${w}"><img src="${A('worldcards/card-w' + String(w).padStart(2, '0'))}" alt="" loading="lazy"><div class="n">${w}. ${n}</div><div class="s">★ ${got}/30</div></div>`; }).join('');
  const ls = levels.filter((l) => l.world === selWorld);
  $('worldInfo').textContent = RUNE_TEXT[ls[0].rune] ? `Usual rune here: ${RUNE_TEXT[ls[0].rune]}.` : '';
  $('levelGrid').innerHTML = ls.map((l) => { const s = eco.stars(l.id); const ok = unlocked(l.id); const cls = !ok ? 'locked' : s > 0 ? 'done' : 'open'; return `<button class="lv ${cls}" data-l="${l.id}" aria-label="Level ${l.id}">${ok ? l.id : ''}<span class="st">${[1, 2, 3].map((i) => `<img class="${i <= s ? 'on' : ''}" src="${A('ui/icon-star-full')}" alt="">`).join('')}</span></button>`; }).join('');
  const on = $('worldCards').querySelector('.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  fillNative('nativeSlot');
}
async function fillNative(id) {
  const el = $(id); if (!el) return; el.innerHTML = ''; if (eco.noAds()) return;
  const n = await ads.native(); if (!n || !$(id)) return;
  el.classList.remove('hidden'); el.innerHTML = `<div class="native"><img src="${A(n.icon.replace('.webp', ''))}" alt=""><div style="flex:1"><div class="tg">Sponsored</div><b>${n.title}</b><div class="fine">${n.body}</div></div><button class="b gold small" style="min-width:0">${n.cta}</button></div>`;
}
function openSelect(w) { selWorld = w || (current ? current.world : Math.min(10, Math.floor(Math.max(0, ...levels.filter((l) => eco.stars(l.id) > 0).map((l) => l.id), 1) / 10) + 1)); game.stop(); renderSelect(); show('select'); const on = $('worldCards').querySelector('.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }

$('worldCards').addEventListener('click', (e) => { const c = e.target.closest('.wcard'); if (c) { sfx('click'); selWorld = +c.dataset.w; renderSelect(); world.scenery.setBackdrop(selWorld); } });
$('levelGrid').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const id = +b.dataset.l; if (!unlocked(id)) { toast('Finish the previous level first'); return; } sfx('click'); startLevel(id); });
$('btnStart').onclick = () => { lockLandscape(); unlockAudio(); sfx('click'); const next = levels.find((l) => !(eco.stars(l.id) > 0)) || levels[0]; startLevel(next.id); };
$('btnLevels').onclick = () => { lockLandscape(); unlockAudio(); sfx('click'); openSelect(); };
$('selBack').onclick = () => { show('title'); titleScene(); };
$('btnBack').onclick = async () => { await breakpoint(current.id); openSelect(current.world); };
$('btnUndo').onclick = () => game.undo();
$('btnClear').onclick = () => game.clearRoute();
$('btnWait').onclick = () => { unlockAudio(); game.tap(game.end.pos); };
$('btnPlay').onclick = () => { unlockAudio(); world.clearHint(); game.play(); };
$('btnSpeed').onclick = () => { game.fast = !game.fast; $('btnSpeed').textContent = game.fast ? '2x' : '1x'; };
$('btnRotate').onclick = () => { sfx('click'); world.rotate(1); };
$('pillHints').onclick = () => { sfx('click'); openShop(); };
$('dkShop').onclick = () => { sfx('click'); openShop(); };
$('dkNoAds').onclick = () => { sfx('click'); openShop(); };
$('dkDaily').onclick = () => { sfx('click'); openDaily(); };
$('dkSettings').onclick = () => { sfx('click'); openSettings(); };
$('btnHint').onclick = () => { sfx('click'); openHint(); };

// ---------------------------------------------------------------- hints
function openHint() {
  if (game.playing) return;
  const n = eco.hints();
  const left = `<img class="chest small" src="${A('ui/icon-hint')}" alt="" /><p>Stuck? Read the tip, or let a hint mark the next steps on the board.</p><div class="fine">${n > 0 ? 'Each reveal uses one hint. Earn more by playing, the daily gift, or the shop.' : 'You are out of hints. One short video gives you one.'}</div>`;
  const right = (n > 0 ? btn('reveal', 'gold', `${ic('hint')} Show next 3 steps (${n})`) : btn('revealAd', 'gold', watchLabel('Watch: show next 3 steps'))) + btn('tip', 'purple small', 'Read the tip');
  sheet('Hint', `<div class="res"><div class="resL">${left}</div><div class="resR">${right}</div></div>`);
}
act('tip', () => { closeSheet(); tutorial.say(current.hint, 10000); });
act('reveal', () => { closeSheet(); revealHint(true); });
act('revealAd', async () => { if (await watch('hint')) { eco.addHints(eco.CONFIG.rewardedHint); closeSheet(); revealHint(true); } });
function revealHint(charge) {
  const info = game.hintInfo(3);
  if (info.done) { toast('Your route already follows the best line. Press PLAY!'); return; }
  if (info.off) { world.showHint([info.cell], 'back'); toast(`Your route leaves the best line at step ${info.at + 1}. Undo back to the marked tile.`, 5500); return; } // free: it only points out a mistake
  if (charge && !eco.useHint()) { openHint(); return; }
  world.showHint(info.cells, 'next'); toast('Walk the numbered tiles in order.', 4500); refreshPills();
}
act('hint', () => { // from the fail sheet
  const rewind = () => { if (game.mode === 'live') game.undoAfterFail(); else game.resetBoard(0.4); };
  if (eco.hints() > 0) { closeSheet(); rewind(); revealHint(true); }
  else watch('hint').then((ok) => { if (ok) { eco.addHints(1); closeSheet(); rewind(); revealHint(true); } });
});

// ---------------------------------------------------------------- result sheet actions
let adBonusUsed = false;
act('next', async () => { closeSheet(); adBonusUsed = false; await breakpoint(current.id); startLevel(current.id + 1); });
act('retry', () => { closeSheet(); game.moves = ''; game.resetBoard(0.4); });
act('retryKeep', () => { closeSheet(); game.resetBoard(0.5); });
act('undoStep', () => { closeSheet(); game.undoAfterFail(); });
act('restart', () => { closeSheet(); game.moves = ''; game.queue = []; game.resetBoard(0.4); });
act('levels', async () => { closeSheet(); await breakpoint(current.id); openSelect(current.world); });
act('adBonus', async (b) => { if (await watch('win_bonus')) { eco.addHints(eco.CONFIG.rewardedBonusOnWin); b.disabled = true; b.innerHTML = `${ic('check')} +${eco.CONFIG.rewardedBonusOnWin} hints added`; refreshPills(); } });
act('worldBonus', (b) => { eco.addHints(eco.CONFIG.worldBonusHints); b.parentElement.querySelectorAll('button').forEach((x) => { x.disabled = true; }); b.textContent = 'Claimed'; $('shBody').querySelector('.chest').src = A('shop/daily-chest-open'); refreshPills(); });
act('worldBonus2', async (b) => { if (adBusy) return; adBusy = true; let ok = false; try { ok = await ads.rewardedInterstitial('world_bonus'); } finally { adBusy = false; } if (ok) { eco.noteRewardWatched(); eco.addHints(eco.CONFIG.worldBonusHints * 2); b.parentElement.querySelectorAll('button').forEach((x) => { x.disabled = true; }); b.textContent = 'Claimed x2'; $('shBody').querySelector('.chest').src = A('shop/daily-chest-open'); refreshPills(); } });
act('skip', async () => { if (await watch('skip_level')) { eco.useSkip(); eco.setStars(current.id, 1); closeSheet(); startLevel(current.id + 1); } });

// ---------------------------------------------------------------- daily gift
function openDaily() {
  const p = eco.dailyPreview(); const ready = eco.dailyReady();
  const left = `<img class="chest" src="${A('shop/daily-chest-' + (ready ? 'closed' : 'open'))}" alt="" /><p>Day ${p.day} of 7 · streak ${p.streak}</p>`;
  let right;
  if (ready) right = `<div class="reward">+${p.hints} ${ic('hint', 'inl')} hint${p.hints > 1 ? 's' : ''}</div>${btn('claim', 'gold', 'Claim')}${btn('claim2', 'green small', watchLabel(`Claim x2 (+${p.hints * 2})`))}`;
  else right = `<p>Today's gift is claimed.<br>Come back tomorrow, the gift grows every day for 7 days.</p>${btn('close', 'purple', 'OK')}`;
  sheet('Daily gift', `<div class="res"><div class="resL">${left}</div><div class="resR">${right}</div></div>`);
}
act('claim', () => { const n = eco.claimDaily(1); toast(`+${n} hints`); closeSheet(); refreshPills(); });
act('claim2', async () => { if (await watch('daily_x2')) { const n = eco.claimDaily(2); toast(`+${n} hints`); closeSheet(); refreshPills(); } });
act('close', () => closeSheet());

// ---------------------------------------------------------------- shop
function openShop() {
  const P = ADS.products; const can = iap.available; const own = eco.noAds();
  // every product card has the same parts in the same places: picture, name, one-line note, price button at the bottom
  const card = (key, img, badge = '') => `<div class="item">${badge ? `<i class="badge2">${badge}</i>` : ''}<img src="${A('shop/' + img)}" alt=""><span class="nm">${P[key].title}</span><small>${P[key].note || ''}</small>${btn('buy:' + key, 'gold small', iap.price(key), can ? '' : 'disabled')}</div>`;
  let html = `<div class="reward">You have ${ic('hint', 'inl')} ${eco.hints()} hints</div><div class="shopgrid">`;
  if (!own) html += card('starter', 'starter-bundle', 'BEST DEAL') + card('remove_ads', 'remove-ads');
  else html += `<div class="item done"><img src="${A('shop/remove-ads')}" alt=""><span class="nm">Ads removed</span><small>Thank you for supporting PATHBOUND!</small><span class="ok">${ic('check', 'inl')} Active</span></div>${card('starter', 'starter-bundle').replace(/<button[\s\S]*<\/button>/, '<span class="ok">Included</span>')}`;
  html += card('hints_s', 'hints-small') + card('hints_m', 'hints-medium', 'POPULAR') + card('hints_l', 'hints-large', 'BEST VALUE') + `</div>`;
  html += `<div class="shopfoot">${btn('freeHint', 'green small', watchLabel('Free hint: watch a video'))}${can ? btn('restore', 'purple small', 'Restore purchases') : ''}</div>`;
  if (!can) html += `<div class="fine">Purchases are available in the mobile app.</div>`;
  sheet('Shop', html);
}
$('sheet').addEventListener('click', async (e) => { const b = e.target.closest('[data-act^="buy:"]'); if (!b || b.disabled) return; const key = b.dataset.act.slice(4); b.disabled = true; const ok = await iap.buy(key); if (ok) { toast('Thank you!'); sfx('win'); setBanner(); openShop(); refreshPills(); } else { toast('Purchase cancelled'); b.disabled = false; } });
act('freeHint', async () => { if (await watch('shop_free_hint')) { eco.addHints(eco.CONFIG.rewardedHint); toast('+1 hint'); openShop(); refreshPills(); } });
act('restore', async () => { toast((await iap.restore()) ? 'Purchases restored' : 'Nothing to restore'); setBanner(); });

// ---------------------------------------------------------------- settings
function openSettings() {
  const ctl = () => (game.mode === 'live' ? 'Tap to walk' : 'Plan, then PLAY');
  let html = `<label class="switch"><span>Controls</span>${btn('ctl', 'purple small', ctl())}</label><div class="fine">Tap to walk: each tap moves Maria one step. Plan: draw the whole route, then press PLAY. Switching restarts the level.</div><label class="switch"><span>Sound effects</span>${btn('snd', 'purple small', eco.sound() ? 'On' : 'Off')}</label><label class="switch"><span>Music</span>${btn('mus', 'purple small', eco.music() ? 'On' : 'Off')}</label>`;
  if (ads.hasPrivacyOptions) html += btn('privacy', 'purple small', 'Ad privacy choices');
  html += btn('resetAsk', 'red small', 'Reset progress') + `<div class="studio-credit"><img src="${A('brand/gamics-emblem')}" alt=""><div><b>GAMECIS</b><span>PATHBOUND 1.0 · Ads by Google AdMob</span></div></div>`;
  sheet('Settings', html);
}
act('snd', (b) => { eco.setSound(!eco.sound()); setMuted(!eco.sound()); b.textContent = eco.sound() ? 'On' : 'Off'; sfx('click'); });
act('mus', (b) => { eco.setMusic(!eco.music()); setMusicOn(eco.music()); b.textContent = eco.music() ? 'On' : 'Off'; sfx('click'); });
act('ctl', (b) => { const m = game.mode === 'live' ? 'plan' : 'live'; eco.setMode(m); game.setMode(m); document.body.classList.toggle('live', m === 'live'); b.textContent = m === 'live' ? 'Tap to walk' : 'Plan, then PLAY'; sfx('click'); if (current) tutorial.end(); });
act('privacy', () => ads.privacyOptions());
act('resetAsk', (b) => { if (b.dataset.sure) eco.resetAll(); else { b.dataset.sure = '1'; b.textContent = 'Tap again to erase everything'; } });

// ---------------------------------------------------------------- studio intro (Gamic Studios), once per launch; a tap skips it
let titleReadyResolve; window.__titleReady = new Promise((r) => { titleReadyResolve = r; });
(function studioIntro() {
  if (['auto', 'moves', 'level', 'nointro'].some((k) => params.has(k))) { window.__introDone = true; return; }
  const box = $('studio'), skip = $('studioSkip'); let done = false; let snd = null; const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const sp = $('stSparks'); for (let i = 0; i < 28; i++) { const d = document.createElement('i'); d.style.left = (10 + Math.random() * 80) + '%'; d.style.top = (45 + Math.random() * 50) + '%'; d.style.animationDelay = (Math.random() * 3) + 's'; d.style.animationDuration = (2.5 + Math.random() * 2) + 's'; d.style.width = d.style.height = (2 + Math.random() * 3) + 'px'; sp.appendChild(d); }
  const smooth = (a) => a * a * (3 - 2 * a);
  const end = () => {
    if (done) return; done = true; timers.forEach(clearTimeout); if (snd) { try { snd.pause(); } catch { /* ignore */ } }
    if (game.maria && game.L) { world.placeActor(game.maria, game.L.start); game.maria.face(1, 1, true); game.maria.play('idle_5', { fade: 0.3 }); } world.zoom = 1; world.frame();
    document.body.classList.remove('cine'); box.classList.add('out'); setTimeout(() => box.classList.add('hidden'), 700); window.__introDone = true;
  };
  box.classList.remove('hidden'); document.body.classList.add('cine'); unlockAudio(); introSting();
  if (eco.sound()) { try { snd = new Audio('/audio/gamics-intro.mp3'); snd.volume = 0.55; snd.play().catch(() => { snd = null; }); } catch { snd = null; } }
  box.addEventListener('pointerdown', () => { if (!skip.classList.contains('hidden')) end(); });
  at(1200, () => skip.classList.remove('hidden'));
  // act 2: the studio mark fades, the real game world appears, Maria drops in and draws her sword, the game logo slams in
  at(5300, async () => {
    box.classList.add('cine');
    await Promise.race([window.__titleReady, new Promise((r) => setTimeout(r, 9000))]); if (done || !game.maria) return end();
    const m = game.maria, to = world.cellPos(game.L.start); const hi = to.clone(); hi.y += 16; m.root.position.copy(hi); m.face(1, 1, true); m.play('leap', { loop: false, len: 0.7 });
    world.zoom = 1.8; world.frame(); world.tween(3.4, (a) => { world.zoom = 1.8 - 0.8 * smooth(a); world.frame(); });
    sfx('whoosh');
    at(500, () => { world.tween(0.5, (a) => { m.root.position.lerpVectors(hi, to, a * a); }); });
    at(1000, () => { m.root.position.copy(to); sfx('boomHit'); world.burst('dust', to, 2.2, 0.1); world.burst('debris', to, 1.2, 0.2); world.burst('spark', to, 1.4, 0.4); $('cine').classList.add('hit'); world.tween(0.5, (a) => { world.panY = (Math.random() - 0.5) * 0.5 * (1 - a); world.frame(); }, () => { world.panY = 0; world.frame(); }); m.play('draw_1', { loop: false, len: 0.5, then: { name: 'draw_2', opts: { loop: false, len: 0.8, then: { name: 'idle_5' } } } }); });
    at(1450, () => sfx('shing'));
    at(1700, () => sfx('logo'));
    at(1900, () => { sfx('fanfare'); world.burst('glow', to.clone().add(new (to.constructor)(0, 1.4, 0)), 1.4); });
    at(3900, end);
  });
})();

// ---------------------------------------------------------------- input
// One finger: tap a tile (a tap is decided when the finger lifts) or drag across tiles.
// Two fingers: pinch to zoom, twist to rotate the camera, slide to pan. Mouse wheel zooms.
const canvas = $('c');
const pts = new Map(); let down = false, gesturing = false, dragged = false, lastCell = null, startCell = null, g0 = null;
const two = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(b.x - a.x, b.y - a.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
const tapCell = (cell, dragging) => { if (!cell) return; if (!dragging) world.ripple(cell, true); game.tap(cell, dragging); };
canvas.addEventListener('pointerdown', (e) => {
  if (screen !== 'play') return; unlockAudio(); try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size >= 2) { gesturing = true; down = false; g0 = two(); return; }
  down = true; dragged = false; startCell = lastCell = world.pick(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesturing && pts.size >= 2 && g0) {
    const g = two(); let da = g.ang - g0.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
    world.gesture({ zoom: g.d / g0.d, twist: da, dx: g.mx - g0.mx, dy: g.my - g0.my }); g0 = g; return;
  }
  if (!down || screen !== 'play') return;
  const c = world.pick(e.clientX, e.clientY);
  if (c && c !== lastCell) { if (!dragged) { dragged = true; tapCell(startCell, false); } lastCell = c; world.ripple(c, true); game.tap(c, true); }
});
const lift = (e) => {
  const had = pts.delete(e.pointerId);
  if (had && down && !dragged && !gesturing && screen === 'play') tapCell(startCell, false);
  if (pts.size < 2) g0 = null; else g0 = two();
  if (pts.size === 0) { down = false; gesturing = false; dragged = false; }
};
window.addEventListener('pointerup', lift); window.addEventListener('pointercancel', lift);
canvas.addEventListener('wheel', (e) => { if (screen !== 'play') return; e.preventDefault(); world.gesture({ zoom: Math.exp(-e.deltaY * 0.0015) }); }, { passive: false });
const zoomBy = (f) => { sfx('click'); world.gesture({ zoom: f }); };
$('btnZoomIn').onclick = () => zoomBy(1.3); $('btnZoomOut').onclick = () => zoomBy(1 / 1.3);
$('btnRotate').ondblclick = () => world.resetView();
window.addEventListener('keydown', (e) => {
  if (screen !== 'play' || !$('sheet').classList.contains('hidden')) { if (e.key === 'Escape' && !$('sheet').classList.contains('hidden') && $('sheet').dataset.dismiss) closeSheet(); return; }
  const map = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R', w: 'U', s: 'D', a: 'L', d: 'R' };
  if (e.key === 'q') world.rotate(-1); else if (e.key === 'e') world.rotate(1);
  else if (e.key === 'h') openHint();
  else if (e.key === 'Backspace' || e.key === 'z') game.undo();
  else if (e.key === 'Enter') game.play();
  else if (e.key === ' ') game.tap(game.end.pos);
  else if (map[e.key]) { const [x, y] = game.end.pos.split(',').map(Number); const d = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[map[e.key]]; let c = `${x + d[0]},${y + d[1]}`; const r = game.L.step(game.end, map[e.key]); if (r.status !== 'blocked' && r.state && !game.L.tele.has(c)) c = r.state.pos === game.end.pos ? c : r.state.pos; game.tap(c); }
});

// coming back to the app after a while may show an app-open ad (only on menu screens)
let hiddenAt = 0;
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { hiddenAt = Date.now(); pauseMusic(); return; }
  resumeMusic();
  if (!hiddenAt || screen === 'play' || screen === 'loading') return; const away = (Date.now() - hiddenAt) / 1000; hiddenAt = 0;
  if (eco.mayShowAppOpen(away) && (await ads.appOpen())) eco.noteAppOpenShown();
});

function lockLandscape() { // phones: go fullscreen and landscape if the browser allows it (the installed app locks it natively)
  if (!matchMedia('(pointer: coarse)').matches) return;
  try { const el = document.documentElement; (el.requestFullscreen ? el.requestFullscreen() : Promise.resolve()).then(() => window.screen.orientation && window.screen.orientation.lock && window.screen.orientation.lock('landscape')).catch(() => {}); } catch { /* ignore */ }
}
function loop() { const dt = world.update(); tutorial.tick(); if (world.spin) { world.viewYaw += dt * 0.1; world.frame(); } game.tick(dt); requestAnimationFrame(loop); }

(async function boot() {
  const bar = (p, t) => { $('loadFill').style.width = p + '%'; if (t) $('loadText').textContent = t; };
  try {
    $('loadTip').textContent = say('loading'); bar(8, 'Loading the dungeon…');
    const man = await loadManifest();
    await loadEnv(man.env); bar(45, 'Waking Maria…');
    await loadChar('maria'); bar(70);
    await loadClips('maria', ['idle', 'walk', 'run', 'run_back', 'draw_1', 'draw_2', 'showcase', 'idle_5', 'victory', 'kick_chest']); bar(92, 'Almost there…');
    loadClips('maria', man.maria); // the other clips arrive in the background
    loop();
    ads.init().then(() => { setBanner(); }); iap.init();
    if (params.has('level')) { await startLevel(+params.get('level')); if (params.has('fast')) { game.fast = true; } }
    else { show('title'); await titleScene(); }
    bar(100); if (!$('loading').classList.contains('hidden')) $('loading').classList.add('hidden'); titleReadyResolve();
  } catch (err) { $('loadText').textContent = 'Could not load the game: ' + err.message; console.error(err); }
})();
