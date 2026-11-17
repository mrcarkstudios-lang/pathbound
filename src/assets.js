import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const base = import.meta.env.BASE_URL + 'assets/';
const envCache = new Map();
const charCache = new Map();
const clipCache = new Map(); // "char/clip" -> AnimationClip | promise
export let manifest = null;

const load = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));

export async function loadManifest() {
  manifest = await (await fetch(base + 'manifest.json')).json();
  return manifest;
}

export async function loadEnv(names) {
  await Promise.all(names.filter((n) => !envCache.has(n)).map(async (n) => {
    const g = await load(`${base}env/${n}.gltf`);
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    envCache.set(n, g.scene);
  }));
}

const tintCache = new Map();
/** Clone of a dungeon piece. tint: optional hex multiply colour (materials are shared per tint). */
export function env(name, tint) {
  const src = envCache.get(name);
  if (!src) return new THREE.Group();
  const o = src.clone(true);
  if (tint !== undefined) o.traverse((m) => {
    if (!m.isMesh) return;
    const key = m.material.uuid + ':' + tint;
    if (!tintCache.has(key)) { const c = m.material.clone(); c.color.set(tint); tintCache.set(key, c); }
    m.material = tintCache.get(key);
  });
  return o;
}

// Clips keep their vertical hip motion; horizontal travel is removed because the game moves actors in code.
const KEEP_TRAVEL = new Set(['death_back', 'death_front', 'die']);
function stripTravel(clip) {
  if (KEEP_TRAVEL.has(clip.name)) return clip;
  for (const tr of clip.tracks) {
    if (/Hips\.position$/.test(tr.name)) {
      const v = tr.values; const x0 = v[0], z0 = v[2];
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
    }
  }
  return clip;
}

export function loadClip(charId, clipId) {
  const key = charId + '/' + clipId;
  if (!clipCache.has(key)) {
    const p = load(`${base}anims/${charId}/${clipId}.glb`).then((g) => {
      const c = stripTravel(g.animations[0]); c.name = clipId; clipCache.set(key, c); return c;
    }).catch(() => { clipCache.delete(key); return null; });
    clipCache.set(key, p);
  }
  return clipCache.get(key);
}
export function getClip(charId, clipId) {
  const c = clipCache.get(charId + '/' + clipId);
  if (c && !(c instanceof Promise)) return c;
  if (!c) loadClip(charId, clipId);
  return null;
}
export async function loadClips(charId, ids) { await Promise.all(ids.map((i) => loadClip(charId, i))); }

export async function loadChar(id) {
  if (!charCache.has(id)) {
    charCache.set(id, load(`${base}chars/${id}.glb`).then((g) => {
      g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; } });
      return g.scene;
    }));
  }
  return charCache.get(id);
}
export async function cloneChar(id) { return SkeletonUtils.clone(await loadChar(id)); }

/** Scale and position a model so it fits a footprint and sits on y = 0. */
export function fit(obj, { width, height, center = true } = {}) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  let s = 1;
  if (width) s = width / Math.max(size.x, size.z);
  if (height) s = Math.min(s === 1 && !width ? Infinity : s, height / size.y);
  obj.scale.multiplyScalar(s);
  box.setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group();
  if (center) { obj.position.x -= c.x; obj.position.z -= c.z; }
  obj.position.y -= box.min.y;
  wrap.add(obj);
  return wrap;
}
