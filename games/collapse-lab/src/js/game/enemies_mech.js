// 力学实验楼的怪物：研究僧、弹簧跳跳、砝码兵、滑块车、摆锤蝠
import { TILE } from '../core/config.js';
import { audio } from '../core/audio.js';
import { clamp, rnd, sign, approach } from '../core/util.js';
import { drawSprite, drawSil } from '../core/assets.js';
import { Enemy, registerEnemy } from './enemy.js';

// ---------------------------------------------------------------- 研究僧
const GRAD = {
  id: 'grad', name: '研究僧', spr: 'm/grad', icon: 'm/grad/walk/1', hp: 34, w: 14, h: 44, speed: 52,
  gold: [2, 5], data: 1, blood: ['#e2e6ee', '#aac0a2', '#3e425a'],
  tip: '举起尺子后会停顿一下再劈下来，绕到背后或直接打断它。',
  desc: '熬夜赶论文熬成了僵尸的研究生。行动迟缓，但挥起那把钢尺毫不手软——据说他只是想找人帮忙看看数据。',
};
class Grad extends Enemy {
  ai(dt) {
    const p = this.player, dx = this.dx(), adx = Math.abs(dx), dy = p.y - this.y;
    switch (this.state) {
      case 'idle':
        this.patrol(dt, 20);
        if (this.aggro || this.noticePlayer(170, 60, 60)) { this.aggro = true; this.setState('chase'); }
        break;
      case 'chase':
        if (p.dead) { this.setState('idle'); this.aggro = false; break; }
        this.facePlayer();
        if (adx < 32 && Math.abs(dy) < 30 && this.onGround) { this.setState('wind'); this.telegraph(0.42); break; }
        if (this.onGround && this.edgeAhead(this.facing) && dy < 20) this.stop(dt);
        else if (adx > 20) this.walk(dt, this.facing, this.def.speed);
        else this.stop(dt);
        if (adx > 380 || Math.abs(dy) > 200) { this.lose = (this.lose || 0) + dt; if (this.lose > 3) { this.setState('idle'); this.aggro = false; this.lose = 0; } } else this.lose = 0;
        break;
      case 'wind':
        this.stop(dt);
        if (this.stateT > 0.42) { this.setState('swing'); this.hitDone = false; audio.sfx('swing'); this.vx = this.facing * 90; }
        break;
      case 'swing':
        if (!this.hitDone && this.hitFront(32, 10, { top: 42, h: 38 })) this.hitDone = true;
        this.stop(dt, 600);
        if (this.stateT > 0.18) this.setState('recover');
        break;
      case 'recover':
        this.stop(dt);
        if (this.stateT > 0.55) this.setState('chase');
        break;
      default: this.setState('idle');
    }
  }
  onInterrupt() { if (this.state !== 'idle') this.setState('chase'); }
  frameName() {
    switch (this.state) {
      case 'wind': return 'm/grad/atk/0';
      case 'swing': return 'm/grad/atk/1';
      case 'recover': return this.stateT < 0.2 ? 'm/grad/atk/1' : 'm/grad/atk/2';
      default: return 'm/grad/walk/' + (Math.abs(this.vx) > 5 ? Math.floor(this.t / 0.16) % 4 : 1);
    }
  }
}
registerEnemy(GRAD, Grad);

// ---------------------------------------------------------------- 弹簧跳跳
const HOPPER = {
  id: 'hopper', name: '弹簧跳跳', spr: 'm/hopper', icon: 'm/hopper/0', hp: 22, w: 14, h: 22, contact: 9,
  gold: [2, 4], data: 1, blood: ['#d84646', '#c4cad8', '#5c6074'],
  tip: '它落地后会缩一下再起跳，趁它压缩的瞬间出手。',
  desc: '一截成了精的弹簧。不会走路，只会一蹦一蹦地往你脸上撞，越是着急蹦得越高。',
};
class Hopper extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.wait = rnd(0.3, 1.2); }
  ai(dt) {
    const p = this.player, dx = this.dx();
    switch (this.state) {
      case 'idle':
        this.stop(dt, 900);
        if (!this.onGround) break;
        this.wait -= dt;
        if (this.aggro || this.seesPlayer(210, 110)) this.aggro = true;
        if (this.wait <= 0) this.setState('squash');
        break;
      case 'squash':
        this.stop(dt, 900);
        if (this.stateT > 0.2) {
          const near = this.aggro && !p.dead;
          const dir = near ? (sign(dx) || 1) : (Math.random() < 0.5 ? 1 : -1);
          this.facing = dir;
          const high = near && p.y < this.y - 40;
          this.vx = dir * (near ? clamp(Math.abs(dx) * 1.1, 70, 150) : rnd(40, 80)) * this.speedMul;
          this.vy = -(high ? 440 : rnd(300, 360));
          this.onGround = false;
          this.setState('air');
          audio.sfx('spring', { gap: 0.15 });
        }
        break;
      case 'air':
        if (this.hitWall) this.vx = -this.vx * 0.5;
        if (this.onGround && this.stateT > 0.1) { this.setState('idle'); this.wait = this.aggro ? rnd(0.35, 0.7) : rnd(0.8, 1.8); }
        break;
      default: this.setState('idle');
    }
  }
  frameName() { return 'm/hopper/' + (this.state === 'squash' ? 1 : this.state === 'air' ? 2 : 0); }
}
registerEnemy(HOPPER, Hopper);

// ---------------------------------------------------------------- 砝码兵
const WEIGHT = {
  id: 'weight', name: '砝码兵', spr: 'm/weight', icon: 'm/weight/walk/1', hp: 78, w: 24, h: 30, speed: 32, kbResist: 0.85,
  gold: [5, 9], data: 2, blood: ['#cca44c', '#8e6c30', '#f4d682'],
  tip: '它跳起砸地时，震波会贴着地面向两边扩散——跳起来躲开，然后趁它僵直输出。',
  desc: '一枚一公斤的黄铜砝码，沉得连击退都不吃。它唯一的招式就是跳起来、砸下去，但这一招很疼。',
};
class Weight extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.slamCd = rnd(0.5, 1.5); }
  ai(dt) {
    const p = this.player, w = this.world, dx = this.dx(), adx = Math.abs(dx), dy = p.y - this.y;
    this.slamCd -= dt;
    this.superArmor = this.state !== 'recover';
    switch (this.state) {
      case 'idle':
        this.patrol(dt, 14);
        if (this.aggro || this.noticePlayer(180, 70, 70)) { this.aggro = true; this.setState('chase'); }
        break;
      case 'chase':
        if (p.dead) { this.setState('idle'); this.aggro = false; break; }
        this.facePlayer();
        if (adx < 96 && Math.abs(dy) < 80 && this.slamCd <= 0 && this.onGround) { this.setState('crouch'); this.telegraph(0.45); break; }
        if (this.onGround && this.edgeAhead(this.facing) && dy < 20) this.stop(dt);
        else if (adx > 30) this.walk(dt, this.facing, this.def.speed, 300);
        else this.stop(dt);
        break;
      case 'crouch':
        this.stop(dt);
        if (this.stateT > 0.45) { this.setState('air'); this.vy = -410; this.vx = sign(dx) * clamp(adx * 1.3, 20, 150); this.onGround = false; }
        break;
      case 'air':
        if (this.onGround && this.stateT > 0.1) {
          this.setState('recover');
          this.vx = 0;
          this.slamCd = rnd(1.8, 2.8);
          w.shake(4, 0.2); audio.sfx('slam');
          w.fx.dust(this.x - 12, this.y, -1, 6); w.fx.dust(this.x + 12, this.y, 1, 6);
          w.fx.ring(this.x, this.y - 2, '#f4d682', 6, 34, 0.22, 2);
          this.hitPlayerRect(this.x - 30, this.y - 20, 60, 22, 16, { kb: 200 });
          for (const d of [-1, 1]) {
            w.spawnProj({ x: this.x + d * 16, y: this.y - 1, vx: d * 160, vy: 0, owner: 'enemy', dmg: this.dmg(13), look: 'quake', color: '#cca44c', r: 7, life: 0.62, noReflect: true, light: null, noWall: true,
              update(pr, dt2, world) { if (!world.level.floorAt(pr.x, pr.y + 4) || world.level.solidAt(pr.x, pr.y - 6)) pr.dead = true; } });
          }
        }
        break;
      case 'recover':
        this.stop(dt);
        if (this.stateT > 0.8) this.setState('chase');
        break;
      default: this.setState('idle');
    }
  }
  frameName() {
    if (this.state === 'crouch' || this.state === 'recover') return 'm/weight/crouch';
    if (this.state === 'air') return 'm/weight/air';
    return 'm/weight/walk/' + (Math.abs(this.vx) > 4 ? Math.floor(this.t / 0.2) % 4 : 1);
  }
}
registerEnemy(WEIGHT, Weight);

// ---------------------------------------------------------------- 滑块车
const CART = {
  id: 'cart', name: '滑块车', spr: 'm/cart', icon: 'm/cart/idle/0', hp: 40, w: 30, h: 18, speed: 20,
  gold: [3, 6], data: 1, blood: ['#b07e4a', '#aab2c4', '#404050'],
  tip: '让它撞上墙：撞墙后会晕眩好一阵，这时它受到的伤害更高。',
  desc: '本该在气垫导轨上匀速滑行的实验小车。现在它看见人就油门到底，直到撞上什么为止——摩擦力？不存在的。',
};
class Cart extends Enemy {
  ai(dt) {
    const p = this.player, w = this.world, dx = this.dx(), adx = Math.abs(dx), dy = p.y - this.y;
    this.superArmor = this.state === 'charge';
    this.contact = this.state === 'charge' ? 12 : 0;
    switch (this.state) {
      case 'idle':
        this.patrol(dt, this.def.speed);
        if (!p.dead && Math.abs(dy) < 28 && adx < 230 && (this.aggro || sign(dx) === this.facing || adx < 80) && w.level.los(this.x, this.cy, p.x, p.cy)) {
          this.aggro = true; this.facePlayer(); this.setState('rev'); this.telegraph(0.6); audio.sfx('charge', { gap: 0.3 });
        }
        break;
      case 'rev':
        this.stop(dt);
        if (Math.random() < 0.5) w.fx.sparks(this.x - this.facing * 12, this.y - 2, '#ffd27a', 1, this.facing > 0 ? Math.PI : 0);
        if (this.stateT > 0.6) { this.setState('charge'); this.dist0 = this.x; }
        break;
      case 'charge':
        this.vx = this.facing * 250 * this.speedMul;
        if (Math.random() < 0.5) w.fx.dust(this.x - this.facing * 14, this.y, -this.facing, 1);
        if (this.hitWall) {
          this.stunT = 1.6; this.vx = -this.facing * 60; this.vy = -120;
          w.shake(3, 0.18); audio.sfx('hitHeavy');
          w.fx.sparks(this.x + this.facing * 16, this.y - 8, '#ffffff', 8);
          this.setState('idle'); this.pauseT = 0.5;
        } else if (this.stateT > 1.25 || (this.onGround && this.edgeAhead(this.facing, 10)) || (dx * this.facing < -70)) { this.setState('skid'); }
        break;
      case 'skid':
        this.stop(dt, 500);
        if (this.stateT > 1.0) { this.setState('idle'); this.pauseT = 0.5; }
        break;
      default: this.setState('idle');
    }
  }
  onTouch(p) { p.vx = this.facing * 260; }
  modifyDamage(dmg) { return this.stunT > 0 ? dmg * 1.5 : dmg; }
  drawOffsetY() { return this.state === 'rev' ? Math.round(Math.sin(this.t * 60)) : 0; }
  frameName() {
    if (this.state === 'charge') return 'm/cart/charge/' + (Math.floor(this.t / 0.05) % 2);
    return 'm/cart/idle/' + (Math.abs(this.vx) > 4 || this.state === 'rev' ? Math.floor(this.t / 0.1) % 2 : 0);
  }
}
registerEnemy(CART, Cart);

// ---------------------------------------------------------------- 摆锤蝠
const BAT = {
  id: 'bat', name: '摆锤蝠', spr: 'm/bat', icon: 'm/bat/fly/1', iconOy: -14, hp: 16, w: 14, h: 14, flying: true,
  gold: [2, 4], data: 1, blood: ['#7e88a8', '#4e3868', '#ffd650'],
  tip: '平时倒挂在天花板上装睡。它俯冲的轨迹是一道弧线，原地起跳就能让它扑空。',
  desc: '长了翅膀的摆球，倒挂在天花板上小憩。有人从下面经过时，它就沿着摆线俯冲下来，再荡回高处。',
};
class Bat extends Enemy {
  constructor(def, x, y, o) {
    super(def, x, y, o);
    this.ceilY = o && o.ceil ? y : null;
    this.state = 'hang'; this.cd = 0;
    if (this.ceilY !== null) this.y = this.ceilY + 22;
    else this.state = 'seek';
  }
  findCeil() {
    const lv = this.world.level;
    let ty = Math.floor((this.y - this.h) / TILE), n = 0;
    while (!lv.isSolid(Math.floor(this.x / TILE), ty) && n < 16) { ty--; n++; }
    return (ty + 1) * TILE;
  }
  ai(dt) {
    const p = this.player, w = this.world;
    this.cd -= dt;
    this.contact = this.state === 'dive' ? 9 : 0;
    switch (this.state) {
      case 'seek':
        this.ceilY = this.findCeil(); this.setState('rise');
        break;
      case 'hang':
        this.vx = this.vy = 0;
        if (this.cd <= 0 && !p.dead && Math.abs(p.x - this.x) < 150 && p.cy > this.y && p.cy - this.y < 220 && w.level.los(this.x, this.y, p.x, p.cy)) {
          this.aggro = true; this.setState('wake'); this.telegraph(0.28);
        } else if (this.aggro && this.cd <= 0 && this.stateT > 2.5) this.aggro = false;
        break;
      case 'wake':
        if (this.stateT > 0.28) {
          this.setState('dive');
          this.tx = p.x; this.ty = p.cy;
          const d = Math.hypot(this.tx - this.x, this.ty - this.y) || 1;
          this.vx = (this.tx - this.x) / d * 60; this.vy = (this.ty - this.y) / d * 60;
          this.facing = sign(this.vx) || 1;
        }
        break;
      case 'dive': {
        const sp = Math.min(260, Math.hypot(this.vx, this.vy) + 620 * dt);
        const d = Math.hypot(this.tx - this.x, this.ty - this.y) || 1;
        this.vx = approach(this.vx, (this.tx - this.x) / d * sp, 900 * dt);
        this.vy = approach(this.vy, (this.ty - this.y) / d * sp, 900 * dt);
        if (d < 14 || this.stateT > 1.3 || this.hitWall || this.y > this.ty + 16) this.setState('rise');
        break;
      }
      case 'rise': {
        const gy = this.ceilY + 22;
        this.vx = approach(this.vx, this.facing * 90, 400 * dt);
        this.vy = approach(this.vy, -170, 700 * dt);
        if (this.hitWall) this.facing = -this.facing;
        if (this.y <= gy + 2 || this.hitCeil) {
          const c = this.findCeil();
          if (this.y - c < 30) { this.ceilY = c; this.y = c + 22; this.setState('hang'); this.cd = rnd(0.8, 1.6); } else this.ceilY = c;
        }
        if (this.stateT > 4) { this.ceilY = this.findCeil(); }
        break;
      }
      default: this.setState('seek');
    }
  }
  onInterrupt() { if (this.state === 'hang' || this.state === 'wake') { this.setState('rise'); } }
  frameName() { return this.state === 'hang' ? 'm/bat/hang' : this.state === 'wake' ? 'm/bat/fly/1' : 'm/bat/fly/' + (Math.floor(this.t / 0.07) % 3); }
  draw(ctx, camX, camY) {
    if (this.state === 'hang') {
      const sx = Math.round(this.x - camX), sy = Math.round(this.ceilY - camY);
      drawSprite(ctx, 'm/bat/hang', sx, sy);
      if (this.flash > 0) drawSil(ctx, 'm/bat/hang', sx, sy, false, '#ffffff', 0.9);
      else if (this.frozenT > 0) drawSil(ctx, 'm/bat/hang', sx, sy, false, '#9fdcff', 0.62);
      return;
    }
    super.draw(ctx, camX, camY);
  }
}
registerEnemy(BAT, Bat);
