// In-app purchases. Stores only exist in the installed app, so:
//   app (Capacitor + cordova-plugin-purchase) -> real Google Play / App Store purchases
//   development (npm run dev, ?ads=sim)        -> instant fake purchase, to test the screens
//   plain website                              -> not available (the shop says so)
import { ADS } from './ads-config.js';
import { grantProduct } from './economy.js';

const params = new URLSearchParams(location.search);
const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const sim = !native && (params.get('ads') === 'sim' || import.meta.env.DEV);
let store = null; let started = false; const pending = new Map();

export const iap = {
  get available() { return native || sim; },
  get products() { return ADS.products; },
  async init() {
    if (!native || started) return; started = true;
    const C = window.CdvPurchase; if (!C) { console.warn('cordova-plugin-purchase is not installed'); return; }
    store = C.store; const plat = window.Capacitor.getPlatform() === 'ios' ? C.Platform.APPLE_APPSTORE : C.Platform.GOOGLE_PLAY;
    store.register(Object.entries(ADS.products).map(([, p]) => ({ id: p.id, type: p.type === 'consumable' ? C.ProductType.CONSUMABLE : C.ProductType.NON_CONSUMABLE, platform: plat })));
    store.when().approved((t) => t.verify()).verified((r) => r.finish()).finished((t) => { for (const [key, p] of Object.entries(ADS.products)) if (t.products.some((x) => x.id === p.id)) { grantProduct(key); const done = pending.get(key); done && done(true); pending.delete(key); } });
    await store.initialize([plat]); await store.update();
  },
  /** Live price text from the store, falling back to the configured one. */
  price(key) { if (store) { const p = store.get(ADS.products[key].id); const o = p && p.getOffer && p.getOffer(); const ph = o && o.pricingPhases && o.pricingPhases[0]; if (ph && ph.price) return ph.price; } return ADS.products[key].price; },
  async buy(key) {
    if (sim) { grantProduct(key); return true; }
    if (!store) return false;
    return new Promise((res) => { pending.set(key, res); const p = store.get(ADS.products[key].id); const o = p && p.getOffer(); if (!o) { pending.delete(key); return res(false); } o.order().then((err) => { if (err) { pending.delete(key); res(false); } }); setTimeout(() => { if (pending.has(key)) { pending.delete(key); res(false); } }, 180000); });
  },
  async restore() { if (store) { await store.restorePurchases(); return true; } return sim; },
};
