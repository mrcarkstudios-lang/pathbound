// Proves src/sim.js matches the Python reference: replays every stored solution.
import fs from 'node:fs';
import { Level } from '../src/sim.js';
const data = JSON.parse(fs.readFileSync(new URL('../src/data/levels.json', import.meta.url)));
let ok = 0, bad = [];
for (const l of data.levels) {
  const L = new Level(l);
  for (const key of ['solution_best', 'solution_shortest']) {
    const sol = l[key]; const { states, status } = L.run(sol.moves);
    const cells = states.map((s) => s.pos).join(' ');
    const want = sol.cells.map((c) => c[0] + ',' + c[1]).join(' ');
    const coinsOk = key !== 'solution_best' || states[states.length - 1].coins.size === l.coins.length;
    if (status === 'win' && cells === want && coinsOk) ok++; else bad.push(`${l.id} ${key} ${status}`);
  }
}
console.log(`replayed ${ok} of ${data.levels.length * 2} solutions`); if (bad.length) { console.log('FAILED', bad); process.exit(1); }
