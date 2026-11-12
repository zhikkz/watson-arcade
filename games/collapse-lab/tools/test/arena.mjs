// 平衡测试：让一个「中等水平」的机器人在平地上依次对战每种怪物，统计击杀时间与掉血。
//   node tools/test/arena.mjs [怪物id,...]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const only = process.argv[2] ? process.argv[2].split(',') : null;

const DEPTH = { grad: 0, hopper: 0, weight: 0, cart: 0, bat: 0, duli: 0, orb: 1, tesla: 1, crab: 1, scope: 1, sentinel: 1, cryo: 3, joule: 3, watt: 3, imp: 3, cat: 4, quark: 4, neutrino: 4, singlet: 4, tyrant: 2, singularity: 5 };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
await page.goto('file://' + join(root, 'dist', 'index.html'));
await page.waitForFunction(() => window.__cl, null, { timeout: 10000 });

const rows = [];
for (const [id, depth] of Object.entries(DEPTH)) {
  if (only && !only.includes(id)) continue;
  const r = await page.evaluate(([id, depth]) => {
    const c = window.__cl, G = c.G, input = c.input;
    const boss = id === 'tyrant' || id === 'singularity';
    const out = { id, depth, trials: [] };
    for (let trial = 0; trial < (boss ? 2 : 3); trial++) {
      G.save.introSeen = true; G.save.tutorialDone = true; G.save.unlocks = {};
      c.game.ui.clear(); c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
      c.game.startRun(1000 + trial * 17); c.game.fade.cb && c.game.fade.cb(); c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
      const run = G.run;
      Object.defineProperty(run, 'depth', { get: () => depth, configurable: true });
      run.scrolls.force = Math.round(1.4 * depth); run.scrolls.vital = Math.round(0.6 * depth); run.recalc();
      run.hp = run.maxHp;
      run.weapons[0] = c.makeItem('wrench', depth + 1, run.rng, 0);
      c.game.loadStage(boss ? (id === 'tyrant' ? 4 : 10) : 1);
      Object.defineProperty(run, 'depth', { get: () => depth, configurable: true });
      c.step(boss ? 110 : 20);
      const w = G.world, p = w.player;
      if (!boss) { for (let i = 0; i < 3; i++) { const fly = c.BESTIARY[id].def.flying; const e = c.spawn(id, p.x + 120 + i * 110, p.y - (fly ? 60 : 0), {}); w.addEnemy(e); } }
      const hp0 = run.hp;
      let frames = 0, react = 0, atkT = 0, hurtN = 0, lastHp = run.hp;
      const maxF = boss ? 60 * 150 : 60 * 60;
      const rel = () => { for (const a of ['left', 'right', 'jump', 'atk1', 'roll', 'heal', 'down']) input.simulate(a, false); };
      while (frames < maxF && !p.dead && w.enemies.some((e) => !e.dead && !e.minion) ) {
        rel();
        let e = null, bd = 1e9;
        for (const o of w.enemies) { if (o.dead) continue; const d = Math.abs(o.x - p.x) + Math.abs(o.cy - p.cy) * 0.5; if (d < bd) { bd = d; e = o; } }
        const dx = e.x - p.x, adx = Math.abs(dx);
        const danger = w.enemies.some((o) => !o.dead && o.warnT > 0 && Math.abs(o.x - p.x) < 110) || w.projs.some((q) => q.owner === 'enemy' && Math.abs(q.x - p.x) < 46 && Math.abs(q.y - p.cy) < 40) || w.actors.some((a) => a.delay !== undefined && !a.done && Math.abs(a.x - p.x) < (a.r || 20) + 14);
        if (danger && react === 0) react = 9;                 // 约 0.15 秒反应时间
        if (react > 0) { react--; if (react === 0 && p.rollCd <= 0) { input.simulate(dx > 0 ? 'right' : 'left', true); input.simulate('roll', true); } }
        if (run.hp < run.maxHp * 0.35 && run.flask > 0 && !danger) input.simulate('heal', true);
        else {
          const range = e.w / 2 + 34;
          if (adx > range) input.simulate(dx > 0 ? 'right' : 'left', true);
          else { input.simulate(dx > 0 ? 'right' : 'left', (frames % 30) < 2); atkT++; if (atkT % 5 === 0) input.simulate('atk1', true); }
          if (e.cy < p.y - 62 && adx < range + 30 && p.onGround && frames % 20 === 0) input.simulate('jump', true);
          if (e.cy < p.y - 62 && !p.onGround && frames % 26 === 13) input.simulate('jump', true);
        }
        c.step(1); frames++;
        if (run.hp < lastHp) hurtN++;
        lastHp = run.hp;
      }
      rel();
      out.trials.push({ t: +(frames / 60).toFixed(1), lost: Math.round(hp0 - run.hp + (run.flaskMax - run.flask) * run.maxHp * 0.55), dead: p.dead, left: w.enemies.filter((e) => !e.dead && !e.minion).length, hits: hurtN, maxHp: run.maxHp, ehp: w.enemies[0] ? w.enemies[0].maxHp : 0 });
    }
    return out;
  }, [id, depth]);
  rows.push(r);
  const t = r.trials;
  console.log(`${id.padEnd(12)} d${depth}  ` + t.map((x) => `${x.dead ? 'DEAD' : x.left ? 'TIMEOUT(' + x.left + ')' : 'ok'} ${String(x.t).padStart(5)}s lost ${String(x.lost).padStart(4)}/${x.maxHp} hits ${x.hits}`).join('  |  '));
}
if (errors.length) console.log(errors.slice(0, 5).join('\n'));
await browser.close();
