// 敌人基类：感知、移动助手、状态效果、受击与死亡、通用绘制
import { GRAVITY, MAX_FALL, TILE, COLORS } from '../core/config.js';
import { audio } from '../core/audio.js';
import { approach, rnd, sign, rectsOverlap, clamp } from '../core/util.js';
import { drawSprite, drawSil, hasSprite } from '../core/assets.js';
import { drawText } from '../core/font.js';
import { G } from './state.js';

export class Enemy {
  constructor(def, x, y, o = {}) {
    this.kind = 'enemy';
    this.def = def; this.id = def.id; this.name = def.name;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.w = def.w; this.h = def.h;
    this.facing = o.facing || (Math.random() < 0.5 ? 1 : -1);
    this.elite = !!o.elite; this.boss = !!def.boss;
    const run = G.run;
    this.maxHp = Math.max(1, Math.round(def.hp * run.enemyHpMul() * (this.elite ? 2.6 : 1) * (o.hpMul || 1)));
    this.hp = this.maxHp;
    this.dmgMul = run.enemyDmgMul() * (this.elite ? 1.3 : 1);
    this.speedMul = this.elite ? 1.12 : 1;
    this.flying = !!def.flying; this.fixed = !!def.fixed;
    this.kbResist = Math.min(1, (def.kbResist || 0) + (this.elite ? 0.35 : 0));
    this.contact = def.contact || 0;
    this.state = 'idle'; this.stateT = 0;
    this.onGround = false; this.hitWall = 0; this.hitCeil = false; this.ride = null;
    this.flash = 0; this.stunT = 0; this.frozenT = 0; this.chill = 0; this.chillImmune = 0;
    this.burnT = 0; this.burnTick = 0; this.shockT = 0; this.shockTick = 0; this.rad = 0; this.radT = 0; this.radTick = 0;
    this.resonateT = 0; this.pulledT = 0;
    this.aggro = false; this.homeX = x; this.homeY = y;
    this.dead = false; this.untargetable = false;
    this.touchCd = 0; this.t = rnd(0, 10); this.hpShowT = 0;
    this.world = null;
    this.minion = !!o.minion;       // 召唤物：不掉落
    this.superArmor = false;
    this.spawnT = o.spawnFx ? 0.4 : 0;
  }

  get cy() { return this.y - this.h / 2; }
  get player() { return this.world.player; }
  dmg(base) { return Math.max(1, Math.round(base * this.dmgMul)); }
  setState(s) { this.state = s; this.stateT = 0; }

  // ---------------------------------------------------------------- 感知
  dx() { return this.player.x - this.x; }
  dy() { return this.player.cy - this.cy; }
  dist() { return Math.hypot(this.dx(), this.dy()); }
  facePlayer() { const d = this.dx(); if (Math.abs(d) > 2) this.facing = sign(d); }
  seesPlayer(range, vRange = 90) {
    const p = this.player;
    if (p.dead) return false;
    const dx = Math.abs(p.x - this.x), dy = Math.abs(p.cy - this.cy);
    if (dx > range || dy > vRange) return false;
    return this.world.level.los(this.x, this.cy, p.x, p.cy);
  }
  /** 发现玩家：近距离、或在面朝方向的视野里 */
  noticePlayer(front = 190, back = 70, vRange = 80) {
    const d = this.dx();
    const range = sign(d) === this.facing ? front : back;
    return this.seesPlayer(range, vRange);
  }

  // ---------------------------------------------------------------- 移动助手
  edgeAhead(dir, look = 4) {
    const lv = this.world.level;
    const px = this.x + dir * (this.w / 2 + look);
    return !lv.isFloor(Math.floor(px / TILE), Math.floor((this.y + 3) / TILE));
  }
  wallAhead(dir, look = 3) {
    const lv = this.world.level;
    const px = this.x + dir * (this.w / 2 + look);
    return lv.solidAt(px, this.y - 4) || lv.solidAt(px, this.y - this.h + 4);
  }
  /** 前方的墙是否矮到可以跳上去（<= maxTiles 格） */
  lowWallAhead(dir, maxTiles = 2) {
    const lv = this.world.level;
    const tx = Math.floor((this.x + dir * (this.w / 2 + 4)) / TILE);
    const ty = Math.floor((this.y - 2) / TILE);
    if (!lv.isSolid(tx, ty)) return false;
    for (let i = 1; i <= maxTiles; i++) if (!lv.isSolid(tx, ty - i)) return true;
    return false;
  }
  walk(dt, dir, speed, accel = 900) {
    this.vx = approach(this.vx, dir * speed * this.speedMul * (this.chill > 0 ? Math.max(0.4, 1 - this.chill * 0.1) : 1), accel * dt);
  }
  stop(dt, fric = 1200) { this.vx = approach(this.vx, 0, fric * dt); }

  /** 巡逻：沿朝向走，遇墙/悬崖掉头，偶尔停顿 */
  patrol(dt, speed) {
    if (this.pauseT > 0) { this.pauseT -= dt; this.stop(dt); return false; }
    if (this.onGround && (this.wallAhead(this.facing) || this.edgeAhead(this.facing))) { this.facing = -this.facing; this.pauseT = rnd(0.2, 0.8); return false; }
    if (Math.random() < dt * 0.25) { this.pauseT = rnd(0.5, 1.6); if (Math.random() < 0.4) this.facing = -this.facing; }
    this.walk(dt, this.facing, speed, 500);
    return true;
  }

  // ---------------------------------------------------------------- 主循环
  update(dt) {
    const w = this.world;
    this.t += dt; this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.touchCd = Math.max(0, this.touchCd - dt);
    this.hpShowT = Math.max(0, this.hpShowT - dt);
    this.resonateT = Math.max(0, this.resonateT - dt);
    this.pulledT = Math.max(0, this.pulledT - dt);
    this.chillImmune = Math.max(0, this.chillImmune - dt);
    if (this.spawnT > 0) { this.spawnT -= dt; return; }
    this.tickStatus(dt);
    if (this.dead) return;

    if (this.frozenT > 0) {
      this.frozenT -= dt;
      if (this.frozenT <= 0) { w.fx.frost(this.x, this.cy, 8); audio.sfx('shatter', { gap: 0.1 }); }
      if (!this.flying) { this.stop(dt, 600); this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt); w.level.moveBody(this, dt); } else { this.vx = 0; this.vy = 0; }
      return;
    }
    if (this.stunT > 0) {
      this.stunT -= dt;
      if (!this.flying) { this.stop(dt, 500); this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt); w.level.moveBody(this, dt); } else { this.vx *= 0.9; this.vy = approach(this.vy, 40, 200 * dt); this.flyMove(dt); }
      this.onStunned(dt);
      return;
    }
    if (this.chill > 0) this.chill = Math.max(0, this.chill - dt * 0.5);

    this.ai(dt);
    if (this.dead) return;

    if (this.fixed) { /* 固定不动 */ } else if (this.flying) this.flyMove(dt);
    else {
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * dt);
      const wasGround = this.onGround;
      w.level.moveBody(this, dt);
      if (this.onGround && !wasGround) this.onLand();
    }
    if (this.y > w.level.pxH + 100) { this.dead = true; return; }
    if (this.contact && this.touchCd <= 0 && !this.player.dead) {
      const p = this.player;
      if (rectsOverlap(this.x - this.w / 2 + 2, this.y - this.h + 2, this.w - 4, this.h - 4, p.x - p.w / 2, p.y - p.h, p.w, p.h)) {
        if (p.hurt(this.dmg(this.contact), Object.assign({ x: this.x }, this.def.contactFx))) { this.touchCd = 0.8; this.onTouch(p); }
      }
    }
  }

  flyMove(dt) {
    const lv = this.world.level;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (this.ghost) { this.x = nx; this.y = ny; return; }
    this.hitWall = 0;
    if (!lv.rectSolid(nx - this.w / 2, this.y - this.h, this.w, this.h)) this.x = nx; else { this.hitWall = sign(this.vx); this.vx = -this.vx * 0.4; }
    if (!lv.rectSolid(this.x - this.w / 2, ny - this.h, this.w, this.h)) this.y = ny; else { this.hitCeil = this.vy < 0; this.vy = -this.vy * 0.4; }
  }

  ai() {}
  onLand() {}
  onStunned() {}
  onTouch() {}

  tickStatus(dt) {
    const w = this.world, run = G.run;
    if (this.burnT > 0) {
      this.burnT -= dt; this.burnTick -= dt;
      if (Math.random() < 0.5) w.fx.embers(this.x + rnd(-this.w / 2, this.w / 2), this.y - rnd(4, this.h), 1);
      if (this.burnTick <= 0) { this.burnTick = 0.5; w.hitEnemy(this, run.dmg('skill', 2.6 + 0.8 * run.depth) * run.stat('dot'), { src: 'dot', quiet: true, color: COLORS.burn, x: this.x, y: this.y - this.h }); }
    }
    if (this.dead) return;
    if (this.radT > 0) {
      this.radT -= dt; this.radTick -= dt;
      if (this.radT <= 0) this.rad = 0;
      if (this.radTick <= 0 && this.rad > 0) { this.radTick = 0.5; w.hitEnemy(this, run.dmg('skill', this.rad * (0.9 + 0.25 * run.depth)) * run.stat('dot'), { src: 'dot', quiet: true, color: COLORS.rad, x: this.x, y: this.y - this.h }); }
    }
    if (this.dead) return;
    if (this.shockT > 0) {
      this.shockT -= dt; this.shockTick -= dt;
      if (Math.random() < 0.25) w.fx.sparks(this.x + rnd(-this.w / 2, this.w / 2), this.y - rnd(2, this.h), '#fff36a', 1);
      if (this.shockTick <= 0) {
        this.shockTick = 0.7;
        const d = run.dmg('skill', 2 + 0.7 * run.depth);
        const o = w.nearestEnemy(this.x, this.cy, 76, false, this);
        if (o) { w.fx.bolt(this.x, this.cy, o.x, o.cy, '#fff36a', 0.1, 4); w.hitEnemy(o, d, { src: 'dot', quiet: true, color: COLORS.shock, x: o.x, y: o.y - o.h }); audio.sfx('spark', { gap: 0.08 }); }
        w.hitEnemy(this, d, { src: 'dot', quiet: true, color: COLORS.shock, x: this.x, y: this.y - this.h });
      }
    }
  }

  applyEffects(eff) {
    if (!eff || this.dead) return;
    const run = G.run;
    if (eff.burn) { if (this.burnT <= 0) this.burnTick = 0.3; this.burnT = Math.max(this.burnT, eff.burn * run.stat('dotDur')); if (this.frozenT > 0) this.frozenT = Math.min(this.frozenT, 0.2); }
    if (eff.shock) { if (this.shockT <= 0) this.shockTick = 0.35; this.shockT = Math.max(this.shockT, eff.shock); }
    if (eff.rad) { this.rad = Math.min(8, this.rad + eff.rad); this.radT = 4 * run.stat('dotDur'); }
    if (eff.freeze) this.freeze(eff.freeze);
    else if (eff.chill && this.frozenT <= 0 && this.chillImmune <= 0) {
      this.chill += eff.chill;
      if (this.chill >= 6) this.freeze(2);
    }
  }

  freeze(dur) {
    if (this.chillImmune > 0 && this.frozenT <= 0) return;
    const run = G.run;
    dur *= run.stat('freezeDur') * (this.boss ? 0.35 : this.elite ? 0.7 : 1);
    this.frozenT = Math.max(this.frozenT, dur);
    this.chill = 0;
    this.chillImmune = dur + (this.boss ? 7 : 3);
    this.burnT = 0;
    this.world.fx.frost(this.x, this.cy, 10);
    this.onInterrupt();
  }

  onInterrupt() {}

  knock(vx, vy) {
    if (this.fixed) return;
    const k = 1 - this.kbResist;
    if (k <= 0) return;
    this.vx = vx * k;
    if (vy && !this.flying) { this.vy = Math.min(this.vy, vy * k); this.onGround = false; } else if (vy) this.vy += vy * k * 0.5;
  }

  /** 受到伤害。返回实际伤害值（0 表示免疫） */
  takeDamage(dmg, info) {
    if (this.dead || this.invulnerable) return 0;
    dmg = this.modifyDamage(dmg, info);
    if (dmg <= 0) return 0;
    if (this.shockT > 0 && info.src !== 'dot') dmg *= 1.15;
    this.hp -= dmg;
    this.flash = 0.1; this.hpShowT = 3;
    if (!this.aggro) { this.aggro = true; this.onAggro(); }
    if (info.kbx || info.kby) { if (!this.superArmor || info.heavy) this.knock(info.kbx || 0, info.kby || 0); }
    if (info.stun && !this.superArmorHard) {
      const s = info.stun * (this.boss ? 0.3 : this.elite ? 0.6 : 1);
      if (s > 0.05) { this.stunT = Math.max(this.stunT, s); this.onInterrupt(); }
    }
    if (this.hp <= 0) { this.hp = 0; this.die(info); }
    return dmg;
  }

  modifyDamage(dmg) { return dmg; }
  onAggro() {}

  die(info) {
    if (this.dead) return;
    this.dead = true;
    const w = this.world;
    const cols = this.def.blood || ['#c8ccd6', '#8a8f9c', '#ffffff'];
    w.fx.debris(this.x, this.cy, cols, this.boss ? 40 : 10 + Math.round(this.w / 3));
    w.fx.ring(this.x, this.cy, cols[0], 4, Math.max(18, this.w), 0.22);
    audio.sfx(this.boss ? 'boom' : 'kill');
    this.onDeath(info);
    w.onEnemyKilled(this, info || {});
  }

  onDeath() {}

  /** 矩形内如果有玩家则造成伤害 */
  hitPlayerRect(x, y, w, h, dmg, o = {}) {
    const p = this.player;
    if (p.dead) return false;
    if (!rectsOverlap(x, y, w, h, p.x - p.w / 2, p.y - p.h, p.w, p.h)) return false;
    return p.hurt(this.dmg(dmg), Object.assign({ x: this.x }, o));
  }

  /** 朝向前方的攻击框 */
  hitFront(reach, dmg, o = {}) {
    const hgt = o.h || this.h;
    const bx = this.facing > 0 ? this.x + (o.inner || 0) : this.x - (o.inner || 0) - reach;
    return this.hitPlayerRect(bx, this.y - (o.top || hgt), reach, hgt, dmg, o);
  }

  /** 出招预警：头顶感叹号 + 闪白 */
  telegraph(dur = 0.3, color = '#ff5a4a') {
    this.warnT = dur; this.warnColor = color;
    audio.sfx('alert', { gap: 0.15 });
  }

  // ---------------------------------------------------------------- 绘制
  frameName() { return this.def.spr + '/0'; }
  drawOffsetY() { return 0; }

  draw(ctx, camX, camY) {
    const sx = Math.round(this.x - camX), sy = Math.round(this.y - camY + this.drawOffsetY());
    if (this.spawnT > 0) {
      const k = 1 - this.spawnT / 0.4;
      ctx.fillStyle = '#c98bff';
      ctx.fillRect(sx - 1, sy - this.h * k, 2, this.h * k);
      return;
    }
    const name = this.frameName();
    const flip = this.facing < 0;
    const alpha = this.alpha === undefined ? 1 : this.alpha;
    if (!hasSprite(name)) {
      ctx.fillStyle = this.elite ? '#c98bff' : '#b05050';
      ctx.fillRect(sx - this.w / 2, sy - this.h, this.w, this.h);
    } else {
      if (this.elite && alpha > 0.5) {
        const c = '#c77dff';
        drawSil(ctx, name, sx - 1, sy, flip, c); drawSil(ctx, name, sx + 1, sy, flip, c);
        drawSil(ctx, name, sx, sy - 1, flip, c); drawSil(ctx, name, sx, sy + 1, flip, c);
      }
      drawSprite(ctx, name, sx, sy, flip, alpha);
      if (this.flash > 0) drawSil(ctx, name, sx, sy, flip, '#ffffff', 0.9);
      else if (this.frozenT > 0) drawSil(ctx, name, sx, sy, flip, '#9fdcff', 0.62);
      else if (this.warnT > 0) drawSil(ctx, name, sx, sy, flip, this.warnColor || '#ff5a4a', 0.28 + 0.25 * Math.sin(this.t * 40));
      else if (this.chill > 0.5) drawSil(ctx, name, sx, sy, flip, '#9fdcff', Math.min(0.45, this.chill * 0.08));
    }
    if (this.frozenT > 0) {
      // 冰壳高光
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx - this.w / 2 + 2, sy - this.h + 3, 2, 1); ctx.fillRect(sx + this.w / 2 - 5, sy - this.h / 2, 3, 1);
    }
    if (this.warnT > 0) {
      this.warnT -= 1 / 60;
      drawText(ctx, '!', sx, sy - this.h - 16 - Math.abs(Math.sin(this.t * 18)) * 2, { size: 12, color: this.warnColor || '#ff5a4a', align: 'center', outline: '#14101a' });
    }
    if (this.stunT > 0) {
      for (let i = 0; i < 3; i++) {
        const a = this.t * 7 + i * 2.09;
        ctx.fillStyle = '#ffe14a';
        ctx.fillRect(Math.round(sx + Math.cos(a) * 8), Math.round(sy - this.h - 6 + Math.sin(a) * 2.5), 2, 2);
      }
    }
    if (!this.boss && this.hpShowT > 0 && this.hp < this.maxHp) {
      const bw = clamp(Math.round(this.w * 1.1), 16, 34), k = this.hp / this.maxHp;
      const bx = sx - (bw >> 1), by = sy - this.h - 7;
      ctx.fillStyle = '#14101a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
      ctx.fillStyle = '#4a1a22'; ctx.fillRect(bx, by, bw, 2);
      ctx.fillStyle = this.elite ? '#c77dff' : '#e5484d'; ctx.fillRect(bx, by, Math.ceil(bw * k), 2);
    }
  }
}

// 怪物注册表：id -> {def, cls}
export const BESTIARY = {};
export function registerEnemy(def, cls) { BESTIARY[def.id] = { def, cls }; def.cls = cls; }
export function spawnEnemy(id, x, y, o) {
  const b = BESTIARY[id];
  if (!b) { console.warn('unknown enemy', id); return null; }
  return new b.cls(b.def, x, y, o);
}
