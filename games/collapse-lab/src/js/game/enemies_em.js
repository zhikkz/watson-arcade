// 电磁实验室的怪物：静电球、特斯拉塔、磁铁蟹、示波器、光子哨兵
import { audio } from '../core/audio.js';
import { clamp, rnd, sign, approach, segRect } from '../core/util.js';
import { drawSprite, drawSil } from '../core/assets.js';
import { Enemy, registerEnemy } from './enemy.js';
import { pxLine } from './fx.js';

// ---------------------------------------------------------------- 静电球
const ORB = {
  id: 'orb', name: '静电球', spr: 'm/orb', icon: 'm/orb/0', iconOy: -12, hp: 26, w: 16, h: 16, flying: true, contact: 8, glow: [44, '#bfe9ff'],
  gold: [3, 5], data: 1, blood: ['#ccd2e2', '#bfe9ff', '#ffffff'],
  tip: '它放电前身上的电火花会突然变长。三颗电火花呈扇形飞来，贴近它反而安全。',
  desc: '范德格拉夫起电机顶上那颗金属球，带着一身静电飘了起来。脾气和它的头发一样炸。',
};
class Orb extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.cd = rnd(1, 2.5); this.side = Math.random() < 0.5 ? 1 : -1; }
  ai(dt) {
    const p = this.player, w = this.world;
    this.cd -= dt;
    if (!this.aggro && this.seesPlayer(220, 150)) this.aggro = true;
    if (this.state === 'charge') {
      this.vx *= 0.9; this.vy *= 0.9;
      if (Math.random() < 0.6) w.fx.sparks(this.x + rnd(-10, 10), this.cy + rnd(-10, 10), '#bfe9ff', 1);
      if (this.stateT > 0.42) {
        const a = Math.atan2(p.cy - this.cy, p.x - this.x);
        for (const off of [-0.32, 0, 0.32]) w.spawnProj({ x: this.x, y: this.cy, vx: Math.cos(a + off) * 150, vy: Math.sin(a + off) * 150, owner: 'enemy', dmg: this.dmg(8), look: 'spark', color: '#bfe9ff', r: 3, life: 2.2 });
        audio.sfx('zap', { gap: 0.1 });
        this.setState('idle'); this.cd = rnd(2.2, 3.2);
      }
      return;
    }
    if (this.aggro && !p.dead) {
      if (Math.random() < dt * 0.3) this.side = -this.side;
      const tx = p.x + this.side * 96, ty = p.cy - 46 + Math.sin(this.t * 2) * 10;
      this.vx = approach(this.vx, clamp((tx - this.x) * 1.5, -62, 62) * this.speedMul, 160 * dt);
      this.vy = approach(this.vy, clamp((ty - this.cy) * 1.5, -50, 50), 160 * dt);
      this.facing = sign(p.x - this.x) || 1;
      if (this.cd <= 0 && this.dist() < 210 && w.level.los(this.x, this.cy, p.x, p.cy)) { this.setState('charge'); this.telegraph(0.42, '#bfe9ff'); }
    } else {
      this.vx = approach(this.vx, Math.sin(this.t * 0.7) * 20, 60 * dt);
      this.vy = approach(this.vy, Math.cos(this.t * 1.1) * 12, 60 * dt);
    }
  }
  frameName() { return 'm/orb/' + (Math.floor(this.t / (this.state === 'charge' ? 0.05 : 0.12)) % 3); }
}
registerEnemy(ORB, Orb);

// ---------------------------------------------------------------- 特斯拉塔
const TESLA = {
  id: 'tesla', name: '特斯拉塔', spr: 'm/tesla', icon: 'm/tesla/idle/0', hp: 48, w: 16, h: 38, fixed: true, kbResist: 1, glow: [36, '#d9c2ff'],
  gold: [4, 7], data: 2, blood: ['#cc7a42', '#62688c', '#d9c2ff'],
  tip: '瞄准线变红就说明落点已经锁定——这时候离开原地，闪电只会劈中你刚才站的位置。',
  desc: '固定在地板或天花板上的线圈塔。不会动，但射程很远：先用细线瞄准，然后一道闪电劈下来。',
};
class Tesla extends Enemy {
  constructor(def, x, y, o) {
    super(def, x, y, o);
    this.ceil = !!(o && o.ceil);
    if (this.ceil) this.y = y + this.h;
    this.cd = rnd(0.5, 1.5); this.tx = x; this.ty = y;
  }
  tip() { return this.ceil ? [this.x, this.y - 6] : [this.x, this.y - this.h + 6]; }
  ai(dt) {
    const p = this.player, w = this.world;
    this.cd -= dt;
    const [sx, sy] = this.tip();
    switch (this.state) {
      case 'idle':
        if (this.cd <= 0 && !p.dead && Math.hypot(p.x - sx, p.cy - sy) < 190 && w.level.los(sx, sy, p.x, p.cy)) { this.aggro = true; this.setState('aim'); audio.sfx('charge', { gap: 0.4 }); }
        break;
      case 'aim':
        if (this.stateT < 0.62) { this.tx = p.x; this.ty = p.cy; } else if (!this.locked) { this.locked = true; audio.sfx('tick'); }
        if (Math.random() < 0.5) w.fx.sparks(sx + rnd(-8, 8), sy + rnd(-4, 4), '#d9c2ff', 1);
        if (this.stateT > 0.95) {
          this.locked = false;
          const dx = this.tx - sx, dy = this.ty - sy, d = Math.hypot(dx, dy) || 1;
          const reach = w.level.raycast(sx, sy, dx / d, dy / d, d + 40);
          const ex = sx + dx / d * reach, ey = sy + dy / d * reach;
          w.fx.bolt(sx, sy, ex, ey, '#d9c2ff', 0.2, 7);
          w.fx.ring(ex, ey, '#d9c2ff', 3, 18, 0.2);
          audio.sfx('zap'); w.shake(2, 0.12);
          if (!p.dead && segRect(sx, sy, ex, ey, p.x - p.w / 2 - 3, p.y - p.h - 3, p.w + 6, p.h + 6)) p.hurt(this.dmg(14), { x: sx });
          this.setState('idle'); this.cd = rnd(1.5, 2.2);
        }
        break;
      default: this.setState('idle');
    }
  }
  onInterrupt() { this.setState('idle'); this.cd = 1; this.locked = false; }
  frameName() {
    const pre = this.ceil ? 'm/teslac/' : 'm/tesla/';
    return pre + (this.state === 'aim' ? 'charge/' : 'idle/') + (Math.floor(this.t / 0.12) % 2);
  }
  draw(ctx, camX, camY) {
    if (this.ceil) {
      // 天花板版本：精灵锚点在顶部
      const y0 = this.y; this.y = this.y - this.h;
      const h0 = this.h; this.h = -58;
      super.draw(ctx, camX, camY);
      this.y = y0; this.h = h0;
    } else super.draw(ctx, camX, camY);
    if (this.state === 'aim') {
      const [sx, sy] = this.tip();
      const col = this.stateT > 0.62 ? '#ff5a4a' : '#d9c2ff';
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(this.t * 40);
      pxLine(ctx, sx - camX, sy - camY, this.tx - camX, this.ty - camY, col, 1);
      ctx.globalAlpha = 1;
    }
  }
}
registerEnemy(TESLA, Tesla);

// ---------------------------------------------------------------- 磁铁蟹
const CRAB = {
  id: 'crab', name: '磁铁蟹', spr: 'm/crab', icon: 'm/crab/walk/0', hp: 54, w: 26, h: 20, speed: 58, kbResist: 0.3,
  gold: [4, 7], data: 2, blood: ['#d63e3e', '#406edc', '#60647c'],
  tip: '被磁力拖过去的时候翻滚可以挣脱。别让它把你吸到钳子前面。',
  desc: '一块马蹄形磁铁长出了腿。它会张开红蓝两极把你隔空吸过去，再狠狠夹一下。',
};
class Crab extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.pullCd = rnd(1, 2.5); }
  ai(dt) {
    const p = this.player, w = this.world, dx = this.dx(), adx = Math.abs(dx), dy = p.y - this.y;
    this.pullCd -= dt;
    switch (this.state) {
      case 'idle':
        this.patrol(dt, 24);
        if (this.aggro || this.noticePlayer(190, 90, 70)) { this.aggro = true; this.setState('chase'); }
        break;
      case 'chase':
        if (p.dead) { this.setState('idle'); this.aggro = false; break; }
        this.facePlayer();
        if (adx < 40 && Math.abs(dy) < 30) { this.setState('wind'); this.telegraph(0.3); break; }
        if (adx > 56 && adx < 185 && Math.abs(dy) < 60 && this.pullCd <= 0 && w.level.los(this.x, this.cy, p.x, p.cy)) { this.setState('pull'); audio.sfx('pull'); this.telegraph(0.3, '#c98bff'); break; }
        if (this.onGround && this.edgeAhead(this.facing) && dy < 20) this.stop(dt);
        else if (adx > 30) this.walk(dt, this.facing, this.def.speed);
        else this.stop(dt);
        break;
      case 'pull':
        this.stop(dt);
        this.facePlayer();
        if (!p.dead && !p.rolling && adx < 220 && Math.abs(dy) < 80) {
          p.vx += sign(-dx) * 620 * dt;
          if (Math.random() < 0.6) w.fx.burst(p.x + rnd(-6, 6), p.cy + rnd(-16, 16), 1, { color: ['#c98bff', '#ffffff'], speed: 0, vx: sign(-dx) * 160, vy: 0, grav: 0, drag: 0, life: 0.2, lifeMax: 0.3 });
        }
        if (this.stateT > 1.3 || adx < 34) { this.pullCd = rnd(3.5, 5); if (adx < 50) { this.setState('wind'); this.telegraph(0.25); } else this.setState('chase'); }
        break;
      case 'wind':
        this.stop(dt);
        if (this.stateT > 0.3) { this.setState('pinch'); this.hitDone = false; audio.sfx('stab'); this.vx = this.facing * 110; }
        break;
      case 'pinch':
        if (!this.hitDone && this.hitFront(36, 13, { top: 28, h: 26 })) this.hitDone = true;
        this.stop(dt, 500);
        if (this.stateT > 0.2) this.setState('recover');
        break;
      case 'recover':
        this.stop(dt);
        if (this.stateT > 0.6) this.setState('chase');
        break;
      default: this.setState('idle');
    }
  }
  onInterrupt() { if (this.state !== 'idle') this.setState('chase'); }
  frameName() {
    switch (this.state) {
      case 'pull': return 'm/crab/pull/' + (Math.floor(this.t / 0.08) % 2);
      case 'wind': return 'm/crab/pinch/0';
      case 'pinch': return 'm/crab/pinch/1';
      case 'recover': return this.stateT < 0.2 ? 'm/crab/pinch/1' : 'm/crab/walk/0';
      default: return 'm/crab/walk/' + (Math.abs(this.vx) > 5 ? Math.floor(this.t / 0.1) % 4 : 0);
    }
  }
}
registerEnemy(CRAB, Crab);

// ---------------------------------------------------------------- 示波器
const SCOPE = {
  id: 'scope', name: '示波器', spr: 'm/scope', icon: 'm/scope/walk/1', hp: 40, w: 20, h: 36, speed: 40,
  gold: [4, 7], data: 2, blood: ['#bebaaa', '#12342a', '#6eff82'],
  tip: '正弦波弹会上下起伏——看准它落到波谷时跳过去，或者用近战把它弹回去。',
  desc: '迈着两条细腿的老式示波器，屏幕上那条绿色波形就是它的表情。它发射的波弹走的是标准的正弦曲线。',
};
class Scope extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.cd = rnd(0.8, 2); }
  ai(dt) {
    const p = this.player, w = this.world, dx = this.dx(), adx = Math.abs(dx), dy = p.y - this.y;
    this.cd -= dt;
    switch (this.state) {
      case 'idle':
        this.patrol(dt, 18);
        if (this.aggro || this.noticePlayer(230, 100, 70)) { this.aggro = true; this.setState('chase'); }
        break;
      case 'chase':
        if (p.dead) { this.setState('idle'); this.aggro = false; break; }
        this.facePlayer();
        if (this.cd <= 0 && adx < 250 && Math.abs(dy) < 56 && w.level.los(this.x, this.cy, p.x, p.cy)) { this.setState('aim'); this.telegraph(0.5, '#6eff82'); break; }
        if (adx < 76 && this.onGround && !this.wallAhead(-this.facing) && !this.edgeAhead(-this.facing)) this.walk(dt, -this.facing, this.def.speed);   // 保持距离
        else if (adx > 170 && !(this.onGround && this.edgeAhead(this.facing))) this.walk(dt, this.facing, this.def.speed);
        else this.stop(dt);
        break;
      case 'aim':
        this.stop(dt);
        if (this.stateT > 0.5) {
          const f = this.facing, y0 = this.y - 22;
          w.spawnProj({ x: this.x + f * 14, y: y0, vx: f * 150, vy: 0, owner: 'enemy', dmg: this.dmg(10), look: 'sine', color: '#6eff82', r: 5, life: 2.4, data: { y0, ph: 0 },
            update(pr, dt2) { pr.data.ph += dt2 * 7; pr.y = pr.data.y0 + Math.sin(pr.data.ph) * 20; } });
          audio.sfx('shoot');
          this.setState('shoot'); this.cd = rnd(2, 2.8);
        }
        break;
      case 'shoot':
        this.stop(dt);
        if (this.stateT > 0.35) this.setState('chase');
        break;
      default: this.setState('idle');
    }
  }
  onInterrupt() { if (this.state !== 'idle') this.setState('chase'); }
  frameName() {
    if (this.state === 'aim') return 'm/scope/shoot/0';
    if (this.state === 'shoot') return 'm/scope/shoot/' + (this.stateT < 0.12 ? 1 : 0);
    return 'm/scope/walk/' + (Math.abs(this.vx) > 4 ? Math.floor(this.t / 0.14) % 4 : 1);
  }
}
registerEnemy(SCOPE, Scope);

// ---------------------------------------------------------------- 光子哨兵
const SENTINEL = {
  id: 'sentinel', name: '光子哨兵', spr: 'm/sentinel', icon: 'm/sentinel/idle/0', iconOy: -10, hp: 30, w: 18, h: 20, flying: true, glow: [40, '#a8e2f0'],
  gold: [4, 7], data: 2, blood: ['#a8e2f0', '#e6faff', '#60a8c8'],
  tip: '红线锁定后光束立刻射出，而且会穿过整个房间。看到红线就翻滚或跳开。',
  desc: '悬浮的三棱镜，中间嵌着一只眼睛。它把周围的光聚成一束，沿瞄准线笔直地射出去。',
};
class Sentinel extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.cd = rnd(1, 2.4); this.ax = 1; this.ay = 0; this.len = 0; }
  ai(dt) {
    const p = this.player, w = this.world;
    this.cd -= dt;
    if (!this.aggro && this.seesPlayer(240, 160)) this.aggro = true;
    switch (this.state) {
      case 'idle':
        this.vx = approach(this.vx, this.aggro ? clamp((p.x - this.x) * 0.6, -34, 34) : Math.sin(this.t * 0.8) * 16, 80 * dt);
        this.vy = approach(this.vy, clamp((this.homeY - 10 + Math.sin(this.t * 1.7) * 8 - this.y) * 2, -30, 30), 80 * dt);
        this.facing = sign(p.x - this.x) || 1;
        if (this.aggro && this.cd <= 0 && !p.dead && this.dist() < 250 && w.level.los(this.x, this.cy, p.x, p.cy)) { this.setState('aim'); audio.sfx('charge', { gap: 0.3 }); }
        break;
      case 'aim':
        this.vx *= 0.9; this.vy *= 0.9;
        if (this.stateT < 0.6) {
          const d = Math.hypot(p.x - this.x, p.cy - this.cy) || 1;
          this.ax = (p.x - this.x) / d; this.ay = (p.cy - this.cy) / d;
          this.facing = sign(this.ax) || 1;
        }
        this.len = w.level.raycast(this.x, this.cy, this.ax, this.ay, 420);
        if (this.stateT > 0.9) { this.setState('fire'); audio.sfx('laser'); w.fx.beam(this.x, this.cy, this.x + this.ax * this.len, this.cy + this.ay * this.len, '#ff5a6a', 5, 0.35); }
        break;
      case 'fire':
        if (!this.hitDone && !p.dead && segRect(this.x, this.cy, this.x + this.ax * this.len, this.cy + this.ay * this.len, p.x - p.w / 2, p.y - p.h, p.w, p.h)) { if (p.hurt(this.dmg(13), { x: this.x, burn: 1 })) this.hitDone = true; }
        if (this.stateT > 0.3) { this.hitDone = false; this.setState('idle'); this.cd = rnd(2, 2.8); }
        break;
      default: this.setState('idle');
    }
  }
  onInterrupt() { this.setState('idle'); this.cd = 1; }
  frameName() { return this.state === 'idle' ? 'm/sentinel/idle/' + (Math.floor(this.t / 0.3) % 2) : 'm/sentinel/charge'; }
  draw(ctx, camX, camY) {
    super.draw(ctx, camX, camY);
    if (this.state === 'aim') {
      ctx.globalAlpha = this.stateT > 0.6 ? 0.9 : 0.4;
      pxLine(ctx, this.x - camX, this.cy - camY, this.x + this.ax * this.len - camX, this.cy + this.ay * this.len - camY, this.stateT > 0.6 ? '#ff5a4a' : '#ffb0b0', 1);
      ctx.globalAlpha = 1;
    }
  }
}
registerEnemy(SENTINEL, Sentinel);
export { drawSprite, drawSil };
