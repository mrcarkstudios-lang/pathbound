// Applies this project's settings to the generated Android project (run after every `cap sync`):
//   - the AdMob APP id from src/ads-config.js goes into AndroidManifest.xml
//   - landscape lock, fullscreen, AD_ID permission
//   - launcher icons (from public/icons) and the splash screen (from the generated art)
//   - local.properties with the Android SDK path
// Usage: node tools/android-setup.mjs
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { pathToFileURL } from 'node:url'; import sharp from 'sharp';
const root = path.resolve(import.meta.dirname, '..'); const res = path.join(root, 'android/app/src/main/res'); const manifestPath = path.join(root, 'android/app/src/main/AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) { console.error('No android/ folder yet. Run: npx cap add android'); process.exit(1); }
const { ADS } = await import(pathToFileURL(path.join(root, 'src/ads-config.js')).href);

// ---- manifest
let m = fs.readFileSync(manifestPath, 'utf8');
const meta = `<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${ADS.appId.android}"/>`;
if (/com\.google\.android\.gms\.ads\.APPLICATION_ID/.test(m)) m = m.replace(/<meta-data android:name="com\.google\.android\.gms\.ads\.APPLICATION_ID"[^>]*\/>/, meta);
else m = m.replace(/(<application[^>]*>)/, `$1\n        ${meta}`);
if (!/screenOrientation/.test(m)) m = m.replace('<activity', '<activity\n            android:screenOrientation="sensorLandscape"');
if (!/AD_ID/.test(m)) m = m.replace('<uses-permission android:name="android.permission.INTERNET" />', '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />\n    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />');
fs.writeFileSync(manifestPath, m);

// ---- immersive fullscreen: hide the status and navigation bars (swipe from an edge shows them briefly)
fs.writeFileSync(path.join(root, 'android/app/src/main/java/com/pathbound/game/MainActivity.java'), `package com.pathbound.game;

import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    hideBars();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) hideBars();
  }

  private void hideBars() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    c.hide(WindowInsetsCompat.Type.systemBars());
  }
}
`);

// ---- fullscreen game theme (hides the status and navigation bars)
const stylesPath = path.join(res, 'values/styles.xml'); let st = fs.readFileSync(stylesPath, 'utf8');
if (!/windowFullscreen/.test(st)) st = st.replace('<item name="android:background">@null</item>', '<item name="android:background">@null</item>\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>');
if (!/Launch" parent="Theme.SplashScreen">\s*<item name="android:windowFullscreen"/.test(st)) st = st.replace('<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">', '<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">\n        <item name="android:windowFullscreen">true</item>');
fs.writeFileSync(stylesPath, st);
fs.writeFileSync(path.join(res, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#150B33</color>\n</resources>\n');

// ---- icons
const icons = path.join(root, 'public/icons'); const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const circle = (s) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="#fff"/></svg>`);
for (const [d, px] of Object.entries(dens)) {
  const dir = path.join(res, `mipmap-${d}`); const full = await sharp(path.join(icons, 'icon-1024.png')).resize(px, px).png().toBuffer();
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), full);
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), await sharp(full).composite([{ input: circle(px), blend: 'dest-in' }]).png().toBuffer());
  const fg = Math.round(px * 108 / 48); fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), await sharp(path.join(icons, 'adaptive-foreground-432.png')).resize(fg, fg).png().toBuffer());
}

// ---- splash: the title backdrop, darkened, with the emblem and the PATHBOUND logo in the middle (matches the in-game loading screen)
const art = path.join(root, 'public/art/backgrounds'); const brand = path.join(root, 'public/art/brand');
const sizes = { mdpi: [480, 320], hdpi: [800, 480], xhdpi: [1280, 720], xxhdpi: [1600, 960], xxxhdpi: [1920, 1280] };
async function splash(file, W, H, out) {
  const lw = Math.round(Math.min(W * 0.62, H * 1.1)); const logo = await sharp(path.join(brand, 'logo-full.webp')).resize({ width: lw }).png().toBuffer(); const lh = (await sharp(logo).metadata()).height;
  const ew = Math.round(Math.min(W, H) * 0.3); const emb = await sharp(path.join(brand, 'logo-emblem.webp')).resize({ width: ew }).png().toBuffer(); const eh = (await sharp(emb).metadata()).height;
  const total = eh + lh - 10; const top = Math.round((H - total) / 2);
  const shade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="g" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#0a051c" stop-opacity="0.15"/><stop offset="1" stop-color="#0a051c" stop-opacity="0.8"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  await sharp(path.join(art, file)).resize(W, H, { fit: 'cover' }).composite([{ input: shade }, { input: emb, left: Math.round((W - ew) / 2), top }, { input: logo, left: Math.round((W - lw) / 2), top: top + eh - 10 }]).png().toFile(out);
}
for (const [d, [w, h]] of Object.entries(sizes)) {
  for (const [kind, file, W, H] of [['land', 'bg-title-landscape.webp', w, h], ['port', 'bg-title-portrait.webp', h, w]]) {
    const dir = path.join(res, `drawable-${kind}-${d}`); if (fs.existsSync(dir)) await splash(file, W, H, path.join(dir, 'splash.png'));
  }
}
await splash('bg-title-landscape.webp', 1280, 720, path.join(res, 'drawable/splash.png'));

// ---- SDK location for Gradle
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA || os.homedir(), 'Android/Sdk');
if (fs.existsSync(sdk)) fs.writeFileSync(path.join(root, 'android/local.properties'), `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);
console.log('Android project set up. AdMob app id:', ADS.appId.android, '| test mode:', ADS.testMode, '| SDK:', fs.existsSync(sdk) ? sdk : 'NOT FOUND');
