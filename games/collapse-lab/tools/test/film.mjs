// 连续画面：机器人在第一关实战，每隔若干帧截一张缩略图拼成总览
//   node tools/test/film.mjs <输出png> [种子] [关卡序号] [帧数]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const fs = require('node:fs');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = process.argv[2] || 'film.png';
const seed = Number(process.argv[3] || 2024), stage = Number(process.argv[4] || 0), total = Number(process.argv[5] || 900);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
await page.goto('file://' + join(root, 'dist', 'index.html'));
await page.waitForFunction(() => window.__cl, null, { timeout: 10000 });
await page.evaluate(([seed, stage]) => {
  const c = window.__cl, G = c.G;
  G.save.introSeen = true; G.save.tutorialDone = true;
  c.game.ui.clear(); c.game.startRun(seed); if (c.game.fade.cb) c.game.fade.cb(); c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
  if (stage) c.game.loadStage(stage);
  c.step(50); c.game.hud.banner = null;
  window.__bot = { react: 0, atkT: 0, dir: 1, stuck: 0, lastX: 0, f: 0 };
}, [seed, stage]);
const shots = [];
const EVERY = 10;
for (let f = 0; f < total; f += EVERY) {
  await page.evaluate((n) => {
    const c = window.__cl, G = c.G, input = c.input, B = window.__bot;
    const w = G.world, p = w.player, run = G.run;
    for (let i = 0; i < n; i++) {
      for (const a of ['left', 'right', 'jump', 'atk1', 'atk2', 'roll', 'heal', 'down', 'skill', 'interact']) input.simulate(a, false);
      if (c.game.ui.active) { input.simulate('confirm', B.f % 20 < 2); c.step(1); B.f++; continue; }
      let e = null, bd = 1e9;
      for (const o of w.enemies) { if (o.dead) continue; const d = Math.abs(o.x - p.x) + Math.abs(o.cy - p.cy) * 1.5; if (d < bd && d < 260) { bd = d; e = o; } }
      const danger = w.enemies.some((o) => !o.dead && o.warnT > 0 && Math.abs(o.x - p.x) < 100 && Math.abs(o.y - p.y) < 60);
      if (danger && B.react === 0) B.react = 10;
      if (B.react > 0) { B.react--; if (B.react === 0 && p.rollCd <= 0 && e) { input.simulate(e.x > p.x ? 'right' : 'left', true); input.simulate('roll', true); } }
      if (run.hp < run.maxHp * 0.4 && run.flask > 0 && !danger) input.simulate('heal', true);
      else if (e) {
        const dx = e.x - p.x, adx = Math.abs(dx), range = e.w / 2 + 32;
        if (adx > range) input.simulate(dx > 0 ? 'right' : 'left', true);
        else { input.simulate(dx > 0 ? 'right' : 'left', B.f % 30 < 2); B.atkT++; if (B.atkT % 5 === 0) input.simulate('atk1', true); if (B.atkT % 47 === 20) input.simulate('atk2', true); if (B.atkT % 90 === 45) input.simulate('skill', true); }
        if (e.cy < p.y - 60 && adx < range + 40 && B.f % 22 === 0) input.simulate('jump', true);
      } else {
        // 没有敌人：向出口方向探索，卡住就跳
        const door = w.exits[0];
        const tx = door ? door.x : p.x + 100;
        const dir = tx > p.x ? 1 : -1;
        input.simulate(dir > 0 ? 'right' : 'left', true);
        if (B.f % 12 === 0) { if (Math.abs(p.x - B.lastX) < 3) B.stuck++; else B.stuck = 0; B.lastX = p.x; }
        if (B.stuck > 0 && B.f % 16 < 3) input.simulate('jump', true);
        if (B.stuck > 4 && B.f % 50 === 0) input.simulate('roll', true);
        const near = w.interactTarget;
        if (near && near !== door && B.f % 30 === 0) input.simulate('interact', true);
      }
      c.step(1); B.f++;
    }
  }, EVERY);
  shots.push(await page.screenshot({ type: 'png' }));
}
const info = await page.evaluate(() => { const G = window.__cl.G, r = G.run, w = G.world; return { hp: Math.round(r.hp), kills: r.kills, gold: r.gold, data: r.data, stage: r.stage, dead: w.player.dead, x: Math.round(w.player.x), y: Math.round(w.player.y) }; });
console.log('bot result', info, 'frames', shots.length);
fs.mkdirSync(dirname(out), { recursive: true });
shots.forEach((b, i) => fs.writeFileSync(out.replace(/\.png$/, '') + '_' + String(i).padStart(3, '0') + '.png', b));
if (errors.length) console.log(errors.slice(0, 5).join('\n'));
await browser.close();
