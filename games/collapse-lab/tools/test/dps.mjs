// 武器 DPS 对比：对着一个木桩（超高血量的研究僧）连续攻击 10 秒
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
await page.goto('file://' + join(root, 'dist', 'index.html'));
await page.waitForFunction(() => window.__cl, null, { timeout: 10000 });
const res = await page.evaluate(() => {
  const c = window.__cl, G = c.G, input = c.input;
  const out = [];
  for (const id of Object.keys(c.ITEMS)) {
    const def = c.ITEMS[id];
    G.save.introSeen = true; G.save.tutorialDone = true;
    c.game.ui.clear(); c.game.startRun(7); if (c.game.fade.cb) { c.game.fade.cb(); } c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
    c.game.loadStage(1); c.step(20);
    const run = G.run, w = G.world, p = w.player;
    run.hp = run.maxHp = 99999;
    const item = c.makeItem(id, 1, run.rng, 0);
    if (def.kind === 'skill') run.skill = item; else run.weapons[0] = item;
    const dist = def.kind === 'skill' ? 40 : def.type === 'melee' ? 26 : 70;
    const dummies = [];
    for (let i = 0; i < 2; i++) { const e = c.spawn('grad', p.x + dist + i * 26, p.y, { hpMul: 5000 }); e.ai = function () { this.vx = 0; }; e.kbResist = 1; w.addEnemy(e); dummies.push(e); }
    const hp0 = dummies.map((e) => e.hp);
    const T = def.kind === 'skill' ? 60 * 30 : 60 * 10;
    for (let f = 0; f < T; f++) {
      const act = def.kind === 'skill' ? 'skill' : 'atk1';
      if (def.type === 'charge') input.simulate(act, (f % 56) < 50);
      else if (def.auto) input.simulate(act, true);
      else input.simulate(act, f % 4 < 2);
      c.step(1);
      p.x = dummies[0].x - dist; p.facing = 1;
    }
    input.simulate('atk1', false); input.simulate('skill', false);
    c.step(120);
    const d = dummies.map((e, i) => hp0[i] - e.hp);
    out.push({ id, name: def.name, kind: def.kind, type: def.type, single: Math.round(d[0] / (T / 60)), both: Math.round((d[0] + d[1]) / (T / 60)) });
  }
  return out;
});
for (const r of res) console.log(`${r.kind.padEnd(6)} ${r.id.padEnd(11)} ${r.name.padEnd(8, '　')} 单体 ${String(r.single).padStart(4)}/s   两个目标合计 ${String(r.both).padStart(4)}/s`);
if (errors.length) console.log(errors.slice(0, 5).join('\n'));
await browser.close();
