// 首领：嘟礼·暴君（放大版嘟礼）与 奇点（对撞核心）
import { TILE, T_PLAT, T_PHASE } from '../core/config.js';
import { audio } from '../core/audio.js';
import { clamp, rnd, sign, approach, segRect, TAU, RNG } from '../core/util.js';
import { drawSprite, drawSil } from '../core/assets.js';
import { Enemy, registerEnemy, spawnEnemy } from './enemy.js';
import { Bomb, Shockwave } from './summons.js';
import { pxLine, pxCircle } from './fx.js';
import { drawGlow } from './lighting.js';
import { G } from './state.js';

const IDLE_DUR = [0.2, 0.2, 0.2, 0.18, 0.1, 0.2];
const CLAW_END = [0.18, 0.33, 0.40, 0.52, 0.61, 0.79];

// ---------------------------------------------------------------- 嘟礼·暴君
const TYRANT = {
  id: 'tyrant', name: '嘟礼·暴君', spr: 'dulix', icon: 'dulix/idle/0', iconScale: 0.45, boss: true,
  hp: 760, w: 44, h: 84, speed: 100, kbResist: 1, gold: [0, 0], data: 0, blood: ['#b3ad8a', '#56634a', '#3a3340'],
  tip: '它冲撞时把它引向墙壁——撞墙会让它晕上好一阵。飞扑落地的震波要跳起来躲。',
  desc: '在配电大厅里吸饱了电的嘟礼，个头足足大了一圈。爪击成串、飞扑震地、蹲身冲撞，血量越低越暴躁，还会吼来帮手。',
};

class Tyrant extends Enemy {
  constructor(def, x, y, o) {
    super(def, x, y, o);
    this.state = 'intro'; this.aggro = true;
    this.superArmor = true; this.superArmorHard = true;
    this.phase = 1; this.last = ''; this.repeat = 0; this.combo = 0;
    this.facing = -1;
  }

  think() {
    const adx = Math.abs(this.dx());
    const hpK = this.hp / this.maxHp;
    const need = hpK < 0.33 ? 3 : hpK < 0.66 ? 2 : 1;
    if (need > this.phase) { this.phase = need; this.start('roar'); return; }
    let opts;
    if (adx < 96) opts = [['claw', 3], ['pounce', 0.6]];
    else if (adx < 230) opts = [['pounce', 2], ['charge', 1.2], ['claw', 1.2]];
    else opts = [['charge', 2], ['pounce', 2]];
    if (this.repeat >= 2) opts = opts.filter((o) => o[0] !== this.last);
    let total = 0; for (const o of opts) total += o[1];
    let r = Math.random() * total, pick = opts[0][0];
    for (const o of opts) { r -= o[1]; if (r <= 0) { pick = o[0]; break; } }
    if (pick === this.last) this.repeat++; else { this.repeat = 0; this.last = pick; }
    this.start(pick);
  }

  start(move) {
    this.facePlayer();
    switch (move) {
      case 'claw': this.combo = this.phase >= 2 ? 3 : 2; this.beginClaw(0); break;
      case 'pounce': this.setState('pounceWind'); this.telegraph(0.42); break;
      case 'charge': this.setState('chargeWind'); this.telegraph(0.55); audio.sfx('growl'); break;
      case 'roar': this.setState('roar'); audio.sfx('roar'); this.world.shake(6, 0.9); break;
      default: break;
    }
  }

  beginClaw(skip) {
    this.setState('claw'); this.stateT = skip; this.hitDone = false; this.swung = false;
    this.telegraph(0.3 - skip);
  }

  ai(dt) {
    const p = this.player, w = this.world, dx = this.dx(), adx = Math.abs(dx);
    const rage = 1 + (this.phase - 1) * 0.14;
    switch (this.state) {
      case 'intro':
        this.stop(dt);
        if (this.stateT > 0.5 && !this.roared) { this.roared = true; audio.sfx('roar'); w.shake(5, 0.8); }
        if (w.bossIntroT <= 0 && this.stateT > 1.4) this.setState('think');
        break;
      case 'think':
        this.stop(dt);
        this.facePlayer();
        if (this.stateT > (0.55 - this.phase * 0.12)) {
          if (adx > 110 && Math.random() < 0.3) this.setState('walk'); else this.think();
        }
        break;
      case 'walk':
        this.facePlayer();
        this.walk(dt, this.facing, this.def.speed * rage);
        if (adx < 90 || this.stateT > 1.1) this.think();
        break;
      case 'claw': {
        const t = this.stateT * rage;
        if (t < 0.33) this.stop(dt);
        else if (t < 0.52) {
          this.walk(dt, this.facing, 270, 5000);
          if (!this.swung) {
            this.swung = true; audio.sfx('swingHeavy');
            const f = this.facing;
            w.fx.slash(this.x + f * 24, this.y - 48, 46, f > 0 ? -1.3 : Math.PI + 1.3, f > 0 ? 1.0 : Math.PI - 1.0, '#e9e2c0', 0.18, 11);
          }
          if (!this.hitDone && this.hitFront(96, 18, { top: 88, h: 84, kb: 240 })) this.hitDone = true;
        } else this.stop(dt, 2000);
        if (t > 0.79) {
          this.combo--;
          if (this.combo > 0 && Math.abs(this.dx()) < 190) { this.facePlayer(); this.beginClaw(0.14); } else this.setState('rest');
        }
        break;
      }
      case 'pounceWind':
        this.stop(dt);
        if (this.stateT < 0.3) this.facePlayer();
        if (this.stateT > 0.42 / rage) {
          this.setState('pounceAir'); this.hitDone = false;
          this.vx = this.facing * clamp(adx / 0.66, 200, 540);
          this.vy = -520; this.onGround = false;
          audio.sfx('growl');
        }
        break;
      case 'pounceAir':
        if (!this.hitDone && this.hitPlayerRect(this.x - 30 + this.facing * 14, this.y - 80, 60, 74, 20, { kb: 280 })) this.hitDone = true;
        if (this.hitWall) this.vx = 0;
        if (this.onGround && this.stateT > 0.1) {
          this.setState('pounceLand'); this.vx *= 0.2;
          w.shake(7, 0.3); audio.sfx('slam');
          w.fx.ring(this.x, this.y - 2, '#e9e2c0', 10, 80, 0.3, 2);
          for (let i = 0; i < 4; i++) w.fx.dust(this.x + rnd(-40, 40), this.y, sign(rnd(-1, 1)), 4);
          this.hitPlayerRect(this.x - 74, this.y - 26, 148, 28, 20, { kb: 260 });
          for (const d of [-1, 1]) {
            w.spawnProj({ x: this.x + d * 30, y: this.y - 1, vx: d * 235, vy: 0, owner: 'enemy', dmg: this.dmg(16), look: 'quake', color: '#b3ad8a', r: 9, life: 0.85, noReflect: true, light: null, noWall: true,
              update(pr, dt2, world) { if (!world.level.floorAt(pr.x, pr.y + 4) || world.level.solidAt(pr.x, pr.y - 6)) pr.dead = true; } });
          }
          if (this.phase >= 2) {
            const gy = this.y;
            for (let i = 0; i < 2 + this.phase; i++) w.addActor(new Bomb(clamp(p.x + rnd(-90, 90), w.level.pxW * 0.04, w.level.pxW * 0.96), gy, { type: 'bolt', delay: 0.6 + i * 0.22, dmg: this.dmg(15), color: '#bfe9ff', y0: gy - 280, y1: gy }));
          }
        }
        break;
      case 'pounceLand':
        this.stop(dt, 2400);
        if (this.stateT > 0.8 / rage) this.setState('think');
        break;
      case 'chargeWind':
        this.stop(dt);
        if (this.stateT < 0.4) this.facePlayer();
        if (this.stateT > 0.55 / rage) { this.setState('charge'); this.x0 = this.x; this.hitDone = false; }
        break;
      case 'charge':
        this.vx = this.facing * 440 * rage;
        if (Math.random() < 0.7) w.fx.dust(this.x - this.facing * 20, this.y, -this.facing, 2);
        if (!this.hitDone && this.hitPlayerRect(this.x - 22, this.y - 78, 44, 76, 20, { kb: 340 })) this.hitDone = true;
        if (this.hitWall) {
          this.vx = -this.facing * 90; this.vy = -200;
          w.shake(8, 0.35); audio.sfx('hitHeavy'); audio.sfx('slam');
          w.fx.sparks(this.x + this.facing * 26, this.y - 40, '#ffffff', 14);
          w.fx.text(this.x, this.y - 100, '撞晕了!', '#ffe14a', { size: 12 });
          this.stunT = 1.7;
          this.setState('rest');
        } else if (this.stateT > 1.5 || Math.abs(this.x - this.x0) > 560) this.setState('skid');
        break;
      case 'skid':
        this.stop(dt, 900);
        if (this.stateT > 0.5) this.setState('think');
        break;
      case 'roar':
        this.stop(dt);
        if (this.stateT > 0.5 && !this.summoned) {
          this.summoned = true;
          const lv = w.level;
          const id = this.phase === 2 ? 'grad' : 'duli';
          for (const sx of [lv.pxW * 0.14, lv.pxW * 0.86]) {
            const e = spawnEnemy(id, sx, this.y, { minion: true, spawnFx: true, hpMul: id === 'duli' ? 0.4 : 0.7 });
            if (e) { e.aggro = true; w.addEnemy(e); w.fx.ring(sx, this.y - 20, '#c98bff', 4, 30, 0.4, 2); }
          }
          w.fx.text(this.x, this.y - 104, this.phase === 2 ? '暴怒!' : '狂暴!', '#ff6b5e', { size: 12, life: 1.2 });
          w.fx.ring(this.x, this.y - 40, '#ff6b5e', 10, 120, 0.5, 2);
        }
        if (this.stateT > 1.3) { this.summoned = false; this.setState('think'); }
        break;
      case 'rest':
        this.stop(dt, 2000);
        if (this.stateT > 0.6 / rage) this.setState('think');
        break;
      default: this.setState('think');
    }
  }

  modifyDamage(dmg) { return this.stunT > 0 ? dmg * 1.35 : dmg; }
  onInterrupt() {}

  onDeath() {
    const w = this.world;
    for (let i = 0; i < 5; i++) w.fx.ring(this.x + rnd(-30, 30), this.y - rnd(10, 80), '#e9e2c0', 6, 60 + i * 14, 0.4 + i * 0.08, 2);
    w.fx.debris(this.x, this.y - 40, this.def.blood, 40);
  }

  frameName() {
    if (this.stunT > 0) return 'dulix/crouch/3';
    const idle = () => { let t = this.t % 1.08, i = 0; while (i < 5 && t > IDLE_DUR[i]) { t -= IDLE_DUR[i]; i++; } return 'dulix/idle/' + i; };
    switch (this.state) {
      case 'intro': return this.stateT > 0.5 && this.stateT < 1.2 ? 'dulix/crouch/' + [1, 2, 3, 3, 3, 2, 1][Math.min(6, Math.floor((this.stateT - 0.5) / 0.1))] : idle();
      case 'walk': return 'dulix/chase/' + (Math.floor(this.t / 0.11) % 6);
      case 'claw': { const t = this.stateT * (1 + (this.phase - 1) * 0.14); let i = 0; while (i < 5 && t > CLAW_END[i]) i++; return 'dulix/claw/' + i; }
      case 'pounceWind': return this.stateT < 0.18 ? 'dulix/pounce/0' : 'dulix/pounce/1';
      case 'pounceAir': return this.stateT < 0.07 ? 'dulix/pounce/2' : this.vy < -160 ? 'dulix/pounce/3' : this.vy < 190 ? 'dulix/pounce/4' : 'dulix/pounce/5';
      case 'pounceLand': return this.stateT < 0.3 ? 'dulix/pounce/6' : 'dulix/pounce/7';
      case 'chargeWind': return 'dulix/crouch/' + [1, 2, 3][Math.min(2, Math.floor(this.stateT / 0.12))];
      case 'charge': return 'dulix/chase/' + (Math.floor(this.t / 0.055) % 6);
      case 'skid': return 'dulix/crouch/1';
      case 'roar': return 'dulix/crouch/' + [1, 2, 3, 3, 3, 3, 2, 1, 0][Math.min(8, Math.floor(this.stateT / 0.14))];
      default: return idle();
    }
  }

  draw(ctx, camX, camY) {
    super.draw(ctx, camX, camY);
    // 狂暴后的电光
    if (this.phase >= 2 && Math.random() < 0.25) this.world.fx.sparks(this.x + rnd(-24, 24), this.y - rnd(8, 80), '#bfe9ff', 1);
  }
}
registerEnemy(TYRANT, Tyrant);

// ---------------------------------------------------------------- 奇点
const SING = {
  id: 'singularity', name: '奇点', spr: 'boss/core', icon: 'boss/core/0', iconScale: 0.55, iconOy: -4, boss: true,
  hp: 760, w: 40, h: 40, flying: true, fixed: true, kbResist: 1, contact: 12, glow: [110, '#c98bff'],
  gold: [0, 0], data: 0, blood: ['#c98bff', '#ffffff', '#62e6ff'],
  tip: '它闭着眼时伤害会被大幅削弱。连放两招之后它会睁眼喘息，那几秒才是输出窗口。',
  desc: '对撞核心里那个不该存在的点。电子环、引力脉冲、旋转光束、粒子雨轮番上阵——整座实验楼的异变都源自这里。关掉它。',
};

class Singularity extends Enemy {
  constructor(def, x, y, o) {
    super(def, x, y, o);
    this.hx = x; this.hy = y;
    this.state = 'intro'; this.aggro = true; this.superArmorHard = true;
    this.phase = 1; this.bag = []; this.count = 0; this.eye = 0;
    this.beams = []; this.beamOn = false; this.rng = new RNG(G.run.seed ^ 0x5151);
    this.spin = 0; this.shieldHintT = 0; this.sub = 0;
  }

  nextAttack() {
    if (!this.bag.length) {
      this.bag = ['ring', 'pulse', 'beams', 'summon'];
      if (this.phase >= 2) this.bag.push('rain');
      this.rng.shuffle(this.bag);
    }
    return this.bag.pop();
  }

  enterPhase(n) {
    const w = this.world, lv = w.level;
    this.phase = n;
    this.invulnerable = true; this.invT = 1.2;
    w.shake(7, 0.6); audio.sfx('roar'); w.flashScreen('#c98bff', 0.5, 0.4);
    w.fx.ring(this.x, this.cy, '#c98bff', 20, 220, 0.6, 2);
    w.fx.text(this.x, this.cy - 50, n === 2 ? '时空开始不稳定' : '坍缩加速!', '#e8a0f0', { size: 12, life: 1.6 });
    if (n === 2) {
      // 两侧平台变成忽隐忽现的叠加态平台
      for (let ty = 0; ty < lv.h; ty++) for (let tx = 0; tx < lv.w; tx++) {
        if (lv.get(tx, ty) === T_PLAT && (ty === 4 || ty === 10)) lv.set(tx, ty, T_PHASE);
      }
      lv.hasPhase = true; lv.invalidate();
    }
    for (const pr of w.projs) if (pr.owner === 'enemy') pr.dead = true;
    this.beams.length = 0; this.beamOn = false;
    this.setState('rest'); this.count = 0;
  }

  ai(dt) {
    const p = this.player, w = this.world;
    this.spin += dt * (0.8 + this.phase * 0.5);
    this.x = this.hx; this.y = this.hy + Math.sin(this.t * 1.4) * 4;
    if (this.invT > 0) { this.invT -= dt; if (this.invT <= 0) this.invulnerable = false; }
    const hpK = this.hp / this.maxHp;
    const need = hpK < 0.33 ? 3 : hpK < 0.66 ? 2 : 1;
    if (need > this.phase && this.state !== 'intro') { this.enterPhase(need); return; }
    const cx = this.x, cy = this.cy;
    switch (this.state) {
      case 'intro':
        this.eye = this.stateT > 0.6 ? 2 : 0;
        if (this.stateT > 0.6 && !this.roared) { this.roared = true; audio.sfx('warp'); w.shake(4, 0.8); w.fx.ring(cx, cy, '#c98bff', 20, 200, 0.8, 2); }
        if (w.bossIntroT <= 0 && this.stateT > 1.5) this.setState('rest');
        break;
      case 'rest':
        this.eye = 0;
        if (this.stateT > 1.0 - this.phase * 0.15) {
          if (this.count >= 2) { this.count = 0; this.setState('weak'); audio.sfx('phase'); w.fx.text(cx, cy - 44, '它睁眼了——趁现在!', '#ffe14a', { size: 12, life: 1.4 }); } else { this.count++; this.attack = this.nextAttack(); this.setState(this.attack); this.sub = 0; this.fired = 0; }
        }
        break;
      case 'weak':
        this.eye = 2;
        if (this.stateT > 3.8) this.setState('rest');
        break;
      case 'ring': {
        this.eye = 1;
        const waves = this.phase;
        if (this.stateT > 0.5 + this.fired * 0.7 && this.fired < waves) {
          const n = 9 + this.phase * 2, off = this.fired * 0.31 + rnd(0, 0.5), dir = this.fired % 2 ? -1 : 1;
          for (let i = 0; i < n; i++) {
            const a = i / n * TAU + off;
            w.spawnProj({ x: cx, y: cy, vx: Math.cos(a) * 104, vy: Math.sin(a) * 104, owner: 'enemy', dmg: this.dmg(11), look: 'orb', color: '#62e6ff', r: 4, life: 4.2, noWall: true,
              update(pr, dt2) { const c = Math.cos(0.42 * dir * dt2), s = Math.sin(0.42 * dir * dt2); const vx = pr.vx * c - pr.vy * s; pr.vy = pr.vx * s + pr.vy * c; pr.vx = vx; } });
          }
          audio.sfx('zap'); w.fx.ring(cx, cy, '#62e6ff', 10, 40, 0.25, 2);
          this.fired++;
        }
        if (this.stateT > 0.9 + waves * 0.7) this.setState('rest');
        break;
      }
      case 'pulse': {
        this.eye = 1;
        const T = 1.5;
        if (this.stateT < T) {
          if (this.stateT < 0.05 && !this.sub) { this.sub = 1; audio.sfx('pull'); }
          const dx = cx - p.x, dy = cy - p.cy, d = Math.hypot(dx, dy) || 1;
          if (!p.dead && !p.rolling) { p.vx += dx / d * 520 * dt; if (!p.onGround) p.vy += dy / d * 260 * dt; }
          for (let i = 0; i < 2; i++) {
            const a = rnd(0, TAU), r = rnd(80, 200);
            w.fx.burst(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, { color: ['#c98bff', '#ffffff', '#62e6ff'], speed: 0, vx: -Math.cos(a) * r * 2.6, vy: -Math.sin(a) * r * 2.6, grav: 0, drag: 0, life: 0.34, lifeMax: 0.36 });
          }
        } else {
          const n = this.phase >= 3 ? 2 : 1;
          if (this.fired < n && this.stateT > T + this.fired * 0.55) {
            this.fired++;
            w.addActor(new Shockwave(cx, cy, { dmg: this.dmg(16), max: 330, speed: 250 }));
            audio.sfx('explode'); w.shake(5, 0.25);
          }
          if (this.stateT > T + n * 0.55 + 0.6) this.setState('rest');
        }
        break;
      }
      case 'beams': {
        this.eye = 1;
        if (!this.beams.length) {
          const k = 1 + this.phase, base = rnd(0, TAU);
          this.beamDir = Math.random() < 0.5 ? 1 : -1;
          for (let i = 0; i < k; i++) this.beams.push({ a: base + i / k * TAU, len: 0 });
          audio.sfx('charge');
        }
        this.beamOn = this.stateT > 0.9;
        if (this.beamOn && !this.sub) { this.sub = 1; audio.sfx('beam'); }
        const om = (0.5 + this.phase * 0.14) * this.beamDir;
        for (const b of this.beams) {
          if (this.beamOn) b.a += om * dt;
          b.len = w.level.raycast(cx, cy, Math.cos(b.a), Math.sin(b.a), 520);
          if (this.beamOn && !p.dead && segRect(cx, cy, cx + Math.cos(b.a) * b.len, cy + Math.sin(b.a) * b.len, p.x - p.w / 2 + 1, p.y - p.h + 1, p.w - 2, p.h - 2)) p.hurt(this.dmg(12), { x: cx, burn: 1 });
        }
        if (this.stateT > 0.9 + 3.4) { this.beams.length = 0; this.beamOn = false; this.setState('rest'); }
        break;
      }
      case 'summon':
        this.eye = 1;
        if (this.stateT > 0.5 && !this.sub) {
          this.sub = 1;
          const n = 2 + this.phase;
          for (let i = 0; i < n; i++) {
            const a = i / n * TAU + rnd(0, 1);
            const e = spawnEnemy('neutrino', cx + Math.cos(a) * 70, cy + Math.sin(a) * 50 + 8, { minion: true, spawnFx: true });
            if (e) { e.aggro = true; w.addEnemy(e); }
          }
          audio.sfx('teleport'); w.fx.ring(cx, cy, '#d6f8ff', 10, 80, 0.4, 2);
        }
        if (this.stateT > 1.2) this.setState('rest');
        break;
      case 'rain':
        this.eye = 1;
        if (!this.sub) {
          this.sub = 1;
          const lv = w.level, floor = (lv.h - 1) * TILE, n = 5 + this.phase;
          const xs = [p.x];
          for (let i = 1; i < n; i++) xs.push(rnd(TILE * 2, lv.pxW - TILE * 2));
          xs.forEach((x, i) => w.addActor(new Bomb(x, floor, { type: 'column', r: 13, delay: 0.75 + i * 0.16, dmg: this.dmg(14), color: '#7dffd8', y0: TILE, y1: floor })));
          audio.sfx('warn');
        }
        if (this.stateT > 2.2) this.setState('rest');
        break;
      default: this.setState('rest');
    }
  }

  modifyDamage(dmg, info) {
    if (this.state === 'weak') return dmg * 1.5;
    if (info.src !== 'dot' && this.shieldHintT < G.time) { this.shieldHintT = G.time + 4; this.world.fx.text(this.x, this.cy - 40, '闭眼时伤害被削弱', '#9aa0b4', { size: 10 }); }
    return dmg * 0.5;
  }
  onInterrupt() {}
  freeze() {}

  onDeath() {
    const w = this.world;
    this.beams.length = 0;
    for (let i = 0; i < 8; i++) w.fx.ring(this.x, this.cy, i % 2 ? '#ffffff' : '#c98bff', 10, 60 + i * 36, 0.5 + i * 0.1, 2);
    w.fx.burst(this.x, this.cy, 60, { color: ['#c98bff', '#ffffff', '#62e6ff'], speed: 60, speedMax: 320, life: 0.6, lifeMax: 1.4, grav: 0, drag: 1, light: 1 });
    // 平台恢复
    const lv = w.level;
    for (let i = 0; i < lv.tiles.length; i++) if (lv.tiles[i] === T_PHASE) lv.tiles[i] = T_PLAT;
    lv.hasPhase = false; lv.invalidate();
  }

  draw(ctx, camX, camY) {
    const x = Math.round(this.x - camX), y = Math.round(this.cy - camY);
    const weak = this.state === 'weak';
    // 瞄准线 / 光束
    for (const b of this.beams) {
      const ex = x + Math.cos(b.a) * b.len, ey = y + Math.sin(b.a) * b.len;
      if (this.beamOn) { pxLine(ctx, x, y, ex, ey, '#c98bff', 5); pxLine(ctx, x, y, ex, ey, '#ffffff', 2); } else { ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(this.t * 16)); pxLine(ctx, x, y, ex, ey, '#ff8ad0', 1); ctx.globalAlpha = 1; }
    }
    // 轨道环
    for (let r = 0; r < 3; r++) {
      const rad = 30 + r * 9, n = 14 + r * 4, tilt = 0.45 + r * 0.2;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + this.spin * (r % 2 ? -1 : 1) * (1 + r * 0.3);
        if (Math.sin(a) > 0) continue;       // 后半圈先画
        ctx.fillStyle = r === 1 ? '#62e6ff' : '#8f6adf';
        ctx.fillRect(Math.round(x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad * tilt), 2, 2);
      }
    }
    const f = 'boss/core/' + (Math.floor(this.t / 0.1) % 4);
    drawSprite(ctx, f, x, y);
    if (this.flash > 0) drawSil(ctx, f, x, y, false, '#ffffff', 0.85);
    else if (weak) drawSil(ctx, f, x, y, false, '#ff7ad9', 0.25 + 0.15 * Math.sin(this.t * 10));
    else if (this.invulnerable) drawSil(ctx, f, x, y, false, '#ffffff', 0.4);
    drawSprite(ctx, 'boss/eye/' + this.eye, x, y);
    for (let r = 0; r < 3; r++) {
      const rad = 30 + r * 9, n = 14 + r * 4, tilt = 0.45 + r * 0.2;
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + this.spin * (r % 2 ? -1 : 1) * (1 + r * 0.3);
        if (Math.sin(a) <= 0) continue;
        ctx.fillStyle = r === 1 ? '#bff4ff' : '#e0c8ff';
        ctx.fillRect(Math.round(x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad * tilt), 2, 2);
      }
    }
    if (!weak && !this.invulnerable && this.state !== 'intro') {
      // 护盾：六边形闪光
      ctx.globalAlpha = 0.25 + 0.1 * Math.sin(this.t * 5);
      pxCircle(ctx, x, y, 27, '#62e6ff');
      ctx.globalAlpha = 1;
    }
    if (this.beamOn) drawGlow(ctx, x, y, 60, '#c98bff', 0.5);
  }
}
registerEnemy(SING, Singularity);
