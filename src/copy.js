// All the words the player reads that are not level hints. Short, punchy, a little cheeky: they are written to be
// read in under two seconds and to make the next attempt feel like a good idea.
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let lastPicked = {};
/** Picks a line, never the same one twice in a row for the same bank. */
export function say(bank) { const list = COPY[bank]; if (!list) return ''; let s; let n = 0; do { s = pick(list); n++; } while (s === lastPicked[bank] && list.length > 1 && n < 6); lastPicked[bank] = s; return s; }

export const COPY = {
  tagline: ['Plan it. Walk it. Win it.', 'Outsmart every trap', 'One path. Zero regrets.', 'Think. Tap. Triumph.', 'Every step counts'],
  loading: [
    'Tap Maria’s tile again to make her WAIT one beat.',
    'Drag your finger across tiles to draw a long path in one go.',
    'Three stars = every coin + no wasted steps.',
    'Stuck? The lightbulb marks your next three steps.',
    'Spin the camera to peek behind tall walls.',
    'Monsters follow a rhythm. Learn the beat, then slip past.',
    'Undo is free. Be brave, try weird routes.',
    'The shortest path is rarely the best one.',
    'Maria never rushes. She walks exactly what you drew.',
  ],
  win3: ['Flawless!', 'Chef’s kiss!', 'Not a step wasted!', 'Pathbound legend!', 'Perfect path!'],
  win2: ['Smooth moves!', 'So close to perfect!', 'Great run!', 'Nicely done!'],
  win1: ['Made it!', 'Chest conquered!', 'Cleared!', 'A win is a win!'],
  win3sub: ['Maria is thoroughly impressed.', 'Frame that route.', 'Zero detours. Pure style.', 'That is how it is done.'],
  win2sub: ['One tighter route and it is three stars.', 'A few steps too many, but who is counting? (The stars are.)', 'Spot the shortcut for the third star.'],
  win1sub: ['Maria made it. Can you make it prettier?', 'Replay for coins and a tighter route.', 'Cleared! The stars are still waiting.'],
  failTitle: ['Oops!', 'Not quite!', 'Plot twist!', 'So close!', 'Ouch!'],
  fail: {
    trap: ['The spikes always win that argument.', 'That tile bites back.', 'Spikes 1, Maria 0.'],
    monster: ['It got there first. Try another rhythm.', 'Caught! Patrols never nap.', 'Too slow, or too fast. Mind the beat.'],
    gaze: ['Spotted! Watchers never blink.', 'Eyes everywhere. Break the line of sight.', 'The red tiles are watching. Wait for the gaze to turn.'],
    gate: ['Squished! Gates wait for no one.', 'The gate had other plans.'],
    other: ['That did not go to plan.'],
  },
  failTipLive: ['Maria is fine. Undo that step and try a different move.', 'Take it back and think one beat ahead.', 'Undo, WAIT a beat, then go again.'],
  failTip: ['Your route is kept. Change a step or add a WAIT, then try again.', 'Nothing is lost: tweak the route and go again.', 'Same route, small change, big difference.'],
  retry: ['One more try', 'Go again', 'Fix it'],
  stuck: ['Stuck? A hint costs one bulb and saves your sanity.', 'Maria believes in you. The hint believes in you more.'],
  routeDone: ['Path locked in. Hit PLAY!', 'That route reaches the chest. Press PLAY!', 'Ready when you are. PLAY!'],
  perfectBonus: ['Perfect! +1 hint', 'Perfect run! +1 hint'],
  daily: ['Your daily gift is waiting.', 'A little something for coming back.'],
  hintIntro: ['Maria whispers:', 'A tip from Maria:', 'Psst:'],
};

export function sayFail(cause) { return pick(COPY.fail[cause] || COPY.fail.other); }

/** Tutorial copy. `guided` lessons point at tiles and buttons; `cards` introduce a new rule the first time it appears. */
export const GUIDED = {
  1: {
    id: 'g1', start: ['Meet Maria', 'She walks exactly the path you draw. Tap the tile in front of her.'], go: ['Nice!', 'Keep tapping tiles toward the chest.'],
    off: ['Detour!', 'Tap Undo to step back, then try again.'], done: ['Path locked in!', 'Hit PLAY and watch her go.'],
    live: { start: ['Meet Maria', 'Tap the tile in front of her. She walks there right away.'], go: ['Nice!', 'Keep tapping toward the chest.'], off: ['Detour!', 'Tap Undo to step back one tile.'], done: ['Made it!', 'Open the chest.'] },
  },
  2: {
    id: 'g2', start: ['Corners allowed', 'Tap tile by tile, or drag your finger across several at once.'], go: ['Keep going', 'The chest is round the corner.'],
    off: ['Wrong turn?', 'Tap Undo, or tap an earlier tile of your path to rewind to it.'], done: ['Ready!', 'Press PLAY.'],
    live: { start: ['Corners allowed', 'Tap the next tile, or drag your finger along the path.'], go: ['Keep going', 'The chest is round the corner.'], off: ['Wrong turn?', 'Tap Undo to step back.'], done: ['Made it!', 'Open the chest.'] },
  },
};

export const CARDS = {
  wait: { title: 'Time is a tool', icon: 'wait', text: 'Tap Maria’s own tile to WAIT one beat. Monsters and traps move on a beat, so sometimes the smartest step is standing still.' },
  coins: { title: 'Shiny stuff', icon: 'coin', text: 'Grab every coin and finish within par for three stars. Sneaky detours often beat the short way.' },
  stairs: { title: 'Going up', icon: '🪜', text: 'Stairs are the only way to change height. Maria cannot climb walls. Yet.' },
  gold_key: { title: 'Golden key', icon: 'key-gold', text: 'Doors open only if you already hold a key when you arrive. Grab first, unlock second.' },
  crumble: { title: 'Crumbling tiles', icon: '🧱', text: 'Cracked tiles fall the moment you step off. One pass each. No going back!' },
  lever: { title: 'Lever time', icon: '🕹️', text: 'Every time Maria steps on a lever, the bridges swap: one set appears, the other vanishes, starting next beat. Plan what it opens… and what it closes.' },
  ferries: { title: 'All aboard', icon: '⛵', text: 'Ferries glide on their own. Step on, WAIT to ride, step off on the far side.' },
  traps: { title: 'Spikes!', icon: '⚠️', text: 'Spike tiles glow RED when stepping there would hurt, ORANGE just before they rise, and GREEN when they are safe. Step only on green. WAIT if you need to.' },
  crates: { title: 'Heavy lifting', icon: '📦', text: 'The Might rune lets Maria shove crates one tile at a time. You cannot pull them back, so think before you push.' },
  plates: { title: 'Pressure plates', icon: '🔘', text: 'Plates open gates while something stands on them. Park a crate there and the gate stays open.' },
  cracked: { title: 'Smash through', icon: '💥', text: 'With the Might rune, Maria’s great sword shatters cracked walls. Shortcut unlocked.' },
  silver_key: { title: 'Silver key', icon: 'key-silver', text: 'Silver keys open silver doors, gold keys open gold ones. Do not mix them up.' },
  portals: { title: 'Portals', icon: '🌀', text: 'Step on a ring and pop out of its twin. Magic shortcuts, but plan where you land.' },
  twin: { title: 'Your reflection', icon: '👥', text: 'Maria’s twin mirrors every step left to right. A wall stops the twin and the step is lost. Both must reach their goals on the same beat.' },
  minion: { title: 'Ghoul patrol', icon: '🧟', text: 'Ghouls pace the same route every beat. Learn their rhythm, then slip past, or WAIT for the gap. Walking into one ends the run.' },
  rogue: { title: 'Vampire patrol', icon: '🧛', text: 'Vampires patrol too, and they never take a break. Count their steps before you commit.' },
  sentry: { title: 'The Watcher', icon: '👁️', text: 'Watchers stare in a straight line and turn every few beats. Stay off the red tiles while the gaze is on them.' },
  hunter: { title: 'The Hunter', icon: '🐺', text: 'Hunters chase! Every couple of beats they step toward Maria. Lead them round walls and crates.' },
  boss: { title: 'Boss fight', icon: '👹', text: 'Warrok is the biggest hunter yet. He steps toward you on a slow beat and slams hard. Use the walls.' },
  wind: { title: 'Rune of Wind', icon: 'rune-wind', text: 'Maria can now leap across a one-tile gap: tap the tile two squares away in a straight line.' },
  ward: { title: 'Rune of Ward', icon: 'rune-ward', text: 'Spikes and flames cannot hurt Maria any more. Monsters still can!' },
};
