// 统一输入：键盘 / 触屏虚拟按键 / 手柄 -> 动作状态
const KEYMAP = {
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyK: 'jump', Space: 'jump',
  KeyJ: 'atk1', KeyZ: 'atk1', KeyU: 'atk2', KeyX: 'atk2',
  KeyI: 'skill', KeyC: 'skill',
  KeyL: 'roll', ShiftLeft: 'roll', ShiftRight: 'roll',
  KeyQ: 'heal', KeyH: 'heal', KeyE: 'interact', KeyF: 'interact',
  Escape: 'pause', KeyP: 'pause', Enter: 'confirm', NumpadEnter: 'confirm',
  KeyM: 'map',
};
const PAD_BUTTONS = { 0: 'jump', 1: 'roll', 2: 'atk1', 3: 'atk2', 4: 'heal', 5: 'interact', 6: 'skill', 7: 'skill', 8: 'map', 9: 'pause', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'atk1', 'atk2', 'skill', 'roll', 'heal', 'interact', 'pause', 'confirm', 'map'];

const src = { kb: {}, touch: {}, pad: {} };   // 各来源的按住状态
const queuedPress = new Set();
const queuedRelease = new Set();
let pressedNow = new Set();
let releasedNow = new Set();
let anyQueued = false, anyNow = false;
const prevPad = {};

function setHeld(source, action, on) {
  const s = src[source];
  const was = isHeld(action);
  s[action] = on;
  const now = isHeld(action);
  if (now && !was) { queuedPress.add(action); anyQueued = true; }
  if (!now && was) queuedRelease.add(action);
}

function isHeld(action) {
  return !!(src.kb[action] || src.touch[action] || src.pad[action]);
}

export const input = {
  device: 'kb',            // 最近使用的设备：kb | touch | pad
  onFirstGesture: null,    // 首次用户手势回调（用于解锁音频）
  enabled: true,

  down: (a) => isHeld(a),
  pressed: (a) => pressedNow.has(a),
  released: (a) => releasedNow.has(a),
  consume(a) { pressedNow.delete(a); },
  anyPressed: () => anyNow,
  axisX() { return (isHeld('right') ? 1 : 0) - (isHeld('left') ? 1 : 0); },
  axisY() { return (isHeld('down') ? 1 : 0) - (isHeld('up') ? 1 : 0); },

  // 菜单语义
  menuConfirm() { return pressedNow.has('confirm') || pressedNow.has('atk1') || pressedNow.has('jump') || pressedNow.has('interact'); },
  menuCancel() { return pressedNow.has('pause') || pressedNow.has('roll') || pressedNow.has('atk2'); },
  consumeMenu() { for (const a of ['confirm', 'atk1', 'jump', 'interact', 'pause', 'roll', 'atk2', 'up', 'down', 'left', 'right']) pressedNow.delete(a); },

  /** 每个逻辑步开始时调用：把事件队列转成本步的边沿状态 */
  beginStep() {
    pollPad();
    pressedNow = new Set(queuedPress);
    releasedNow = new Set(queuedRelease);
    anyNow = anyQueued;
    queuedPress.clear(); queuedRelease.clear(); anyQueued = false;
  },
  /** 同一渲染帧内的后续逻辑步不应重复触发边沿 */
  endStep() { pressedNow.clear(); releasedNow.clear(); anyNow = false; },

  clear() {
    for (const s of Object.values(src)) for (const k of Object.keys(s)) s[k] = false;
    queuedPress.clear(); queuedRelease.clear(); pressedNow.clear(); releasedNow.clear();
  },

  /** 测试/脚本用：直接设置某动作的按住状态 */
  simulate(action, on) { setHeld('kb', action, on); },
};

function gesture() {
  if (input.onFirstGesture) { const f = input.onFirstGesture; input.onFirstGesture = null; f(); }
}

export function initKeyboard(target = window) {
  target.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    gesture();
    if (!a) return;
    if (!e.metaKey && !e.ctrlKey && !e.altKey) e.preventDefault();
    if (e.repeat) return;
    input.device = 'kb';
    setHeld('kb', a, true);
  });
  target.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    setHeld('kb', a, false);
  });
  window.addEventListener('blur', () => input.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) input.clear(); });
}

// ---------------------------------------------------------------- 触屏
// 虚拟按键画在游戏画面里（见 core/touch.js），这里只提供设置动作状态的接口。
export function touchSet(action, on) {
  if (on) input.device = 'touch';
  setHeld('touch', action, on);
}
export function touchClear() {
  for (const k of Object.keys(src.touch)) if (src.touch[k]) setHeld('touch', k, false);
}
/** 任意输入设备的首次手势（解锁音频） */
export function noteGesture() { gesture(); }

// ---------------------------------------------------------------- 手柄
function pollPad() {
  if (!navigator.getGamepads) return;
  let pads;
  try { pads = navigator.getGamepads(); } catch (_) { return; }
  let gp = null;
  for (const p of pads) if (p && p.connected) { gp = p; break; }
  const now = {};
  if (gp) {
    gp.buttons.forEach((b, i) => { const a = PAD_BUTTONS[i]; if (a && (b.pressed || b.value > 0.5)) now[a] = true; });
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (ax < -0.4) now.left = true;
    if (ax > 0.4) now.right = true;
    if (ay < -0.6) now.up = true;
    if (ay > 0.6) now.down = true;
  }
  for (const a of ACTIONS) {
    const on = !!now[a];
    if (on !== !!prevPad[a]) {
      prevPad[a] = on;
      if (on) { input.device = 'pad'; gesture(); }
      setHeld('pad', a, on);
    }
  }
}

/** 当前设备下某动作的按键提示文字 */
export function keyHint(action) {
  const kb = { left: 'A', right: 'D', up: 'W', down: 'S', jump: 'K', atk1: 'J', atk2: 'U', skill: 'I', roll: 'L', heal: 'Q', interact: 'E', pause: 'Esc', confirm: 'J', map: 'M' };
  const pad = { left: '←', right: '→', up: '↑', down: '↓', jump: 'A', atk1: 'X', atk2: 'Y', skill: 'RT', roll: 'B', heal: 'LB', interact: 'RB', pause: 'Start', confirm: 'A', map: 'Back' };
  const touch = { left: '摇杆←', right: '摇杆→', up: '摇杆↑', down: '摇杆↓', jump: '跳', atk1: '主手键', atk2: '副手键', skill: '技能键', roll: '滚', heal: '保温杯键', interact: '互动', pause: 'Ⅱ', confirm: '点击', map: '小地图' };
  return (input.device === 'pad' ? pad : input.device === 'touch' ? touch : kb)[action] || '?';
}
