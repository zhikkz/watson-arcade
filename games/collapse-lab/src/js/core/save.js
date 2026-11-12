// 本地存档：保存在浏览器的 localStorage 里（同一个浏览器、同一个网址下长期有效，不需要服务器）
//   collapse-lab-save-v1   永久进度：数据、解锁、图鉴、统计、设置
//   collapse-lab-run-v1    进行中的一局：进入当前区域时的状态（存档点），用于「继续实验」
// 全部读写都有 try/catch：隐私模式、被禁用的站点数据或沙箱里 localStorage 可能不可用，
// 这时退回到内存里（只在本次打开期间有效），并通过 saveStatus() 告诉界面。
const KEY = 'collapse-lab-save-v1';
const RUN_KEY = 'collapse-lab-run-v1';

const DEFAULTS = () => ({
  version: 1,
  data: 0,                 // 永久货币「数据」
  unlocks: {},             // 永久解锁 id -> 等级/true
  seen: {},                // 图鉴：怪物 id -> 击杀数
  runs: 0, wins: 0, deaths: 0,
  bestStage: 0, bestTime: 0, entropy: 0,   // entropy: 通关后解锁的难度层级
  introSeen: false,
  tutorialDone: false,
  settings: { sfx: 0.8, music: 0.55, shake: true, flash: true, touchScale: 1, stickFixed: true },   // stickFixed: 触屏摇杆固定在左下角
});

let cache = null;            // 永久进度
let runCache;                // 进行中的一局：undefined = 还没读过，null = 没有
let store = null, storeChecked = false, lastWriteOk = true;

/** 可用的 localStorage；不可用时返回 null */
function storage() {
  if (storeChecked) return store;
  storeChecked = true;
  try {
    const s = window.localStorage;
    const probe = '__collapse-lab-probe__';
    s.setItem(probe, '1');
    if (s.getItem(probe) !== '1') throw new Error('readback');
    s.removeItem(probe);
    store = s;
  } catch (_) { store = null; }
  return store;
}

function put(key, obj) {
  const s = storage();
  if (!s) { lastWriteOk = false; return false; }
  try { s.setItem(key, JSON.stringify(obj)); lastWriteOk = true; } catch (_) { lastWriteOk = false; }   // 例如配额已满
  return lastWriteOk;
}

function get(key) {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : null;
  } catch (_) { return null; }      // 读不到 / 存档损坏：当作没有
}

/** 存档能不能真正写进浏览器 */
export function saveStatus() {
  const ok = !!storage() && lastWriteOk;
  return { ok, text: ok ? '本机浏览器' : '无法写入（仅本次有效）' };
}

// ---------------------------------------------------------------- 永久进度
export function loadSave() {
  if (cache) return cache;
  const obj = DEFAULTS();
  const parsed = get(KEY);
  if (parsed) {
    Object.assign(obj, parsed);
    obj.settings = Object.assign(DEFAULTS().settings, parsed.settings || {});
    obj.unlocks = parsed.unlocks && typeof parsed.unlocks === 'object' ? parsed.unlocks : {};
    obj.seen = parsed.seen && typeof parsed.seen === 'object' ? parsed.seen : {};
    for (const k of ['data', 'runs', 'wins', 'deaths', 'bestStage', 'bestTime', 'entropy']) obj[k] = Number.isFinite(obj[k]) ? obj[k] : 0;
  }
  cache = obj;
  return obj;
}

export function writeSave() {
  if (!cache) return false;
  return put(KEY, cache);
}

// ---------------------------------------------------------------- 进行中的一局
/** 读取存档点：{ v, at, name, run }，没有则为 null */
export function loadRunSave() {
  if (runCache !== undefined) return runCache;
  const o = get(RUN_KEY);
  runCache = o && o.v === 1 && o.run && typeof o.run === 'object' && Number.isFinite(o.run.stage) && Number.isFinite(o.run.seed) ? o : null;
  return runCache;
}

export function writeRunSave(obj) {
  runCache = obj;
  return put(RUN_KEY, obj);
}

export function clearRunSave() {
  runCache = null;
  const s = storage();
  if (s) { try { s.removeItem(RUN_KEY); } catch (_) { /* ignore */ } }
}

// ---------------------------------------------------------------- 清除
/** 清除全部存档（永久进度 + 进行中的一局），返回新的空白存档 */
export function resetSave() {
  cache = DEFAULTS();
  clearRunSave();
  const s = storage();
  if (s) { try { s.removeItem(KEY); } catch (_) { /* ignore */ } }
  writeSave();
  return cache;
}
