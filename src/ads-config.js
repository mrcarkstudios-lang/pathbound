// Ad network settings. The ids below are GOOGLE'S OFFICIAL TEST IDS: they always fill and never earn or risk anything.
// Before release: create your app and ad units in AdMob, paste the real ids here, and set testMode to false.
export const ADS = {
  testMode: false,
  debugEEA: false,                 // pretend to be in the EU to test the consent form
  testDevices: [],                 // device ids printed in the log of the first test run
  h5ClientId: '',                  // 'ca-pub-XXXXXXXXXXXXXXXX' once AdSense for Games is approved (website version only)
  appId: { android: 'ca-app-pub-6221264275692660~1282742097', ios: 'ca-app-pub-3940256099942544~1458002511' }, // goes in AndroidManifest.xml / Info.plist
  units: {
    android: {
      banner: 'ca-app-pub-6221264275692660/8969660429',
      interstitial: 'ca-app-pub-6221264275692660/8128506994',
      rewarded: 'ca-app-pub-6221264275692660/2844390727',
      rewardedInterstitial: 'ca-app-pub-6221264275692660/4189261989',
      appOpen: 'ca-app-pub-6221264275692660/3011911687',
      native: 'ca-app-pub-6221264275692660/7905145711',
    },
    ios: {
      banner: 'ca-app-pub-3940256099942544/2934735716',
      interstitial: 'ca-app-pub-3940256099942544/4411468910',
      rewarded: 'ca-app-pub-3940256099942544/1712485313',
      rewardedInterstitial: 'ca-app-pub-3940256099942544/6978759866',
      appOpen: 'ca-app-pub-3940256099942544/5575463023',
      native: 'ca-app-pub-3940256099942544/3986624511',
    },
  },
  // In-app purchase product ids (create the same ids in Play Console / App Store Connect)
  products: {
    remove_ads: { id: 'pathbound.remove_ads', type: 'non-consumable', price: '$2.99', title: 'Remove Ads', note: 'No banner or pop-up ads' },
    starter: { id: 'pathbound.starter', type: 'non-consumable', price: '$3.99', title: 'Starter Bundle', note: 'Remove Ads + 20 hints' },
    hints_s: { id: 'pathbound.hints_s', type: 'consumable', price: '$0.99', title: '5 Hints' },
    hints_m: { id: 'pathbound.hints_m', type: 'consumable', price: '$1.99', title: '15 Hints', note: 'Best value' },
    hints_l: { id: 'pathbound.hints_l', type: 'consumable', price: '$3.99', title: '40 Hints' },
  },
};
