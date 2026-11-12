// 热学车间的怪物：冻冻、焦耳、瓦特、小妖
import { audio } from '../core/audio.js';
import { clamp, rnd, sign, approach } from '../core/util.js';
import { Enemy, registerEnemy } from './enemy.js';
import { Field } from './summons.js';

// ---------------------------------------------------------------- 冻冻
const CRYO = {
  id: 'cryo', name: '冻冻', spr: 'm/cryo', icon: 'm/cryo/0', hp: 30, w: 18, h: 14, contact: 8, contactFx: { chill: 2.5 },
  gold: [3, 5], data: 1, blood: ['#84ccf2', '#d6f4ff', '#4e8ecc'],
  tip: '碰到它会被冻得行动迟缓。它死时还会炸开一团寒雾，用远程解决最稳妥。',
  desc: '液氮罐里漏出来的一坨东西，居然学会了蹦跶。摸上去零下一百九十六度。',
};
class Cryo extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.wait = rnd(0.4, 1.4); }
  ai(dt) {
    const p = this.player, dx = this.dx();
    switch (this.state) {
      case 'idle':
        this.stop(dt, 700);
        if (!this.onGround) break;
        this.wait -= dt;
        if (!this.aggro && this.seesPlayer(190, 90)) this.aggro = true;
        if (this.wait <= 0) this.setState('squash');
        break;
      case 'squash':
        this.stop(dt, 700);
        if (this.stateT > 0.25) {
          const near = this.aggro && !p.dead;
          const dir = near ? (sign(dx) || 1) : (Math.random() < 0.5 ? 1 : -1);
          this.facing = dir;
          this.vx = dir * (near ? clamp(Math.abs(dx), 60, 120) : rnd(30, 60)) * this.speedMul;
          this.vy = -rnd(250, 310);
          this.onGround = false;
          this.setState('air');
        }
        break;
      case 'air':
        if (this.hitWall) this.vx = -this.vx * 0.5;
        if (this.onGround && this.stateT > 0.1) { this.setState('idle'); this.wait = this.aggro ? rnd(0.5, 0.9) : rnd(1, 2); this.world.fx.frost(this.x, this.y, 3); }
        break;
      default: this.setState('idle');
    }
  }
  onDeath() {
    const w = this.world;
    w.explode(this.x, this.cy, 40, this.dmg(6), { owner: 'enemy', color: '#bfeaff', sfx: 'freeze', chill: 3 });
    const gy = w.level.groundBelow(this.x, this.y - 6, 5);
    w.addActor(new Field(this.x, gy === null ? this.y : gy, 30, 2.5, this.dmg(3), { owner: 'enemy', type: 'frost' }));
  }
  frameName() { return 'm/cryo/' + (this.state === 'squash' ? 1 : this.state === 'air' ? 2 : 0); }
}
registerEnemy(CRYO, Cryo);

// ---------------------------------------------------------------- 焦耳
const JOULE = {
  id: 'joule', name: '焦耳', spr: 'm/joule', icon: 'm/joule/0', iconOy: -8, hp: 28, w: 14, h: 22, flying: true, contact: 7, contactFx: { burn: 2 }, glow: [48, '#ff9a4a'],
  gold: [3, 5], data: 1, blood: ['#ff8232', '#ffd068', '#fffadc'],
  tip: '火球是抛物线，落地会留下一片火。别站在原地，被点着了就翻滚灭火。',
  desc: '炉膛里蹦出来的一团火苗，忽左忽右地飘。它抛出的火球会在地上烧一小会儿。',
};
class Joule extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.cd = rnd(1.2, 2.6); this.side = Math.random() < 0.5 ? 1 : -1; }
  ai(dt) {
    const p = this.player, w = this.world;
    this.cd -= dt;
    if (!this.aggro && this.seesPlayer(220, 150)) this.aggro = true;
    if (Math.random() < 0.3) w.fx.embers(this.x + rnd(-4, 4), this.y - rnd(4, 18), 1);
    if (this.state === 'wind') {
      this.vx *= 0.9; this.vy *= 0.9;
      if (this.stateT > 0.36) {
        const dx = p.x - this.x, dy = p.y - 6 - this.cy;
        const T = clamp(Math.abs(dx) / 150, 0.45, 0.95), g = 520;
        w.spawnProj({ x: this.x, y: this.cy, vx: dx / T, vy: dy / T - g * T / 2, grav: g, owner: 'enemy', dmg: this.dmg(9), look: 'fire', color: '#ff9a4a', r: 4, life: 3, burn: 2.5,
          explode: { r: 24, color: '#ff9a4a', sfx: 'burn', field: 2, fieldType: 'fire' }, fieldType: 'fire' });
        audio.sfx('throw');
        this.setState('idle'); this.cd = rnd(2.4, 3.4);
      }
      return;
    }
    if (this.aggro && !p.dead) {
      if (Math.random() < dt * 0.5) this.side = -this.side;
      const tx = p.x + this.side * 104 + Math.sin(this.t * 2.3) * 24, ty = p.cy - 34 + Math.sin(this.t * 3.1) * 16;
      this.vx = approach(this.vx, clamp((tx - this.x) * 2, -80, 80) * this.speedMul, 220 * dt);
      this.vy = approach(this.vy, clamp((ty - this.cy) * 2, -60, 60), 220 * dt);
      this.facing = sign(p.x - this.x) || 1;
      if (this.cd <= 0 && this.dist() < 220 && w.level.los(this.x, this.cy, p.x, p.cy)) { this.setState('wind'); this.telegraph(0.36, '#ff9a4a'); }
    } else {
      this.vx = approach(this.vx, Math.sin(this.t * 0.9) * 24, 80 * dt);
      this.vy = approach(this.vy, Math.cos(this.t * 1.3) * 14, 80 * dt);
    }
  }
  frameName() { return 'm/joule/' + (Math.floor(this.t / 0.1) % 3); }
}
registerEnemy(JOULE, Joule);

// ---------------------------------------------------------------- 瓦特
const WATT = {
  id: 'watt', name: '瓦特', spr: 'm/watt', icon: 'm/watt/walk/1', hp: 60, w: 22, h: 38, speed: 44, kbResist: 0.5,
  gold: [5, 8], data: 2, blood: ['#c47448', '#4a4650', '#e2e2ec'],
  tip: '血量见底时它会烧得通红并冲过来自爆。要么立刻打死，要么翻滚拉开距离。',
  desc: '一台长了腿的小锅炉，压力表就是它的独眼。近身会喷高温蒸汽；被逼急了，它会把压力顶到爆表。',
};
class Watt extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.cd = rnd(0.5, 1.5); this.tick = 0; this.hot = false; }
  ai(dt) {
    const p = this.player, w = this.world, dx = this.dx(), adx = Math.abs(dx), dy = p.y - this.y;
    this.cd -= dt;
    if (!this.hot && this.hp < this.maxHp * 0.42 && this.state !== 'idle') {
      this.hot = true; this.setState('hot'); this.superArmor = true;
      this.telegraph(0.5); audio.sfx('warn'); w.fx.text(this.x, this.y - this.h - 18, '过热!', '#ff6b5e', { size: 12 });
    }
    switch (this.state) {
      case 'idle':
        this.patrol(dt, 18);
        if (this.aggro || this.noticePlayer(190, 80, 70)) { this.aggro = true; this.setState('chase'); }
        break;
      case 'chase':
        if (p.dead) { this.setState('idle'); this.aggro = false; break; }
        this.facePlayer();
        if (adx < 66 && Math.abs(dy) < 34 && this.cd <= 0 && this.onGround) { this.setState('wind'); this.telegraph(0.4); break; }
        if (this.onGround && this.edgeAhead(this.facing) && dy < 20) this.stop(dt);
        else if (adx > 40) this.walk(dt, this.facing, this.def.speed);
        else this.stop(dt);
        break;
      case 'wind':
        this.stop(dt);
        if (this.stateT > 0.4) { this.setState('vent'); this.tick = 0; audio.sfx('steam'); }
        break;
      case 'vent': {
        this.stop(dt);
        const f = this.facing;
        w.fx.burst(this.x + f * 18, this.y - 17, 2, { color: ['#e8e8f0', '#c0c4d0', '#ffffff'], speed: 130, speedMax: 230, angle: f > 0 ? 0 : Math.PI, spread: 0.5, grav: -30, drag: 2.6, life: 0.24, lifeMax: 0.4, size: 3, shrink: true });
        this.tick -= dt;
        if (this.tick <= 0) { this.tick = 0.25; this.hitFront(64, 7, { top: 34, h: 32, inner: 8, burn: 1.5, kb: 120 }); }
        if (this.stateT > 0.9) { this.setState('recover'); this.cd = rnd(1.4, 2.2); }
        break;
      }
      case 'recover':
        this.stop(dt);
        if (this.stateT > 0.5) this.setState('chase');
        break;
      case 'hot': {
        this.facePlayer();
        if (this.stateT > 0.5) this.walk(dt, this.facing, this.def.speed * 2.6, 1400); else this.stop(dt);
        if (Math.random() < 0.6) w.fx.embers(this.x + rnd(-8, 8), this.y - rnd(6, 34), 1);
        const touching = adx < 22 && Math.abs(dy) < 40;
        if (this.stateT > 3 || (this.stateT > 0.6 && touching)) {
          w.explode(this.x, this.cy, 58, this.dmg(22), { owner: 'enemy', color: '#ff9a4a', burn: 3 });
          this.hp = 0; this.die({});
        }
        break;
      }
      default: this.setState('idle');
    }
  }
  onInterrupt() { if (this.state !== 'idle' && this.state !== 'hot') this.setState('chase'); }
  frameName() {
    if (this.state === 'hot') return 'm/watt/hot/' + (Math.floor(this.t / 0.08) % 2);
    if (this.state === 'vent' || this.state === 'wind') return 'm/watt/vent/' + (Math.floor(this.t / 0.08) % 2);
    return 'm/watt/walk/' + (Math.abs(this.vx) > 4 ? Math.floor(this.t / 0.15) % 4 : 1);
  }
}
registerEnemy(WATT, Watt);

// ---------------------------------------------------------------- 小妖
const IMP = {
  id: 'imp', name: '麦克斯韦小妖', spr: 'm/imp', icon: 'm/imp/fly/0', iconOy: -10, hp: 36, w: 14, h: 18, flying: true, glow: [36, '#c98bff'],
  gold: [5, 9], data: 2, blood: ['#9676b0', '#e0543c', '#549ce8'],
  tip: '它总是先瞬移再出手，而且冷热交替。记住上一发是什么，下一发就是相反的。',
  desc: '传说中把守着小门、挑拣快慢分子的那只小妖。它左手攥着热、右手攥着冷，瞬移到你身边再丢过来。',
};
class Imp extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.cd = rnd(1, 2); this.hotNext = Math.random() < 0.5; }
  ai(dt) {
    const p = this.player, w = this.world;
    this.cd -= dt;
    if (!this.aggro && this.seesPlayer(230, 160)) this.aggro = true;
    switch (this.state) {
      case 'idle':
        this.vx = approach(this.vx, Math.sin(this.t * 1.3) * 22, 100 * dt);
        this.vy = approach(this.vy, Math.cos(this.t * 2.1) * 16, 100 * dt);
        this.facing = sign(p.x - this.x) || 1;
        if (this.aggro && this.cd <= 0 && !p.dead) {
          // 瞬移到玩家附近的空位
          for (let i = 0; i < 8; i++) {
            const nx = p.x + (Math.random() < 0.5 ? -1 : 1) * rnd(70, 120), ny = p.y - rnd(30, 80);
            if (!w.level.rectSolid(nx - 8, ny - 20, 16, 22) && w.level.los(nx, ny - 10, p.x, p.cy)) {
              w.fx.ring(this.x, this.cy, '#c98bff', 12, 2, 0.2); w.fx.smoke(this.x, this.cy, 4, ['#c98bff', '#9676b0']);
              this.x = nx; this.y = ny;
              w.fx.ring(this.x, this.cy, '#c98bff', 2, 14, 0.2); audio.sfx('teleport', { gap: 0.1 });
              break;
            }
          }
          this.vx = this.vy = 0;
          this.facing = sign(p.x - this.x) || 1;
          this.setState('wind'); this.telegraph(0.34, this.hotNext ? '#ff9a4a' : '#8fdcff');
        }
        break;
      case 'wind':
        if (this.stateT > 0.34) {
          const d = Math.hypot(p.x - this.x, p.cy - this.cy) || 1;
          const hot = this.hotNext;
          w.spawnProj({ x: this.x, y: this.cy, vx: (p.x - this.x) / d * 190, vy: (p.cy - this.cy) / d * 190, owner: 'enemy', dmg: this.dmg(10), look: hot ? 'fire' : 'ice', color: hot ? '#ff9a4a' : '#8fdcff', r: 4, life: 2.4, burn: hot ? 2.5 : 0, chill: hot ? 0 : 3 });
          audio.sfx(hot ? 'burn' : 'freeze', { gap: 0.1 });
          this.hotNext = !hot;
          this.setState('throw');
        }
        break;
      case 'throw':
        if (this.stateT > 0.3) { this.setState('idle'); this.cd = rnd(2, 3); }
        break;
      default: this.setState('idle');
    }
  }
  onInterrupt() { this.setState('idle'); this.cd = Math.max(this.cd, 0.8); }
  frameName() { return this.state === 'throw' || this.state === 'wind' ? 'm/imp/throw' : 'm/imp/fly/' + (Math.floor(this.t / 0.1) % 2); }
}
registerEnemy(IMP, Imp);
