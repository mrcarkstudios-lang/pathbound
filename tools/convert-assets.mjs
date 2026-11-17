// One-time asset pipeline: Mixamo FBX -> optimised GLB, KayKit glTF copy.
// Usage: node tools/convert-assets.mjs <extractedAssetsDir>
//   <extractedAssetsDir> must contain the unzipped packs in folders:
//   gsp (Great Sword Pack), cp1..cp5 (Creature Packs), pack4 (KayKit dungeon)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, prune, dedup, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const src = process.argv[2];
const tmp = path.join(src, '..', 'conv_tmp');
const out = path.join(root, 'public', 'assets');
const FBX = path.join(root, 'node_modules', 'fbx2gltf', 'bin', 'Windows_NT', 'FBX2glTF.exe');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(tmp, { recursive: true });

function fbx2glb(input, name) {
  const o = path.join(tmp, name);
  execFileSync(FBX, ['--binary', '--input', input, '--output', o], { stdio: 'ignore' });
  return o + '.glb';
}

async function convertChar(fbx, id, texSize = 1024) {
  const doc = await io.read(fbx2glb(fbx, id + '_raw'));
  for (const a of doc.getRoot().listAnimations()) a.dispose();
  for (const m of doc.getRoot().listMaterials()) {
    m.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null);
    m.setMetallicFactor(0).setRoughnessFactor(0.85);
    for (const ext of m.listExtensions()) ext.dispose();
  }
  await doc.transform(prune(), dedup(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: 82 }));
  const dir = path.join(out, 'chars'); fs.mkdirSync(dir, { recursive: true });
  await io.write(path.join(dir, id + '.glb'), doc);
  console.log('char', id, (fs.statSync(path.join(dir, id + '.glb')).size / 1024 | 0) + 'KB');
}

async function convertClip(fbx, charId, clipId) {
  const doc = await io.read(fbx2glb(fbx, charId + '_' + clipId));
  const anims = doc.getRoot().listAnimations();
  for (const a of anims) {
    a.setName(clipId);
    for (const ch of a.listChannels()) {
      const p = ch.getTargetPath(); const n = ch.getTargetNode()?.getName() || '';
      if (p === 'scale' || (p === 'translation' && !/Hips$/.test(n))) { ch.getSampler()?.dispose(); ch.dispose(); }
    }
  }
  await doc.transform(resample({ tolerance: 0.0005 }), prune());
  const dir = path.join(out, 'anims', charId); fs.mkdirSync(dir, { recursive: true });
  await io.write(path.join(dir, clipId + '.glb'), doc);
  return fs.statSync(path.join(dir, clipId + '.glb')).size;
}

// ---- Maria: all 51 clips, ids as in docs/MIXAMO_ANIMATION_CHECKLIST.md
const MARIA = {
  'great sword walk': 'walk', 'great sword walk (2)': 'walk_back', 'great sword run (2)': 'run', 'great sword run': 'run_back',
  'great sword turn': 'turn_a', 'great sword turn (2)': 'turn_b', 'great sword 180 turn': 'turn_180', 'great sword 180 turn (2)': 'turn_180_fast',
  'great sword strafe': 'strafe_a', 'great sword strafe (2)': 'strafe_b', 'great sword strafe (3)': 'strafe_a_fast', 'great sword strafe (4)': 'strafe_b_fast',
  'great sword jump': 'leap', 'great sword jump (2)': 'hop',
  'great sword idle': 'idle', 'great sword idle (2)': 'idle_2', 'great sword idle (3)': 'idle_3', 'great sword idle (4)': 'idle_4', 'great sword idle (5)': 'idle_5',
  'great sword crouching': 'crouch_in', 'great sword crouching (3)': 'crouch_hold', 'great sword crouching (2)': 'crouch_out',
  'great sword crouching (4)': 'brace_in', 'great sword crouching (5)': 'brace_hold', 'great sword crouching (6)': 'brace_out',
  'great sword slash': 'smash', 'great sword high spin attack': 'smash_through', 'great sword slash (4)': 'door_cut',
  'great sword attack': 'lever', 'great sword slash (5)': 'lever_low', 'great sword kick': 'kick_crate', 'great sword kick (2)': 'kick_chest',
  'great sword slide attack': 'gate_slide', 'great sword blocking': 'guard_in', 'great sword blocking (2)': 'guard_hold', 'great sword blocking (3)': 'guard_out',
  'great sword impact': 'guard_hit', 'spell cast': 'cast',
  'great sword impact (3)': 'hit_trap', 'great sword impact (2)': 'hit_monster', 'great sword impact (4)': 'hit_braced', 'great sword impact (5)': 'hit_crouch',
  'two handed sword death': 'death_back', 'two handed sword death (2)': 'death_front',
  'draw a great sword 1': 'draw_1', 'draw a great sword 2': 'draw_2', 'great sword power up': 'victory', 'great sword slash (3)': 'flourish',
  'great sword casting': 'rune_award', 'great sword jump attack': 'boss_strike', 'great sword slash (2)': 'showcase',
};
// ---- creatures: the same 19 clips in every Creature Pack
const CREATURE = {
  'mutant breathing idle': 'idle', 'mutant idle': 'idle_long', 'mutant idle (2)': 'idle_2', 'mutant walking': 'walk', 'mutant run': 'run',
  'mutant left turn 45': 'turn_l', 'left turn 45': 'turn_l2', 'mutant right turn 45': 'turn_r', 'mutant right turn 45 (2)': 'turn_r2', 'mutant right turn 90': 'turn_r90',
  'mutant roaring': 'roar', 'mutant punch': 'punch', 'mutant swiping': 'swipe', 'mutant jump attack': 'lunge', 'jump attack': 'slam',
  'mutant jumping': 'spawn', 'mutant jumping (2)': 'startle', 'mutant flexing muscles': 'taunt', 'mutant dying': 'die',
};
const CREATURES = { cp1: ['Warrok W Kurniawan', 'warrok'], cp2: ['Mutant', 'mutant'], cp3: ['Skeletonzombie T Avelange', 'zombie'], cp4: ['Vampire A Lusth', 'vampire'], cp5: ['Maw J Laygo', 'maw'] };

const ENV = ['floor_tile_small', 'floor_tile_small_broken_A', 'floor_tile_small_broken_B', 'floor_tile_small_weeds_A', 'floor_tile_small_weeds_B', 'floor_tile_small_corner',
  'floor_dirt_small_A', 'floor_dirt_small_B', 'floor_dirt_small_C', 'floor_dirt_small_D', 'floor_dirt_small_weeds', 'floor_wood_small', 'floor_wood_small_dark',
  'floor_tile_grate', 'coin', 'key', 'chest_gold', 'box_large', 'wall_doorway', 'wall_gated', 'wall_cracked', 'wall_broken', 'wall_half', 'pillar', 'pillar_decorated',
  'torch_lit', 'barrel_small', 'barrel_large', 'rubble_half', 'banner_red', 'banner_blue', 'banner_green', 'banner_white', 'banner_yellow', 'column', 'crates_stacked', 'barrier'];

const only = process.argv[3];
if (!only || only === 'maria') {
  await convertChar(path.join(src, 'gsp', 'Maria WProp J J Ong.fbx'), 'maria');
  let total = 0;
  for (const [file, id] of Object.entries(MARIA)) total += await convertClip(path.join(src, 'gsp', file + '.fbx'), 'maria', id);
  console.log('maria clips', Object.keys(MARIA).length, (total / 1024 | 0) + 'KB');
}
for (const [dir, [file, id]] of Object.entries(CREATURES)) {
  if (only && only !== id && only !== 'creatures') continue;
  await convertChar(path.join(src, dir, file + '.fbx'), id);
  let total = 0;
  for (const [f, cid] of Object.entries(CREATURE)) total += await convertClip(path.join(src, dir, f + '.fbx'), id, cid);
  console.log(id, 'clips', (total / 1024 | 0) + 'KB');
}
if (!only || only === 'env') {
  const kk = path.join(src, 'pack4', 'KayKit_Dungeon_Pack_1.1_FREE', 'Assets', 'gltf');
  const dir = path.join(out, 'env'); fs.mkdirSync(dir, { recursive: true });
  for (const n of ENV) for (const ext of ['.gltf', '.bin']) fs.copyFileSync(path.join(kk, n + ext), path.join(dir, n + ext));
  fs.copyFileSync(path.join(kk, 'dungeon_texture.png'), path.join(dir, 'dungeon_texture.png'));
  console.log('env', ENV.length);
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ maria: Object.values(MARIA), creature: Object.values(CREATURE), creatures: Object.values(CREATURES).map(c => c[1]), env: ENV }));
