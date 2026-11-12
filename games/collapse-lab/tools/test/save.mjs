// 存档测试：node tools/test/save.mjs [截图目录]
// 用一个真正落盘的浏览器配置目录，验证「关掉页面再打开」之后永久进度和进行中的一局都还在。
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = process.argv[2] || null;
let failed = 0;
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log((ok ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : '')); };

// 本地静态服务器：和真实部署一样走 http（localStorage 按网址隔离）
const html = readFileSync(join(root, 'dist', 'index.html'));
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const profile = mkdtempSync(join(tmpdir(), 'cl-save-'));
const errors = [];

async function open() {
  const ctx = await chromium.launchPersistentContext(profile, { viewport: { width: 1280, height: 720 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__cl, null, { timeout: 10000 });
  const ev = (fn, a) => page.evaluate(fn, a);
  const step = (n) => ev((k) => window.__cl.step(k), n);
  const press = async (act, frames = 2) => { await ev((a) => window.__cl.input.simulate(a, true), act); await step(frames); await ev((a) => window.__cl.input.simulate(a, false), act); await step(2); };
  const shot = async (name) => { if (outDir) await page.screenshot({ path: join(outDir, name + '.png') }); };
  const titleItems = () => ev(() => { const a = window.__cl.game.ui.active; return a && a.items ? a.items.map((it) => { const l = Array.isArray(it) ? it[0] : it.label; return typeof l === 'function' ? l() : l; }) : null; });
  return { ctx, page, ev, step, press, shot, titleItems };
}
const state = (ev) => ev(() => { const c = window.__cl, r = c.G.run, s = c.G.save; return { run: r ? { stage: r.stage, hp: Math.round(r.hp), maxHp: r.maxHp, gold: r.gold, data: r.data, perks: r.perks.slice(), w: r.weapons.map((x) => x && x.id + ':' + x.lv + ':' + x.affixes.join('+')), skill: r.skill && r.skill.id, scrolls: r.scrolls, flask: r.flask, kills: r.kills, time: Math.round(r.time), seed: r.seed } : null, save: { data: s.data, runs: s.runs, unlocks: Object.keys(s.unlocks), sfx: s.settings.sfx }, raw: !!JSON.parse(localStorage.getItem('collapse-lab-save-v1') || '{}').checkpoint }; });

// ---------------------------------------------------------------- 第 1 次打开：玩到第 3 个区域
console.log('== 第 1 次打开');
let g = await open();
check('存档位置：本机浏览器', await g.ev(() => window.__cl.game.runSave === null));
await g.step(40);
check('没有存档时标题第一项是「开始实验」', (await g.titleItems())[0] === '开始实验');
await g.ev(() => { const c = window.__cl; c.G.save.introSeen = true; c.game.startRun(2024); });
await g.step(80);
// 捡到装备、文献、定理、金币，然后进茶水间、上传数据、进下一关
await g.ev(() => {
  const c = window.__cl, r = c.G.run;
  r.weapons[1] = c.makeItem('laserpen', 2, r.rng, 2); r.skill = c.makeItem('gravity', 2, r.rng, 1);
  r.addScroll('force'); r.addScroll('vital'); r.addPerk('hooke'); r.gold = 321; r.data = 77; r.kills = 12; r.hp = 63; r.flask = 1;
  c.game.exitStage();
});
await g.step(60);
check('进入茶水间', await g.ev(() => window.__cl.G.run.stage === 1));
await g.ev(() => window.__cl.game.ui.openTerminal());
await g.step(10);
check('终端机上传数据', await g.ev(() => window.__cl.G.save.data === 77 && window.__cl.G.run.data === 0));
check('存档点里的未上传数据同步清零', await g.ev(() => window.__cl.game.runSave.run.data === 0));
await g.ev(() => { const u = window.__cl.game.ui; u.active.back(); });
await g.ev(() => { const c = window.__cl; c.G.save.settings.sfx = 0.3; c.game.exitStage(); });
await g.step(80);
const atEntry = await state(g.ev);
check('进入第 3 个区域并写入存档点', atEntry.run.stage === 2 && atEntry.raw, JSON.stringify(atEntry.run));
// 区域内又打了一阵（这些不会进存档点）
await g.ev(() => { const r = window.__cl.G.run; r.gold += 500; r.hp = 5; r.addPerk('kepler'); });
// 暂停 -> 回到标题
await g.press('pause');
await g.step(12);
await g.shot('save_pause');
const pauseItems = await g.titleItems();
check('暂停菜单有「回到标题」', pauseItems && pauseItems.includes('回到标题'), JSON.stringify(pauseItems));
await g.ev(() => { const a = window.__cl.game.ui.active; a.items.find((it) => it.label === '回到标题').action(); });
await g.step(20);
check('回到标题先说明区域内进度不保存，默认取消', await g.ev(() => window.__cl.game.ui.active.sel === 0 && window.__cl.game.ui.active.text.includes('不会保存')));
await g.ev(() => window.__cl.game.ui.active.items[1].action());
await g.step(60);
await g.shot('save_title_continue');
const items1 = await g.titleItems();
check('回到标题，第一项是「继续 · 区域名」', items1 && /^继续 · /.test(items1[0]) && items1[1] === '新的实验', JSON.stringify(items1));
await g.ctx.close();     // 关掉浏览器

// ---------------------------------------------------------------- 第 2 次打开：继续
console.log('== 第 2 次打开（关闭浏览器后重新打开）');
g = await open();
await g.step(40);
const items2 = await g.titleItems();
check('重新打开后仍然有「继续」', items2 && /^继续 · /.test(items2[0]), JSON.stringify(items2));
const meta2 = await state(g.ev);
check('永久进度还在（数据 77、设置）', meta2.save.data === 77 && meta2.save.sfx === 0.3 && meta2.save.runs === 1, JSON.stringify(meta2.save));
await g.press('confirm');     // 选中的就是「继续」
await g.step(80);
const cont = await state(g.ev);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check('继续后回到存档点的状态', cont.run && same({ ...cont.run, time: 0 }, { ...atEntry.run, time: 0 }), JSON.stringify(cont.run));
check('没有多算一局', cont.save.runs === 1);
await g.shot('save_continued');
// 同一个存档点读两次，生成的关卡一样（随机数状态被正确还原）
const sig = () => g.ev(() => { const lv = window.__cl.G.world.level; let h = 0; for (let i = 0; i < lv.tiles.length; i++) h = (h * 31 + lv.tiles[i]) | 0; return h + '/' + lv.spawns.length; });
const sigA = await sig();
await g.ev(() => { window.__cl.game.toTitle(); });
await g.step(60);
await g.press('confirm');
await g.step(80);
check('再读一次档，关卡完全相同', sigA === await sig(), sigA);
// 死亡后存档点消失
await g.ev(() => { const c = window.__cl; c.G.world.player.hurt ? 0 : 0; c.G.run.hp = 0; c.game.finishRun(false); });
await g.step(20);
check('死亡后不能再「继续」', await g.ev(() => window.__cl.game.runSave === null && !JSON.parse(localStorage.getItem('collapse-lab-save-v1') || '{}').checkpoint));
await g.ev(() => window.__cl.game.toTitle());
await g.step(60);
check('标题恢复为「开始实验」', (await g.titleItems())[0] === '开始实验');
// 新开一局并保存退出，然后测试「新的实验」的二次确认
await g.ev(() => window.__cl.game.startRun(99));
await g.step(60);
await g.ev(() => window.__cl.game.returnToTitle());
await g.step(60);
await g.press('down'); await g.press('confirm'); await g.step(20);
check('「新的实验」先显示确认页，默认取消', await g.ev(() => window.__cl.game.ui.active.title === '开始新的实验？' && window.__cl.game.ui.active.sel === 0 && !window.__cl.G.run));
await g.shot('save_title_confirm');
await g.press('down'); await g.press('confirm'); await g.step(60);
check('明确选择后才重开', await g.ev(() => !!window.__cl.G.run && window.__cl.G.run.stage === 0 && window.__cl.G.run.seed !== 99));

// ---------------------------------------------------------------- 重置本游戏进度（保留设置）
await g.press('pause'); await g.step(12);
await g.ev(() => window.__cl.game.ui.openSaveManager());
await g.step(12);
await g.shot('save_settings');
const clearIdx = await g.ev(() => window.__cl.game.ui.active.items.findIndex((it) => it.danger));
await g.ev((i) => { const a = window.__cl.game.ui.active; a.sel = i; }, clearIdx);
await g.step(2); await g.press('confirm'); await g.step(20);
check('重置确认默认取消，并说明范围', await g.ev(() => window.__cl.G.save.data === 77 && window.__cl.game.ui.active.sel === 0 && window.__cl.game.ui.active.text.includes('其他游戏')));
await g.press('down'); await g.press('confirm'); await g.step(30);
await g.shot('save_wiped_toast');
await g.step(40);
const wiped = await g.ev(() => { const c = window.__cl; return { data: c.G.save.data, runs: c.G.save.runs, run: !!c.G.run, cp: c.game.runSave, title: !!(c.game.ui.active && c.game.ui.active.items && c.game.ui.active.pausesWorld === false), raw: JSON.parse(localStorage.getItem('collapse-lab-save-v1') || '{}').checkpoint }; });
check('确认后：本游戏进度重置并回到标题', wiped.data === 0 && wiped.runs === 0 && !wiped.run && !wiped.cp && wiped.title && !wiped.raw, JSON.stringify(wiped));
await g.ctx.close();

// ---------------------------------------------------------------- 第 3 次打开：确认清档也落盘了
console.log('== 第 3 次打开');
g = await open();
await g.step(30);
const s3 = await state(g.ev);
check('重置后重新打开进度为空，设置保留', s3.save.data === 0 && s3.save.runs === 0 && s3.save.sfx === 0.3 && (await g.titleItems())[0] === '开始实验', JSON.stringify(s3.save));
// 损坏的存档不应该让游戏打不开
await g.ev(() => { localStorage.setItem('collapse-lab-run-v1', '{"v":1,"run":{"stage":3,"seed":5,"weapons":[{"id":"no-such-item"}],"perks":["nope"],"hp":"x"}}'); localStorage.setItem('collapse-lab-save-v1', '{broken'); });
await g.ctx.close();
g = await open();
await g.step(30);
check('永久存档损坏时用默认值启动', await g.ev(() => window.__cl.G.save.data === 0));
await g.press('confirm'); await g.step(80);
const bad = await state(g.ev);
check('存档点里有不认识的内容时仍能继续', bad.run && bad.run.stage === 3 && bad.run.w[0].startsWith('wrench') && bad.run.perks.length === 0 && bad.run.hp > 0, JSON.stringify(bad.run));
await g.ctx.close();

server.close();
rmSync(profile, { recursive: true, force: true });
console.log(errors.length ? errors.join('\n') : 'no console errors');
console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed');
process.exit(failed || errors.length ? 1 : 0);
