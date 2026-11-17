// Player progress, hint tokens, the daily gift and the rules for when an ad may appear.
// Every number a designer might tune is in CONFIG.
const SAVE_KEY = 'pathbound_v1';

export const CONFIG = {
  startHints: 3,
  dailyHints: [1, 1, 2, 2, 3, 3, 5],          // day 1..7 of a streak
  winHintEvery3Stars: 1,                       // a perfect level pays one hint
  rewardedHint: 1,                             // hints for watching one rewarded video
  rewardedBonusOnWin: 2,                       // "watch to get 2 hints" on the level-complete card
  worldBonusHints: 3,                          // claimed after the last level of a world, doubled by a rewarded interstitial
  interstitial: { firstLevel: 6, everyLevels: 3, minGapSec: 120, afterRewardGapSec: 45 },
  appOpen: { minAwaySec: 120, cooldownSec: 4 * 3600, firstDayFree: true },
  stuckAfterFails: 3,                          // offer a rewarded hint / skip after this many failed plays of one level
  skipsPerDayWithAd: 3,
};

let s = { stars: {}, seen: {}, hints: CONFIG.startHints, noAds: false, lastDaily: '', streak: 0, sound: true, installAt: Date.now(), ads: { lastInter: 0, lastReward: 0, lastOpen: 0, levelsSince: 0 }, fails: {}, lessons: {}, skips: { day: '', n: 0 }, played: 0 };
try { const raw = JSON.parse(localStorage.getItem(SAVE_KEY)); if (raw) s = { ...s, ...raw, ads: { ...s.ads, ...(raw.ads || {}) } }; } catch { /* private mode: play without saving */ }
const listeners = new Set();
export const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* ignore */ } listeners.forEach((f) => f(s)); };
export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const state = () => s;
const today = () => new Date().toISOString().slice(0, 10);
const now = () => Date.now();

// ---- progress
export const stars = (id) => s.stars[id] || 0;
export const totalStars = () => Object.values(s.stars).reduce((a, b) => a + b, 0);
export function setStars(id, n) { s.stars[id] = Math.max(s.stars[id] || 0, n); save(); }
export const seen = (id) => !!s.seen[id];
export function markSeen(id) { s.seen[id] = 1; save(); }

// ---- hints
export const hints = () => s.hints;
export function addHints(n) { s.hints = Math.max(0, s.hints + n); save(); }
export function useHint() { if (s.hints <= 0) return false; s.hints--; save(); return true; }

// ---- daily gift
export const dailyReady = () => s.lastDaily !== today();
export function dailyPreview() { const yest = new Date(now() - 864e5).toISOString().slice(0, 10); const streak = s.lastDaily === yest ? s.streak + 1 : (s.lastDaily === today() ? s.streak : 1); return { day: ((Math.max(1, streak) - 1) % 7) + 1, hints: CONFIG.dailyHints[(Math.max(1, streak) - 1) % 7], streak: Math.max(1, streak) }; }
export function claimDaily(multiplier = 1) {
  if (!dailyReady()) return 0; const p = dailyPreview(); s.streak = p.streak; s.lastDaily = today(); const n = p.hints * multiplier; s.hints += n; save(); return n;
}

// ---- tutorial lessons already shown
export const lessonSeen = (id) => !!(s.lessons && s.lessons[id]);
export function markLesson(id) { if (!s.lessons) s.lessons = {}; s.lessons[id] = 1; save(); }

// ---- failed plays (to notice a stuck player) and skips
export function recordFail(id) { s.fails[id] = (s.fails[id] || 0) + 1; save(); return s.fails[id]; }
export const failCount = (id) => s.fails[id] || 0;
export function clearFails(id) { if (s.fails[id]) { delete s.fails[id]; save(); } }
export function skipsLeft() { if (s.skips.day !== today()) s.skips = { day: today(), n: 0 }; return Math.max(0, CONFIG.skipsPerDayWithAd - s.skips.n); }
export function useSkip() { skipsLeft(); s.skips.n++; save(); }

// ---- purchases
export const noAds = () => !!s.noAds;
export function grantProduct(id) {
  if (id === 'remove_ads') s.noAds = true;
  else if (id === 'hints_s') s.hints += 5; else if (id === 'hints_m') s.hints += 15; else if (id === 'hints_l') s.hints += 40;
  else if (id === 'starter') { s.noAds = true; s.hints += 20; s.starterBought = true; }
  save();
}

// ---- ad pacing: one place that says whether an ad is allowed right now
export function noteLevelWon() { s.ads.levelsSince++; s.played++; save(); }
export function mayShowInterstitial(levelId) {
  if (s.noAds) return false; const c = CONFIG.interstitial; const t = now();
  if (levelId < c.firstLevel || s.ads.levelsSince < c.everyLevels) return false;
  if (t - s.ads.lastInter < c.minGapSec * 1000 || t - s.ads.lastReward < c.afterRewardGapSec * 1000) return false;
  return true;
}
export function noteInterstitialShown() { s.ads.lastInter = now(); s.ads.levelsSince = 0; save(); }
export function noteRewardWatched() { s.ads.lastReward = now(); save(); }
export function mayShowAppOpen(awaySec) {
  if (s.noAds) return false; const c = CONFIG.appOpen; const t = now();
  if (awaySec < c.minAwaySec || t - s.ads.lastOpen < c.cooldownSec * 1000) return false;
  if (c.firstDayFree && t - s.installAt < 864e5) return false;
  return true;
}
export function noteAppOpenShown() { s.ads.lastOpen = now(); save(); }

// ---- controls: 'live' (a tap walks Maria one step) or 'plan' (draw the route, then PLAY)
export const mode = () => (s.mode === 'plan' ? 'plan' : 'live');
export function setMode(m) { s.mode = m; save(); }

// ---- settings
export const sound = () => s.sound !== false;
export function setSound(v) { s.sound = v; save(); }
export const music = () => s.music !== false;
export function setMusic(v) { s.music = v; save(); }
export function resetAll() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } location.reload(); }
