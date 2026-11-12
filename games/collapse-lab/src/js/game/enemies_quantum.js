// 量子对撞机的怪物：叠加猫、夸克团（及散开的小夸克）、幽灵粒子、奇点幼体
import { audio } from '../core/audio.js';
import { clamp, rnd, sign, approach, TAU } from '../core/util.js';
import { Enemy, registerEnemy, spawnEnemy } from './enemy.js';
import { Bomb } from './summons.js';

// ---------------------------------------------------------------- 叠加猫
const CAT = {
  id: 'cat', name: '叠加猫', spr: 'm/cat', icon: 'm/cat/sit', hp: 46, w: 20, h: 16, speed: 122,
  gold: [5, 8], data: 2, blood: ['#40366a', '#6e6096', '#78ffe6'],
  tip: '半透明的时候打不中它，它也伤不到你。等它“坍缩”回实体再动手。',
  desc: '从那只著名的箱子里溜出来的猫，至今没人观测过它。它在“在”与“不在”之间来回切换，只有实体状态才会扑人。',
};
class QCat extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.phaseT = rnd(1.5, 3); this.ghostMode = false; this.cd = rnd(0.3, 1); this.alpha = 1; }
  setGhost(on) {
    this.ghostMode = on; this.untargetable = on;
    this.phaseT = on ? rnd(1.3, 1.9) : rnd(2.2, 3);
    this.world.fx.ring(this.x, this.cy, '#78ffe6', on ? 14 : 3, on ? 3 : 16, 0.2);
    if (Math.abs(this.x - this.player.x) < 300) audio.sfx('phase', { gap: 0.2 });
  }
  ai(dt) {
    const p = this.player, dx = this.dx(), adx = Math.abs(dx), dy = p.y - this.y;
    this.cd -= dt;
    this.alpha = approach(this.alpha, this.ghostMode ? 0.32 : 1, dt * 5);
    if (this.aggro && this.state !== 'pounce' && this.state !== 'wind') { this.phaseT -= dt; if (this.phaseT <= 0) this.setGhost(!this.ghostMode); }
    switch (this.state) {
      case 'idle':
        this.patrol(dt, 26);
        if (this.aggro || this.noticePlayer(200, 90, 70)) { this.aggro = true; this.setState('chase'); }
        break;
      case 'chase':
        if (p.dead) { this.setState('idle'); this.aggro = false; break; }
        if (this.ghostMode) {
          // 幽灵态：绕到玩家身后
          const tx = p.x - p.facing * 60;
          const d = tx - this.x;
          this.facing = sign(d) || this.facing;
          if (Math.abs(d) > 14 && !(this.onGround && this.edgeAhead(this.facing))) this.walk(dt, this.facing, this.def.speed); else this.stop(dt);
        } else {
          this.facePlayer();
          if (adx > 34 && adx < 130 && Math.abs(dy) < 50 && this.cd <= 0 && this.onGround) { this.setState('wind'); this.telegraph(0.26, '#78ffe6'); break; }
          if (this.onGround && this.edgeAhead(this.facing) && dy < 20) this.stop(dt);
          else if (adx > 26) this.walk(dt, this.facing, this.def.speed);
          else this.stop(dt);
        }
        if (this.onGround && this.wallAhead(this.facing) && this.lowWallAhead(this.facing, 3)) this.vy = -430;
        break;
      case 'wind':
        this.stop(dt);
        if (this.stateT > 0.26) { this.setState('pounce'); this.hitDone = false; this.vx = this.facing * clamp(adx / 0.38, 200, 340); this.vy = -230; this.onGround = false; audio.sfx('meow', { gap: 0.3 }); }
        break;
      case 'pounce':
        if (!this.hitDone && this.hitPlayerRect(this.x - 12, this.y - 18, 24, 18, 13, { kb: 160 })) this.hitDone = true;
        if (this.hitWall) this.vx = 0;
        if (this.onGround && this.stateT > 0.1) { this.setState('recover'); this.cd = rnd(1.2, 2); }
        break;
      case 'recover':
        this.stop(dt, 1400);
        if (this.stateT > 0.4) this.setState('chase');
        break;
      default: this.setState('idle');
    }
  }
  onInterrupt() { if (this.state !== 'idle') this.setState('chase'); }
  frameName() {
    if (this.state === 'pounce' || this.state === 'wind') return 'm/cat/pounce';
    if (this.state === 'recover') return 'm/cat/sit';
    return Math.abs(this.vx) > 6 ? 'm/cat/walk/' + (Math.floor(this.t / 0.08) % 4) : 'm/cat/sit';
  }
}
registerEnemy(CAT, QCat);

// ---------------------------------------------------------------- 夸克团
const QUARK = {
  id: 'quark', name: '夸克团', spr: 'm/quark', icon: 'm/quark/0', iconOy: -6, hp: 44, w: 22, h: 24, flying: true, glow: [40, '#ffffff'],
  gold: [5, 8], data: 2, blood: ['#e84848', '#5cd670', '#5490f4'],
  tip: '打散之后三颗小夸克会各自冲过来，留一手范围攻击收尾。',
  desc: '红、绿、蓝三颗夸克被看不见的弹簧拴在一起，谁也离不开谁。把它们打散？它们会更生气。',
};
class Quark extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.cd = rnd(1.2, 2.4); this.side = Math.random() < 0.5 ? 1 : -1; }
  ai(dt) {
    const p = this.player, w = this.world;
    this.cd -= dt;
    if (!this.aggro && this.seesPlayer(230, 160)) this.aggro = true;
    if (this.state === 'wind') {
      this.vx *= 0.92; this.vy *= 0.92;
      if (this.stateT > 0.4) {
        const a = Math.atan2(p.cy - this.cy, p.x - this.x);
        ['#e84848', '#5cd670', '#5490f4'].forEach((c, i) => {
          const an = a + (i - 1) * 0.36;
          w.spawnProj({ x: this.x, y: this.cy, vx: Math.cos(an) * 145, vy: Math.sin(an) * 145, owner: 'enemy', dmg: this.dmg(8), look: 'orb', color: c, r: 3, life: 2.4 });
        });
        audio.sfx('shoot', { gap: 0.1 });
        this.setState('idle'); this.cd = rnd(2.2, 3);
      }
      return;
    }
    if (this.aggro && !p.dead) {
      if (Math.random() < dt * 0.3) this.side = -this.side;
      const tx = p.x + this.side * 110, ty = p.cy - 30 + Math.sin(this.t * 1.6) * 14;
      this.vx = approach(this.vx, clamp((tx - this.x) * 1.2, -46, 46) * this.speedMul, 120 * dt);
      this.vy = approach(this.vy, clamp((ty - this.cy) * 1.2, -40, 40), 120 * dt);
      if (this.cd <= 0 && this.dist() < 230 && w.level.los(this.x, this.cy, p.x, p.cy)) { this.setState('wind'); this.telegraph(0.4, '#ffffff'); }
    } else {
      this.vx = approach(this.vx, Math.sin(this.t * 0.6) * 16, 50 * dt);
      this.vy = approach(this.vy, Math.cos(this.t) * 10, 50 * dt);
    }
  }
  onDeath() {
    const w = this.world;
    ['r', 'g', 'b'].forEach((c, i) => {
      const e = spawnEnemy('quarkmini', this.x + (i - 1) * 8, this.y - 4, { minion: true, color: c });
      if (e) { w.addEnemy(e); e.aggro = true; e.vx = (i - 1) * 90; e.vy = -120; }
    });
  }
  frameName() { return 'm/quark/' + (Math.floor(this.t / 0.14) % 3); }
}
registerEnemy(QUARK, Quark);

const QMINI = {
  id: 'quarkmini', name: '小夸克', spr: 'm/quarkmini/r', icon: 'm/quarkmini/r/0', iconScale: 2, hp: 8, w: 8, h: 8, flying: true, contact: 6,
  gold: [0, 1], data: 0, blood: ['#e84848', '#5cd670', '#5490f4'],
  tip: '很脆，但速度不慢。别被三颗一起撞上。',
  desc: '单独一颗的夸克。它不该单独存在——所以它急着找个东西撞上去。',
};
class QuarkMini extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.color = (o && o.color) || 'r'; this.life = 7; }
  ai(dt) {
    const p = this.player;
    this.life -= dt;
    if (this.life <= 0) { this.die({}); return; }
    const d = this.dist() || 1;
    const sp = this.stateT < 0.5 ? 20 : 112;
    this.vx = approach(this.vx, (p.x - this.x) / d * sp, 420 * dt);
    this.vy = approach(this.vy, (p.cy - this.cy) / d * sp, 420 * dt);
    this.facing = sign(this.vx) || 1;
  }
  onTouch() { this.minion = true; this.die({}); }
  frameName() { return `m/quarkmini/${this.color}/${Math.floor(this.t / 0.1) % 2}`; }
}
registerEnemy(QMINI, QuarkMini);

// ---------------------------------------------------------------- 幽灵粒子
const NEUTRINO = {
  id: 'neutrino', name: '幽灵粒子', spr: 'm/neutrino', icon: 'm/neutrino/0', iconScale: 2, iconOy: -6, hp: 16, w: 10, h: 14, flying: true, contact: 8, glow: [26, '#d6f8ff'],
  gold: [2, 4], data: 1, blood: ['#d6f8ff', '#8cd6f0', '#ffffff'],
  tip: '它能穿墙，而且你的攻击有时会直接穿过它。多补几下就是了。',
  desc: '几乎不和任何东西打交道的粒子——墙挡不住它，你的武器有时也碰不到它。慢悠悠的，但甩不掉。',
};
class Neutrino extends Enemy {
  constructor(def, x, y, o) { super(def, x, y, o); this.ghost = true; this.alpha = 0.85; this.wob = rnd(0, 6); }
  ai(dt) {
    const p = this.player;
    if (!this.aggro && this.dist() < 240) this.aggro = true;
    if (this.aggro && !p.dead) {
      const d = this.dist() || 1;
      this.vx = approach(this.vx, (p.x - this.x) / d * 48 * this.speedMul + Math.sin(this.t * 3 + this.wob) * 22, 160 * dt);
      this.vy = approach(this.vy, (p.cy - this.cy) / d * 48 * this.speedMul + Math.cos(this.t * 2.3 + this.wob) * 22, 160 * dt);
      this.facing = sign(p.x - this.x) || 1;
    } else { this.vx = Math.sin(this.t + this.wob) * 12; this.vy = Math.cos(this.t * 1.4 + this.wob) * 10; }
  }
  modifyDamage(dmg, info) {
    if (info.src !== 'dot' && Math.random() < 0.25) { this.world.fx.text(this.x, this.y - 20, '穿过', '#d6f8ff', { size: 8 }); return 0; }
    return dmg;
  }
  frameName() { return 'm/neutrino/' + (Math.floor(this.t / 0.16) % 2); }
}
registerEnemy(NEUTRINO, Neutrino);

// ---------------------------------------------------------------- 奇点幼体
const SINGLET = {
  id: 'singlet', name: '奇点幼体', spr: 'm/singlet', icon: 'm/singlet/0', iconOy: -10, hp: 52, w: 18, h: 18, flying: true, contact: 12, kbResist: 0.6, glow: [34, '#c98bff'],
  gold: [5, 9], data: 3, blood: ['#be78ff', '#1a1228', '#ffffff'],
  tip: '靠近会被它的引力拖过去。打死后它会延迟坍缩爆炸，看到红圈马上离开。',
  desc: '对撞机里偶然诞生的微型黑洞。它不追人，只是慢慢飘着，把经过的一切往自己身上拽。',
};
class Singlet extends Enemy {
  ai(dt) {
    const p = this.player, w = this.world;
    const dx = p.x - this.x, dy = p.cy - this.cy, d = Math.hypot(dx, dy) || 1;
    if (!this.aggro && d < 230) this.aggro = true;
    if (this.aggro && !p.dead) {
      this.vx = approach(this.vx, dx / d * 30 * this.speedMul, 60 * dt);
      this.vy = approach(this.vy, dy / d * 30 * this.speedMul, 60 * dt);
      if (d < 120 && d > 10 && !p.rolling) {
        const pull = 360 * (1 - d / 150);
        p.vx -= dx / d * pull * dt;
        if (!p.onGround) p.vy -= dy / d * pull * dt * 0.7;
        if (Math.random() < 0.5) {
          const a = rnd(0, TAU), r = rnd(30, 80);
          w.fx.burst(this.x + Math.cos(a) * r, this.cy + Math.sin(a) * r, 1, { color: ['#c98bff', '#ffffff'], speed: 0, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3, grav: 0, drag: 0, life: 0.26, lifeMax: 0.3 });
        }
      }
    } else { this.vx = Math.sin(this.t * 0.7) * 10; this.vy = Math.cos(this.t) * 8; }
  }
  onDeath() {
    this.world.addActor(new Bomb(this.x, this.cy, { delay: 0.75, r: 58, dmg: this.dmg(18), color: '#c98bff', sfx: 'explode' }));
    audio.sfx('warn', { gap: 0.2 });
  }
  frameName() { return 'm/singlet/' + (Math.floor(this.t / 0.12) % 3); }
}
registerEnemy(SINGLET, Singlet);
