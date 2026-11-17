// Builds docs/ART_PROMPTS_FOR_GEMINI.md and docs/art_prompts.json from one list, so they never disagree.
import fs from 'node:fs'; import path from 'node:path';
const docs = path.resolve(import.meta.dirname, '..', '..', 'docs');
const STYLE = 'Stylized low-poly 3D game art, soft toon shading, clean bold shapes, smooth gradients, gentle rim light, saturated but harmonious colours, isometric-friendly, mobile puzzle-adventure look (Monument Valley meets a cute dungeon crawler). No photorealism, no watermark, no signature.';
const MAG = 'Place the subject on a perfectly flat solid magenta (#FF00FF) background with no shadow on the background, so it can be cut out. Keep a margin around the subject.';
const BLK = 'Place it on a pure solid black (#000000) background, glowing softly, so it can be used as an additive sprite.';
const SCENE = 'Background scene for a puzzle game. Layered depth (foreground, midground, far background), soft atmospheric perspective. IMPORTANT: keep the centre 50% calm, low-contrast and uncluttered because the game board is drawn there; put the detail in the top, bottom and the edges. No characters, no text, no UI.';
const TILE = 'Seamless tileable texture, flat top-down orthographic view, no perspective, no vignette, even lighting with no gradient across the image, edges must match when tiled. Stylized hand-painted game texture, visible but soft detail.';
const W = [
  ['w01', 'Forgotten Garden', 'overgrown ruined garden, flowers, ivy-covered arches, soft morning light, pale blue sky with warm cream haze, drifting petals', 'mossy sandstone bricks with small weeds, warm tan and green'],
  ['w02', 'Broken Ruins', 'grey toppled columns and broken walls under an overcast misty sky, moss, drifting dust, muted blue-grey palette', 'cracked grey stone slabs with moss in the joints'],
  ['w03', 'Floating Islands', 'bright blue sky, big white clouds, distant floating islands with waterfalls, sunny and airy, turquoise and white', 'pale blue-grey stone tiles with tiny cyan rune scratches'],
  ['w04', 'Ancient Temple', 'dark stone temple hall, giant carved statues, hanging braziers, warm amber torch glow, deep brown and gold', 'dark brown carved stone with thin gold inlay lines'],
  ['w05', 'Monster Territory', 'dark spooky forest at night, glowing green mist, big pale moon, twisted trees, fireflies, deep green and teal', 'dark packed earth with roots, bones and green moss'],
  ['w06', 'Lost Kingdom', 'sunset over a ruined golden city, purple and pink sky, torn banners, long shadows, dusty gold', 'weathered wooden planks and old brown flagstones'],
  ['w07', 'Portal Dimension', 'violet void with swirling magenta and cyan portals, floating crystals, stars, surreal and dreamlike', 'violet crystal-flecked stone with faint glowing magenta veins'],
  ['w08', 'Burning Path', 'volcanic cavern, rivers of lava, rising embers, black rock, red and orange glow, smoky air', 'black volcanic rock with glowing orange cracks'],
  ['w09', 'Twin Souls', 'deep blue night with two mirrored moons, icy blue crystals, calm still water reflections, cool silver and blue', 'frosted blue ice stone with fine white cracks'],
  ['w10', 'Final Dimension', 'cosmic nebula in gold and purple, a huge glowing gate floating in space, cracks of light, epic and mysterious', 'dark purple marble with gold veins and tiny stars'],
];
const E = [];
const add = (folder, file, aspect, px, prompt) => E.push({ file: `${folder}/${file}`, aspect, size: px, prompt });

// ---- 1 brand
const LOGO = 'Spell the title exactly P-A-T-H-B-O-U-N-D, nothing else. The lettering is chunky glossy 3D gold with a dark-purple outline and a soft highlight.';
add('brand', 'logo-full.png', '1:1', '2048x2048', `${STYLE} Main game logo. At the top an emblem: a floating isometric stone tile with a glowing cyan dotted route winding across it, a great sword planted at the start and a glowing cyan gem at the end. Below it the word PATHBOUND. ${LOGO} ${MAG}`);
add('brand', 'logo-wordmark.png', '4:1', '2048x512', `${STYLE} Wordmark only, no emblem: the single word PATHBOUND on one line. ${LOGO} A thin cyan dotted line runs under it. ${MAG}`);
add('brand', 'logo-emblem.png', '1:1', '1024x1024', `${STYLE} Emblem only, no text: a floating isometric stone tile with a glowing cyan dotted route winding across it, a great sword planted at the start and a glowing cyan gem at the end. ${MAG}`);
add('brand', 'app-icon-1024.png', '1:1', '1024x1024', `${STYLE} Mobile app icon, full-bleed square (no rounded corners, no border), no text. A floating isometric tile with a glowing cyan dotted path, a great sword planted at one end and a glowing cyan gem at the other, deep purple radial-gradient background with soft light behind the tile. Subject centred inside the middle 70%.`);
add('brand', 'app-icon-foreground.png', '1:1', '1024x1024', `${STYLE} Android adaptive icon foreground layer: only the emblem (isometric tile, cyan dotted path, great sword, cyan gem), small and centred inside the middle 55% of the canvas, no text. ${MAG}`);
add('brand', 'store-feature-1024x500.png', '2:1', '2048x1000', `${STYLE} Wide store key art. A heroine in light armour holding a huge great sword stands on a floating isometric stone path above a sea of clouds; a glowing cyan route leads to a golden treasure chest; mystical purple and gold sunset sky with floating islands. Keep the left third calm and empty for a title overlay. No text.`);
add('brand', 'splash-loading.png', '9:16', '1080x1920', `${STYLE} Loading splash: deep purple night sky with soft stars, one small floating island with a tiny glowing tile path in the lower middle, plenty of empty space above for a logo. No text.`);
add('brand', 'social-share-1200x630.png', '1.91:1', '1200x630', `${STYLE} Social share card: a floating isometric stone path with a great sword and a glowing cyan gem above clouds, purple and gold sky, calm empty left half for a title. No text.`);

// ---- 2 backgrounds
const TITLE = 'Epic fantasy dusk: giant floating islands with tiny temples and waterfalls, glowing clouds, first stars appearing, a huge distant ruined castle on the horizon, warm gold light.';
add('backgrounds', 'bg-title-portrait.png', '9:16', '1080x1920', `${STYLE} ${SCENE} ${TITLE} The centre-bottom is calm open sky where menu buttons will sit.`);
add('backgrounds', 'bg-title-landscape.png', '16:9', '1920x1080', `${STYLE} ${SCENE} ${TITLE} The centre is calm open sky.`);
for (const [id, name, scene] of W) {
  add('backgrounds', `bg-${id}-portrait.png`, '9:16', '1080x1920', `${STYLE} ${SCENE} World "${name}": ${scene}.`);
  add('backgrounds', `bg-${id}-landscape.png`, '16:9', '1920x1080', `${STYLE} ${SCENE} World "${name}": ${scene}.`);
}
// ---- 3 textures
for (const [id, name, , tex] of W) add('textures', `tex-${id}-wall.png`, '1:1', '1024x1024', `${TILE} Material for the sides of floating stone blocks in the world "${name}": ${tex}.`);
add('textures', 'tex-moss-overlay.png', '1:1', '1024x1024', `${TILE} Soft green moss and grass tufts on a solid black background, to be used as a blended overlay.`);
add('textures', 'tex-crack-overlay.png', '1:1', '1024x1024', `${TILE} Fine dark cracks and chips on a solid white background, to be used as a multiply overlay.`);
add('textures', 'tex-metal-grate.png', '1:1', '1024x1024', `${TILE} Dark iron grate with rivets and small rust stains.`);
add('textures', 'tex-magic-runes.png', '1:1', '1024x1024', `${TILE} Faint glowing cyan magic rune circles and lines on a solid black background, to be used as an additive overlay.`);
// ---- 4 world cards
for (const [id, name, scene] of W) add('worldcards', `card-${id}.png`, '4:3', '1024x768', `${STYLE} Illustrated card art for the world "${name}": a small floating isometric island showing ${scene.split(',').slice(0, 3).join(',')}. One clear focal object, dark soft vignette at the edges, no text.`);
// ---- 5 UI
const U = (file, what) => add('ui', file, '1:1', '1024x1024', `${STYLE} Single UI element for a fantasy puzzle game: ${what}. Chunky, glossy, consistent thick dark-purple outline, centred. No text. ${MAG}`);
U('btn-gold.png', 'a wide rounded gold button, blank face, with a lighter top bevel and a darker bottom edge');
U('btn-gold-pressed.png', 'the same wide rounded gold button in its pressed state (slightly darker, bottom edge squashed)');
U('btn-purple.png', 'a wide rounded purple button, blank face, soft bevel');
U('btn-green.png', 'a wide rounded green button, blank face, soft bevel');
U('btn-red.png', 'a wide rounded red button, blank face, soft bevel');
U('btn-round.png', 'a round dark-purple icon button with a thin gold rim, blank face');
U('btn-round-gold.png', 'a round gold icon button with a glossy highlight, blank face');
U('panel-popup.png', 'a large popup window frame in dark purple with ornate gold corners and a blank middle');
U('panel-ribbon.png', 'a wide gold ribbon banner for a popup title, blank');
U('panel-tooltip.png', 'a small rounded speech-bubble tooltip panel in dark purple with a gold rim, blank');
U('panel-pill.png', 'a pill-shaped currency bar, dark purple with a gold rim and an empty round slot at the left');
U('tile-level-open.png', 'a square level-select tile, unlocked, glowing purple with a gold rim and three empty star slots along the bottom');
U('tile-level-locked.png', 'a square level-select tile, locked, grey-purple and dull with a padlock in the middle');
U('tile-level-done.png', 'a square level-select tile, completed, warm gold glow, three empty star slots along the bottom');
U('bar-progress.png', 'an empty horizontal progress bar frame with a rounded gold rim');
U('burst-win.png', 'a radiating golden sunburst with sparkles, for behind the level-complete stars');
const ICONS = [['star-full', 'a shiny gold star'], ['star-empty', 'an empty dull dark-grey star outline'], ['coin', 'a gold coin with a small gem in the centre'], ['hint', 'a glowing yellow lightbulb'], ['lock', 'a gold padlock'], ['rotate', 'two circular arrows forming a camera rotate symbol'], ['undo', 'a curved undo arrow'], ['clear', 'a trash can'], ['play', 'a big triangular play symbol'], ['fast', 'a fast-forward double triangle'], ['sound-on', 'a speaker with sound waves'], ['sound-off', 'a speaker with a cross'], ['music', 'a musical note'], ['settings', 'a gear'], ['shop', 'a small shopping bag with a star'], ['gift', 'a gift box with a bow'], ['no-ads', 'a shield with a crossed-out play-video symbol'], ['back', 'a chevron arrow pointing left'], ['home', 'a small house'], ['watch-ad', 'a video play symbol inside a rounded screen with a small sparkle'], ['key-gold', 'a golden key'], ['key-silver', 'a silver key'], ['trophy', 'a golden trophy'], ['heart', 'a red heart'], ['wait', 'an hourglass'], ['info', 'a round info symbol'], ['close', 'a bold X'], ['check', 'a bold green check mark']];
for (const [f, w] of ICONS) U(`icon-${f}.png`, `an icon of ${w}`);
for (const [f, w, c] of [['might', 'a golden sword', 'warm gold glow'], ['wind', 'a swirling wind spiral', 'green glow'], ['ward', 'a shield', 'blue glow']]) add('ui', `rune-${f}.png`, '1:1', '1024x1024', `${STYLE} A round magical rune badge showing ${w} carved in the middle, ${c}, a thin metal rim. No text. ${MAG}`);
// ---- 6 shop & rewards
const S = (file, what) => add('shop', file, '1:1', '1024x1024', `${STYLE} Store item illustration: ${what}. Appealing, glossy, centred, no text. ${MAG}`);
S('hints-small.png', 'a small pouch with three glowing yellow lightbulbs');
S('hints-medium.png', 'a bigger bag overflowing with about ten glowing yellow lightbulbs');
S('hints-large.png', 'a treasure chest full of glowing yellow lightbulbs and gold sparkles');
S('remove-ads.png', 'a big shield with a crossed-out video-play symbol, gold and purple');
S('starter-bundle.png', 'a treasure chest with a ribbon, spilling gold coins, a lightbulb and a glowing key');
S('daily-chest-closed.png', 'a closed wooden treasure chest with gold trim and a soft glow around the lock');
S('daily-chest-open.png', 'the same wooden treasure chest open with light and sparkles streaming out');
S('level-skip.png', 'a golden arrow jumping over a small stone tile gap');
S('double-reward.png', 'two overlapping gold stars with a sparkle burst, no letters');
// ---- 7 scenery
const P = (f, w) => add('scenery', f, '1:1', '1024x1024', `${STYLE} A single small floating island seen from an isometric angle, ${w}, with hanging roots and chunks of rock below it. Centred. No text. ${MAG}`);
P('island-grass.png', 'a grassy top with one round tree and tiny flowers');
P('island-ruins.png', 'a grey stone top with a broken column and a fallen arch');
P('island-sky.png', 'a pale stone top with a small waterfall pouring off the edge');
P('island-temple.png', 'a dark stone top with a carved statue and two lit braziers');
P('island-forest.png', 'a mossy dark top with twisted dead trees and glowing mushrooms');
P('island-castle.png', 'a golden-brown top with a small broken tower and torn banners');
P('island-crystal.png', 'a violet top covered in large glowing crystals');
P('island-lava.png', 'a black rock top with glowing lava cracks and a small flame');
P('island-ice.png', 'a frosted top with sharp blue ice crystals');
P('island-cosmic.png', 'a dark marble top with a small glowing gold ring floating above it');
for (const [f, w] of [['cloud-1', 'a fluffy soft white cloud, flat bottom'], ['cloud-2', 'a long thin wispy cloud streak'], ['cloud-3', 'a cluster of three small puffy clouds']]) add('scenery', `${f}.png`, '2:1', '1024x512', `${STYLE} ${w}, soft toon shading, white with pale blue shading. ${MAG}`);
// ---- 8 particles
const F = (f, w, bg) => add('fx', f, '1:1', '512x512', `${STYLE} A single particle sprite: ${w}. Centred, soft edges. No text. ${bg}`);
F('fx-glow.png', 'a round soft white glow, bright centre fading to nothing', BLK);
F('fx-sparkle.png', 'a four-point white sparkle star with a soft glow', BLK);
F('fx-ember.png', 'a small glowing orange ember', BLK);
F('fx-firefly.png', 'a tiny soft yellow-green glowing dot', BLK);
F('fx-star.png', 'a small twinkling pale-blue star', BLK);
F('fx-snow.png', 'a soft white snowflake dot', BLK);
F('fx-petal.png', 'a single pink flower petal', MAG);
F('fx-leaf.png', 'a single green leaf', MAG);
F('fx-smoke.png', 'a soft grey puff of smoke with a feathered edge', MAG);
F('fx-coin-burst.png', 'a ring of small gold sparkles bursting outward', BLK);

fs.writeFileSync(path.join(docs, 'art_prompts.json'), JSON.stringify({ style: STYLE, count: E.length, images: E }, null, 1));
const groups = {}; for (const e of E) (groups[e.file.split('/')[0]] ||= []).push(e);
const titles = { brand: '1. Brand (logo, icons, store art)', backgrounds: '2. Backgrounds (title + 10 worlds, portrait and landscape)', textures: '3. Textures (seamless)', worldcards: '4. World cards (level-select)', ui: '5. UI kit (buttons, panels, icons, runes)', shop: '6. Shop and reward art', scenery: '7. Scenery (floating islands, clouds)', fx: '8. Particle sprites' };
let md = `# PATHBOUND art prompts for Gemini\n\nGenerated by \`game/tools/make-art-prompts.mjs\`. **${E.length} images.** The same list is in \`docs/art_prompts.json\` (fields: file, aspect, size, prompt) so a Gemini canvas app can loop over it and name each file exactly.\n\n## Rules for the generator app\n1. Send every prompt exactly as written (each already contains the style text).\n2. Save with the file name given, keeping the folder (the zip must keep \`brand/\`, \`backgrounds/\`, \`textures/\`, \`worldcards/\`, \`ui/\`, \`shop/\`, \`scenery/\`, \`fx/\`).\n3. Aspect ratio is required; the pixel size is a target (bigger is fine, I resize).\n4. Prompts ending in a magenta (#FF00FF) rule: keep that flat magenta; I cut it out. Prompts ending in a black rule are glow sprites: keep pure black.\n5. Regenerate any logo where the letters are not exactly PATHBOUND.\n6. Textures must tile: check by placing four copies side by side.\n7. Add a \`manifest.json\` in the zip listing the final file names.\n\n## Style text used in every prompt\n> ${STYLE}\n\n## Priority order\nbrand, bg-title, ui, backgrounds w01-w03, textures, then the rest.\n`;
for (const g of Object.keys(groups)) { md += `\n## ${titles[g]}\n`; for (const e of groups[g]) md += `\n**\`${e.file}\`** · ${e.aspect} · ${e.size}\n\n> ${e.prompt}\n`; }
fs.writeFileSync(path.join(docs, 'ART_PROMPTS_FOR_GEMINI.md'), md);
console.log(E.length, 'images');
