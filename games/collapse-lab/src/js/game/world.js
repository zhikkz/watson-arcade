// 世界：一个关卡实例里的全部实体与规则（更新、伤害结算、掉落、交互、渲染）
import { W, H, TILE, COLORS, T_ACID } from '../core/config.js';
import { input } from '../core/input.js';
import { touch } from '../core/touch.js';
import { audio } from '../core/audio.js';
import { rnd, rndInt, sign, clamp, rectsOverlap } from '../core/util.js';
import { drawText } from '../core/font.js';
import { G } from './state.js';
import { FX } from './fx.js';
import { Camera } from './camera.js';
import { Lighting, drawGlow } from './lighting.js';
import { Player } from './player.js';
import { Projectile, inRadius } from './projectiles.js';
import { Field, Orbit } from './summons.js';
import { spawnEnemy } from './enemy.js';
import { hasAffix } from './items.js';
import { BIOMES } from './biomes.js';
import { Coin, DataOrb, Food, ItemPickup, ScrollPickup, Crate, Chest, Vending, ExitDoor, Dispenser, Blackboard, Terminal, Spring, Sign, starterChoices } from './props.js';
import { makeHazard } from './hazards.js';
import { drawBackdrop } from './backdrop.js';

export class World {
  constructor(game, level, stageDef) {
    this.game = game; this.level = level; this.stageDef = stageDef;
    this.run = G.run;
    this.biome = BIOMES[level.biome];
    this.player = new Player(level.start.x, level.start.y);
    this.player.world = this;
    this.enemies = []; this.projs = []; this.actors = []; this.pickups = []; this.props = []; this.hazards = [];
    this.fx = new FX();
    this.camera = new Camera(level);
    this.lighting = new Lighting();
    this.time = 0; this.hitstopT = 0; this.slowT = 0; this.slowK = 1;
    this.flash = null;
    this.inputLocked = false; this.cutscene = false;
    this.safeX = level.start.x; this.safeY = level.start.y;
    this.interactTarget = null;
    this.boss = null; this.bossIntroT = 0;
    this.deathT = -1;
    this.exits = [];
    this.kills = 0; this.total = 0;
    this.explored = new Uint8Array(level.w * level.h);
    this.mini = document.createElement('canvas');
    this.mini.width = level.w; this.mini.height = level.h;
    this.miniCtx = this.mini.getContext('2d');
    this.spawnAll();
    this.camera.snap(this.player.x, this.player.y);
    this.player.setState('enter');
    this.reveal();
  }

  // ---------------------------------------------------------------- 生成
  spawnAll() {
    const run = this.run, lv = this.level;
    let pedestals = null;
    for (const s of lv.spawns) {
      switch (s.type) {
        case 'enemy': { const e = spawnEnemy(s.id, s.x, s.y, { elite: s.elite, ceil: s.ceil }); if (e) { this.addEnemy(e); this.total++; } break; }
        case 'boss': { const e = spawnEnemy(s.id, s.x, s.y, {}); if (e) { this.addEnemy(e); this.boss = e; } break; }
        case 'crate': this.addProp(new Crate(s.x, s.y)); break;
        case 'chest': this.addProp(new Chest(s.x, s.y)); break;
        case 'scroll': this.addPickup(new ScrollPickup(s.x, s.y)); break;
        case 'vending': this.addProp(new Vending(s.x, s.y)); break;
        case 'exit': { const d = new ExitDoor(s.x, s.y, s.locked); this.addProp(d); this.exits.push(d); break; }
        case 'dispenser': this.addProp(new Dispenser(s.x, s.y)); break;
        case 'blackboard': this.addProp(new Blackboard(s.x, s.y)); break;
        case 'terminal': this.addProp(new Terminal(s.x, s.y)); break;
        case 'spring': this.addProp(new Spring(s.x, s.y)); break;
        case 'pedestal': {
          if (run.stage === 0) {
            if (!pedestals) pedestals = starterChoices(run);
            const item = pedestals.shift();
            if (item) this.addPickup(new ItemPickup(s.x, s.y, item, { group: 'starter' }));
          }
          break;
        }
        case 'hazard': case 'mover': { const h = makeHazard(s, this); if (h) this.addHazard(h); break; }
        default: break;
      }
    }
    // 第一关的操作提示
    if (run.stage === 0 && !G.save.tutorialDone) {
      const sx = lv.start.x, sy = lv.start.y;
      const room = (lv.rooms || []).find((r) => r.type === 'start');
      const d = room && sx > (room.x * 26 + 13) * TILE ? -1 : 1;     // 起点房可能被镜像
      // 触屏有单独的说法：按键就画在屏幕上，直接说位置和图标
      this.addProp(new Sign(sx + d * 30, sy, (k, t) => (t
        ? (touch.fixed ? '左下角的摇杆：按住往左右推就能移动' : '左手在屏幕左半边按住拖动：移动') + '\n右下大键攻击　「跳」可二段跳　「滚」无敌翻滚'
        : `${k('left')}/${k('right')} 移动   ${k('jump')} 跳跃（空中可再跳一次）\n${k('atk1')} 攻击   ${k('roll')} 翻滚（无敌，可穿过敌人）`)));
      this.addProp(new Sign(sx + d * 250, sy, (k, t) => (t
        ? '装备二选一：靠近后点右侧出现的「互动」查看\n黄键副武器　紫键技能　白色小键喝保温杯回血'
        : `装备二选一：靠近按 ${k('interact')} 查看\n${k('atk2')} 副武器   ${k('skill')} 技能   ${k('heal')} 喝保温杯回血`)));
      this.addProp(new Sign(sx + d * 420, sy, (k, t) => (t
        ? '摇杆向下 + 跳：从平台下跳；空中则是下砸\n朝墙边跳可以攀上去'
        : `${k('down')}+${k('jump')}：从平台下跳；空中则是下砸\n朝墙边跳可以攀上去`)));
    }
  }

  addEnemy(e) { e.world = this; this.enemies.push(e); return e; }
  addActor(a) { a.world = this; this.actors.push(a); return a; }
  addPickup(p) { p.world = this; this.pickups.push(p); return p; }
  addProp(p) { p.world = this; this.props.push(p); return p; }
  addHazard(h) { h.world = this; this.hazards.push(h); if (h.isMover) this.level.movers.push(h); return h; }
  spawnProj(o) { const p = new Projectile(o); p.world = this; this.projs.push(p); return p; }
  spawnOrbit(player) { const n = this.actors.filter((a) => a instanceof Orbit && !a.dead).length; return this.addActor(new Orbit(player, this.run.dmg('skill', 9 + 3 * this.run.depth), n * 2.09)); }

  // ---------------------------------------------------------------- 查询
  enemiesInRadius(x, y, r) {
    const out = [];
    for (const e of this.enemies) if (!e.dead && !e.untargetable && inRadius(x, y, r, e)) out.push(e);
    return out;
  }
  nearestEnemy(x, y, range, needLos, exclude) {
    let best = null, bd = range * range;
    for (const e of this.enemies) {
      if (e.dead || e.untargetable || e === exclude || (exclude instanceof Set && exclude.has(e))) continue;
      const d = (e.x - x) * (e.x - x) + (e.cy - y) * (e.cy - y);
      if (d >= bd) continue;
      if (needLos && !this.level.los(x, y, e.x, e.cy)) continue;
      best = e; bd = d;
    }
    return best;
  }

  // ---------------------------------------------------------------- 战斗结算
  hitEnemy(e, dmg, info = {}) {
    if (e.dead) return 0;
    const run = this.run, p = this.player;
    if (info.src !== 'dot') dmg *= run.hitMul(p, e, info);
    const crit = !!info.crit;
    if (crit) dmg *= 2;
    dmg = Math.max(1, Math.round(dmg));
    const dealt = e.takeDamage(dmg, info);
    if (dealt <= 0) {
      if (!info.quiet && info.src !== 'dot') this.fx.text(e.x, e.y - e.h - 6, '免疫', '#9aa0b4', { size: 8 });
      return 0;
    }
    if (info.effects) e.applyEffects(info.effects);
    const hx = info.x === undefined ? e.x : info.x, hy = info.y === undefined ? e.cy : info.y;
    const shown = Math.round(dealt);
    if (info.src === 'dot') this.fx.text(e.x, e.y - e.h - 4, shown, info.color || '#ffb060', { size: 8, life: 0.5 });
    else {
      this.fx.text(e.x, e.y - e.h - 6, crit ? shown + '!' : shown, crit ? COLORS.crit : '#ffffff', { size: crit ? 12 : 10, big: crit });
      if (!info.quiet) {
        this.fx.sparks(hx, hy, crit ? '#ffe14a' : '#ffffff', crit ? 9 : 5);
        audio.sfx(crit ? 'crit' : info.heavy ? 'hitHeavy' : 'hit');
        this.hitstop((info.stop === undefined ? 0.03 : info.stop) + (crit ? 0.03 : 0));
        this.shake((info.shake === undefined ? 1.5 : info.shake) + (crit ? 1.5 : 0), 0.12);
      }
    }
    run.onHit(p, e, dealt, info);
    return dealt;
  }

  onEnemyKilled(e, info) {
    const run = this.run, p = this.player;
    this.kills++;
    G.save.seen[e.id] = (G.save.seen[e.id] || 0) + 1;
    run.onKill(p, e, info);
    if (!e.minion) {
      const loot = 1 + run.stat('loot');
      const def = e.def;
      if (def.gold) {
        let g = rndInt(def.gold[0], def.gold[1]) * (1 + 0.3 * run.depth) * loot * (e.elite ? 3 : 1);
        if (info.item && hasAffix(info.item, 'rich')) g *= 1.6;
        this.dropGold(e.x, e.cy, Math.round(g));
      }
      if (def.data) this.dropData(e.x, e.cy, Math.round(def.data * loot * (e.elite ? 2.5 : 1)));
      if (Math.random() < (e.elite ? 0.3 : 0.035)) this.addPickup(new Food(e.x, e.cy));
      if (e.elite && Math.random() < 0.45) {
        this.addPickup(new ItemPickup(e.x, e.cy, this.game.rollDrop(1), { pop: true }));
      }
    }
    if (info.item) {
      if (hasAffix(info.item, 'vamp')) run.heal(3, p);
      if (hasAffix(info.item, 'boom')) this.explode(e.x, e.cy, 42, run.dmg('skill', 14 + 5 * run.depth), { src: 'perk' });
    }
    if (e === this.boss) this.onBossDefeated(e);
  }

  onBossDefeated(e) {
    this.boss = null;
    this.slowmo(1.2, 0.25);
    this.shake(8, 0.6);
    this.flashScreen('#ffffff', 0.8, 0.5);
    for (const en of this.enemies) if (!en.dead && en !== e) { en.minion = true; en.die({}); }
    for (const pr of this.projs) if (pr.owner === 'enemy') pr.dead = true;
    this.dropGold(e.x, e.cy, 120 + 60 * this.run.depth);
    this.dropData(e.x, e.cy, 14 + 4 * this.run.depth);
    this.addPickup(new ItemPickup(e.x - 20, e.cy, this.game.rollDrop(2), { pop: true }));
    this.addPickup(new ScrollPickup(e.x + 20, e.cy));
    for (const d of this.exits) d.unlock();
    audio.music(null);
    this.game.onBossDefeated(e);
  }

  dropGold(x, y, amount) {
    if (amount <= 0) return;
    const n = clamp(Math.ceil(amount / 6), 1, 8);
    let left = amount;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.max(1, Math.round(amount / n));
      left -= v;
      if (v > 0) this.addPickup(new Coin(x + rnd(-4, 4), y, v));
    }
  }
  dropData(x, y, amount) { for (let i = 0; i < amount; i++) this.addPickup(new DataOrb(x + rnd(-6, 6), y + rnd(-6, 6), 1)); }

  explode(x, y, r, dmg, o = {}) {
    const owner = o.owner || 'player';
    const color = o.color || '#ffd070';
    this.fx.ring(x, y, color, 4, r, 0.28, 2);
    this.fx.ring(x, y, '#ffffff', 2, r * 0.7, 0.2, 1);
    this.fx.burst(x, y, 16, { color: [color, '#ffffff'], speed: 60, speedMax: 220, life: 0.25, lifeMax: 0.55, grav: 120, light: 1 });
    this.fx.smoke(x, y, 6);
    this.shake(Math.min(7, r / 12), 0.22);
    audio.sfx(o.sfx || 'explode');
    if (owner === 'player') {
      for (const e of this.enemiesInRadius(x, y, r)) {
        this.hitEnemy(e, dmg, { src: o.src || 'skill', effects: o.effects, kbx: sign(e.x - x) * 190, kby: -150, item: o.item, x: e.x, y: e.cy, quiet: true, heavy: true });
      }
      this.breakCratesInRect(x - r, y - r, r * 2, r * 2);
    } else {
      const p = this.player;
      if (inRadius(x, y, r, p)) p.hurt(dmg, { x, burn: o.burn, chill: o.chill });
    }
    if (o.field) {
      const gy = this.level.groundBelow(x, y - 8, 6);
      this.addActor(new Field(x, gy === null ? y : gy, r * 0.8, o.field, owner === 'player' ? dmg * 0.25 : dmg * 0.5, { owner, type: o.fieldType || 'shock', effects: o.effects, src: 'dot' }));
    }
  }

  chainLightning(x, y, dmg, jumps, from) {
    const visited = new Set();
    if (from) visited.add(from);
    let cx = x, cy = y;
    for (let i = 0; i < jumps; i++) {
      const e = this.nearestEnemy(cx, cy, 120, false, visited);
      if (!e) break;
      visited.add(e);
      this.fx.bolt(cx, cy, e.x, e.cy, '#bfe9ff', 0.16, 6);
      this.hitEnemy(e, dmg, { src: 'perk', effects: { shock: 2 }, quiet: true, x: e.x, y: e.cy });
      cx = e.x; cy = e.cy;
    }
    if (visited.size > (from ? 1 : 0)) audio.sfx('zap');
  }

  breakCratesInRect(x, y, w, h) {
    for (const p of this.props) if (p.breakable && !p.dead && rectsOverlap(x, y, w, h, p.x - p.w / 2, p.y - p.h, p.w, p.h)) p.break();
  }

  /** 近战挥击弹反敌方子弹 */
  reflectProjectiles(x, y, w, h, player) {
    for (const pr of this.projs) {
      if (pr.dead || pr.owner !== 'enemy' || pr.noReflect) continue;
      if (pr.x < x - pr.r || pr.x > x + w + pr.r || pr.y < y - pr.r || pr.y > y + h + pr.r) continue;
      pr.owner = 'player'; pr.src = 'ranged';
      pr.vx = -pr.vx * 1.2; pr.vy = -pr.vy * 0.6 - 20;
      if (Math.abs(pr.vx) < 80) pr.vx = player.facing * 260;
      pr.dmg = this.run.dmg('ranged', pr.dmg * 1.5 + 6);
      pr.homing = 0; pr.life = Math.max(pr.life, 1); pr.hitSet.clear();
      pr.explode = null;
      this.fx.sparks(pr.x, pr.y, '#ffffff', 6);
      this.fx.text(pr.x, pr.y - 10, '弹反', '#bfe9ff', { size: 8 });
      audio.sfx('block');
    }
  }

  hitstop(t) { if (t > 0) this.hitstopT = Math.min(0.12, Math.max(this.hitstopT, t)); }
  shake(mag, dur) { if (G.save.settings.shake && mag > 0) this.camera.shake(mag, dur); }
  flashScreen(color, alpha, dur, edge = false) { if (G.save.settings.flash) this.flash = { color, alpha, t: dur, max: dur, edge }; }
  slowmo(dur, k) { this.slowT = dur; this.slowK = k; }

  onPlayerDeath() { this.deathT = 0; this.slowmo(1.0, 0.3); }

  // ---------------------------------------------------------------- 更新
  update(dt) {
    const p = this.player, lv = this.level;
    if (this.flash) { this.flash.t -= dt; if (this.flash.t <= 0) this.flash = null; }
    if (this.hitstopT > 0) { this.hitstopT -= dt; this.camera.update(dt, p, G.save.settings.shake); return; }
    this.time += dt;
    let edt = dt;
    if (this.slowT > 0) { this.slowT -= dt; edt = dt * this.slowK; }
    lv.phaseOn = (this.time % 3.6) < 2.3;

    for (const h of this.hazards) if (h.isMover) h.update(edt);
    p.update(this.deathT >= 0 ? edt : dt);
    p.animate(dt);

    const ax = p.x, ay = p.y;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!e.boss && !e.aggro && (Math.abs(e.x - ax) > 560 || Math.abs(e.y - ay) > 340)) continue;
      e.update(edt);
    }
    for (const pr of this.projs) if (!pr.dead) pr.update(pr.owner === 'player' ? dt : edt);
    for (const a of this.actors) if (!a.dead) a.update(dt);
    for (const h of this.hazards) if (!h.isMover && !h.dead) h.update(edt);
    for (const k of this.pickups) if (!k.dead) k.update(dt);
    for (const k of this.props) if (!k.dead) k.update(dt);

    this.enemies = this.enemies.filter((e) => !e.dead);
    this.projs = this.projs.filter((e) => !e.dead);
    this.actors = this.actors.filter((e) => !e.dead);
    this.pickups = this.pickups.filter((e) => !e.dead);
    this.props = this.props.filter((e) => !e.dead);
    this.hazards = this.hazards.filter((e) => !e.dead);
    if (lv.movers.length) lv.movers = lv.movers.filter((m) => !m.dead);

    this.fx.update(dt);
    this.camera.update(dt, p, G.save.settings.shake);
    this.updateInteract();
    this.reveal();
    this.acidFx(dt);

    if (this.deathT >= 0) {
      this.deathT += dt;
      if (this.deathT > 1.9 && !this.deathSent) { this.deathSent = true; this.game.onDeath(); }
    }
  }

  updateInteract() {
    const p = this.player;
    let best = null, bd = 1e9;
    if (!p.dead && !this.inputLocked && (p.state === 'normal' || p.state === 'heal')) {
      for (const list of [this.pickups, this.props]) for (const o of list) {
        if (!o.interactive || o.dead) continue;
        if (!o.near(p)) continue;
        const d = Math.abs(o.x - p.x);
        if (d < bd) { bd = d; best = o; }
      }
    }
    this.interactTarget = best;
    if (best && input.pressed('interact')) { input.consume('interact'); best.interact(p); }
  }

  reveal() {
    const lv = this.level;
    const cam = this.camera;
    const tx0 = Math.max(0, Math.floor(cam.x / TILE) + 1), tx1 = Math.min(lv.w - 1, Math.floor((cam.x + W) / TILE) - 1);
    const ty0 = Math.max(0, Math.floor(cam.y / TILE) + 1), ty1 = Math.min(lv.h - 1, Math.floor((cam.y + H) / TILE) - 1);
    const g = this.miniCtx;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * lv.w + tx;
      if (this.explored[i]) continue;
      this.explored[i] = 1;
      const t = lv.tiles[i];
      if (t === 1 || t === 4) {
        // 只画与空气相邻的墙体轮廓
        if (!lv.isSolid(tx - 1, ty) || !lv.isSolid(tx + 1, ty) || !lv.isSolid(tx, ty - 1) || !lv.isSolid(tx, ty + 1)) { g.fillStyle = '#9aa4c8'; g.fillRect(tx, ty, 1, 1); }
      } else if (t === 2 || t === 6) { g.fillStyle = '#6a7399'; g.fillRect(tx, ty, 1, 1); } else if (t === 3 || t === 5) { g.fillStyle = '#b05a5a'; g.fillRect(tx, ty, 1, 1); } else if (lv.back[i]) { g.fillStyle = '#2c3350'; g.fillRect(tx, ty, 1, 1); }
    }
  }

  acidFx(dt) {
    // 液体表面偶尔冒泡
    const lv = this.level, B = this.biome;
    if (!B.liquid || Math.random() > 0.3) return;
    const tx = Math.floor((this.camera.x + rnd(0, W)) / TILE), ty = Math.floor((this.camera.y + rnd(0, H)) / TILE);
    if (lv.get(tx, ty) === T_ACID && lv.get(tx, ty - 1) !== T_ACID) {
      this.fx.burst(tx * TILE + rnd(2, 22), ty * TILE + 8, 1, { color: B.liquidColor, speed: 6, speedMax: 26, angle: -Math.PI / 2, spread: 0.6, grav: 60, life: 0.3, lifeMax: 0.7, light: 1 });
    }
    void dt;
  }

  // ---------------------------------------------------------------- 绘制
  draw(ctx) {
    const cam = this.camera, lv = this.level, p = this.player;
    const cx = cam.vx, cy = cam.vy;
    drawBackdrop(ctx, lv.biome, cx, cy, this.time);
    lv.drawLayer(ctx, cx, cy, false);
    this.drawLiquid(ctx, cx, cy);
    for (const h of this.hazards) if (h.drawBack) h.drawBack(ctx, cx, cy);
    for (const k of this.props) k.draw(ctx, cx, cy);
    for (const h of this.hazards) if (!h.emissive) h.draw(ctx, cx, cy);
    for (const k of this.pickups) k.draw(ctx, cx, cy);
    this.fx.drawBack(ctx, cx, cy);
    for (const a of this.actors) a.draw(ctx, cx, cy);
    for (const e of this.enemies) if (e.x > cx - 80 && e.x < cx + W + 80 && e.y > cy - 60 && e.y < cy + H + 120) e.draw(ctx, cx, cy);
    p.draw(ctx, cx, cy);
    lv.drawLayer(ctx, cx, cy, true);

    // 光照
    const L = this.lighting;
    L.begin(this.biome.ambient);
    for (const l of lv.lights) {
      const k = l.flicker ? (Math.sin(this.time * 9 * l.flicker) > -0.82 ? 1 : 0.35) : 1;
      L.add(l.x - cx, l.y - cy, l.r, l.color, 0.95 * k);
    }
    L.add(p.x - cx, p.cy - cy, 84, '#dfe6ff', 0.55);
    for (const e of this.enemies) if (e.def.glow) L.add(e.x - cx, e.cy - cy, e.def.glow[0], e.def.glow[1], 0.7);
    for (const pr of this.projs) if (pr.light) L.add(pr.x - cx, pr.y - cy, 30, pr.light, 0.7);
    for (const a of this.actors) if (a.light) L.add(a.x - cx, a.y - cy, a.lightR || 30, a.light, 0.7);
    for (const k of this.pickups) if (k.light) L.add(k.x - cx, k.y - 8 - cy, k.lightR || 24, k.light, 0.6);
    for (const k of this.props) if (k.light) L.add(k.x - cx, k.y - k.h / 2 - cy, k.lightR || 30, k.light, 0.6);
    for (const h of this.hazards) if (h.addLights) h.addLights(L, cx, cy);
    this.fx.forEachLight((x, y, r, c, a) => L.add(x - cx, y - cy, r, c, a));
    L.render(ctx);

    // 发光体在光照之后绘制，保持明亮
    for (const l of lv.lights) drawGlow(ctx, l.x - cx, l.y - cy - 4, 20, l.color, 0.35);
    for (const h of this.hazards) if (h.emissive) h.draw(ctx, cx, cy);
    for (const pr of this.projs) pr.draw(ctx, cx, cy);
    this.fx.draw(ctx, cx, cy);
    for (const k of this.props) if (k.drawOverlay) k.drawOverlay(ctx, cx, cy);
    this.fx.drawTexts(ctx, cx, cy);
    this.drawPrompt(ctx, cx, cy);

    if (this.flash) {
      const a = this.flash.alpha * (this.flash.t / this.flash.max);
      ctx.fillStyle = this.flash.color;
      if (this.flash.edge) {
        // 只染四周：分几层向内变淡
        for (let i = 0; i < 5; i++) {
          ctx.globalAlpha = a * (1 - i / 5) * 0.55;
          const m = i * 9;
          ctx.fillRect(0, m, W, 9); ctx.fillRect(0, H - m - 9, W, 9);
          ctx.fillRect(m, 0, 12, H); ctx.fillRect(W - m - 12, 0, 12, H);
        }
      } else { ctx.globalAlpha = a; ctx.fillRect(0, 0, W, H); }
      ctx.globalAlpha = 1;
    }
  }

  drawLiquid(ctx, cx, cy) {
    const lv = this.level, B = this.biome;
    if (!B.liquid && !lv.hasPhase) return;
    const col = B.liquidColor || ['#000', '#000', '#000'];
    const tx0 = Math.floor(cx / TILE), tx1 = Math.floor((cx + W) / TILE), ty0 = Math.floor(cy / TILE), ty1 = Math.floor((cy + H) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const tt = lv.get(tx, ty);
      if (tt === 6) { this.drawPhaseTile(ctx, tx * TILE - cx, ty * TILE - cy, tx); continue; }
      if (tt !== T_ACID) continue;
      const x = tx * TILE - cx, y = ty * TILE - cy;
      const top = lv.get(tx, ty - 1) !== T_ACID;
      ctx.fillStyle = col[0];
      ctx.fillRect(x, y + (top ? 8 : 0), TILE, TILE - (top ? 8 : 0));
      if (top) {
        ctx.fillStyle = col[1];
        for (let i = 0; i < TILE; i += 2) {
          const wv = Math.round(Math.sin(this.time * 3 + (tx * TILE + i) * 0.2) * 1.5);
          ctx.fillRect(x + i, y + 7 + wv, 2, 2);
        }
        ctx.fillStyle = col[2];
        const bx = (Math.floor(this.time * 8) + tx * 7) % TILE;
        ctx.fillRect(x + bx, y + 9, 2, 1);
      }
    }
  }

  drawPhaseTile(ctx, x, y, tx) {
    const on = this.level.phaseOn;
    const ph = this.time % 3.6;
    const warn = on && ph > 1.8;            // 即将消失：闪烁
    if (on && !(warn && Math.floor(this.time * 12) % 2)) {
      ctx.fillStyle = '#14101a'; ctx.fillRect(x, y, TILE, 6);
      ctx.fillStyle = '#3c6a78'; ctx.fillRect(x, y, TILE, 5);
      ctx.fillStyle = '#7dffd8'; ctx.fillRect(x + 2, y + 2, TILE - 4, 1);
      ctx.fillStyle = '#c8fff0'; ctx.fillRect(x + ((tx * 7 + Math.floor(this.time * 10)) % 20) + 2, y + 2, 2, 1);
    } else {
      ctx.globalAlpha = on ? 0.5 : 0.28;
      ctx.fillStyle = '#7dffd8';
      for (let i = 0; i < TILE; i += 4) { ctx.fillRect(x + i, y, 2, 1); ctx.fillRect(x + i + 2, y + 4, 2, 1); }
      ctx.globalAlpha = 1;
    }
  }

  drawPrompt(ctx, cx, cy) {
    const o = this.interactTarget;
    if (!o) return;
    const x = Math.round(o.x - cx), y = Math.round(o.y - cy - o.h - 16);
    const key = G.game.keyLabel('interact');
    const label = `{y}[${key}]{/} ${o.prompt}`;
    drawText(ctx, label, clamp(x, 80, W - 80), Math.max(4, y), { size: 12, color: '#ffffff', align: 'center', outline: '#14101a' });
  }
}
