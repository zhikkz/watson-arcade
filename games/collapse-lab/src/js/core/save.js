// 版本 2 把永久进度与区域存档点一次写进同一个键，避免上传数据时只成功保存一半。
// 沿用永久存档键；第一次读取时迁移旧的独立本局存档，迁移成功后才删除旧键。
const KEY = 'collapse-lab-save-v1';
const LEGACY_RUN_KEY = 'collapse-lab-run-v1';
const SETTINGS = () => ({ sfx: 0.8, music: 0.55, shake: true, flash: true, touchScale: 1, stickFixed: true });
const DEFAULTS = () => ({
  version: 2, data: 0, unlocks: {}, seen: {},
  runs: 0, wins: 0, deaths: 0, bestStage: 0, bestTime: 0, entropy: 0,
  introSeen: false, tutorialDone: false, settings: SETTINGS(),
});
const record = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const number = (v, fallback = 0, hi = 1e9) => Number.isFinite(v) ? Math.max(0, Math.min(hi, v)) : fallback;

let cache, runCache = null, initialized = false;
let store, checked = false, writeChecked = false, lastWriteOk = false;

function storage() {
  if (!checked) {
    checked = true;
    // 不用写探针决定能否读取：配额已满时，已有存档仍然可以读取。
    try { store = window.localStorage; } catch (_) { store = null; }
  }
  return store;
}

function read(key) {
  try {
    const value = JSON.parse(storage()?.getItem(key) || 'null');
    return record(value) ? value : null;
  } catch (_) { return null; }
}

function checkpoint(value) {
  const r = value?.run;
  return record(value) && value.v === 1 && record(r)
    && Number.isInteger(r.stage) && r.stage >= 0
    && Number.isInteger(r.seed) && r.seed >= 0 && r.seed <= 0xffffffff
    ? value : null;
}

function initialize() {
  if (initialized) return;
  initialized = true;
  cache = DEFAULTS();
  const old = read(KEY);
  if (old) {
    for (const key of ['data', 'runs', 'wins', 'deaths', 'bestStage', 'entropy']) cache[key] = Math.floor(number(old[key]));
    cache.bestTime = number(old.bestTime);
    for (const key of ['introSeen', 'tutorialDone']) cache[key] = old[key] === true;
    if (record(old.unlocks)) cache.unlocks = Object.fromEntries(Object.entries(old.unlocks).filter(([, v]) => v === true || (Number.isFinite(v) && v > 0)));
    if (record(old.seen)) cache.seen = Object.fromEntries(Object.entries(old.seen).filter(([, v]) => Number.isFinite(v) && v >= 0).map(([k, v]) => [k, Math.floor(v)]));
    const st = record(old.settings) ? old.settings : {};
    for (const key of ['sfx', 'music']) cache.settings[key] = number(st[key], cache.settings[key], 1);
    cache.settings.touchScale = Math.max(0.5, number(st.touchScale, 1, 2));
    for (const key of ['shake', 'flash', 'stickFixed']) if (typeof st[key] === 'boolean') cache.settings[key] = st[key];
  }
  // checkpoint:null 是明确的删除标记，绝不从残留的旧键复活一局。
  const modern = old?.version === 2;
  runCache = checkpoint(modern ? old.checkpoint : read(LEGACY_RUN_KEY));
  if (!modern && (old || runCache)) writeSave();
}

export function loadSave() { initialize(); return cache; }
export function loadRunSave() { initialize(); return runCache; }

/** 每次写入都包含永久进度和本局存档点，localStorage.setItem 原子地替换整个文档。 */
export function writeSave() {
  initialize();
  writeChecked = true;
  try {
    const s = storage();
    if (!s) throw new Error('storage unavailable');
    s.setItem(KEY, JSON.stringify({ ...cache, version: 2, checkpoint: runCache }));
    lastWriteOk = true;
    // 清理失败不影响已经提交的版本 2 文档；之后也不会再读取这个旧键。
    try { s.removeItem(LEGACY_RUN_KEY); } catch (_) { /* 已迁移 */ }
  } catch (_) { lastWriteOk = false; }
  return lastWriteOk;
}

export function writeRunSave(value) {
  initialize();
  runCache = checkpoint(value);
  return writeSave();
}

export function clearRunSave() {
  initialize();
  runCache = null;
  return writeSave();
}

/** 重置的范围只限本游戏进度；保留玩家偏好，其他游戏的键不受影响。 */
export function resetSave() {
  initialize();
  cache = { ...DEFAULTS(), settings: { ...cache.settings } };
  runCache = null;
  writeSave();
  return cache;
}

export function resetSettings() {
  initialize();
  Object.assign(cache.settings, SETTINGS());
  return writeSave();
}

export function saveStatus() {
  initialize();
  if (!writeChecked) {
    writeChecked = true;
    try {
      const s = storage();
      if (!s) throw new Error('storage unavailable');
      const probe = '__collapse-lab-probe__';
      s.setItem(probe, '1'); s.removeItem(probe);
      lastWriteOk = true;
    } catch (_) { lastWriteOk = false; }
  }
  return { ok: lastWriteOk, text: lastWriteOk ? '本机浏览器' : '更改未写入' };
}
