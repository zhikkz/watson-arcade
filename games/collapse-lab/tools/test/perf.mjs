// 性能粗测：在怪物密集的场景里连续跑逻辑+绘制，输出每帧平均耗时
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('file://' + join(root, 'dist', 'index.html'));
await page.waitForFunction(() => window.__cl, null, { timeout: 10000 });
const res = await page.evaluate(() => {
  const c = window.__cl, G = c.G;
  G.save.introSeen = true; G.save.tutorialDone = true;
  c.game.ui.clear(); c.game.startRun(11); if (c.game.fade.cb) c.game.fade.cb(); c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
  c.game.loadStage(8); c.step(30);
  const w = G.world, p = w.player, run = G.run;
  run.hp = run.maxHp = 1e6;
  const ids = ['cat', 'quark', 'neutrino', 'singlet', 'duli', 'scope', 'sentinel', 'grad'];
  for (let i = 0; i < 24; i++) { const e = c.spawn(ids[i % ids.length], p.x + 40 + (i % 12) * 40, p.y - (i % 3) * 30, {}); e.aggro = true; w.addEnemy(e); }
  run.weapons[0] = c.makeItem('gloves', 5, run.rng, 2);
  const N = 600;
  let upd = 0, drw = 0;
  for (let i = 0; i < N; i++) {
    c.input.simulate('atk1', i % 4 < 2);
    const t0 = performance.now();
    c.input.beginStep(); c.game.update(1 / 60); c.input.endStep();
    const t1 = performance.now();
    c.game.draw();
    const t2 = performance.now();
    upd += t1 - t0; drw += t2 - t1;
  }
  return { update: +(upd / N).toFixed(3), draw: +(drw / N).toFixed(3), enemies: w.enemies.length, parts: w.fx.parts.length, projs: w.projs.length };
});
console.log(res);
await browser.close();
