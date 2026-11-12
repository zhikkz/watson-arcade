// 移动手感的数值校验：跳跃高度 / 距离、二段跳、滑铲过矮道、攀沿、下跳
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto('file://' + join(root, 'dist', 'index.html'));
await page.waitForFunction(() => window.__cl, null, { timeout: 10000 });
const res = await page.evaluate(() => {
  const c = window.__cl, G = c.G, input = c.input, T = 24;
  const out = {};
  const reset = () => {
    G.save.introSeen = true; G.save.tutorialDone = true;
    c.game.ui.clear(); c.game.startRun(3); if (c.game.fade.cb) c.game.fade.cb(); c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
    c.game.loadStage(1); c.step(40);
    for (const a of ['left', 'right', 'jump', 'roll', 'down', 'atk1']) input.simulate(a, false);
    const w = G.world; w.props.length = 0; w.pickups.length = 0;
    return w;
  };
  // 1) 原地跳高度
  let w = reset(), p = w.player, y0 = p.y, top = p.y;
  input.simulate('jump', true); for (let i = 0; i < 60; i++) { c.step(1); top = Math.min(top, p.y); } input.simulate('jump', false);
  out.jumpHeight = +(y0 - top).toFixed(1);
  // 2) 二段跳总高度
  w = reset(); p = w.player; y0 = p.y; top = p.y;
  input.simulate('jump', true); for (let i = 0; i < 20; i++) { c.step(1); top = Math.min(top, p.y); if (p.vy > -40) break; }
  input.simulate('jump', false); c.step(1); input.simulate('jump', true);
  for (let i = 0; i < 60; i++) { c.step(1); top = Math.min(top, p.y); }
  input.simulate('jump', false);
  out.doubleJumpHeight = +(y0 - top).toFixed(1);
  // 3) 助跑跳远距离
  w = reset(); p = w.player;
  input.simulate('right', true); c.step(30); const x0 = p.x; input.simulate('jump', true); c.step(2);
  let n = 0; while (!p.onGround && n++ < 120) c.step(1);
  out.jumpDistance = +(p.x - x0).toFixed(1); input.simulate('jump', false); input.simulate('right', false);
  // 4) 滑铲穿过 3 格长、2 格高的矮道
  w = reset(); p = w.player;
  const lv = w.level, fy = Math.round(p.y / T);     // 地面行
  const tx = Math.floor(p.x / T) + 5;
  for (let i = 0; i < 3; i++) for (let j = 3; j <= 8; j++) lv.set(tx + i, fy - j, 1);
  lv.invalidate();
  input.simulate('right', true); c.step(20);
  const blockedX = p.x;
  input.simulate('roll', true); c.step(2); input.simulate('roll', false); c.step(60);
  out.slideTunnel = { blockedAt: +blockedX.toFixed(0), tunnel: [tx * T, (tx + 3) * T], after: +p.x.toFixed(0), passed: p.x > (tx + 3) * T, state: p.state, h: p.h };
  input.simulate('right', false);
  // 5) 攀沿：面前 4 格高的墙（单跳够不到顶，靠攀沿上去）
  w = reset(); p = w.player;
  const lv2 = w.level, tx2 = Math.floor(p.x / T) + 4;
  for (let i = 0; i < 4; i++) for (let j = 1; j <= 4; j++) lv2.set(tx2 + i, fy - j, 1);
  lv2.invalidate();
  input.simulate('right', true); c.step(16); input.simulate('jump', true);
  let climbed = false; for (let i = 0; i < 90; i++) { c.step(1); if (p.state === 'climb') climbed = true; }
  out.ledge = { climbed, onTop: Math.abs(p.y - (fy - 4) * T) < 1 && p.x > tx2 * T, y: p.y, wallTop: (fy - 4) * T };
  input.simulate('right', false); input.simulate('jump', false);
  // 6) 平台下跳
  w = reset(); p = w.player;
  const lv3 = w.level, tx3 = Math.floor(p.x / T);
  for (let i = -1; i <= 2; i++) lv3.set(tx3 + i, fy - 3, 2);
  lv3.invalidate();
  p.y = (fy - 3) * T; p.vy = 0; c.step(5);
  const onPlat = p.onGround && Math.abs(p.y - (fy - 3) * T) < 1;
  input.simulate('down', true); c.step(2); input.simulate('jump', true); c.step(2); input.simulate('jump', false); c.step(40); input.simulate('down', false);
  out.dropThrough = { onPlat, landedOnFloor: Math.abs(p.y - fy * T) < 1, state: p.state };
  return out;
});
console.log(JSON.stringify(res, null, 1));
console.log('tiles: jump', (res.jumpHeight / 24).toFixed(2), 'double', (res.doubleJumpHeight / 24).toFixed(2), 'dist', (res.jumpDistance / 24).toFixed(2));
if (errors.length) console.log(errors.join('\n'));
await browser.close();
