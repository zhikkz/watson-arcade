// 拾取物与可交互物件
import { GRAVITY, TILE, COLORS, W } from '../core/config.js';
import { audio } from '../core/audio.js';
import { rnd, sign, approach, rndInt } from '../core/util.js';
import { drawSprite, hasSprite, drawSil } from '../core/assets.js';
import { drawText } from '../core/font.js';
import { input, keyHint } from '../core/input.js';
import { G } from './state.js';
import { ITEMS, itemColor, itemTitle, rollItem, makeItem, unlockedItems } from './items.js';
import { pxDisc } from './fx.js';

function spr(ctx, name, x, y, flip, fallback) {
  if (hasSprite(name)) drawSprite(ctx, name, x, y, flip);
  else fallback();
}

class Thing {
  constructor(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.w = 10; this.h = 10; this.dead = false; this.world = null; this.t = rnd(0, 6); this.age = 0; this.onGround = false; }
  get cy() { return this.y - this.h / 2; }
  near(p, rx = 22, ry = 30) { return Math.abs(p.x - this.x) < rx && Math.abs(p.cy - this.cy) < ry; }
  fall(dt, bounce = 0.35) {
    this.vy = Math.min(520, this.vy + GRAVITY * 0.8 * dt);
    const vy0 = this.vy;
    this.world.level.moveBody(this, dt);
    if (this.onGround) {
      if (vy0 > 120 && bounce) { this.vy = -vy0 * bounce; this.onGround = false; }
      this.vx = approach(this.vx, 0, 500 * dt);
    }
    if (this.hitWall) this.vx = -this.vx * 0.5;
  }
  update(dt) { this.t += dt; this.age += dt; }
  draw() {}
}

// ---------------------------------------------------------------- 拾取物
export class Coin extends Thing {
  constructor(x, y, value) { super(x, y); this.value = value; this.w = 6; this.h = 6; this.vx = rnd(-90, 90); this.vy = rnd(-260, -140); this.delay = 0.35; }
  update(dt) {
    super.update(dt);
    const p = this.world.player;
    this.delay -= dt;
    const dx = p.x - this.x, dy = p.cy - this.cy, d = Math.hypot(dx, dy);
    if (this.delay <= 0 && d < 52 && !p.dead) {
      this.vx += dx / d * 1400 * dt; this.vy += dy / d * 1400 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (d < 12) { this.dead = true; G.run.gold += this.value; audio.sfx('gold', { gap: 0.04 }); this.world.fx.text(this.x, this.y - 10, '+' + this.value, COLORS.gold, { size: 8, life: 0.5 }); }
    } else this.fall(dt, 0.45);
    if (this.age > 40) this.dead = true;
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    const f = Math.floor(this.t * 10) % 4;
    spr(ctx, 'fx/coin/' + f, x, y, false, () => { ctx.fillStyle = '#ffd24a'; ctx.fillRect(x - 2, y - 5, f % 2 ? 2 : 4, 5); });
  }
}

export class DataOrb extends Thing {
  constructor(x, y, value) { super(x, y); this.value = value; this.vx = rnd(-110, 110); this.vy = rnd(-200, -60); this.light = '#62e6ff'; this.lightR = 18; }
  update(dt) {
    super.update(dt);
    const p = this.world.player;
    const dx = p.x - this.x, dy = p.cy - this.y, d = Math.hypot(dx, dy) || 1;
    if (this.age > 0.45 && !p.dead) {
      const sp = Math.min(520, 120 + (this.age - 0.45) * 700);
      this.vx = approach(this.vx, dx / d * sp, 2600 * dt); this.vy = approach(this.vy, dy / d * sp, 2600 * dt);
    } else { this.vx *= 0.94; this.vy *= 0.94; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (d < 12 && !p.dead) { this.dead = true; G.run.data += this.value; audio.sfx('data', { gap: 0.03 }); this.world.fx.text(p.x, p.y - 62, '+' + this.value, COLORS.data, { size: 8, life: 0.5 }); }
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    pxDisc(ctx, x, y, 2, '#62e6ff');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 1, 1, 2);
    if (Math.floor(this.t * 14) % 2) { ctx.fillStyle = '#62e6ff'; ctx.fillRect(x - 4, y, 1, 1); ctx.fillRect(x + 3, y, 1, 1); ctx.fillRect(x, y - 4, 1, 1); ctx.fillRect(x, y + 3, 1, 1); }
  }
}

export class Food extends Thing {
  constructor(x, y) { super(x, y); this.vx = rnd(-50, 50); this.vy = -180; this.w = 10; this.h = 10; }
  update(dt) {
    super.update(dt);
    this.fall(dt, 0.3);
    const p = this.world.player, run = G.run;
    if (this.age > 0.5 && this.near(p, 14, 28) && run.hp < run.maxHp && !p.dead) {
      this.dead = true;
      run.heal(Math.round(run.maxHp * 0.15), p);
      audio.sfx('heal');
    }
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy - Math.abs(Math.sin(this.t * 3)) * 2);
    spr(ctx, 'item/noodle', x, y, false, () => { ctx.fillStyle = '#ff8a3a'; ctx.fillRect(x - 5, y - 9, 10, 9); });
  }
}

/** 地上的装备：靠近按互动键拾取（会弹出对比面板） */
export class ItemPickup extends Thing {
  constructor(x, y, item, o = {}) {
    super(x, y);
    this.item = item; this.w = 12; this.h = 14; this.vy = o.pop ? -260 : 0; this.vx = o.pop ? rnd(-40, 40) : 0;
    this.price = o.price || 0;
    this.group = o.group || null;
    this.light = itemColor(item); this.lightR = 26;
    this.interactive = true;
  }
  get prompt() { return (this.price ? `购买 ${this.price}` : '查看') + ' ' + itemTitle(this.item); }
  update(dt) { super.update(dt); this.fall(dt, 0.25); }
  interact(p) {
    const run = G.run;
    if (this.price && run.gold < this.price) { audio.sfx('deny'); this.world.fx.text(this.x, this.y - 30, '经费不足', '#ff6b5e'); return; }
    G.game.ui.openPickup(this);
  }
  /** 被拿走后的清理（同组的其它台座一起消失） */
  taken() {
    this.dead = true;
    if (this.group) for (const o of this.world.pickups) if (o !== this && o.group === this.group && !o.dead) { o.dead = true; this.world.fx.smoke(o.x, o.y - 8, 6); }
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy - 6 - Math.sin(this.t * 3) * 2);
    const def = ITEMS[this.item.id];
    const col = itemColor(this.item);
    // 稀有度光柱
    ctx.globalAlpha = 0.22 + 0.08 * Math.sin(this.t * 5);
    ctx.fillStyle = col; ctx.fillRect(x - 5, y - 30, 10, 34);
    ctx.globalAlpha = 1;
    spr(ctx, def.icon, x, y + 6, false, () => { ctx.fillStyle = col; ctx.fillRect(x - 6, y - 6, 12, 12); ctx.fillStyle = '#14101a'; ctx.fillRect(x - 4, y - 4, 8, 8); });
    if (this.price) drawText(ctx, String(this.price), x, y - 22, { size: 8, color: COLORS.gold, align: 'center', outline: '#14101a' });
  }
}

export class ScrollPickup extends Thing {
  constructor(x, y) { super(x, y); this.w = 12; this.h = 14; this.interactive = true; this.light = '#ffe9a0'; this.lightR = 30; }
  get prompt() { return '研读文献'; }
  update(dt) { super.update(dt); this.fall(dt, 0.2); if (Math.random() < 0.08) this.world.fx.burst(this.x + rnd(-6, 6), this.y - rnd(4, 16), 1, { color: ['#ffe9a0', '#ffffff'], speed: 4, speedMax: 12, grav: -30, life: 0.5, lifeMax: 0.9 }); }
  interact() { G.game.ui.openScroll(this); }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy - 4 - Math.sin(this.t * 2.5) * 2);
    spr(ctx, 'item/scroll', x, y + 2, false, () => { ctx.fillStyle = '#ffe9a0'; ctx.fillRect(x - 6, y - 10, 12, 10); });
  }
}

// ---------------------------------------------------------------- 物件
export class Crate extends Thing {
  constructor(x, y) { super(x, y); this.w = 18; this.h = 16; this.variant = rndInt(0, 1); this.breakable = true; }
  skin() { const b = this.world.level.biome; return b === 'em' || b === 'quantum' ? 2 : this.variant; }
  update(dt) { super.update(dt); }
  break() {
    if (this.dead) return;
    this.dead = true;
    const w = this.world, run = G.run;
    audio.sfx('crate', { gap: 0.05 });
    w.fx.debris(this.x, this.y - 8, this.skin() === 2 ? ['#8a93b0', '#5a6078', '#c8d0e8'] : ['#b98a50', '#8a6236', '#d9b074'], 9);
    const r = Math.random();
    if (r < 0.55) w.dropGold(this.x, this.y - 8, rndInt(3, 7) + run.depth * 2);
    else if (r < 0.63) w.addPickup(new Food(this.x, this.y - 8));
    else if (r < 0.7) w.dropData(this.x, this.y - 8, 1);
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    spr(ctx, 'obj/crate/' + this.skin(), x, y, false, () => { ctx.fillStyle = '#b98a50'; ctx.fillRect(x - 9, y - 16, 18, 16); ctx.fillStyle = '#8a6236'; ctx.fillRect(x - 9, y - 9, 18, 2); });
  }
}

export class Chest extends Thing {
  constructor(x, y) { super(x, y); this.w = 22; this.h = 18; this.open = false; this.interactive = true; this.light = '#ffe9a0'; this.lightR = 34; }
  get prompt() { return '打开样品柜'; }
  interact(p) {
    if (this.open) return;
    this.open = true; this.interactive = false;
    const w = this.world, run = G.run;
    audio.sfx('chest');
    w.fx.burst(this.x, this.y - 12, 16, { color: ['#ffe9a0', '#ffffff', '#ffd24a'], speed: 40, speedMax: 140, angle: -Math.PI / 2, spread: 2, grav: 200, life: 0.4, lifeMax: 0.8 });
    const item = rollItem(run, run.rng, undefined, 1);
    item.lv += 1;
    w.addPickup(new ItemPickup(this.x, this.y - 14, item, { pop: true }));
    w.dropGold(this.x, this.y - 10, 18 + run.depth * 8);
    w.dropData(this.x, this.y - 10, 3);
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    spr(ctx, 'obj/chest/' + (this.open ? 1 : 0), x, y, false, () => { ctx.fillStyle = this.open ? '#6a5a40' : '#c8a060'; ctx.fillRect(x - 11, y - 16, 22, 16); });
  }
}

export class Vending extends Thing {
  constructor(x, y) {
    super(x, y); this.w = 30; this.h = 46; this.interactive = true; this.light = '#8fe8ff'; this.lightR = 60;
    this.stock = null;
  }
  get prompt() { return '自动售货机'; }
  ensureStock() {
    if (this.stock) return;
    const run = G.run, rng = run.rng;
    const lvl = 1 + run.depth;
    const price = (base) => Math.round(base * (1 + 0.35 * run.depth) / 5) * 5;
    this.stock = [
      { kind: 'item', item: rollItem(run, rng, 'weapon', 1), price: price(60) },
      { kind: 'item', item: rollItem(run, rng, 'skill', 0), price: price(55) },
      { kind: 'food', name: '红烧牛肉面', desc: '回复 {g}35%{/} 生命。', price: price(25), icon: 'item/noodle' },
      { kind: 'flask', name: '枸杞茶补充装', desc: '保温杯 {g}+1{/} 次。', price: price(35), icon: 'item/flask' },
    ];
    void lvl;
  }
  interact() { this.ensureStock(); G.game.ui.openShop(this); }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    spr(ctx, 'obj/vending', x, y, false, () => { ctx.fillStyle = '#3a6ea8'; ctx.fillRect(x - 15, y - 46, 30, 46); ctx.fillStyle = '#8fe8ff'; ctx.fillRect(x - 11, y - 42, 16, 22); });
  }
}

export class ExitDoor extends Thing {
  constructor(x, y, locked) { super(x, y); this.w = 26; this.h = 46; this.locked = !!locked; this.interactive = true; this.light = '#9dffb0'; this.lightR = 50; }
  get prompt() { return this.locked ? '门锁着' : '前往下一区域'; }
  interact(p) {
    if (this.locked) { audio.sfx('deny'); return; }
    audio.sfx('door');
    G.game.exitStage();
  }
  unlock() { if (!this.locked) return; this.locked = false; audio.sfx('door'); this.world.fx.ring(this.x, this.y - 22, '#9dffb0', 6, 50, 0.5, 2); }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    spr(ctx, 'obj/door/' + (this.locked ? 0 : 1), x, y, false, () => { ctx.fillStyle = this.locked ? '#5a4a4a' : '#3a8a5a'; ctx.fillRect(x - 13, y - 46, 26, 46); });
    if (!this.locked) {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.t * 4);
      drawText(ctx, '▼', x, y - 62 + Math.sin(this.t * 5) * 2, { size: 12, color: '#9dffb0', align: 'center', outline: '#14101a' });
      ctx.globalAlpha = 1;
    }
  }
}

export class Dispenser extends Thing {
  constructor(x, y) { super(x, y); this.w = 18; this.h = 42; this.used = false; this.interactive = true; this.light = '#bfeaff'; this.lightR = 40; }
  get prompt() { return this.used ? '饮水机（已用过）' : '接水：装满保温杯'; }
  interact(p) {
    const run = G.run;
    if (this.used) { audio.sfx('deny'); return; }
    this.used = true;
    run.flask = run.flaskMax;
    run.heal(Math.round(run.maxHp * 0.4), p);
    audio.sfx('gulp'); audio.sfx('heal');
    this.world.fx.burst(this.x, this.y - 30, 12, { color: ['#bfeaff', '#ffffff', '#6cc4ff'], speed: 20, speedMax: 70, grav: 200, life: 0.4, lifeMax: 0.8 });
    this.world.fx.text(this.x, this.y - 52, '保温杯已装满', '#7be07b');
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    spr(ctx, 'obj/dispenser', x, y, false, () => { ctx.fillStyle = '#dfe6f0'; ctx.fillRect(x - 8, y - 30, 16, 30); ctx.fillStyle = '#6cc4ff'; ctx.fillRect(x - 6, y - 44, 12, 14); });
  }
}

export class Blackboard extends Thing {
  constructor(x, y) { super(x, y); this.w = 60; this.h = 40; this.used = false; this.interactive = true; }
  get prompt() { return this.used ? '黑板（已领悟）' : '黑板：领悟一条定理'; }
  near(p) { return Math.abs(p.x - this.x) < 30 && Math.abs(p.y - this.y) < 40; }
  interact() {
    if (this.used) { audio.sfx('deny'); return; }
    G.game.ui.openPerks(this);
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    spr(ctx, 'obj/blackboard', x, y - 14, false, () => { ctx.fillStyle = '#2a4a3a'; ctx.fillRect(x - 30, y - 54, 60, 36); });
    if (!this.used) drawText(ctx, '?', x, y - 68 + Math.sin(this.t * 4) * 2, { size: 12, color: '#ffe14a', align: 'center', outline: '#14101a' });
  }
}

export class Terminal extends Thing {
  constructor(x, y) { super(x, y); this.w = 22; this.h = 36; this.interactive = true; this.light = '#62e6ff'; this.lightR = 46; }
  get prompt() { return '终端机：上传数据 / 永久解锁'; }
  interact() { G.game.ui.openTerminal(this); }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    spr(ctx, 'obj/terminal/' + (Math.floor(this.t * 2) % 2), x, y, false, () => { ctx.fillStyle = '#4a5068'; ctx.fillRect(x - 11, y - 36, 22, 36); ctx.fillStyle = '#62e6ff'; ctx.fillRect(x - 8, y - 32, 16, 12); });
  }
}

export class Spring extends Thing {
  constructor(x, y) { super(x, y); this.w = 20; this.h = 8; this.squash = 0; }
  update(dt) {
    super.update(dt);
    this.squash = Math.max(0, this.squash - dt);
    const w = this.world, p = w.player;
    const hit = (b) => Math.abs(b.x - this.x) < (this.w + b.w) / 2 && b.y > this.y - 10 && b.y <= this.y + 2 && b.vy >= 0;
    if (!p.dead && hit(p) && p.state !== 'climb') {
      p.vy = -860; p.onGround = false; p.noCut = true; p.airJumps = 1 + G.run.stat('airJumps'); p.airDash = true; p.tuckT = 0.3;
      if (p.state === 'slam' || p.state === 'roll') p.setState('normal');
      this.squash = 0.25; audio.sfx('spring');
      w.fx.dust(this.x, this.y, 0, 6);
    }
    for (const e of w.enemies) if (!e.flying && !e.fixed && !e.dead && hit(e)) { e.vy = -620; e.onGround = false; this.squash = 0.25; audio.sfx('spring', { gap: 0.2 }); }
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    const f = this.squash > 0.15 ? 1 : this.squash > 0 ? 2 : 0;
    spr(ctx, 'obj/spring/' + f, x, y, false, () => { ctx.fillStyle = '#d04a4a'; ctx.fillRect(x - 10, y - (f === 2 ? 14 : f === 1 ? 4 : 8), 20, 3); ctx.fillStyle = '#9aa0b4'; ctx.fillRect(x - 6, y - 6, 12, 6); });
  }
}

/** 教学提示牌：靠近时在头顶显示文字 */
export class Sign extends Thing {
  constructor(x, y, textFn) { super(x, y); this.textFn = textFn; this.a = 0; }
  update(dt) {
    super.update(dt);
    const p = this.world.player;
    const near = Math.abs(p.x - this.x) < 70 && Math.abs(p.y - this.y) < 80;
    this.a = approach(this.a, near ? 1 : 0, dt * 4);
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    spr(ctx, 'obj/sign', x, y, false, () => { ctx.fillStyle = '#ffe9a0'; ctx.fillRect(x - 5, y - 16, 10, 10); ctx.fillStyle = '#8a6236'; ctx.fillRect(x - 1, y - 6, 2, 6); });
  }
  drawOverlay(ctx, cx, cy) {
    if (this.a <= 0.02) return;
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    const tx = Math.max(150, Math.min(W - 150, x));
    drawText(ctx, this.textFn(keyHint, input.device === 'touch'), tx, y - 96 - (1 - this.a) * 6, { size: 12, color: '#ffffff', align: 'center', outline: '#14101a', alpha: this.a, maxWidth: 290 });
  }
}

/** 开局装备台座用的物品 */
export function starterChoices(run) {
  const pool = unlockedItems(run.save);
  const rng = run.rng;
  const ranged = pool.filter((id) => ITEMS[id].kind === 'weapon' && ITEMS[id].type !== 'melee');
  const skills = pool.filter((id) => ITEMS[id].kind === 'skill');
  return [makeItem(rng.pick(ranged), 1, rng, 0), makeItem(rng.pick(skills), 1, rng, 0)];
}

export { TILE, sign, drawSil };
