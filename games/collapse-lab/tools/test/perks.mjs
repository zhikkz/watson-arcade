// 定理 / 词条全开的压力测试：确保所有钩子在实战里不会抛异常
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto('file://' + join(root, 'dist', 'index.html'));
await page.waitForFunction(() => window.__cl, null, { timeout: 10000 });
const res = await page.evaluate(() => {
  const c = window.__cl, G = c.G, input = c.input, out = [];
  G.save.introSeen = true; G.save.tutorialDone = true; G.save.unlocks = { revive: true, flask1: true, flask2: true, hp1: true, hp2: true, gold1: true, starter: true, recycle: true };
  for (const id of Object.keys(c.ITEMS)) if (!c.ITEMS[id].free) G.save.unlocks[(c.ITEMS[id].kind === 'skill' ? 's_' : 'w_') + id] = true;
  const AFF = ['sharp', 'burn', 'chill', 'shock', 'rad', 'vamp', 'crit', 'boom', 'rich', 'brittle', 'fuel', 'quick'];
  const weapons = Object.keys(c.ITEMS).filter((id) => c.ITEMS[id].kind === 'weapon');
  const skills = Object.keys(c.ITEMS).filter((id) => c.ITEMS[id].kind === 'skill');
  const mobs = Object.keys(c.BESTIARY).filter((id) => !c.BESTIARY[id].def.boss);
  for (let round = 0; round < 6; round++) {
    c.game.ui.clear(); c.game.startRun(500 + round); if (c.game.fade.cb) c.game.fade.cb(); c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
    c.game.loadStage([1, 3, 5, 7, 9, 1][round]); c.step(20);
    const run = G.run, w = G.world, p = w.player;
    for (const id of Object.keys(c.PERKS)) run.addPerk(id);
    run.scrolls.force = 3; run.scrolls.tech = 3; run.scrolls.vital = 2; run.recalc(); run.hp = run.maxHp;
    const mk = (id, i) => { const it = c.makeItem(id, 3, run.rng, 0); it.affixes = [AFF[(i * 3) % AFF.length], AFF[(i * 3 + 1) % AFF.length], AFF[(i * 3 + 2) % AFF.length]]; return it; };
    run.weapons[0] = mk(weapons[(round * 2) % weapons.length], round);
    run.weapons[1] = mk(weapons[(round * 2 + 1) % weapons.length], round + 2);
    run.skill = mk(skills[round % skills.length], round);
    for (let i = 0; i < 14; i++) { const id = mobs[(round * 5 + i) % mobs.length]; const fly = c.BESTIARY[id].def.flying; const e = c.spawn(id, p.x + 60 + (i % 7) * 60, p.y - (fly ? 60 : 0), { elite: i % 5 === 0 }); e.aggro = true; w.addEnemy(e); }
    let f = 0, revived = false;
    while (f < 60 * 40 && w.enemies.some((e) => !e.dead)) {
      for (const a of ['left', 'right', 'jump', 'atk1', 'atk2', 'roll', 'heal', 'skill', 'down']) input.simulate(a, false);
      let e = null, bd = 1e9;
      for (const o of w.enemies) { if (o.dead) continue; const d = Math.abs(o.x - p.x); if (d < bd) { bd = d; e = o; } }
      if (!e) break;
      const dx = e.x - p.x;
      if (Math.abs(dx) > 40) input.simulate(dx > 0 ? 'right' : 'left', true);
      if (f % 5 === 0) input.simulate('atk1', true);
      if (f % 9 === 4) input.simulate('atk2', true);
      if (f % 60 === 30) input.simulate('skill', true);
      if (f % 70 === 10) input.simulate('jump', true);
      if (f % 70 === 24) input.simulate('jump', true);       // 二段跳 -> 开普勒卫星
      if (f % 110 === 50) input.simulate('roll', true);
      if (f % 200 === 150) { input.simulate('down', true); input.simulate('jump', true); }
      if (f % 300 === 280) input.simulate('heal', true);
      if (f === 600 && !revived) { run.hp = 1; revived = true; }      // 触发薛定谔协议
      if (p.dead) break;
      if (c.game.ui.active) { input.simulate('confirm', true); }
      c.step(1); f++;
    }
    out.push(`round ${round}: ${c.ITEMS[run.weapons[0].id].name}+${c.ITEMS[run.weapons[1].id].name}+${c.ITEMS[run.skill.id].name} frames ${f} left ${w.enemies.filter((e) => !e.dead).length} hp ${Math.round(run.hp)}/${run.maxHp} dead ${p.dead} revives ${run.revives} kills ${run.kills} actors ${w.actors.length}`);
  }
  return out;
});
for (const l of res) console.log(l);
console.log(errors.length ? errors.slice(0, 10).join('\n') : 'no errors');
await browser.close();
