// 不依赖浏览器的实际移动、存档迁移、故障恢复与前端流程回归。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Level, T_SOLID, T_PLAT } from '../../src/js/game/level.js';
import { Player } from '../../src/js/game/player.js';
import { Run } from '../../src/js/game/run.js';
import { input } from '../../src/js/core/input.js';
import { G } from '../../src/js/game/state.js';
import { STEP, TILE } from '../../src/js/core/config.js';
import { validateLevel, generateLevel } from '../../src/js/game/levelgen.js';

const KEY = 'collapse-lab-save-v1', LEGACY = 'collapse-lab-run-v1';
const cp = (stage = 0) => ({ v: 1, at: 100, name: '旧标题', run: { stage, seed: 2024, data: 77 } });
class Storage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.writes = []; }
  getItem(k) { if (this.blocked) throw Error('blocked'); return this.values.get(k) ?? null; }
  setItem(k, v) { if (this.blocked || this.full) throw Error('quota'); this.values.set(k, v); this.writes.push([k, JSON.parse(v === '1' ? '1' : v)]); }
  removeItem(k) { if (this.removeFails || this.blocked) throw Error('remove'); this.values.delete(k); }
  json(k = KEY) { return JSON.parse(this.getItem(k)); }
}
let moduleId = 0;
async function fresh(storage) {
  globalThis.window = { localStorage: storage };
  return import(`../../src/js/core/save.js?case=${++moduleId}`);
}
const baseSave = () => ({ unlocks: {}, seen: {}, settings: { sfx: 0.8, music: 0.55 }, entropy: 0 });

function tunnel(platform = false) {
  input.clear();
  const lv = new Level(20, 16, 'rest'); lv.tiles.fill(0);
  for (let x = 0; x < lv.w; x++) lv.set(x, 13, T_SOLID);
  for (let x = 3; x <= 10; x++) { lv.set(x, 6, T_SOLID); lv.set(x, 9, platform ? T_PLAT : T_SOLID); }
  for (let y = 6; y <= 9; y++) lv.set(11, y, T_SOLID);
  const p = new Player(10 * TILE + 12, 9 * TILE);
  G.run = new Run(baseSave(), 7);
  const noop = () => {};
  p.world = { level: lv, run: G.run, fx: new Proxy({}, { get: () => noop }), shake: noop, safeX: p.x, safeY: p.y };
  p.state = 'roll'; p.h = 28; p.rollT = 0; p.rollDir = 1; p.onGround = true;
  return p;
}
function stepPlayer(p, n) { for (let i = 0; i < n; i++) { input.beginStep(); p.update(STEP); input.endStep(); } }

test('低通道翻滚结束后可以停下、反向离开死角', () => {
  const p = tunnel();
  input.simulate('right', true); stepPlayer(p, 30);
  const blockedX = p.x;
  input.simulate('right', false); stepPlayer(p, 15);
  assert.equal(p.vx, 0);
  input.simulate('left', true); stepPlayer(p, 45);
  assert.ok(p.x < blockedX - 40, `${p.x} vs ${blockedX}`);
  assert.equal(p.h, 28);
  input.clear();
});

test('站不起身且两侧受限时仍可从单向台阶下跳', () => {
  const p = tunnel(true), startY = p.y;
  input.simulate('down', true); input.simulate('jump', true); stepPlayer(p, 2);
  input.simulate('jump', false); stepPlayer(p, 45);
  assert.ok(p.y > startY + TILE);
  assert.equal(p.y, 13 * TILE);
  assert.equal(p.state, 'normal'); assert.equal(p.h, 50);
  input.clear();
});

test('地图校验拒绝入口与出口连通、却藏有孤立落脚坑的关卡', () => {
  const lv = new Level(20, 20, 'rest');
  for (let y = 2; y < 7; y++) for (let x = 1; x < 19; x++) lv.set(x, y, 0);
  // 一个完全隔离的低通道落脚点：旧校验只遍历入口搜索到的位置，会漏过它。
  for (let y = 13; y < 16; y++) for (let x = 8; x < 11; x++) lv.set(x, y, 0);
  lv.start = { x: 2.5 * TILE, y: 7 * TILE };
  assert.equal(validateLevel(lv, [{ type: 'exit', x: 17.5 * TILE, y: 7 * TILE }]).ok, false);
});

test('生成器移除孤立台阶后复验，并保留原有模板和确定性', () => {
  const run = { depth: 1, entropy: 0, seed: 25, stage: 2 };
  const seed = (25 * 2654435761) >>> 0;
  const lv = generateLevel(run, 'em', seed);
  assert.ok(validateLevel(lv, lv.spawns).ok);
  assert.ok(lv.repairedPlatforms > 0);
  assert.equal(lv.attempts, 1);
  assert.ok(lv.rooms.every((r) => !r.name.startsWith('安全通道')));
  for (const s of lv.spawns.filter((s) => s.ground)) assert.ok(lv.floorAt(s.x, s.y));
  assert.deepEqual(generateLevel(run, 'em', seed).tiles, lv.tiles);
  assert.equal(lv.phaseOn, true);
});

test('RNG 快照保留 uint32 状态，兼容旧版超出 32 位的累加状态', () => {
  const run = new Run(baseSave(), 2024);
  for (let i = 0; i < 150; i++) run.rng.next();
  const snap = run.snapshot(), legacy = { ...snap, rng: run.rng.s };
  assert.ok(legacy.rng > 0xffffffff);
  const restored = Run.restore(baseSave(), snap), old = Run.restore(baseSave(), legacy);
  for (let i = 0; i < 30; i++) { const n = run.rng.next(); assert.equal(restored.rng.next(), n); assert.equal(old.rng.next(), n); }
});

test('旧版双键存档合并迁移，保留永久进度、设置及本局', async () => {
  const s = new Storage({ [KEY]: JSON.stringify({ version: 1, data: 52, runs: 2, settings: { sfx: 0.3 }, unlocks: { hp1: true } }), [LEGACY]: JSON.stringify(cp(2)), zg_progress: 'untouched' });
  const api = await fresh(s);
  assert.equal(api.loadSave().data, 52); assert.equal(api.loadRunSave().run.stage, 2);
  assert.equal(s.json().checkpoint.run.data, 77); assert.equal(s.json().version, 2);
  assert.equal(s.json().settings.sfx, 0.3); assert.ok(s.json().unlocks.hp1);
  assert.equal(s.getItem(LEGACY), null); assert.equal(s.getItem('zg_progress'), 'untouched');
  assert.equal(s.writes.length, 1);
});

test('配额已满时仍读取旧存档；迁移失败保留原件，并能重试', async () => {
  const s = new Storage({ [KEY]: JSON.stringify({ version: 1, data: 99 }), [LEGACY]: JSON.stringify(cp()) });
  s.full = true;
  const api = await fresh(s);
  assert.equal(api.loadSave().data, 99); assert.ok(api.loadRunSave());
  assert.equal(api.saveStatus().ok, false); assert.ok(s.getItem(LEGACY));
  s.full = false;
  assert.equal(api.writeSave(), true); assert.equal(api.saveStatus().ok, true);
  assert.equal(s.json().data, 99); assert.equal(s.getItem(LEGACY), null);
});

test('上传数据原子提交；失败时余额和区域存档点同时保持旧版本', async () => {
  const s = new Storage({ [KEY]: JSON.stringify({ version: 2, data: 0, checkpoint: cp(1) }) });
  const api = await fresh(s), save = api.loadSave(), checkpoint = api.loadRunSave();
  save.data += checkpoint.run.data; checkpoint.run.data = 0;
  s.full = true;
  assert.equal(api.writeRunSave(checkpoint), false);
  assert.equal(s.json().data, 0); assert.equal(s.json().checkpoint.run.data, 77);
  s.full = false;
  assert.ok(api.writeSave());
  assert.equal(s.json().data, 77); assert.equal(s.json().checkpoint.run.data, 0);
  const reloaded = await fresh(s);
  assert.equal(reloaded.loadSave().data, 77); assert.equal(reloaded.loadRunSave().run.data, 0);
});

test('删除旧键失败也不会在结束本局后复活旧档', async () => {
  const s = new Storage({ [KEY]: JSON.stringify({ version: 1, data: 20 }), [LEGACY]: JSON.stringify(cp()) });
  s.removeFails = true;
  const api = await fresh(s);
  assert.ok(api.loadRunSave()); assert.ok(api.clearRunSave());
  assert.equal(s.json().checkpoint, null); assert.ok(s.getItem(LEGACY));
  assert.equal((await fresh(s)).loadRunSave(), null);
});

test('重置本游戏进度保留设置和其他游戏，恢复设置保留进度', async () => {
  const s = new Storage({ [KEY]: JSON.stringify({ version: 2, data: 88, runs: 4, unlocks: { hp1: true }, settings: { sfx: 0.3, stickFixed: false }, checkpoint: cp() }), zg_progress: 'another-game' });
  const api = await fresh(s);
  const reset = api.resetSave();
  assert.equal(reset.data, 0); assert.equal(reset.runs, 0); assert.deepEqual(reset.unlocks, {});
  assert.equal(reset.settings.sfx, 0.3); assert.equal(reset.settings.stickFixed, false);
  assert.equal(api.loadRunSave(), null); assert.equal(s.getItem('zg_progress'), 'another-game');
  reset.data = 51; api.writeRunSave(cp(2));
  const settings = reset.settings;
  assert.ok(api.resetSettings());
  assert.equal(settings.sfx, 0.8); assert.equal(settings.stickFixed, true);
  assert.equal(s.json().data, 51); assert.equal(s.json().checkpoint.run.stage, 2);
});

test('损坏或错误类型字段使用安全默认值，禁用存储时仍可游玩', async () => {
  const s = new Storage({ [KEY]: JSON.stringify({ version: 2, data: -5, seen: [], unlocks: [], settings: { sfx: 40, music: 'loud', shake: 'no' }, checkpoint: { v: 1, run: { stage: 1.5, seed: 3 } } }) });
  const api = await fresh(s), save = api.loadSave();
  assert.equal(save.data, 0); assert.deepEqual(save.seen, {}); assert.deepEqual(save.unlocks, {});
  assert.equal(save.settings.sfx, 1); assert.equal(save.settings.music, 0.55); assert.equal(save.settings.shake, true);
  assert.equal(api.loadRunSave(), null);
  const blocked = new Storage(); blocked.blocked = true;
  const memory = await fresh(blocked);
  memory.loadSave().data = 17;
  assert.equal(memory.writeRunSave(cp()), false); assert.equal(memory.saveStatus().ok, false);
  assert.equal(memory.loadSave().data, 17); assert.ok(memory.loadRunSave());
});

test('前端确认默认取消；返回标题回退到入口，重置只作用于本游戏进度', async () => {
  // DOM/Canvas 仅做环境替身；下面直接运行正式 Game、UI、World 与存档代码。
  const s = new Storage({ zg_progress: 'keep' });
  globalThis.window = { localStorage: s };
  const context = new Proxy({ globalAlpha: 1 }, { get: (o, k) => k in o ? o[k] : () => {} });
  const canvas = () => ({ getContext: () => context });
  globalThis.document = { createElement: canvas };
  const { Game } = await import('../../src/js/game/game.js');
  const { loadSave } = await import('../../src/js/core/save.js');
  const game = new Game(canvas());
  const transition = () => { const cb = game.fade.cb; game.fade.cb = null; cb?.(); game.fade.a = game.fade.target = 0; };
  G.save.introSeen = true; G.save.settings.sfx = 0.3;
  game.startRun(2024); transition();
  G.run.data = 77; G.run.gold = 123;
  game.loadStage(1);
  game.ui.openTerminal();
  assert.equal(G.save.data, 77); assert.equal(game.runSave.run.data, 0);
  assert.equal(s.json().data, 77); assert.equal(s.json().checkpoint.run.data, 0);
  game.ui.clear(); game.ui.openPause();
  G.run.gold = 999;
  const pause = game.ui.active;
  assert.ok(!pause.items.some((it) => it.label === '保存并退出'));
  pause.items.find((it) => it.label === '回到标题').action();
  assert.equal(game.ui.active.sel, 0); assert.equal(game.ui.active.items[0].label, '取消');
  game.ui.active.items[0].action();
  assert.equal(game.ui.active, pause); assert.equal(G.run.gold, 999);
  pause.items.find((it) => it.label === '回到标题').action();
  game.ui.active.items[1].action(); transition();
  assert.equal(G.run, null); assert.ok(game.continueRun()); transition();
  assert.equal(G.run.gold, 123); assert.equal(G.run.data, 0);
  game.ui.openTerminal(); assert.equal(G.save.data, 77); // 不能重复上传
  game.ui.clear(); game.ui.openSaveManager();
  game.ui.active.items.find((it) => it.danger).action();
  assert.ok(game.ui.active.text.includes('其他游戏')); assert.equal(game.ui.active.sel, 0);
  game.ui.active.items[1].action(); transition();
  assert.equal(G.save.data, 0); assert.equal(G.save.runs, 0); assert.equal(game.runSave, null);
  assert.equal(G.save.settings.sfx, 0.3); assert.equal(s.getItem('zg_progress'), 'keep');
  assert.equal(loadSave(), G.save);
});
