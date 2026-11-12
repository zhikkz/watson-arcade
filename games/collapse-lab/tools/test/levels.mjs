// 关卡生成批量校验：node tools/test/levels.mjs [每个区域的数量]
// 不依赖浏览器；对每个区域生成 N 个关卡，统计一次成功率、房间数、怪物数等。
import { generateLevel, buildFixedLevel } from '../../src/js/game/levelgen.js';
import { TEMPLATES } from '../../src/js/game/templates.js';

const N = Number(process.argv[2] || 200);
const biomes = [['mech', 0], ['em', 1], ['thermo', 3], ['quantum', 4]];
let fail = 0;
for (const [biome, depth] of biomes) {
  let attempts = 0, rooms = 0, enemies = 0, maxAttempts = 0, t0 = Date.now();
  const tplUse = {};
  const kinds = {};
  for (let i = 0; i < N; i++) {
    const run = { depth, entropy: 0, seed: i * 7919 + 13, stage: depth };
    try {
      const lv = generateLevel(run, biome, (i * 2654435761) >>> 0);
      attempts += lv.attempts; maxAttempts = Math.max(maxAttempts, lv.attempts);
      rooms += lv.rooms.length;
      for (const r of lv.rooms) tplUse[r.name] = (tplUse[r.name] || 0) + 1;
      for (const s of lv.spawns) { kinds[s.type] = (kinds[s.type] || 0) + 1; if (s.type === 'enemy') enemies++; }
    } catch (e) { fail++; console.log('FAIL', biome, i, e.message); }
  }
  const ms = (Date.now() - t0) / N;
  console.log(`${biome}: avg attempts ${(attempts / N).toFixed(2)} (max ${maxAttempts}), rooms ${(rooms / N).toFixed(1)}, enemies ${(enemies / N).toFixed(1)}, ${ms.toFixed(1)} ms/level`);
  console.log('   per level:', Object.entries(kinds).map(([k, v]) => `${k} ${(v / N).toFixed(1)}`).join(', '));
  if (biome === 'quantum') console.log('   template use:', Object.entries(tplUse).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
}
for (const id of ['rest', 'tyrant', 'singularity']) {
  const lv = buildFixedLevel(id, { seed: 1, stage: 1, depth: 0, entropy: 0 });
  console.log(`fixed ${id}: ${lv.w}x${lv.h}, start ${JSON.stringify(lv.start)}, spawns ${lv.spawns.map((s) => s.type).join(',')}`);
}
console.log(`templates: ${TEMPLATES.length}, failures: ${fail}`);
process.exit(fail ? 1 : 0);
