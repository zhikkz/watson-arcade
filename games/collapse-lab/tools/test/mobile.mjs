// 手机端测试：node tools/test/mobile.mjs <输出目录>
// 用真实的触摸事件（CDP Input.dispatchTouchEvent）驱动画面内的摇杆和圆键，
// 覆盖横屏、竖屏（自动旋转成横屏）、16:9 小屏和平板，并截图。
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = process.argv[2] || '.';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const errors = [];
let failed = 0;
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : '')); };

const DEVICES = [
  ['phone_land', 844, 390],     // 19.5:9 横屏
  ['phone_port', 390, 844],     // 竖着拿：应自动旋转成横屏
  ['phone_169', 667, 375],      // 16:9 小屏
  ['tablet_port', 768, 1024],   // 平板竖屏
];

for (const [name, vw, vh] of DEVICES) {
  console.log(`== ${name} ${vw}x${vh}`);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  page.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(name + ' ' + m.text()); });
  await page.goto('file://' + join(root, 'dist', 'index.html'));
  await page.waitForFunction(() => window.__cl, null, { timeout: 10000 });

  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = (n) => ev((k) => window.__cl.step(k), n);
  const shot = (s) => page.screenshot({ path: join(outDir, `${name}_${s}.png`) });
  /** 游戏坐标 -> 屏幕坐标（考虑旋转） */
  const toClient = (gx, gy) => ev(([x, y]) => {
    const c = window.__cl, r = document.getElementById('root').getBoundingClientRect(), cv = document.getElementById('game');
    const lx = parseFloat(cv.style.left) + x * c.VIEW.scale, ly = parseFloat(cv.style.top) + y * c.VIEW.scale;
    return c.VIEW.rot ? [r.right - ly, r.top + lx] : [r.left + lx, r.top + ly];
  }, [gx, gy]);
  // 多点触控：维护当前按下的触点
  const pts = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts.entries()].map(([id, p]) => ({ id, x: Math.round(p[0]), y: Math.round(p[1]) })) });
  // CDP 语义：touchStart / touchMove 带上当前所有触点（新出现的 = 按下，消失的 = 抬起）；touchEnd 不带触点 = 全部抬起
  const tdown = async (id, gx, gy) => { pts.set(id, await toClient(gx, gy)); await send('touchStart'); };
  const tmove = async (id, gx, gy) => { pts.set(id, await toClient(gx, gy)); await send('touchMove'); };
  const tup = async (id) => { pts.delete(id); await send(pts.size ? 'touchMove' : 'touchEnd'); };
  const tap = async (gx, gy, id = 9) => { await tdown(id, gx, gy); await step(2); await tup(id); await step(2); };

  const info = await ev(() => { const c = window.__cl, cv = document.getElementById('game').getBoundingClientRect(); return { W: c.W, rot: c.VIEW.rot, touch: c.VIEW.touch, scale: +c.VIEW.scale.toFixed(3), cw: Math.round(cv.width), ch: Math.round(cv.height), sw: document.documentElement.scrollWidth, iw: window.innerWidth }; });
  console.log('  view', JSON.stringify(info));
  check('识别为触屏设备', info.touch);
  check('竖屏自动旋转 / 横屏不旋转', info.rot === (vh > vw));
  // 旋转后画布的包围盒是竖的：长边应当贴满屏幕的长边
  const longSide = Math.max(info.cw, info.ch), shortSide = Math.min(info.cw, info.ch);
  check('画面铺满屏幕', longSide >= Math.max(vw, vh) - 2 || shortSide >= Math.min(vw, vh) - 2, `${info.cw}x${info.ch}`);
  check('没有横向滚动', info.sw <= info.iw);

  // ---- 标题：真实触摸点「开始实验」
  await ev(() => { const c = window.__cl; c.G.save.introSeen = true; c.G.save.tutorialDone = false; });
  await step(30);
  await shot('title');
  const ox = (info.W - 640) / 2;
  await tap(ox + 320, 161);
  await step(10);
  check('点「开始实验」能开局', await ev(() => !!window.__cl.G.run));
  // 换成固定种子，方便截图对比
  await ev(() => { const c = window.__cl; c.game.startRun(12345); });
  await step(80);
  check('触屏模式', await ev(() => window.__cl.input.device === 'touch'));
  await shot('play');

  // ---- 摇杆：左半屏按下并向右拖
  const x0 = await ev(() => window.__cl.G.world.player.x);
  await tdown(1, 110, 250);
  await tmove(1, 150, 252);
  await step(30);
  // 默认是固定摇杆：底座留在左下角，不跟着手指跑
  const fx = await ev(() => { const t = window.__cl.touch, h = t.home(); return { fixed: t.fixed, same: t.stick.ox === h.x && t.stick.oy === h.y, knob: Math.round(Math.hypot(t.stick.dx, t.stick.dy)) }; });
  check('摇杆默认固定：拖动时底座不动、圆钮不出圈', fx.fixed && fx.same && fx.knob <= 30, JSON.stringify(fx));
  await tmove(1, 300, 120);      // 手指拖得很远
  await step(4);
  check('手指拖远后底座仍在原位', await ev(() => { const t = window.__cl.touch, h = t.home(); return t.stick.ox === h.x && t.stick.oy === h.y && window.__cl.input.down('right'); }));
  await tmove(1, 150, 252);
  await step(4);
  const x1 = await ev(() => window.__cl.G.world.player.x);
  check('摇杆向右 -> 角色右移', x1 - x0 > 20, `dx=${Math.round(x1 - x0)}`);
  // ---- 同时按「跳」（多点触控）
  const y0 = await ev(() => window.__cl.G.world.player.y);
  const jp = await ev(() => { const t = window.__cl.touch; return t.pos(t.buttons.find((b) => b.id === 'jump')); });
  await tdown(2, jp.x, jp.y);
  await step(8);
  const y1 = await ev(() => window.__cl.G.world.player.y);
  check('按住摇杆的同时点「跳」', y0 - y1 > 10, `dy=${Math.round(y0 - y1)}`);
  await shot('stick_jump');
  await tup(2);
  await tup(1);
  await step(40);
  check('松手后停止移动', await ev(() => !window.__cl.input.down('right') && !window.__cl.input.down('jump')));

  // ---- 主手攻击键
  const ap = await ev(() => { const t = window.__cl.touch; return t.pos(t.buttons.find((b) => b.id === 'atk1')); });
  await tdown(3, ap.x, ap.y); await step(3);
  const atk = await ev(() => { const p = window.__cl.G.world.player; return p.state + '/' + (p.anim && p.anim.name || p.animName || ''); });
  await step(4); await shot('attack'); await tup(3); await step(30);
  check('主手键 -> 出招', /atk|attack|swing/i.test(atk) || await ev(() => window.__cl.G.run.wcd[0] > 0 || window.__cl.G.world.player.state !== 'normal'), atk);

  // ---- 翻滚键
  const rp = await ev(() => { const t = window.__cl.touch; return t.pos(t.buttons.find((b) => b.id === 'roll')); });
  await tdown(4, rp.x, rp.y); await step(4);
  const rolling = await ev(() => window.__cl.G.world.player.state);
  await tup(4); await step(40);
  check('滚键 -> 翻滚', rolling === 'roll', rolling);

  // ---- 设置里把摇杆改成「跟随手指」，再改回来
  await ev(() => window.__cl.game.ui.openSettings());
  await step(14);
  const stickRow = await ev(() => { const a = window.__cl.game.ui.active; const i = a.items.findIndex((it) => it.label === '摇杆位置'); return { i, value: i >= 0 ? a.items[i].value() : null }; });
  check('设置里有「摇杆位置」，默认「固定」', stickRow.i >= 0 && stickRow.value === '固定', JSON.stringify(stickRow));
  await shot('settings');
  await tap(ox + 320, 58 + stickRow.i * 28 + 11);
  await step(4);
  check('点一下切换为「跟随手指」并写入存档', await ev(() => { const c = window.__cl; return c.touch.fixed === false && c.G.save.settings.stickFixed === false && JSON.parse(localStorage.getItem('collapse-lab-save-v1')).settings.stickFixed === false; }));
  await tap(ox + 601, 17);
  await step(6);
  await tdown(5, 200, 200);
  await step(2);
  const fl0 = await ev(() => { const s = window.__cl.touch.stick; return [Math.round(s.ox), Math.round(s.oy)]; });
  await tmove(5, 320, 200);
  await step(2);
  const fl1 = await ev(() => Math.round(window.__cl.touch.stick.ox));
  await tup(5);
  await step(20);
  check('跟随手指：底座出现在手指下，并会跟着拖动', Math.abs(fl0[0] - 200) <= 2 && Math.abs(fl0[1] - 200) <= 2 && fl1 > fl0[0] + 20, JSON.stringify([fl0, fl1]));
  await ev(() => { const c = window.__cl; c.G.save.settings.stickFixed = true; c.touch.fixed = true; });

  // ---- 小地图 -> 大地图
  const mr = await ev(() => window.__cl.touch.miniRect());
  await tap(mr.x + 40, mr.y + 20);
  check('点小地图展开大地图', await ev(() => window.__cl.touch.mapOpen));
  await step(2); await shot('map');
  await tap(info.W / 2, 180);
  check('再点任意位置收起', await ev(() => !window.__cl.touch.mapOpen));

  // ---- 暂停键 -> 暂停菜单 -> 返回键
  const pp = await ev(() => { const t = window.__cl.touch; return t.pos(t.buttons.find((b) => b.id === 'pause')); });
  await tap(pp.x, pp.y);
  await step(14);
  check('点 Ⅱ 打开暂停菜单', await ev(() => { const a = window.__cl.game.ui.active; return !!a && a.title === '暂停'; }));
  await shot('pause');
  await tap(ox + 601, 17);
  await step(4);
  check('点「返回」继续游戏', await ev(() => !window.__cl.game.ui.active));

  // ---- 三选一：两次点击才确认
  await ev(() => { const c = window.__cl; c.game.ui.openPerks({}); });
  await step(16);
  await shot('choice');
  await tap(ox + 130, 160);
  await step(2);
  const armed = await ev(() => { const a = window.__cl.game.ui.active; return a ? a.sel : -1; });
  check('第一次点卡片只是选中', armed === 0, 'sel=' + armed);
  await step(4);
  await tap(ox + 130, 160);
  await step(4);
  check('第二次点同一张卡片才确定', await ev(() => !window.__cl.game.ui.active && window.__cl.G.run.perks.length === 1));

  // ---- 茶水间（加宽后的固定关卡）与「互动」键
  await ev(() => { const c = window.__cl; c.game.loadStage(1); });
  await step(30);
  await ev(() => { const c = window.__cl, w = c.G.world, d = w.props.find((o) => o.interactive); w.player.x = d.x; w.player.y = d.y; });
  await step(6);
  check('靠近设施时出现「互动」键', await ev(() => window.__cl.touch.showInteract));
  await shot('rest');
  const view = await ev(() => { const c = window.__cl, w = c.G.world; return { cam: Math.round(w.camera.x), lvl: w.level.pxW, W: c.W }; });
  check('固定关卡不露出关卡外面', view.lvl >= view.W, JSON.stringify(view));

  // ---- 首领房
  await ev(() => { const c = window.__cl; c.game.loadStage(10); });
  await step(140);
  await shot('boss');
  await ctx.close();
}
console.log(errors.length ? errors.join('\n') : 'no console errors');
console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed');
await browser.close();
process.exit(failed || errors.length ? 1 : 0);
