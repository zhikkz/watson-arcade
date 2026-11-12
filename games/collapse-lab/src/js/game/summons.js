// 技能召唤物与持续性区域：线圈、引力阱、猫箱 / 猫 / 辐射云、麦克斯韦妖、卫星、带电区域
import { GRAVITY, TILE } from '../core/config.js';
import { audio } from '../core/audio.js';
import { TAU, rnd, sign, approach } from '../core/util.js';
import { drawSprite, hasSprite } from '../core/assets.js';
import { pxDisc, pxCircle, pxLine } from './fx.js';
import { G } from './state.js';

class Actor {
  constructor(x, y) { this.kind = 'actor'; this.x = x; this.y = y; this.dead = false; this.world = null; this.t = 0; }
  update(dt) { this.t += dt; }
  draw() {}
}

export class Turret extends Actor {
  constructor(x, y, dmg, life) { super(x, y); this.dmg = dmg; this.life = life; this.cd = 0.3; this.light = '#b58cff'; this.lightR = 46; }
  update(dt) {
    super.update(dt);
    const w = this.world;
    this.life -= dt; this.cd -= dt;
    if (this.life <= 0) { this.dead = true; w.fx.smoke(this.x, this.y - 12, 6); return; }
    if (this.cd <= 0) {
      const e = w.nearestEnemy(this.x, this.y - 20, 108, true);
      if (e) {
        this.cd = 0.45;
        w.fx.bolt(this.x, this.y - 24, e.x, e.cy, '#d9c2ff', 0.14, 5);
        w.hitEnemy(e, this.dmg, { src: 'skill', effects: { shock: 2 }, kbx: 0, kby: 0, x: e.x, y: e.cy, stop: 0, shake: 0.6 });
        audio.sfx('zap');
      } else this.cd = 0.12;
    }
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    if (hasSprite('obj/coil')) drawSprite(ctx, 'obj/coil', x, y);
    else { ctx.fillStyle = '#6a6f8a'; ctx.fillRect(x - 5, y - 6, 10, 6); ctx.fillStyle = '#b58cff'; ctx.fillRect(x - 2, y - 22, 4, 16); }
    if (Math.floor(this.t * 12) % 2) pxDisc(ctx, x, y - 25, 2, '#ffffff'); else pxDisc(ctx, x, y - 25, 3, '#d9c2ff');
    if (this.life < 2 && Math.floor(this.t * 10) % 2) return;
    ctx.fillStyle = '#b58cff';
    ctx.fillRect(x - 8, y + 2, Math.round(16 * Math.min(1, this.life / 8)), 1);
  }
}

export class GravityWell extends Actor {
  constructor(x, y, dmg) { super(x, y); this.dmg = dmg; this.life = 2.2; this.light = '#c98bff'; this.lightR = 60; audio.sfx('pull'); }
  update(dt) {
    super.update(dt);
    const w = this.world;
    this.life -= dt;
    for (const e of w.enemies) {
      if (e.dead || e.boss || e.fixed) continue;
      const dx = this.x - e.x, dy = this.y - e.cy, d = Math.hypot(dx, dy);
      if (d > 118 || d < 4) continue;
      const pull = 560 * (1 - d / 150);
      e.vx += dx / d * pull * dt;
      if (e.flying) e.vy += dy / d * pull * dt; else if (e.onGround && d < 60 && dy < -8) e.vy = -90;
      e.pulledT = 0.1;
    }
    if (Math.random() < 0.8) {
      const a = rnd(0, TAU), r = rnd(40, 100);
      w.fx.burst(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, 1, { color: ['#c98bff', '#ffffff', '#8f6adf'], speed: 0, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3, grav: 0, drag: 0, life: 0.28, lifeMax: 0.3 });
    }
    if (this.life <= 0) {
      this.dead = true;
      w.explode(this.x, this.y, 62, this.dmg, { src: 'skill', color: '#c98bff', sfx: 'explode' });
    }
  }
  draw(ctx, cx, cy) {
    const x = this.x - cx, y = this.y - cy;
    const r = 7 + Math.sin(this.t * 14) * 1.5;
    pxDisc(ctx, x, y, r + 2, '#8f6adf');
    pxDisc(ctx, x, y, r, '#14101a');
    for (let i = 0; i < 3; i++) {
      const a = this.t * (5 + i) + i * 2.1, rr = 12 + i * 5;
      ctx.fillStyle = i === 1 ? '#ffffff' : '#c98bff';
      ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.6), 2, 2);
    }
  }
}

export class RadCloud extends Actor {
  constructor(x, y, dmg, life = 5, r = 58) { super(x, y); this.dmg = dmg; this.life = life; this.r = r; this.tick = 0.2; this.light = '#9dff5a'; this.lightR = r; }
  update(dt) {
    super.update(dt);
    const w = this.world;
    this.life -= dt; this.tick -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (Math.random() < 0.7) w.fx.burst(this.x + rnd(-this.r, this.r) * 0.8, this.y + rnd(-this.r, this.r) * 0.5, 1, { color: ['#9dff5a', '#d6ff9a', '#5fbf3a'], speed: 4, speedMax: 16, grav: -30, drag: 1, life: 0.5, lifeMax: 1, size: 2, shrink: true });
    if (this.tick <= 0) {
      this.tick = 0.5;
      for (const e of w.enemiesInRadius(this.x, this.y, this.r)) w.hitEnemy(e, this.dmg * 0.7, { src: 'dot', effects: { rad: 1 }, quiet: true, x: e.x, y: e.cy });
    }
  }
  draw(ctx, cx, cy) {
    ctx.globalAlpha = 0.14 + 0.05 * Math.sin(this.t * 6);
    pxDisc(ctx, this.x - cx, this.y - cy, this.r, '#9dff5a');
    ctx.globalAlpha = 0.35;
    pxCircle(ctx, this.x - cx, this.y - cy, this.r, '#d6ff9a');
    ctx.globalAlpha = 1;
  }
}

export class Cat extends Actor {
  constructor(x, y, dmg, life = 9) {
    super(x, y);
    this.dmg = dmg; this.life = life; this.vx = 0; this.vy = -160; this.w = 12; this.h = 10; this.facing = 1;
    this.onGround = false; this.cd = 0;
  }
  update(dt) {
    super.update(dt);
    const w = this.world, p = w.player;
    this.life -= dt; this.cd -= dt;
    if (this.life <= 0) { this.dead = true; w.fx.smoke(this.x, this.y - 5, 5, ['#ffd9a0', '#ffffff']); return; }
    const e = w.nearestEnemy(this.x, this.y - 5, 190, false);
    const tx = e ? e.x : p.x - p.facing * 18;
    const dx = tx - this.x;
    if (Math.abs(dx) > 10) { this.vx = approach(this.vx, sign(dx) * 185, 1400 * dt); this.facing = sign(dx); } else this.vx = approach(this.vx, 0, 1400 * dt);
    this.vy = Math.min(600, this.vy + GRAVITY * dt);
    if (this.onGround && (this.hitWall || (e && e.cy < this.y - 26 && Math.abs(dx) < 60))) this.vy = -430;
    w.level.moveBody(this, dt);
    if (!e && Math.hypot(p.x - this.x, p.y - this.y) > 260) { this.x = p.x; this.y = p.y - 4; w.fx.smoke(this.x, this.y - 5, 4, ['#ffd9a0']); }
    if (e && this.cd <= 0 && Math.abs(e.x - this.x) < e.w / 2 + 14 && Math.abs(e.cy - (this.y - 5)) < e.h / 2 + 16) {
      this.cd = 0.55;
      w.hitEnemy(e, this.dmg, { src: 'skill', kbx: this.facing * 50, kby: -40, x: e.x, y: e.cy, stop: 0.01, shake: 0.8 });
      w.fx.slash(e.x, e.cy, 9, -1, 1, '#ffe2a0', 0.12, 4);
      if (Math.random() < 0.3) audio.sfx('meow');
    }
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    if (this.life < 1.5 && Math.floor(this.t * 12) % 2) return;
    if (hasSprite('obj/cat/0')) {
      const f = !this.onGround ? 2 : Math.abs(this.vx) > 20 ? Math.floor(this.t * 12) % 4 : 0;
      drawSprite(ctx, 'obj/cat/' + f, x, y, this.facing < 0);
    } else { ctx.fillStyle = '#ffb13a'; ctx.fillRect(x - 6, y - 8, 12, 8); }
  }
}

export class CatBox extends Actor {
  constructor(x, y, dmg) { super(x, y); this.dmg = dmg; this.vy = 0; this.w = 12; this.h = 12; this.vx = 0; this.opened = false; }
  update(dt) {
    super.update(dt);
    const w = this.world;
    this.vy = Math.min(500, this.vy + GRAVITY * dt);
    w.level.moveBody(this, dt);
    if (this.t > 0.5 && !this.opened) {
      this.opened = true; this.dead = true;
      w.fx.debris(this.x, this.y - 6, ['#b98a50', '#8a6236', '#e0b070'], 8);
      if (Math.random() < 0.5) {
        w.addActor(new Cat(this.x, this.y - 2, this.dmg));
        w.fx.text(this.x, this.y - 22, '活的!', '#7be07b', { size: 12 });
        audio.sfx('meow');
      } else {
        w.addActor(new RadCloud(this.x, this.y - 14, this.dmg));
        w.fx.text(this.x, this.y - 22, '……死的', '#9dff5a', { size: 12 });
        audio.sfx('steam');
      }
    }
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx + (this.onGround ? Math.sin(this.t * 60) * 1.2 : 0)), y = Math.round(this.y - cy);
    if (hasSprite('obj/catbox')) drawSprite(ctx, 'obj/catbox', x, y);
    else { ctx.fillStyle = '#b98a50'; ctx.fillRect(x - 6, y - 12, 12, 12); }
  }
}

export class Demon extends Actor {
  constructor(player, dmg, life) { super(player.x, player.y - 60); this.p = player; this.dmg = dmg; this.life = life; this.cd = 0.5; this.hot = true; this.light = '#ff9a4a'; this.lightR = 36; this.facing = 1; }
  update(dt) {
    super.update(dt);
    const w = this.world, p = this.p;
    this.life -= dt; this.cd -= dt;
    if (this.life <= 0 || p.dead) { this.dead = true; w.fx.smoke(this.x, this.y, 5, ['#ff9a4a', '#8fdcff']); return; }
    const tx = p.x - p.facing * 20, ty = p.y - 62 + Math.sin(this.t * 4) * 4;
    this.x += (tx - this.x) * Math.min(1, dt * 6);
    this.y += (ty - this.y) * Math.min(1, dt * 6);
    if (this.cd <= 0) {
      const e = w.nearestEnemy(this.x, this.y, 200, true);
      if (e) {
        this.cd = 0.8;
        const dx = e.x - this.x, dy = e.cy - this.y, d = Math.hypot(dx, dy) || 1;
        this.facing = sign(dx) || 1;
        w.spawnProj({ x: this.x, y: this.y, vx: dx / d * 310, vy: dy / d * 310, owner: 'player', src: 'skill', dmg: this.dmg, look: this.hot ? 'fire' : 'ice', color: this.hot ? '#ff9a4a' : '#8fdcff', r: 4, life: 1, effects: this.hot ? { burn: 3 } : { chill: 2 }, kb: 30 });
        audio.sfx(this.hot ? 'burn' : 'freeze', { gap: 0.2 });
        this.hot = !this.hot;
      } else this.cd = 0.2;
    }
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    if (this.life < 2 && Math.floor(this.t * 10) % 2) return;
    if (hasSprite('obj/demon/0')) drawSprite(ctx, 'obj/demon/' + (Math.floor(this.t * 8) % 2), x, y, this.facing < 0);
    else { pxDisc(ctx, x, y, 5, this.hot ? '#ff9a4a' : '#8fdcff'); }
  }
}

export class Orbit extends Actor {
  constructor(player, dmg, phase) { super(player.x, player.y); this.p = player; this.dmg = dmg; this.a = phase; this.life = 12; this.hitT = new Map(); this.light = '#62e6ff'; this.lightR = 20; }
  update(dt) {
    super.update(dt);
    const w = this.world, p = this.p;
    this.life -= dt;
    if (this.life <= 0 || p.dead) { this.dead = true; return; }
    this.a += dt * 4.2;
    this.x = p.x + Math.cos(this.a) * 30; this.y = p.cy + Math.sin(this.a) * 18;
    for (const e of w.enemies) {
      if (e.dead || e.untargetable) continue;
      if (this.x < e.x - e.w / 2 - 3 || this.x > e.x + e.w / 2 + 3 || this.y < e.y - e.h - 3 || this.y > e.y + 3) continue;
      const last = this.hitT.get(e) || -9;
      if (G.time - last < 0.6) continue;
      this.hitT.set(e, G.time);
      w.hitEnemy(e, this.dmg, { src: 'perk', kbx: 0, kby: 0, x: this.x, y: this.y, stop: 0, shake: 0.5 });
    }
  }
  draw(ctx, cx, cy) {
    const x = this.x - cx, y = this.y - cy;
    if (this.life < 2 && Math.floor(this.t * 10) % 2) return;
    pxDisc(ctx, x, y, 3, '#62e6ff');
    pxDisc(ctx, x, y, 1, '#ffffff');
    ctx.fillStyle = '#62e6ff';
    ctx.fillRect(Math.round(x - Math.cos(this.a + 1.57) * 5), Math.round(y - Math.sin(this.a + 1.57) * 3), 1, 1);
  }
}

/** 带电 / 燃烧 / 冰雾区域（贴地），对范围内目标持续结算 */
export class Field extends Actor {
  constructor(x, y, r, dur, dmg, o = {}) {
    super(x, y);
    this.r = r; this.life = dur; this.dmg = dmg; this.tick = 0.15;
    this.owner = o.owner || 'player'; this.type = o.type || 'shock';
    this.effects = o.effects || null; this.src = o.src || 'dot';
    this.color = { shock: '#bfe9ff', fire: '#ff8a3a', frost: '#9fdcff', rad: '#9dff5a' }[this.type];
    this.light = this.color; this.lightR = r;
  }
  update(dt) {
    super.update(dt);
    const w = this.world;
    this.life -= dt; this.tick -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.type === 'shock' && Math.random() < 0.35) {
      const a = this.x + rnd(-this.r, this.r), b = this.x + rnd(-this.r, this.r);
      w.fx.bolt(a, this.y - rnd(0, 8), b, this.y - rnd(0, 14), this.color, 0.08, 3);
    } else if (this.type === 'fire' && Math.random() < 0.8) w.fx.embers(this.x + rnd(-this.r, this.r), this.y - rnd(0, 6), 1);
    else if (this.type === 'frost' && Math.random() < 0.5) w.fx.frost(this.x + rnd(-this.r, this.r), this.y - rnd(0, 10), 1);
    if (this.tick <= 0) {
      this.tick = 0.4;
      if (this.owner === 'player') {
        for (const e of w.enemiesInRadius(this.x, this.y - 6, this.r)) w.hitEnemy(e, this.dmg, { src: this.src, effects: this.effects, quiet: true, x: e.x, y: e.cy });
      } else {
        const p = w.player;
        if (Math.abs(p.x - this.x) < this.r && p.y > this.y - 22 && p.y < this.y + 10) p.hurt(this.dmg, { silentKb: true, burn: this.type === 'fire' ? 2 : 0, chill: this.type === 'frost' ? 2 : 0, x: this.x });
      }
    }
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    if (this.type === 'fire') {
      for (let i = -this.r; i < this.r; i += 3) {
        const h = 3 + Math.abs(Math.sin(this.t * 14 + i * 0.7)) * 7 * Math.min(1, this.life * 2);
        ctx.fillStyle = (i % 2) ? '#ff8a3a' : '#ffd070';
        ctx.fillRect(x + i, Math.round(y - h), 3, Math.round(h));
      }
    } else if (this.type === 'frost') {
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#dff6ff';
      ctx.fillRect(x - this.r, y - 2, this.r * 2, 2);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.5; ctx.fillStyle = this.color;
      ctx.fillRect(x - this.r, y - 1, this.r * 2, 1);
      ctx.globalAlpha = 1;
    }
  }
}

/** 带预警的敌方范围攻击：圆形爆炸 / 竖直光柱 / 落雷 */
export class Bomb extends Actor {
  constructor(x, y, o = {}) {
    super(x, y);
    this.delay = o.delay === undefined ? 0.8 : o.delay;
    this.r = o.r || 40; this.dmg = o.dmg || 10; this.type = o.type || 'circle';
    this.color = o.color || '#ff5a4a'; this.o = o; this.done = false; this.after = 0.25;
    this.y0 = o.y0 === undefined ? y - 300 : o.y0; this.y1 = o.y1 === undefined ? y : o.y1;
  }
  update(dt) {
    super.update(dt);
    const w = this.world, p = w.player, o = this.o;
    if (!this.done && this.t >= this.delay) {
      this.done = true;
      if (this.type === 'circle') w.explode(this.x, this.y, this.r, this.dmg, { owner: 'enemy', color: this.color, sfx: o.sfx, burn: o.burn, chill: o.chill });
      else {
        const hw = this.type === 'bolt' ? 12 : this.r;
        if (this.type === 'bolt') w.fx.bolt(this.x + rnd(-20, 20), this.y0, this.x, this.y1, this.color, 0.22, 9);
        else w.fx.beam(this.x, this.y0, this.x, this.y1, this.color, hw * 2, 0.3);
        w.fx.ring(this.x, this.y1, this.color, 4, 26, 0.25, 2);
        w.shake(3, 0.15); audio.sfx(o.sfx || (this.type === 'bolt' ? 'zap' : 'beam'), { gap: 0.05 });
        if (!p.dead && p.x + p.w / 2 > this.x - hw && p.x - p.w / 2 < this.x + hw && p.y > this.y0 && p.y - p.h < this.y1) p.hurt(this.dmg, { x: this.x, burn: o.burn, chill: o.chill });
      }
    }
    if (this.done) { this.after -= dt; if (this.after <= 0) this.dead = true; }
  }
  draw(ctx, cx, cy) {
    if (this.done) return;
    const k = Math.min(1, this.t / this.delay);
    const x = Math.round(this.x - cx);
    const blink = Math.floor(this.t * (8 + k * 14)) % 2;
    ctx.globalAlpha = 0.35 + 0.4 * k;
    if (this.type === 'circle') {
      pxCircle(ctx, x, this.y - cy, this.r, this.color);
      pxCircle(ctx, x, this.y - cy, Math.max(2, this.r * (1 - k)), blink ? '#ffffff' : this.color);
    } else {
      const hw = this.type === 'bolt' ? 12 : this.r;
      ctx.fillStyle = blink ? '#ffffff' : this.color;
      ctx.fillRect(x, Math.round(this.y0 - cy), 1, Math.round(this.y1 - this.y0));
      ctx.fillRect(x - hw, Math.round(this.y1 - cy) - 2, hw * 2, 2);
      ctx.globalAlpha *= 0.4;
      ctx.fillRect(x - Math.round(hw * (1 - k)), Math.round(this.y0 - cy), Math.max(1, Math.round(hw * 2 * (1 - k))), Math.round(this.y1 - this.y0));
    }
    ctx.globalAlpha = 1;
  }
}

/** 向外扩张的冲击波环：碰到环带时受伤，可以翻滚穿过 */
export class Shockwave extends Actor {
  constructor(x, y, o = {}) { super(x, y); this.r = o.r0 || 10; this.max = o.max || 260; this.speed = o.speed || 240; this.dmg = o.dmg || 14; this.color = o.color || '#c98bff'; this.hit = false; this.light = this.color; this.lightR = 60; }
  update(dt) {
    super.update(dt);
    const p = this.world.player;
    this.r += this.speed * dt;
    if (this.r > this.max) { this.dead = true; return; }
    if (!this.hit && !p.dead) {
      const d = Math.hypot(p.x - this.x, p.cy - this.y);
      if (Math.abs(d - this.r) < 11) { if (p.hurt(this.dmg, { x: this.x, kb: 200 })) this.hit = true; }
    }
  }
  draw(ctx, cx, cy) {
    const a = Math.min(1, (this.max - this.r) / 80);
    ctx.globalAlpha = a;
    pxCircle(ctx, this.x - cx, this.y - cy, this.r, this.color, 2);
    pxCircle(ctx, this.x - cx, this.y - cy, this.r - 3, '#ffffff', 1);
    ctx.globalAlpha = a * 0.5;
    pxCircle(ctx, this.x - cx, this.y - cy, this.r + 4, this.color, 1);
    ctx.globalAlpha = 1;
  }
}

export { Actor, pxLine, TILE };
