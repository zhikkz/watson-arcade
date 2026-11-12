// 截图工具：node tools/test/shot.mjs <输出目录> [脚本名...]
// 用法见各场景函数。使用 window.__cl.step() 手动推进逻辑帧，保证结果稳定。
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = process.argv[2] || '.';
const scenes = process.argv.slice(3);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
await page.goto('file://' + join(root, 'dist', 'index.html'));
await page.waitForFunction(() => window.__cl, null, { timeout: 10000 });

const shot = async (name) => { await page.screenshot({ path: join(outDir, name + '.png') }); console.log('shot', name); };
const step = (n) => page.evaluate((k) => window.__cl.step(k), n);
const press = async (act, frames = 2) => { await page.evaluate((a) => window.__cl.input.simulate(a, true), act); await step(frames); await page.evaluate((a) => window.__cl.input.simulate(a, false), act); await step(1); };
const hold = (act, on) => page.evaluate(([a, o]) => window.__cl.input.simulate(a, o), [act, on]);
const ev = (fn, arg) => page.evaluate(fn, arg);

const S = {
  async title() { await step(30); await shot('title'); },
  async start() {
    await ev(() => { const c = window.__cl; c.G.save.introSeen = true; c.G.save.tutorialDone = false; c.game.startRun(12345); });
    await step(60);
    await shot('start');
  },
  async run() {
    await hold('right', true); await step(50); await shot('run1');
    await press('jump', 3); await step(12); await shot('jump');
    await step(40); await hold('right', false);
    await press('atk1', 2); await step(6); await shot('attack');
    await step(30); await press('roll', 2); await step(8); await shot('roll');
    await step(40);
  },
  // 依次进入每个区域，在玩家身边刷出该区域的全部怪物并截图
  async biomes() {
    const stages = { mech: 0, em: 2, thermo: 6, quantum: 8 };
    const mobs = {
      mech: ['grad', 'hopper', 'weight', 'cart', 'bat', 'duli'],
      em: ['orb', 'tesla', 'crab', 'scope', 'sentinel', 'duli'],
      thermo: ['cryo', 'joule', 'watt', 'imp', 'grad'],
      quantum: ['cat', 'quark', 'neutrino', 'singlet', 'duli'],
    };
    for (const [b, st] of Object.entries(stages)) {
      await ev((stage) => {
        const c = window.__cl;
        c.G.save.introSeen = true; c.G.save.tutorialDone = true;
        if (!c.G.run) c.game.startRun(777);
        c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
        c.game.ui.clear();
        c.G.run.stage = stage; c.G.run.hp = c.G.run.maxHp = 9999;
        c.game.loadStage(stage);
      }, st);
      await step(30);
      await shot('biome_' + b + '_a');
      await ev((list) => {
        const c = window.__cl, w = c.G.world, p = w.player;
        // 清掉原有怪物，在玩家右侧排开
        for (const e of w.enemies) e.dead = true;
        const mod = c.spawn;
        list.forEach((id, i) => { const e = mod(id, p.x + 70 + i * 44, p.y - (['bat','orb','sentinel','joule','imp','quark','neutrino','singlet'].includes(id) ? 60 : 0), {}); if (e) w.addEnemy(e); });
      }, mobs[b]);
      await step(20);
      await shot('biome_' + b + '_mobs');
      await step(90);
      await shot('biome_' + b + '_fight');
      // 走到下一个房间看看场景
      await ev(() => { const w = window.__cl.G.world; for (const e of w.enemies) e.dead = true; });
      await hold('right', true); await step(170); await hold('right', false); await step(10);
      await shot('biome_' + b + '_b');
    }
  },
  async bosses() {
    for (const [name, st] of [['tyrant', 4], ['singularity', 10]]) {
      await ev((stage) => {
        const c = window.__cl;
        c.G.save.introSeen = true; c.G.save.tutorialDone = true;
        if (!c.G.run) c.game.startRun(777);
        c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
        c.game.ui.clear();
        c.G.run.stage = stage; c.G.run.hp = c.G.run.maxHp = 99999;
        c.game.loadStage(stage);
      }, st);
      await step(120); await shot('boss_' + name + '_1');
      await hold('right', true); await step(60); await hold('right', false);
      await step(100); await shot('boss_' + name + '_2');
      await step(160); await shot('boss_' + name + '_3');
      await step(200); await shot('boss_' + name + '_4');
    }
  },
  // 全流程冒烟：作弊机器人依次清怪、开箱、拾取、选定理、过门，直到通关；轮换全部武器与技能
  async flow() {
    const result = await page.evaluate(() => {
      const c = window.__cl, G = c.G, input = c.input;
      const log = [];
      c.G.save.introSeen = true; c.G.save.tutorialDone = true;
      c.game.ui.clear();
      c.game.startRun(4242);
      c.step(40);
      const weapons = Object.keys(c.ITEMS).filter((id) => c.ITEMS[id].kind === 'weapon');
      const skills = Object.keys(c.ITEMS).filter((id) => c.ITEMS[id].kind === 'skill');
      let wi = 0, si = 0;
      const tap = (act, hold = 2, after = 1) => { input.simulate(act, true); c.step(hold); input.simulate(act, false); c.step(after); };
      const closeUI = () => { let n = 0; while (c.game.ui.active && n++ < 30) { tap('confirm', 2, 4); c.step(12); if (c.game.ui.active && n % 2 === 0) { tap('roll', 2, 4); c.step(10); } } };
      const fake = (id) => c.makeItem(id, G.run.itemLevel(), G.run.rng, 2);
      let guard = 0;
      while (G.run && !G.run.finished && guard++ < 40) {
        const w = G.world, p = w.player, run = G.run;
        const st = run.stage;
        // 轮换装备
        run.weapons[0] = fake(weapons[wi++ % weapons.length]);
        run.weapons[1] = fake(weapons[wi++ % weapons.length]);
        run.skill = fake(skills[si++ % skills.length]);
        let killed = 0, forced = 0;
        const list = w.enemies.slice();
        for (const e of list) {
          let tries = 0;
          while (!e.dead && tries++ < 14) {
            run.hp = run.maxHp;
            const dir = e.x > p.x ? 1 : -1;
            const gy = e.flying ? (w.level.groundBelow(e.x, e.y, 12) || e.y) : e.y;
            p.x = e.x - 26; p.y = e.flying ? Math.min(gy, e.y + 30) : gy; p.vx = p.vy = 0; p.facing = 1;
            if (p.state !== 'normal') p.setState('normal');
            void dir;
            tap('atk1', 2, 10); tap('atk1', 2, 10); tap('atk1', 2, 16);
            input.simulate('atk2', true); c.step(26); input.simulate('atk2', false); c.step(6);
            if (tries % 3 === 0) tap('skill', 2, 12);
            if (tries % 4 === 1) tap('roll', 2, 24);
            if (tries % 5 === 2) { tap('jump', 3, 6); input.simulate('down', true); tap('jump', 2, 30); input.simulate('down', false); }
            closeUI();
          }
          if (!e.dead) { e.invulnerable = false; e.hp = 1; w.hitEnemy(e, 1e9, { src: 'melee' }); forced++; }
          killed++;
          c.step(4);
        }
        // 首领房可能刷出随从
        let extra = 0;
        while (w.enemies.some((e) => !e.dead) && extra++ < 60) { for (const e of w.enemies) if (!e.dead) { e.invulnerable = false; w.hitEnemy(e, 1e9, { src: 'melee' }); } c.step(30); }
        c.step(60);
        // 拾取与交互
        let inter = 0;
        for (let pass = 0; pass < 3; pass++) {
          for (const o of [...w.pickups, ...w.props]) {
            if (o.dead || !o.interactive || o === w.exits[0]) continue;
            run.gold = Math.max(run.gold, 500);
            p.x = o.x; p.y = o.y; p.vx = p.vy = 0; if (p.state !== 'normal') p.setState('normal');
            c.step(3);
            tap('interact', 2, 6); inter++;
            closeUI();
            c.step(20);
          }
        }
        log.push(`stage ${st} (${w.level.biome}${w.level.fixed ? '/' + w.level.fixed : ''}): enemies ${list.length} forced ${forced} interact ${inter} hp ${Math.round(run.hp)} perks ${run.perks.length} scrolls ${JSON.stringify(run.scrolls)} gold ${run.gold} data ${run.data}`);
        // 过门
        const door = w.exits[0];
        if (!door) { log.push('no exit door!'); break; }
        let n = 0;
        while (G.run && !G.run.finished && G.run.stage === st && n++ < 40) {
          if (G.world !== w) break;
          p.x = door.x; p.y = door.y; p.vx = p.vy = 0; if (p.state !== 'normal') p.setState('normal');
          c.step(3); tap('interact', 2, 30); closeUI(); c.step(30);
        }
        if (G.run && G.run.stage === st && !G.run.finished) { log.push('stuck at stage ' + st + ' locked=' + door.locked); c.step(300); if (G.run.stage === st && !G.run.finished) break; }
      }
      c.step(240);
      log.push('finished=' + (G.run ? G.run.finished : 'no run') + ' ui=' + (c.game.ui.active ? c.game.ui.active.constructor.name : 'none') + ' wins=' + G.save.wins + ' data=' + G.save.data + ' seen=' + Object.keys(G.save.seen).length + '/' + Object.keys(c.BESTIARY).length);
      return log;
    });
    for (const l of result) console.log('  ' + l);
    await shot('flow_end');
  },
  // 逐个打开界面截图
  async ui() {
    await ev(() => {
      const c = window.__cl, G = c.G;
      G.save.introSeen = true; G.save.tutorialDone = true;
      G.save.seen = { duli: 3, grad: 12, hopper: 5, weight: 2, cart: 1, orb: 4, crab: 2, cat: 1, tyrant: 1 };
      G.save.data = 64;
      c.game.ui.clear(); c.game.startRun(99);
      c.step(50);
      const run = G.run;
      run.weapons[0] = c.makeItem('wrench', 2, run.rng, 1);
      run.weapons[1] = c.makeItem('laserpen', 2, run.rng, 2);
      run.skill = c.makeItem('coil', 1, run.rng, 0);
      run.gold = 130; run.data = 17;
      run.addPerk('newton3'); run.addPerk('kepler'); run.addPerk('emc2');
      run.scrolls.force = 2; run.scrolls.vital = 1; run.recalc();
    });
    await step(10);
    const open = async (name, fn) => { await ev(fn); await step(20); await shot('ui_' + name); await ev(() => { window.__cl.game.ui.clear(); }); await step(5); };
    await open('pickup', () => { const c = window.__cl, w = c.G.world; const it = c.makeItem('pendulum', 3, c.G.run.rng, 2); const pk = w.pickups.find((o) => o.item) || { item: it, taken() {}, price: 0 }; pk.item = it; c.game.ui.push(new (c.game.ui.constructor.prototype.openPickup ? Object : Object)()); c.game.ui.clear(); c.game.ui.openPickup({ item: it, price: 0, taken() {}, group: null }); });
    await open('pickup_skill', () => { const c = window.__cl; const it = c.makeItem('catbox', 2, c.G.run.rng, 1); c.game.ui.openPickup({ item: it, price: 45, taken() {} }); });
    await open('scroll', () => { const c = window.__cl; c.game.ui.openScroll({ dead: false }); });
    await open('perks', () => { const c = window.__cl; c.game.ui.openPerks({ used: false }); });
    await open('shop', () => { const c = window.__cl, w = c.G.world; const v = w.props.find((o) => o.ensureStock); v.ensureStock(); c.game.ui.openShop(v); });
    await open('terminal', () => { const c = window.__cl; c.game.ui.openTerminal(); });
    await open('pause', () => { const c = window.__cl; c.game.ui.openPause(); });
    await open('settings', () => { const c = window.__cl; c.game.ui.openSettings(); });
    await open('help', () => { const c = window.__cl; c.game.ui.openHelp(); });
    await open('bestiary', () => { const c = window.__cl; c.game.ui.openBestiary(); });
    await open('death', () => { const c = window.__cl; c.game.ui.openResult(false, { stageName: '电磁实验室', kills: 37, time: 412, perks: 2, banked: 0, lost: 17, kept: 8, entropy: 0 }); });
    await ev(() => { const c = window.__cl; c.game.ui.openResult(true, { stageName: '对撞核心', kills: 142, time: 1260, perks: 5, banked: 96, lost: 0, kept: 0, entropy: 1 }); });
    await step(80); await shot('ui_win'); await ev(() => { window.__cl.game.ui.clear(); });
    await ev(() => { const c = window.__cl; c.game.ui.openIntro(() => {}); });
    await step(400); await shot('ui_intro'); await ev(() => { window.__cl.game.ui.clear(); });
  },
  // 连招逐帧特写：每 3 帧截一次玩家周围的画面
  async combat() {
    const weapon = process.env.WPN || 'wrench';
    await ev((wpn) => {
      const c = window.__cl, G = c.G;
      G.save.introSeen = true; G.save.tutorialDone = true;
      c.game.ui.clear(); c.game.startRun(5);
      c.step(60);
      const w = G.world, p = w.player;
      for (const e of w.enemies) e.dead = true;
      G.run.weapons[0] = c.makeItem(wpn, 1, G.run.rng, 0);
      G.run.hp = G.run.maxHp = 9999;
      p.x += 120; c.step(5);
      const e = c.spawn('grad', p.x + 34, p.y, { hpMul: 50 }); w.addEnemy(e);
      const e2 = c.spawn('hopper', p.x + 60, p.y, { hpMul: 50 }); w.addEnemy(e2);
      c.step(2);
    }, weapon);
    const box = await page.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); const c = window.__cl, w = c.G.world; const k = r.width / 640; return { x: r.left + (w.player.x - w.camera.vx - 60) * k, y: r.top + (w.player.y - w.camera.vy - 90) * k, width: 190 * k, height: 110 * k }; });
    const frames = [];
    await hold('atk1', true);
    for (let i = 0; i < 24; i++) {
      await step(3);
      if (i % 8 === 6) { await hold('atk1', false); await step(1); await hold('atk1', true); }
      frames.push(await page.screenshot({ clip: box }));
    }
    await hold('atk1', false);
    const fs = createRequire(import.meta.url)('node:fs');
    frames.forEach((b, i) => fs.writeFileSync(join(outDir, `combat_${String(i).padStart(2, '0')}.png`), b));
    console.log('combat frames', frames.length);
  },
  // 每件武器 / 技能出手时的特写
  async weapons() {
    const fs = createRequire(import.meta.url)('node:fs');
    const ids = await ev(() => Object.keys(window.__cl.ITEMS));
    for (const id of ids) {
      await ev((id) => {
        const c = window.__cl, G = c.G;
        G.save.introSeen = true; G.save.tutorialDone = true;
        c.game.ui.clear(); c.game.startRun(5); if (c.game.fade.cb) c.game.fade.cb(); c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
        c.game.loadStage(1); c.step(30);
        const w = G.world, p = w.player, run = G.run;
        w.props.length = 0; c.game.hud.banner = null;
        run.hp = run.maxHp = 9999;
        const def = c.ITEMS[id];
        const item = c.makeItem(id, 1, run.rng, 0);
        if (def.kind === 'skill') { run.skill = item; } else run.weapons[0] = item;
        p.x = 260; p.facing = 1; c.step(2);
        for (let i = 0; i < 3; i++) { const e = c.spawn('grad', p.x + 44 + i * 34, p.y, { hpMul: 200 }); e.ai = function () { this.vx = 0; this.facing = -1; }; e.kbResist = 1; w.addEnemy(e); }
      }, id);
      const def = await ev((id) => { const d = window.__cl.ITEMS[id]; return { kind: d.kind, type: d.type, auto: !!d.auto }; }, id);
      const act = def.kind === 'skill' ? 'skill' : 'atk1';
      const delays = def.kind === 'skill' ? [16, 50, 110] : def.type === 'charge' ? [40, 50, 56] : def.type === 'melee' ? [8, 22, 40] : [10, 24, 44];
      const box = await page.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); const c = window.__cl, w = c.G.world; const k = r.width / 640; return { x: r.left + (w.player.x - w.camera.vx - 50) * k, y: r.top + (w.player.y - w.camera.vy - 100) * k, width: 220 * k, height: 116 * k }; });
      let f = 0;
      for (let i = 0; i < delays.length; i++) {
        while (f < delays[i]) {
          const on = def.type === 'charge' ? f < 46 : (def.auto || def.type === 'spray') ? true : (f % 16) < 2;
          await hold(act, on); await step(1); f++;
        }
        fs.writeFileSync(join(outDir, `w_${id}_${i}.png`), await page.screenshot({ clip: box }));
      }
      await hold(act, false);
    }
    console.log('weapons shot', ids.length);
  },
  // 各种机关
  async hazards() {
    const fs = createRequire(import.meta.url)('node:fs');
    const list = [['mech', 0, 'pendulum', 'ceil'], ['mech', 0, 'crusher', 'ceil'], ['mech', 0, 'piston', 'floor'], ['em', 2, 'arc', 'ceil'], ['em', 2, 'laser', 'ceil'], ['thermo', 6, 'steam', 'ceil'], ['thermo', 6, 'flame', 'floor'], ['thermo', 6, 'icicle', 'ceil'], ['quantum', 8, 'beam', 'floor'], ['quantum', 8, 'beam', 'ceil']];
    let n = 0;
    for (const [biome, st, kind, mount] of list) {
      await ev(([st, kind, mount]) => {
        const c = window.__cl, G = c.G;
        G.save.introSeen = true; G.save.tutorialDone = true;
        c.game.ui.clear(); c.game.startRun(21); if (c.game.fade.cb) c.game.fade.cb(); c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
        c.game.loadStage(st); c.step(20);
        const w = G.world, p = w.player; c.game.hud.banner = null;
        G.run.hp = G.run.maxHp = 9999;
        for (const e of w.enemies) e.dead = true;
        const T = 24, tx = Math.floor(p.x / T) + 3;
        let ty = Math.floor((p.y - 30) / T); let cy = ty; while (!w.level.isSolid(tx, cy) && cy > 0) cy--;
        const s = { type: 'hazard', kind, mount, x: tx * T + 12, y: mount === 'ceil' ? (cy + 1) * T : p.y, phase: 0.55 };
        w.addHazard(c.makeHazard(s, w));
        p.x = tx * T - 40;
      }, [st, kind, mount]);
      const box = await page.evaluate(() => { const r = document.getElementById('game').getBoundingClientRect(); const c = window.__cl, w = c.G.world; const k = r.width / 640; return { x: r.left + Math.max(0, (w.player.x - w.camera.vx - 40)) * k, y: r.top, width: 230 * k, height: 360 * k }; });
      for (let i = 0; i < 3; i++) { await step(i === 0 ? 50 : 55); fs.writeFileSync(join(outDir, `hz_${String(n).padStart(2, '0')}_${kind}_${i}.png`), await page.screenshot({ clip: box })); }
      n++;
    }
    console.log('hazards shot', n);
  },
  // 门框 / 大地图 / 首领房布景
  async polish() {
    await ev(() => {
      const c = window.__cl, G = c.G;
      G.save.introSeen = true; G.save.tutorialDone = true;
      c.game.ui.clear(); c.game.startRun(31); if (c.game.fade.cb) c.game.fade.cb(); c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0;
      c.game.loadStage(0); c.step(20); c.game.hud.banner = null;
      const w = G.world, p = w.player; G.run.hp = G.run.maxHp = 9999;
      for (const e of w.enemies) e.dead = true;
      // 走到第一个门口
      const room = w.level.rooms.find((r) => r.type === 'start');
      const right = room.open.R;
      p.x = (room.x * 26 + (right ? 23 : 2)) * 24; p.y = (room.y * 15 + 14) * 24; c.step(30);
      // 把整张地图标记为已探索，方便看大地图
    });
    await shot('polish_door');
    await ev(() => { const c = window.__cl, w = c.G.world, lv = w.level; const cam = w.camera; for (let cy = 0; cy < lv.h * 24; cy += 300) for (let cx = 0; cx < lv.w * 24; cx += 500) { cam.x = cx; cam.y = cy; w.reveal(); } c.input.simulate('map', true); c.step(3); });
    await shot('polish_map');
    await ev(() => { window.__cl.input.simulate('map', false); });
    for (const [name, st] of [['tyrant', 4], ['singularity', 10]]) {
      await ev((st) => { const c = window.__cl; c.game.loadStage(st); c.G.run.hp = c.G.run.maxHp = 99999; c.step(150); c.game.hud.banner = null; c.step(2); }, st);
      await shot('polish_' + name);
    }
  },
  // 死亡 -> 结算 -> 再来一局 / 回标题；暂停菜单；放弃
  async death() {
    const log = await page.evaluate(() => {
      const c = window.__cl, G = c.G, input = c.input, out = [];
      const tap = (act, hold = 2, after = 2) => { input.simulate(act, true); c.step(hold); input.simulate(act, false); c.step(after); };
      G.save.introSeen = true; G.save.tutorialDone = true; G.save.unlocks = { recycle: true };
      c.game.ui.clear(); c.game.startRun(77); c.step(60);
      let w = G.world, p = w.player;
      G.run.data = 21; G.run.hp = 5;
      const e = c.spawn('duli', p.x + 60, p.y, {}); e.aggro = true; w.addEnemy(e);
      let n = 0; while (!p.dead && n++ < 900) c.step(1);
      out.push('player dead after frames: ' + n + ' state=' + p.state);
      c.step(200);
      out.push('ui after death: ' + (c.game.ui.active ? c.game.ui.active.constructor.name : 'none') + ' deaths=' + G.save.deaths + ' data(saved)=' + G.save.data);
      return out;
    });
    for (const l of log) console.log('  ' + l);
    await step(60); await shot('death_result');
    const log2 = await page.evaluate(() => {
      const c = window.__cl, G = c.G, input = c.input, out = [];
      const tap = (act, hold = 2, after = 2) => { input.simulate(act, true); c.step(hold); input.simulate(act, false); c.step(after); };
      tap('confirm'); c.step(90);
      out.push('after retry: run=' + !!G.run + ' stage=' + (G.run && G.run.stage) + ' hp=' + (G.run && G.run.hp) + ' ui=' + (c.game.ui.active ? c.game.ui.active.constructor.name : 'none') + ' world=' + !!G.world);
      // 暂停 -> 继续
      tap('pause'); c.step(5);
      out.push('pause ui: ' + (c.game.ui.active ? c.game.ui.active.constructor.name : 'none'));
      const t0 = G.world.time; c.step(30); out.push('world paused: ' + (G.world.time === t0));
      tap('pause'); c.step(5);
      out.push('after resume ui: ' + (c.game.ui.active ? c.game.ui.active.constructor.name : 'none'));
      // 暂停 -> 放弃本局
      tap('pause'); c.step(5);
      for (let i = 0; i < 5; i++) tap('down');
      tap('confirm'); c.step(3);       // 第一次：提示「再按一次：确认放弃」
      out.push('abandon armed: run=' + !!G.run + ' cp=' + !!c.game.runSave);
      tap('confirm'); c.step(90);
      out.push('after abandon: cp=' + !!c.game.runSave);
      out.push('after abandon: run=' + !!G.run + ' ui=' + (c.game.ui.active ? c.game.ui.active.constructor.name : 'none'));
      // 标题 -> 开始
      tap('confirm'); c.step(90);
      out.push('after start from title: run=' + !!G.run + ' ui=' + (c.game.ui.active ? c.game.ui.active.constructor.name : 'none') + ' runs=' + G.save.runs);
      return out;
    });
    for (const l of log2) console.log('  ' + l);
  },
  async rest() {
    await ev(() => {
      const c = window.__cl;
      c.G.save.introSeen = true;
      if (!c.G.run) c.game.startRun(777);
      c.game.fade.cb = null; c.game.fade.a = 0; c.game.fade.target = 0; c.game.ui.clear();
      c.game.loadStage(1);
    });
    await step(60); await shot('rest');
  },
};

for (const s of scenes.length ? scenes : ['title', 'start', 'run']) {
  if (!S[s]) { console.log('unknown scene', s); continue; }
  try { await S[s](); } catch (e) { errors.push('scene ' + s + ': ' + e.message); }
}
if (errors.length) { console.log('--- errors (' + errors.length + ')'); for (const e of errors.slice(0, 20)) console.log(e); }
else console.log('no console errors');
await browser.close();
