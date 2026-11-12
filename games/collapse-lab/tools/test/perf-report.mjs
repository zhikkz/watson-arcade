import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const directory = process.argv[2];
const load = (name) => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const after = load('perf-after.json');
const before = existsSync(join(directory, 'perf-before.json')) ? load('perf-before.json') : null;
console.log('### Collapse Lab mobile rendering\n');
console.log(`Chromium, 844 × 390, DPR 3, ${after.cpuRate}× CPU throttling. These are emulated measurements, not physical-phone FPS.\n`);
console.log('| Scene / version | Mean draw ms | P95 draw ms | P95 frame interval ms | Frames >25 ms | Canvas calls / last frame |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const result of after.results) {
  const base = before?.results.find((b) => b.scene === result.scene);
  for (const [version, r] of [['before', base], ['after', result]]) {
    if (!r) continue;
    const calls = Object.values(r.calls).reduce((sum, n) => sum + n, 0);
    console.log(`| ${r.scene} / ${version} | ${r.drawMs.mean} | ${r.drawMs.p95} | ${r.frameIntervalMs.p95} | ${r.over25ms}/${r.frames - 1} | ${calls} |`);
  }
}
