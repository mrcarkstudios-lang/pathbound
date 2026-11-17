// Ad service. The game only ever calls this file; it picks a provider at start-up:
//   admob : the installed Android / iOS app (Capacitor + @capacitor-community/admob 8) -> banner, interstitial, rewarded,
//           rewarded interstitial, app open
//   h5    : the website with Google "AdSense for Games" (H5 Games Ads), if ADS.h5ClientId is set -> interstitial + rewarded
//   sim   : a fake ad screen for development (npm run dev, or ?ads=sim)
//   none  : the plain website with no ad network. Interstitials are skipped; rewarded actions are granted freely.
// AdMob itself cannot run in a normal browser tab: it needs the native app shell (see docs/MONETIZATION_AND_ADS_PLAN.md).
import { ADS } from './ads-config.js';

const params = new URLSearchParams(location.search);
const cap = window.Capacitor;
const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
const platform = native ? cap.getPlatform() : 'web';
const wantSim = params.get('ads') === 'sim' || (import.meta.env.DEV && params.get('ads') !== 'off');
const $ = (id) => document.getElementById(id);

let provider = 'none'; let AdMob = null; let E = null; let bannerH = 0;
const ids = () => ADS.units[platform === 'ios' ? 'ios' : 'android'];
const testing = ADS.testMode;
let onBannerHeight = () => {};

/** Resolves with the payload of the first `event`, or null after a timeout. */
function waitFor(event, timeoutMs = 180000) {
  return new Promise((resolve) => {
    let h = null; let done = false;
    const fin = (v) => { if (done) return; done = true; clearTimeout(t); if (h && h.remove) h.remove(); resolve(v); };
    const t = setTimeout(() => fin(null), timeoutMs);
    AdMob.addListener(event, (p) => fin(p === undefined ? true : p)).then((x) => { h = x; if (done && x.remove) x.remove(); });
  });
}
/** Races "ad closed" against "ad failed to show", so the game never waits for an ad that did not appear. */
const closedOrFailed = (closed, failed) => Promise.race([waitFor(closed).then((v) => ({ ok: v !== null })), waitFor(failed).then(() => ({ ok: false }))]);
const toastFail = (m) => { const t = $('toast'); if (t) { t.textContent = m; t.classList.remove('hidden'); setTimeout(() => t.classList.add('hidden'), 3200); } };

export const ads = {
  get provider() { return provider; },
  get bannerHeight() { return bannerH; },
  set onBannerHeight(f) { onBannerHeight = f; },

  async init() {
    if (native) {
      try {
        const mod = await import('@capacitor-community/admob'); AdMob = mod.AdMob; E = mod; provider = 'admob';
        if (platform === 'ios') { try { const st = await AdMob.trackingAuthorizationStatus(); if (st.status === 'notDetermined') await AdMob.requestTrackingAuthorization(); } catch (e) { console.warn('ATT', e); } }
        await this.consent();
        await AdMob.initialize({ initializeForTesting: testing, testingDevices: ADS.testDevices || [], tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false, maxAdContentRating: E.MaxAdContentRating.ParentalGuidance });
        AdMob.addListener(E.BannerAdPluginEvents.SizeChanged, (s) => { bannerH = s && s.height ? s.height : bannerH; onBannerHeight(bannerH); });
        AdMob.addListener(E.BannerAdPluginEvents.FailedToLoad, (e) => console.warn('banner failed', e));
        this._preload();
      } catch (e) { console.warn('AdMob start-up failed', e); provider = 'none'; }
    } else if (ADS.h5ClientId) {
      provider = 'h5';
      await new Promise((res) => { const sc = document.createElement('script'); sc.async = true; sc.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.h5ClientId}`; sc.setAttribute('data-ad-frequency-hint', '30s'); if (testing) sc.setAttribute('data-adbreak-test', 'on'); sc.onload = res; sc.onerror = res; document.head.appendChild(sc); });
      window.adsbygoogle = window.adsbygoogle || []; window.adBreak = window.adConfig = (o) => window.adsbygoogle.push(o); window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
    } else if (wantSim) { provider = 'sim'; }
    return provider;
  },

  /** EU/UK consent (Google UMP). Must run before the first ad request. */
  async consent() {
    try {
      const geo = testing && ADS.debugEEA ? E.AdmobConsentDebugGeography.EEA : E.AdmobConsentDebugGeography.DISABLED;
      const info = await AdMob.requestConsentInfo({ debugGeography: geo, testDeviceIdentifiers: ADS.testDevices || [], tagForUnderAgeOfConsent: false });
      this.privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') await AdMob.showConsentForm();
    } catch (e) { console.warn('consent', e); }
  },
  /** Settings -> "Ad privacy choices": reopen the consent form. */
  async privacyOptions() { if (AdMob) { try { await AdMob.showPrivacyOptionsForm(); return true; } catch (e) { return false; } } return false; },
  get hasPrivacyOptions() { return provider === 'admob' && !!this.privacyRequired; },

  // ---------------------------------------------------------------- banner
  async banner(show) {
    if (provider === 'admob') {
      try {
        if (show) await AdMob.showBanner({ adId: ids().banner, adSize: E.BannerAdSize.ADAPTIVE_BANNER, position: E.BannerAdPosition.BOTTOM_CENTER, margin: 0, isTesting: testing });
        else { await AdMob.removeBanner(); bannerH = 0; onBannerHeight(0); }
      } catch (e) { console.warn('banner', e); }
    } else if (provider === 'sim') { bannerH = show ? 56 : 0; const el = $('adBanner'); if (el) el.classList.toggle('hidden', !show); onBannerHeight(bannerH); }
  },

  // ---------------------------------------------------------------- interstitial: shown at a natural break
  async interstitial(placement = 'break') {
    if (provider === 'admob') {
      try {
        await AdMob.prepareInterstitial({ adId: ids().interstitial, isTesting: testing });
        const end = closedOrFailed(E.InterstitialAdPluginEvents.Dismissed, E.InterstitialAdPluginEvents.FailedToShow);
        await AdMob.showInterstitial(); const r = await end; this._preload(); return r.ok;
      } catch (e) { console.warn('interstitial', e); return false; }
    }
    if (provider === 'h5') return new Promise((res) => { let shown = false; window.adBreak({ type: 'next', name: placement, beforeAd: () => { shown = true; }, afterAd: () => {}, adBreakDone: () => res(shown) }); });
    if (provider === 'sim') return simAd('Interstitial ad', 3, false);
    return false;
  },

  // ---------------------------------------------------------------- rewarded video: the player chose to watch
  /** Resolves true only if the player earned the reward. */
  async rewarded(placement = 'reward') {
    if (provider === 'admob') {
      try {
        await AdMob.prepareRewardVideoAd({ adId: ids().rewarded, isTesting: testing });
        let earned = false; const h = await AdMob.addListener(E.RewardAdPluginEvents.Rewarded, () => { earned = true; });
        const end = closedOrFailed(E.RewardAdPluginEvents.Dismissed, E.RewardAdPluginEvents.FailedToShow);
        const item = await AdMob.showRewardVideoAd().catch(() => null); if (item && item.type !== undefined) earned = true;
        await end; if (h && h.remove) h.remove(); return earned;
      } catch (e) { console.warn('rewarded', e); toastFail('The video is not ready yet. Try again in a moment.'); return false; }
    }
    if (provider === 'h5') return new Promise((res) => { let ok = false; window.adBreak({ type: 'reward', name: placement, beforeReward: (show) => show(), adViewed: () => { ok = true; }, adDismissed: () => {}, adBreakDone: () => res(ok) }); });
    if (provider === 'sim') return simAd('Rewarded video', 4, true);
    return true; // no ad network on this platform: the action is simply allowed
  },
  /** Does a rewarded ad exist, or will the action be free? Used to label buttons honestly. */
  get rewardedIsReal() { return provider !== 'none'; },

  // ---------------------------------------------------------------- rewarded interstitial: the player taps a "bonus" button first
  async rewardedInterstitial(placement = 'bonus') {
    if (provider === 'admob') {
      try {
        await AdMob.prepareRewardInterstitialAd({ adId: ids().rewardedInterstitial, isTesting: testing });
        let earned = false; const h = await AdMob.addListener(E.RewardInterstitialAdPluginEvents.Rewarded, () => { earned = true; });
        const end = closedOrFailed(E.RewardInterstitialAdPluginEvents.Dismissed, E.RewardInterstitialAdPluginEvents.FailedToShow);
        const item = await AdMob.showRewardInterstitialAd().catch(() => null); if (item && item.type !== undefined) earned = true;
        await end; if (h && h.remove) h.remove(); return earned;
      } catch (e) { console.warn('rewarded interstitial', e); return this.rewarded(placement); }
    }
    return this.rewarded(placement); // other providers: an ordinary rewarded video
  },

  // ---------------------------------------------------------------- app open
  async appOpen() {
    if (provider === 'admob') {
      try {
        await AdMob.loadAppOpen({ adId: ids().appOpen });
        const end = closedOrFailed(E.AppOpenAdPluginEvents.Closed, E.AppOpenAdPluginEvents.FailedToShow);
        await AdMob.showAppOpen(); return (await end).ok;
      } catch (e) { console.warn('app open', e); return false; }
    }
    if (provider === 'sim') return simAd('App open ad', 2, false);
    return false;
  },

  // ---------------------------------------------------------------- native ad slot (a card that looks like the game)
  /** Returns { title, body, cta, icon } for a card, or null. The plugin supports real native ads (see the plan, phase 2); the simulator shows a sample. */
  async native() {
    if (provider === 'sim') return { title: 'Sponsored: Sample Game', body: 'A native ad is styled like the game and always labelled "Sponsored".', cta: 'Install', icon: 'shop/hints-small.webp' };
    return null;
  },

  _preload() { if (provider !== 'admob') return; try { AdMob.prepareInterstitial({ adId: ids().interstitial, isTesting: testing }).catch(() => {}); } catch (e) { /* ignore */ } },
};

/** Development ad screen: counts down, then shows a close button. For rewarded ads, closing early gives no reward. */
function simAd(label, seconds, isReward) {
  return new Promise((resolve) => {
    const el = $('adSim'); if (!el) return resolve(true);
    el.querySelector('.adLabel').textContent = `${label} (test)`; const close = el.querySelector('.adClose'); const left = el.querySelector('.adLeft');
    let t = seconds; close.disabled = true; close.textContent = isReward ? 'Skip (no reward)' : 'Close'; close.dataset.early = '1'; el.classList.remove('hidden'); left.textContent = isReward ? `Reward in ${t}s` : `Ad ends in ${t}s`;
    const tick = setInterval(() => {
      t--;
      if (t <= 0) { clearInterval(tick); left.textContent = isReward ? 'Reward ready' : 'Done'; close.textContent = isReward ? 'Claim reward' : 'Close'; close.dataset.early = ''; close.disabled = false; }
      else { left.textContent = isReward ? `Reward in ${t}s` : `Ad ends in ${t}s`; if (isReward) close.disabled = false; }
    }, 1000);
    close.onclick = () => { clearInterval(tick); el.classList.add('hidden'); resolve(isReward ? !close.dataset.early : true); };
  });
}
