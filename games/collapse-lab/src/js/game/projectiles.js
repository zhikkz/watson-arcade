// 投射物（玩家与敌人共用）
import { TILE } from '../core/config.js';
import { TAU, rnd } from '../core/util.js';
import { drawSprite, drawSpriteRot, hasSprite } from '../core/assets.js';
import { pxLine, pxDisc, pxCircle } from './fx.js';
import { inView } from '../core/viewport.js';
import { G } from './state.js';

export class Projectile {
  constructor(o) {
    this.kind = 'proj';
    this.x = o.x; this.y = o.y; this.vx = o.vx || 0; this.vy = o.vy || 0;
    this.r = o.r || 3;
    this.owner = o.owner || 'player';
    this.dmg = o.dmg || 1;
    this.src = o.src || 'ranged';
    this.grav = o.grav || 0;
    this.life = o.life === undefined ? 2 : o.life;
    this.maxLife = this.life;
    this.pierce = o.pierce || 0;
    this.bounces = o.bounces || 0;
    this.bounced = 0;
    this.look = o.look || 'orb';
    this.color = o.color || '#ffffff';
    this.effects = o.effects || null;
    this.kb = o.kb === undefined ? 60 : o.kb;
    this.crit = o.crit || null;          // 函数 (proj, target) => bool
    this.explode = o.explode || null;    // {r, effects, field, color, sfx, dmgMul}
    this.onHit = o.onHit || null;
    this.onEnd = o.onEnd || null;
    this.custom = o.update || null;      // 自定义逻辑 (proj, dt, world) => void
    this.noWall = !!o.noWall;
    this.sticky = !!o.sticky;
    this.noReflect = !!o.noReflect;
    this.trigger = !!o.trigger;      // 碰到目标只触发 onEnd，不直接造成伤害
    this.stuck = false;
    this.item = o.item || null;
    this.hitSet = new Set();
    this.traveled = 0;
    this.rot = o.rot || 0; this.spin = o.spin || 0;
    this.light = o.light === undefined ? this.color : o.light;
    this.burn = o.burn; this.chill = o.chill;      // 敌方弹命中玩家时附带
    this.t = 0;
    this.dead = false;
    this.world = null;
    this.homing = o.homing || 0;
    this.data = o.data || null;
    this.trail = o.trail !== false;
  }

  end(hitWall) {
    if (this.dead) return;
    this.dead = true;
    const w = this.world;
    if (this.explode) {
      const e = this.explode;
      w.explode(this.x, this.y, e.r, this.dmg * (e.dmgMul || 1), { src: this.src, effects: e.effects, color: e.color, sfx: e.sfx, owner: this.owner, item: this.item, field: e.field, fieldType: e.fieldType, burn: this.burn, chill: this.chill });
    } else if (this.look !== 'wave' && this.look !== 'none') {
      w.fx.sparks(this.x, this.y, this.color, hitWall ? 4 : 3);
    }
    if (this.onEnd) this.onEnd(this, w, hitWall);
  }

  update(dt) {
    const w = this.world, lv = w.level;
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) { this.end(false); return; }
    if (this.custom) { this.custom(this, dt, w); if (this.dead) return; }
    if (this.stuck) return;
    this.vy += this.grav * dt;
    if (this.homing && this.owner === 'enemy') {
      const p = w.player;
      const a = Math.atan2(p.cy - this.y, p.x - this.x);
      const sp = Math.hypot(this.vx, this.vy);
      const cur = Math.atan2(this.vy, this.vx);
      let d = a - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
      const na = cur + Math.max(-this.homing * dt, Math.min(this.homing * dt, d));
      this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
    }
    this.rot += this.spin * dt;
    const dist = Math.hypot(this.vx, this.vy) * dt;
    const n = Math.max(1, Math.ceil(dist / 5));
    const sx = this.vx * dt / n, sy = this.vy * dt / n;
    for (let i = 0; i < n && !this.dead; i++) {
      const px = this.x, py = this.y;
      this.x += sx; this.y += sy;
      this.traveled += Math.hypot(sx, sy);
      if (!this.noWall && lv.solidAt(this.x, this.y)) {
        if (this.sticky) { this.x = px; this.y = py; this.stuck = true; this.vx = this.vy = 0; return; }
        if (this.bounces > 0) {
          this.bounces--; this.bounced++;
          const hx = lv.solidAt(this.x, py), hy = lv.solidAt(px, this.y);
          if (hx || (!hx && !hy)) this.vx = -this.vx;
          if (hy || (!hx && !hy)) this.vy = -this.vy;
          this.x = px; this.y = py;
          if (this.grav) { this.vx *= 0.6; this.vy *= 0.55; }
          w.fx.sparks(this.x, this.y, this.color, 2);
          this.hitSet.clear();
          break;
        }
        this.x = px; this.y = py;
        this.end(true);
        return;
      }
      this.checkTargets();
    }
    // 拖尾
    if (this.trail && !this.dead) {
      if (this.look === 'fire' && Math.random() < 0.6) w.fx.embers(this.x, this.y, 1);
      else if (this.look === 'ice' && Math.random() < 0.5) w.fx.frost(this.x, this.y, 1);
      else if (this.look === 'jar' || this.look === 'bomb') { if (Math.random() < 0.3) w.fx.sparks(this.x, this.y, this.color, 1); }
    }
  }

  checkTargets() {
    const w = this.world, r = this.r;
    if (this.owner === 'player') {
      for (const e of w.enemies) {
        if (e.dead || e.untargetable || this.hitSet.has(e)) continue;
        if (this.x + r < e.x - e.w / 2 || this.x - r > e.x + e.w / 2 || this.y + r < e.y - e.h || this.y - r > e.y) continue;
        this.hitSet.add(e);
        if (this.sticky && !this.stuck) { this.stuck = true; this.stuckTo = e; this.offX = this.x - e.x; this.offY = this.y - e.y; return; }
        if (this.explode || this.trigger) { this.end(false); return; }
        const crit = this.crit ? !!this.crit(this, e) : false;
        const hit = w.hitEnemy(e, this.dmg, { src: this.src, crit, kbx: Math.sign(this.vx || 1) * this.kb, kby: -20, effects: this.effects, item: this.item, x: this.x, y: this.y });
        if (this.onHit) this.onHit(this, e, w, hit);
        if (this.pierce > 0) this.pierce--; else { this.end(false); return; }
      }
      w.breakCratesInRect(this.x - r, this.y - r, r * 2, r * 2);
    } else {
      const p = w.player;
      if (p.dead) return;
      if (this.x + r < p.x - p.w / 2 || this.x - r > p.x + p.w / 2 || this.y + r < p.y - p.h || this.y - r > p.y) return;
      if (this.explode) { this.end(false); return; }
      if (p.hurt(this.dmg, { x: this.x - Math.sign(this.vx || 1) * 4, burn: this.burn, chill: this.chill })) {
        if (this.onHit) this.onHit(this, p, w, true);
        this.end(false);
      } else if (p.iframe <= 0 && p.invuln <= 0) this.end(false);
    }
  }

  draw(ctx, cx, cy) {
    if (!inView(this.x, this.y, this.x, this.y, cx, cy, this.r + 24)) return;
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    const c = this.color;
    switch (this.look) {
      case 'laser': {
        const sp = Math.hypot(this.vx, this.vy) || 1;
        const dx = this.vx / sp * 9, dy = this.vy / sp * 9;
        pxLine(ctx, x - dx, y - dy, x, y, c, 3);
        pxLine(ctx, x - dx * 0.8, y - dy * 0.8, x, y, '#ffffff', 1);
        break;
      }
      case 'pellet': {
        const sp = Math.hypot(this.vx, this.vy) || 1;
        pxLine(ctx, x - this.vx / sp * 5, y - this.vy / sp * 5, x, y, c, 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, 1, 1);
        break;
      }
      case 'wave': {
        // 声波：三道弧线
        const dir = Math.sign(this.vx) || 1;
        ctx.globalAlpha = Math.min(1, this.life / this.maxLife * 2);
        for (let i = 0; i < 3; i++) {
          const h = 7 + i * 4, ox = -i * 5 * dir;
          for (let j = -h; j <= h; j += 1) {
            const bx = Math.round(Math.sqrt(Math.max(0, 1 - (j / h) * (j / h))) * 5 * dir);
            ctx.fillStyle = i === 0 ? '#ffffff' : c;
            ctx.fillRect(x + ox + bx, y + j, 1, 1);
          }
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'sine': {
        // 示波器的正弦波弹
        ctx.fillStyle = c;
        for (let i = -6; i <= 6; i++) ctx.fillRect(x + i, Math.round(y + Math.sin((i + this.t * 40) * 0.6) * 3), 1, 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2);
        break;
      }
      case 'spark': {
        ctx.fillStyle = c;
        ctx.fillRect(x - 2, y - 1, 4, 2); ctx.fillRect(x - 1, y - 2, 2, 4);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2);
        if ((G.frame >> 1) & 1) { ctx.fillStyle = c; ctx.fillRect(x - 4, y, 1, 1); ctx.fillRect(x + 3, y - 1, 1, 1); ctx.fillRect(x, y - 4, 1, 1); ctx.fillRect(x - 1, y + 3, 1, 1); }
        break;
      }
      case 'fire': {
        pxDisc(ctx, x, y, this.r + 1, '#ff7a2e');
        pxDisc(ctx, x, y, this.r - 1, '#ffd070');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, 2, 2);
        break;
      }
      case 'ice': {
        pxDisc(ctx, x, y, this.r + 1, '#6cc4ff');
        pxDisc(ctx, x, y, this.r - 1, '#dff6ff');
        break;
      }
      case 'disc': {
        const ph = Math.floor(this.t * 30) % 2;
        pxDisc(ctx, x, y, 5, '#8a6a20');
        pxDisc(ctx, x, y, 4, c);
        ctx.fillStyle = '#ffffff';
        if (ph) { ctx.fillRect(x - 4, y, 9, 1); } else { ctx.fillRect(x, y - 4, 1, 9); }
        ctx.fillStyle = '#14101a'; ctx.fillRect(x, y, 1, 1);
        break;
      }
      case 'ring': {
        pxCircle(ctx, x, y, this.r, c);
        pxCircle(ctx, x, y, Math.max(1, this.r - 2), '#ffffff');
        break;
      }
      case 'quake': {
        const ph = Math.floor(this.t * 20) % 2;
        for (let i = -1; i <= 1; i++) {
          const hh = 5 + ((i + ph) & 1) * 4;
          ctx.fillStyle = '#14101a'; ctx.fillRect(x + i * 5 - 3, y - hh - 1, 6, hh + 1);
          ctx.fillStyle = c; ctx.fillRect(x + i * 5 - 2, y - hh, 4, hh);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(x + i * 5 - 2, y - hh, 1, hh);
        }
        break;
      }
      case 'none': break;
      default: {
        const spr = 'proj/' + this.look;
        if (hasSprite(spr)) {
          if (this.spin) drawSpriteRot(ctx, spr, x, y, this.rot, false);
          else drawSprite(ctx, spr, x, y, this.vx < 0);
        } else {
          pxDisc(ctx, x, y, this.r + 1, c);
          pxDisc(ctx, x, y, Math.max(1, this.r - 1), '#ffffff');
        }
      }
    }
  }
}

/** 圆形范围内对某格式化目标做命中检测的小工具 */
export function inRadius(x, y, r, e) {
  const nx = Math.max(e.x - e.w / 2, Math.min(x, e.x + e.w / 2));
  const ny = Math.max(e.y - e.h, Math.min(y, e.y));
  return (nx - x) * (nx - x) + (ny - y) * (ny - y) <= r * r;
}

export { TILE, rnd };
