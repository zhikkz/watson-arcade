// 入口：载入资源、适配画布（含手机强制横屏）、分发指针事件、驱动固定步长主循环
import { W, H, STEP, VIEW, setViewWidth } from './core/config.js';
import { loadAssets } from './core/assets.js';
import { input, initKeyboard, noteGesture } from './core/input.js';
import { touch } from './core/touch.js';
import { audio } from './core/audio.js';
import { Game } from './game/game.js';
import { G } from './game/state.js';
import { spawnEnemy, BESTIARY } from './game/enemy.js';
import { makeItem, ITEMS } from './game/items.js';
import { makeHazard } from './game/hazards.js';
import { PERKS } from './game/perks.js';

const root = document.getElementById('root');
const app = document.getElementById('app');
const canvas = document.getElementById('game');
const loading = document.getElementById('loading');
const hallLink = document.getElementById('hall-link');
// Keep this HTML link separate from the canvas's pointer and keyboard controls.
for (const type of ['pointerdown', 'pointerup', 'keydown', 'keyup', 'touchstart', 'touchmove', 'touchend']) {
  hallLink.addEventListener(type, (event) => event.stopPropagation());
}

const MIN_W = 640, MAX_W = 800;     // 16:9 ~ 20:9
let game = null;
let cvLeft = 0, cvTop = 0;          // 画布在 #app（未旋转的横屏坐标系）里的位置

function detectTouch() {
  try {
    const coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const pts = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    return coarse && pts;
  } catch (_) { return false; }
}

/**
 * 布局：
 *  - 触屏设备竖着拿时，把整个画面顺时针旋转 90°——无论系统有没有锁定方向，游戏始终是横屏的；
 *  - 画面高度固定 360，宽度按屏幕比例在 640~800 之间取值，于是手机上可以铺满整个屏幕；
 *  - 电脑上尽量取整数倍放大，保持像素锐利。
 */
function layout() {
  const rw = root.clientWidth, rh = root.clientHeight;
  if (!rw || !rh) return;
  const rot = VIEW.touch && rh > rw * 1.05;
  const bw = rot ? rh : rw, bh = rot ? rw : rh;
  let vw = Math.round(H * bw / bh / 2) * 2;
  vw = Math.max(MIN_W, Math.min(MAX_W, vw));
  if (vw !== W || canvas.width !== vw) {
    setViewWidth(vw);
    canvas.width = vw; canvas.height = H;       // 会重置上下文状态
    if (game) game.onResize();
  }
  const fit = Math.min(bw / vw, bh / H);
  let scale = fit;
  if (!VIEW.touch) {
    // 优先整数倍（按物理像素），损失太多时退回等比填充
    const dpr = window.devicePixelRatio || 1;
    const k = Math.floor(fit * dpr);
    if (k >= 1 && k / dpr >= fit * 0.82 && k / dpr >= 1) scale = k / dpr;
  }
  VIEW.rot = rot; VIEW.scale = scale;
  const cw = Math.round(vw * scale), ch = Math.round(H * scale);
  cvLeft = Math.floor((bw - cw) / 2); cvTop = Math.floor((bh - ch) / 2);
  app.style.width = bw + 'px'; app.style.height = bh + 'px';
  app.style.transform = rot ? 'rotate(90deg) translateY(-100%)' : '';
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  canvas.style.left = cvLeft + 'px'; canvas.style.top = cvTop + 'px';
  canvas.style.imageRendering = scale < 1 ? 'auto' : '';
}

/** 指针位置 -> 游戏坐标（考虑旋转与缩放） */
function gamePos(e) {
  const r = root.getBoundingClientRect();
  let lx, ly;
  if (VIEW.rot) { lx = e.clientY - r.top; ly = r.right - e.clientX; } else { lx = e.clientX - r.left; ly = e.clientY - r.top; }
  return [(lx - cvLeft) / VIEW.scale, (ly - cvTop) / VIEW.scale];
}

function initPointer() {
  const isTouchPointer = (e) => e.pointerType === 'touch' || e.pointerType === 'pen';
  root.addEventListener('pointerdown', (e) => {
    audio.unlock(); noteGesture();
    const t = isTouchPointer(e);
    if (t) {
      if (!VIEW.touch) { VIEW.touch = true; layout(); }
      input.device = 'touch';
      e.preventDefault();
    }
    try { root.setPointerCapture(e.pointerId); } catch (_) { /* 旧浏览器 */ }
    try { canvas.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    const [x, y] = gamePos(e);
    game.pointerDown(e.pointerId, x, y, t);
  });
  root.addEventListener('pointermove', (e) => {
    const [x, y] = gamePos(e);
    game.pointerMove(e.pointerId, x, y, isTouchPointer(e));
  });
  // 触摸的「抬手」才是浏览器认可的用户手势：音频解锁、菜单点击（可能触发全屏）都放在这里
  root.addEventListener('pointerup', (e) => {
    audio.unlock();
    const [x, y] = gamePos(e);
    game.pointerUp(e.pointerId, x, y, false);
  });
  const cancel = (e) => { game.pointerUp(e.pointerId, 0, 0, true); };
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('lostpointercapture', cancel);
  // 屏蔽长按菜单、双指缩放、橡皮筋滚动
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  for (const type of ['touchstart', 'touchmove', 'touchend']) root.addEventListener(type, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => e.preventDefault());
}

async function boot() {
  try {
    await loadAssets();
  } catch (err) {
    loading.textContent = '资源载入失败：' + err.message;
    return;
  }
  VIEW.touch = detectTouch();
  if (VIEW.touch) input.device = 'touch';
  initKeyboard(window);
  input.onFirstGesture = () => audio.unlock();
  layout();
  game = new Game(canvas);
  loading.hidden = true;
  layout();
  initPointer();

  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => { layout(); setTimeout(layout, 250); });
  document.addEventListener('fullscreenchange', () => { layout(); setTimeout(layout, 250); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
  if (window.ResizeObserver) new ResizeObserver(layout).observe(root);

  // 切到后台 / 失焦：松开所有虚拟按键，游戏中自动暂停
  const away = () => { touch.reset(); game.autoPause(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { audio.suspend(); away(); } else audio.resume(); });
  window.addEventListener('blur', () => touch.reset());
  window.addEventListener('pagehide', away);

  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 4) {
      input.beginStep();
      game.update(STEP);
      input.endStep();
      acc -= STEP; steps++;
    }
    if (steps === 4) acc = 0;
    game.draw();
    hallLink.hidden = !!game.world && !game.ui.active?.hallReturn;
  }
  requestAnimationFrame(frame);

  // 调试 / 自动化测试接口（不影响正常游玩）
  window.__cl = {
    G, game, input, audio, touch, VIEW, layout, spawn: spawnEnemy, makeItem, ITEMS, BESTIARY, makeHazard, PERKS,
    get W() { return W; },
    /** 手动推进 n 个逻辑帧并重绘（测试用，不依赖 rAF 计时） */
    step(n = 1) { for (let i = 0; i < n; i++) { input.beginStep(); game.update(STEP); input.endStep(); } game.draw(); },
  };
}

boot();
