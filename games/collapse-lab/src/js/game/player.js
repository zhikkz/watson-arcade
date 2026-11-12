// 主角：张震
import { TILE, GRAVITY, MAX_FALL, T_SPIKE, T_ACID, T_PLAT, T_PHASE, COLORS } from '../core/config.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { approach, clamp, sign, rnd } from '../core/util.js';
import { drawSprite, drawSil } from '../core/assets.js';
import { G } from './state.js';
import { Weapons } from './weapons.js';
import { BODY_W, STAND_H, ROLL_H, RUN, ACC_G, ACC_A, FRIC, JUMP_V, DJUMP_V, JUMP_CUT, ledgeTarget } from './movement.js';

const ROLL_SPEED = 300, ROLL_T = 0.36, DASH_T = 0.2, ROLL_CD = 0.24;
const COYOTE = 0.1, JUMP_BUF = 0.12;

const IDLE_DUR = [0.19, 0.2, 0.2, 0.1, 0.18, 0.2];

export class Player {
  constructor(x, y) {
    this.kind = 'player';
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.w = BODY_W; this.h = STAND_H;
    this.facing = 1;
    this.onGround = false; this.hitWall = 0; this.hitCeil = false; this.onIce = false; this.ride = null;
    this.state = 'normal';
    this.stateT = 0;
    this.world = null;
    this.dead = false;

    this.coyote = 0; this.jumpBuf = 0; this.airJumps = 1; this.airDash = true;
    this.rollT = 0; this.rollCd = 0; this.rollDir = 1; this.rollAir = false;
    this.dropT = 0; this.invuln = 0; this.iframe = 0; this.flash = 0;
    this.landT = 0; this.tuckT = 0; this.animT = 0; this.runPhase = 0; this.stepSfx = 0;
    this.climb = null; this.lookDown = false;
    this.healT = 0; this.healed = false;
    this.pose = null;                 // 攻击姿势覆盖 {frame, oy}
    this.atk = null;                  // 当前攻击状态（由 Weapons 管理）
    this.atkBuf = -1; this.atkBufT = 0;
    this.status = { burn: 0, chill: 0, burnTick: 0 };
    this.fallStart = y;
    this.combo = 0; this.comboT = 0;  // 连击计数（定理用）
    this.lastHurtT = 99;
    this.speedBoostT = 0;
    this.shield = 0;
    this.gunT = 0; this.gunItem = null; this.discOut = false; this.comboNext = null;
  }

  get run() { return G.run; }
  get cx() { return this.x; }
  get cy() { return this.y - this.h / 2; }
  get rolling() { return this.state === 'roll'; }

  // ---------------------------------------------------------------- 数值
  moveSpeed() {
    let s = RUN * (1 + this.run.stat('speed'));
    if (this.status.chill > 0) s *= 0.68;
    if (this.speedBoostT > 0) s *= 1.25;
    if (this.run.hasPerk('relativity')) s *= 1 + 0.3 * (1 - this.run.hp / this.run.maxHp);
    return s;
  }

  // ---------------------------------------------------------------- 主更新
  update(dt) {
    const run = this.run, lv = this.world.level;
    this.stateT += dt; this.animT += dt;
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.iframe = Math.max(0, this.iframe - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.landT = Math.max(0, this.landT - dt);
    this.tuckT = Math.max(0, this.tuckT - dt);
    this.dropT = Math.max(0, this.dropT - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.atkBufT = Math.max(0, this.atkBufT - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    this.speedBoostT = Math.max(0, this.speedBoostT - dt);
    this.gunT = Math.max(0, this.gunT - dt);
    this.lastHurtT += dt;
    if (this.comboT <= 0) this.combo = 0;
    run.tickCooldowns(dt);
    this.updateStatus(dt);
    if (this.state === 'dead') { this.updateDead(dt); return; }

    const locked = this.world.inputLocked;
    const ax = locked ? 0 : input.axisX();
    const jumpPressed = !locked && (input.pressed('jump') || input.pressed('up'));
    const jumpHeld = !locked && (input.down('jump') || input.down('up'));
    const downHeld = !locked && input.down('down');
    if (jumpPressed) this.jumpBuf = JUMP_BUF;
    this.lookDown = downHeld && this.onGround && this.state === 'normal' && Math.abs(this.vx) < 5;

    // 攻击键缓冲
    if (!locked) {
      if (input.pressed('atk1')) { this.atkBuf = 0; this.atkBufT = 0.18; }
      if (input.pressed('atk2')) { this.atkBuf = 1; this.atkBufT = 0.18; }
    }

    switch (this.state) {
      case 'normal': this.updateNormal(dt, ax, jumpHeld, downHeld, locked); break;
      case 'roll': this.updateRoll(dt, ax); break;
      case 'attack': this.updateAttack(dt, ax, jumpHeld); break;
      case 'hurt': this.updateHurt(dt); break;
      case 'heal': this.updateHeal(dt); break;
      case 'climb': this.updateClimb(dt); break;
      case 'slam': this.updateSlam(dt); break;
      case 'enter': this.vx = 0; if (this.stateT > 0.45) this.setState('normal'); this.applyGravity(dt, true); break;
      default: break;
    }

    if (this.state !== 'climb') {
      const wasGround = this.onGround, fallV = this.vy;
      lv.moveBody(this, dt, this.dropT > 0);
      if (this.onGround && !wasGround) this.onLand(fallV);
      if (this.onGround) { this.coyote = COYOTE; this.airJumps = 1 + run.stat('airJumps'); this.airDash = true; } else this.coyote = Math.max(0, this.coyote - dt);
      this.checkHazards(dt);
      this.tryLedge(ax);
    }
    // 掉出世界的兜底
    if (this.y > lv.pxH + 80) { this.x = this.world.safeX; this.y = this.world.safeY; this.vx = this.vy = 0; this.hurt(8, { silentKb: true }); }
    if (this.onGround && this.state === 'normal' && !lv.rectTouches(this.x - 6, this.y - 8, 12, 8, T_SPIKE)) {
      if (lv.isSolid(Math.floor(this.x / TILE), Math.floor((this.y + 2) / TILE))) { this.world.safeX = this.x; this.world.safeY = this.y; }
    }
  }

  setState(s) {
    if (this.state === 'roll' && s !== 'roll') this.h = STAND_H;
    this.state = s; this.stateT = 0;
    if (s !== 'attack') { this.pose = null; this.atk = null; }
  }

  applyGravity(dt, jumpHeld) {
    let g = GRAVITY;
    if (this.vy > 0) g *= 1.12;
    this.vy = Math.min(MAX_FALL, this.vy + g * dt);
    if (!jumpHeld && this.vy < -JUMP_CUT && !this.noCut) this.vy = -JUMP_CUT;
    if (this.vy >= 0) this.noCut = false;
  }

  moveHoriz(dt, ax, factor = 1) {
    const max = this.moveSpeed() * factor;
    const ice = this.onIce ? 0.12 : 1;
    if (ax !== 0) {
      const acc = (this.onGround ? ACC_G : ACC_A) * ice;
      // 超速（冲刺后）时不强行减速到上限，而是自然衰减
      if (Math.abs(this.vx) > max && sign(this.vx) === ax) this.vx = approach(this.vx, ax * max, FRIC * 0.5 * dt * ice);
      else this.vx = approach(this.vx, ax * max, acc * dt);
      this.facing = ax;
    } else {
      this.vx = approach(this.vx, 0, (this.onGround ? FRIC : FRIC * 0.35) * dt * ice);
    }
  }

  // ---------------------------------------------------------------- 常规状态
  updateNormal(dt, ax, jumpHeld, downHeld, locked) {
    const run = this.run;
    this.moveHoriz(dt, ax);
    this.applyGravity(dt, jumpHeld);

    // 跳跃 / 下跳 / 下砸 / 二段跳
    if (this.jumpBuf > 0) {
      const lv = this.world.level;
      const onPlat = this.onGround && this.standingOnPlat();
      if (downHeld && onPlat) {
        this.dropThrough();
      } else if (downHeld && !this.onGround && this.coyote <= 0) {
        this.jumpBuf = 0; this.startSlam();
        return;
      } else if (this.onGround || this.coyote > 0) {
        this.doJump(JUMP_V, false);
      } else if (this.airJumps > 0) {
        this.airJumps--; this.doJump(DJUMP_V, true);
      }
    }

    if (locked) return;
    // 翻滚 / 空中冲刺
    if (input.pressed('roll') && this.rollCd <= 0) { if (this.startRoll(ax)) return; }
    // 喝水
    if (input.pressed('heal')) this.tryHeal();
    // 技能
    if (input.pressed('skill')) Weapons.useSkill(this);
    // 攻击
    if (this.atkBufT > 0) {
      const slot = this.atkBuf;
      if (Weapons.tryStart(this, slot, ax)) { this.atkBufT = 0; return; }
    }
    // 按住连发的远程武器
    for (let s = 0; s < 2; s++) {
      if (input.down(s === 0 ? 'atk1' : 'atk2') && Weapons.isAuto(run.weapons[s])) { if (Weapons.tryStart(this, s, ax)) return; }
    }
  }

  standingOnPlat() {
    const lv = this.world.level;
    if (this.ride) return true;
    const ty = Math.floor((this.y + 1) / TILE);
    const tx0 = Math.floor((this.x - this.w / 2) / TILE), tx1 = Math.floor((this.x + this.w / 2 - 0.001) / TILE);
    let plat = false;
    for (let tx = tx0; tx <= tx1; tx++) {
      if (lv.isSolid(tx, ty)) return false;
      const t = lv.get(tx, ty);
      if (t === T_PLAT || t === T_PHASE) plat = true;
    }
    return plat;
  }

  dropThrough() {
    this.dropT = 0.2; this.vy = 80; this.jumpBuf = 0;
    this.onGround = false; this.coyote = 0; this.ride = null;
  }

  doJump(v, isDouble) {
    const run = this.run;
    this.vy = -v * (1 + run.stat('jump'));
    this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.ride = null;
    this.noCut = false;
    if (isDouble) {
      this.tuckT = 0.34;
      audio.sfx('djump');
      this.world.fx.ring(this.x, this.y - 6, '#cfe8ff', 3, 16, 0.22);
      this.world.fx.burst(this.x, this.y - 4, 6, { color: ['#ffffff', '#bfe0ff'], speed: 30, speedMax: 70, angle: Math.PI / 2, spread: 1.6, grav: 40, life: 0.2, lifeMax: 0.35 });
      if (run.hasPerk('kepler')) run.spawnOrbit(this);
    } else {
      audio.sfx('jump');
      this.world.fx.dust(this.x, this.y, 0, 5);
    }
  }

  onLand(fallV) {
    if (fallV > 260) { this.landT = 0.09; audio.sfx('land'); this.world.fx.dust(this.x - 5, this.y, -1, 3); this.world.fx.dust(this.x + 5, this.y, 1, 3); }
    this.tuckT = 0;
  }

  // ---------------------------------------------------------------- 翻滚 / 冲刺
  startRoll(ax) {
    const run = this.run;
    const dir = ax !== 0 ? ax : this.facing;
    if (!this.onGround) {
      if (!this.airDash) return false;
      this.airDash = false;
      this.rollAir = true;
      this.rollT = DASH_T;
    } else {
      this.rollAir = false;
      this.rollT = ROLL_T * (1 + run.stat('rollLen'));
    }
    this.setState('roll');
    this.rollDir = dir; this.facing = dir;
    this.h = ROLL_H;
    this.iframe = this.rollT - 0.04;
    this.rollCd = this.rollT + ROLL_CD * (1 - run.stat('rollCd'));
    this.vx = dir * ROLL_SPEED * (this.rollAir ? 1.1 : 1);
    if (this.rollAir) this.vy = 0;
    this.ghostT = 0;
    audio.sfx('roll');
    this.world.fx.dust(this.x - dir * 6, this.y, -dir, 5);
    run.onRoll(this);
    return true;
  }

  updateRoll(dt, ax) {
    const lv = this.world.level;
    this.rollT -= dt;
    // 翻滚结束却站不起来时改为可控的低姿移动；不能一直被原方向推在墙上。
    if (this.rollT <= 0 && !this.canStand()) {
      this.iframe = 0;
      this.moveHoriz(dt, ax, 0.62);
      this.applyGravity(dt, true);
      if (this.jumpBuf > 0 && input.down('down') && this.onGround && this.standingOnPlat()) this.dropThrough();
      return;
    }
    const sp = ROLL_SPEED * (this.rollAir ? 1.1 : 1);
    this.vx = this.rollDir * (this.rollT > 0.08 ? sp : sp * 0.62);
    if (this.rollAir) this.vy = 0; else this.applyGravity(dt, true);
    this.ghostT -= dt;
    if (this.ghostT <= 0) { this.ghostT = 0.045; this.world.fx.ghost(this.spriteName(), this.x, this.y, this.facing < 0, '#8fd8ff', 0.2); }
    if (!this.rollAir && this.onGround && Math.random() < 0.5) this.world.fx.dust(this.x - this.rollDir * 8, this.y, -this.rollDir, 1);
    // 翻滚可被跳跃取消（保留动量）
    if (this.jumpBuf > 0 && this.rollT < ROLL_T - 0.12 && (this.onGround || this.coyote > 0) && this.canStand()) {
      this.setState('normal'); this.doJump(JUMP_V, false); this.vx = this.rollDir * sp * 0.85; return;
    }
    if (this.rollT <= 0) {
      this.setState('normal');
      this.vx = this.rollDir * this.moveSpeed() * 0.8;
    }
  }

  canStand() {
    return !this.world.level.rectSolid(this.x - this.w / 2, this.y - STAND_H, this.w, STAND_H - 1);
  }

  // ---------------------------------------------------------------- 攻击
  updateAttack(dt, ax, jumpHeld) {
    this.applyGravity(dt, jumpHeld);
    const done = Weapons.update(this, dt, ax);
    if (this.state !== 'attack') return;
    // 翻滚取消
    if (input.pressed('roll') && this.rollCd <= 0 && !this.world.inputLocked) { if (this.startRoll(ax)) return; }
    // 跳跃取消（出招后段）
    if (this.jumpBuf > 0 && this.atk && this.atk.canCancel) {
      if (this.onGround || this.coyote > 0) { this.setState('normal'); this.doJump(JUMP_V, false); return; }
      if (this.airJumps > 0) { this.airJumps--; this.setState('normal'); this.doJump(DJUMP_V, true); return; }
    }
    if (done) this.setState('normal');
  }

  // ---------------------------------------------------------------- 下砸
  startSlam() {
    this.setState('slam');
    this.vx = 0; this.vy = -120;
    this.slamFrom = this.y;
    audio.sfx('swingHeavy');
  }

  updateSlam(dt) {
    const w = this.world;
    this.vx = 0;
    this.vy = this.stateT < 0.1 ? this.vy + 900 * dt : 700;
    this.iframe = Math.max(this.iframe, 0.05);
    if (this.stateT > 0.1 && Math.random() < 0.7) w.fx.ghost(this.spriteName(), this.x, this.y, this.facing < 0, '#ffd27a', 0.16);
    if (this.onGround) {
      const drop = clamp((this.y - this.slamFrom) / 120, 0.4, 2);
      const dmg = this.run.dmg('melee', 14 * (0.7 + drop * 0.5));
      w.fx.ring(this.x, this.y - 2, '#ffe9b0', 6, 50, 0.28, 2);
      w.fx.dust(this.x - 10, this.y, -1, 6); w.fx.dust(this.x + 10, this.y, 1, 6);
      w.shake(5, 0.22); audio.sfx('slam');
      for (const e of w.enemiesInRadius(this.x, this.y - 10, 50)) {
        w.hitEnemy(e, dmg, { kbx: sign(e.x - this.x) * 160, kby: -180, stun: 0.6, src: 'slam' });
      }
      w.breakCratesInRect(this.x - 40, this.y - 30, 80, 34);
      this.setState('normal'); this.landT = 0.14; this.vy = 0;
    }
    if (this.stateT > 2) this.setState('normal');
  }

  // ---------------------------------------------------------------- 攀沿
  tryLedge(ax) {
    if (this.state !== 'normal' || this.onGround || this.hitWall === 0 || ax !== this.hitWall) return;
    if (this.vy < -140) return;
    const target = ledgeTarget(this.world.level, this, this.hitWall);
    if (!target) return;
    this.climb = { x0: this.x, y0: this.y, x1: target.x, y1: target.y, t: 0 };
    this.setState('climb');
    this.vx = this.vy = 0;
    audio.sfx('step');
  }

  updateClimb(dt) {
    const c = this.climb;
    c.t += dt / 0.16;
    const k = Math.min(1, c.t);
    // 先上后前
    const ky = Math.min(1, k * 1.6), kx = Math.max(0, (k - 0.4) / 0.6);
    this.y = c.y0 + (c.y1 - c.y0) * ky;
    this.x = c.x0 + (c.x1 - c.x0) * kx;
    if (k >= 1) { this.x = c.x1; this.y = c.y1; this.onGround = true; this.setState('normal'); this.landT = 0.06; this.airJumps = 1 + this.run.stat('airJumps'); this.airDash = true; }
  }

  // ---------------------------------------------------------------- 回血
  tryHeal() {
    const run = this.run;
    if (run.flask <= 0) { audio.sfx('deny'); this.world.fx.text(this.x, this.y - 58, '保温杯空了', '#9aa0b4'); return; }
    if (run.hp >= run.maxHp) return;
    this.setState('heal');
    this.healed = false;
    audio.sfx('gulp');
  }

  updateHeal(dt) {
    const run = this.run;
    this.vx = approach(this.vx, 0, FRIC * dt);
    this.applyGravity(dt, true);
    const T = 0.55 * (1 - run.stat('healSpeed'));
    if (!this.healed && this.stateT >= T * 0.75) {
      this.healed = true;
      run.flask--;
      const amt = Math.round(run.maxHp * (0.55 + run.stat('healAmt')));
      run.heal(amt, this);
      audio.sfx('heal');
      this.world.fx.burst(this.x, this.y - 26, 14, { color: ['#7be07b', '#c8ffb0', '#ffffff'], speed: 20, speedMax: 60, grav: -80, life: 0.4, lifeMax: 0.8 });
    }
    if (this.stateT >= T) this.setState('normal');
  }

  // ---------------------------------------------------------------- 受伤 / 死亡
  /** 返回 true 表示确实受到了伤害 */
  hurt(dmg, o = {}) {
    const run = this.run, w = this.world;
    if (this.state === 'dead' || w.cutscene) return false;
    if (this.iframe > 0 && !o.unavoidable) {
      if (!this.dodgeTextT || this.dodgeTextT < G.time - 0.4) { this.dodgeTextT = G.time; run.onDodge(this); }
      return false;
    }
    if (this.invuln > 0) return false;
    if (run.hasPerk('uncertainty') && Math.random() < 0.15) {
      w.fx.text(this.x, this.y - 58, '测不准!', '#c98bff'); this.invuln = 0.3; return false;
    }
    dmg = Math.max(1, Math.round(dmg * (1 - run.stat('armor')) * run.difficultyDmg()));
    if (this.shield > 0) {
      const ab = Math.min(this.shield, dmg);
      this.shield -= ab; dmg -= ab;
      w.fx.text(this.x, this.y - 58, '屏蔽', '#62e6ff');
      if (dmg <= 0) { this.invuln = 0.4; audio.sfx('block'); return false; }
    }
    run.hp -= dmg;
    run.dmgTaken += dmg;
    this.lastHurtT = 0;
    this.combo = 0;
    w.fx.text(this.x, this.y - 56, '-' + dmg, '#ff6b5e', { size: 12 });
    w.fx.burst(this.x, this.cy, 8, { color: ['#ff6b5e', '#ffb0a0'], speed: 50, speedMax: 130, life: 0.25, lifeMax: 0.5 });
    w.shake(4, 0.2); w.hitstop(0.07); w.flashScreen('#ff2b2b', 0.9, 0.3, true);
    audio.sfx('hurt');
    if (o.burn) this.status.burn = Math.max(this.status.burn, o.burn);
    if (o.chill) this.status.chill = Math.max(this.status.chill, o.chill);
    run.onHurt(this, dmg, o);
    if (run.hp <= 0) {
      if (run.tryRevive(this)) return true;
      run.hp = 0; this.die(); return true;
    }
    this.invuln = 0.9; this.flash = 0.12;
    if (!o.silentKb) {
      const dir = o.x !== undefined ? (sign(this.x - o.x) || -this.facing) : -this.facing;
      this.vx = dir * (o.kb || 150); this.vy = Math.min(this.vy, -170);
      this.onGround = false;
      this.setState('hurt');
    }
    return true;
  }

  updateHurt(dt) {
    this.applyGravity(dt, true);
    this.vx = approach(this.vx, 0, 500 * dt);
    if (this.stateT > 0.24) this.setState('normal');
  }

  die() {
    this.setState('dead');
    this.vx = 0; this.vy = -120;
    this.dead = true;
    audio.sfx('death');
    this.world.onPlayerDeath();
  }

  updateDead(dt) {
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
    this.vx = approach(this.vx, 0, 300 * dt);
    this.world.level.moveBody(this, dt);
    // 坍缩成像素
    if (this.stateT < 1.2 && Math.random() < 0.8) {
      this.world.fx.burst(this.x + rnd(-8, 8), this.y - rnd(0, 46), 2, { color: ['#62e6ff', '#ffffff', '#8fa0ff'], speed: 10, speedMax: 50, grav: -120, life: 0.4, lifeMax: 0.9 });
    }
  }

  updateStatus(dt) {
    const s = this.status;
    if (s.chill > 0) s.chill = Math.max(0, s.chill - dt);
    if (s.burn > 0) {
      s.burn = Math.max(0, s.burn - dt);
      s.burnTick -= dt;
      if (Math.random() < 0.4) this.world.fx.embers(this.x + rnd(-6, 6), this.y - rnd(8, 40), 1);
      if (s.burnTick <= 0 && this.state !== 'dead') {
        s.burnTick = 0.5;
        const run = this.run;
        const d = Math.max(1, Math.round(3 * run.difficultyDmg()));
        run.hp = Math.max(1, run.hp - d);
        this.world.fx.text(this.x, this.y - 54, '-' + d, COLORS.burn, { size: 8 });
      }
      if (this.rolling) s.burn = Math.max(0, s.burn - dt * 4);   // 翻滚灭火
    }
  }

  checkHazards(dt) {
    const lv = this.world.level;
    if (this.state === 'dead') return;
    // 地刺：只在脚踩进刺尖范围内才算
    if (lv.rectTouches(this.x - 5, this.y - 9, 10, 9, T_SPIKE)) {
      if (this.hurt(12, { unavoidable: false, kb: 60 })) { this.vy = -300; this.onGround = false; }
    }
    if (lv.rectTouches(this.x - 5, this.y - 12, 10, 12, T_ACID)) {
      this.acidT = (this.acidT || 0) - dt;
      this.vx *= 0.9;
      if (this.acidT <= 0) { this.acidT = 0.45; this.hurt(9, { burn: 1.5, silentKb: true, unavoidable: true }); this.invuln = Math.min(this.invuln, 0.3); }
    }
  }

  // ---------------------------------------------------------------- 绘制
  spriteName() {
    if (this.pose) return this.pose.frame;
    switch (this.state) {
      case 'dead': return 'hero/slide/5';
      case 'hurt': return 'hero/tuck/4';
      case 'climb': return this.climb && this.climb.t > 0.5 ? 'hero/jump/6' : 'hero/jump/3';
      case 'slam': return 'hero/tuck/' + (Math.floor(this.stateT / 0.05) % 6);
      case 'heal': return 'hero/idle/2';
      case 'enter': return 'hero/jump/6';
      case 'roll': {
        if (this.rollAir) return 'hero/tuck/' + (Math.floor(this.stateT / 0.04) % 6);
        const t = this.stateT;
        if (t < 0.04) return 'hero/slide/3';
        if (this.rollT < 0.07) return 'hero/slide/7';
        return 'hero/slide/' + (4 + Math.floor(t / 0.07) % 3);
      }
      default: break;
    }
    if (!this.onGround) {
      if (this.tuckT > 0) return 'hero/tuck/' + (Math.floor((0.34 - this.tuckT) / 0.055) % 6);
      if (this.vy < -300) return 'hero/jump/2';
      if (this.vy < -90) return 'hero/jump/3';
      if (this.vy < 110) return 'hero/jump/4';
      return 'hero/jump/5';
    }
    if (this.landT > 0) return 'hero/jump/6';
    if (this.gunT > 0 && Math.abs(this.vx) <= 14) return 'hero/run/3';
    if (Math.abs(this.vx) > 14) {
      return 'hero/run/' + (Math.floor(this.runPhase) % 6);
    }
    // 待机：按素材包给出的帧时长
    let t = this.animT % 1.07, i = 0;
    while (i < 5 && t > IDLE_DUR[i]) { t -= IDLE_DUR[i]; i++; }
    return 'hero/idle/' + i;
  }

  animate(dt) {
    if (this.onGround && Math.abs(this.vx) > 14 && (this.state === 'normal' || (this.state === 'attack' && !this.pose))) {
      const prev = Math.floor(this.runPhase);
      this.runPhase += dt * (Math.abs(this.vx) / RUN) / 0.085;
      const cur = Math.floor(this.runPhase);
      if (cur !== prev && (cur % 3 === 1)) audio.sfx('step');
    } else if (this.state === 'normal') this.runPhase = 0;
  }

  draw(ctx, camX, camY) {
    const sx = this.x - camX, sy = this.y - camY;
    const name = this.spriteName();
    const flip = this.facing < 0;
    const oy = this.pose && this.pose.oy ? this.pose.oy : 0;
    if (this.atk && this.atk.drawBehind) this.atk.drawBehind(ctx, camX, camY);
    if (this.state === 'dead') {
      const k = clamp(1 - this.stateT / 1.3, 0, 1);
      if (k > 0) { drawSprite(ctx, name, sx, sy, flip, k); drawSil(ctx, name, sx, sy, flip, '#62e6ff', (1 - k) * k * 2); }
      return;
    }
    const blink = this.invuln > 0 && this.iframe <= 0 && Math.floor(this.invuln * 20) % 2 === 0;
    drawSprite(ctx, name, sx, sy + oy, flip, blink ? 0.45 : 1);
    if (this.flash > 0) drawSil(ctx, name, sx, sy + oy, flip, '#ffffff', 0.85);
    else if (this.status.chill > 0) drawSil(ctx, name, sx, sy + oy, flip, '#8fdcff', 0.35);
    else if (this.status.burn > 0) drawSil(ctx, name, sx, sy + oy, flip, '#ff8a3a', 0.25 + 0.1 * Math.sin(G.time * 20));
    if (this.shield > 0) drawSil(ctx, name, sx, sy + oy, flip, '#62e6ff', 0.2 + 0.1 * Math.sin(G.time * 8));
    if (this.state === 'heal') {
      // 举起保温杯
      drawSprite(ctx, 'item/flask', sx + this.facing * 7, sy - 36 - Math.min(4, this.stateT * 20), flip);
    }
    if (this.atk && this.atk.draw) this.atk.draw(ctx, camX, camY);
    else if (this.gunT > 0 && this.state === 'normal') Weapons.drawGunOverlay(ctx, this, camX, camY);
  }
}

export const PLAYER_CONST = { RUN, JUMP_V, STAND_H, ROLL_H };
