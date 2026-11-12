// 特效：粒子、飘字、冲击环、闪电、残影、斩击弧光（全部用整像素矩形绘制）
import { rnd, TAU, clamp } from '../core/util.js';
import { drawText } from '../core/font.js';
import { drawSil, drawSprite } from '../core/assets.js';

export function pxLine(ctx, x0, y0, x1, y1, color, thick = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = color;
  const o = thick >> 1;
  let guard = 0;
  while (guard++ < 2000) {
    ctx.fillRect(x0 - o, y0 - o, thick, thick);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export function pxCircle(ctx, cx, cy, r, color, thick = 1) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  if (r <= 0) return;
  ctx.fillStyle = color;
  let x = r, y = 0, err = 1 - r;
  const p = (px, py) => ctx.fillRect(px, py, thick, thick);
  while (x >= y) {
    p(cx + x, cy + y); p(cx - x, cy + y); p(cx + x, cy - y); p(cx - x, cy - y);
    p(cx + y, cy + x); p(cx - y, cy + x); p(cx + y, cy - x); p(cx - y, cy - x);
    y++;
    if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
  }
}

export function pxDisc(ctx, cx, cy, r, color) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

/** 锯齿闪电折线的点序列 */
export function boltPoints(x1, y1, x2, y2, jitter = 6, seg = 10) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(2, Math.round(d / seg));
  const nx = -(y2 - y1) / (d || 1), ny = (x2 - x1) / (d || 1);
  const pts = [[x1, y1]];
  for (let i = 1; i < n; i++) {
    const t = i / n, j = (Math.random() * 2 - 1) * jitter;
    pts.push([x1 + (x2 - x1) * t + nx * j, y1 + (y2 - y1) * t + ny * j]);
  }
  pts.push([x2, y2]);
  return pts;
}

export class FX {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.rings = [];
    this.bolts = [];
    this.ghosts = [];
    this.slashes = [];
    this.beams = [];
  }

  clear() { this.parts.length = this.texts.length = this.rings.length = this.bolts.length = this.ghosts.length = this.slashes.length = this.beams.length = 0; }

  /** 通用粒子爆发 */
  burst(x, y, n, o = {}) {
    if (this.parts.length > 900) n = Math.ceil(n / 3);
    const sp0 = o.speed === undefined ? 40 : o.speed, sp1 = o.speedMax === undefined ? sp0 * 2.2 : o.speedMax;
    const a0 = o.angle === undefined ? 0 : o.angle, spread = o.spread === undefined ? TAU : o.spread;
    for (let i = 0; i < n; i++) {
      const a = a0 + (Math.random() - 0.5) * spread;
      const s = rnd(sp0, sp1);
      const life = rnd(o.life || 0.3, o.lifeMax || (o.life || 0.3) * 1.8);
      this.parts.push({
        x: x + rnd(-1, 1) * (o.radius || 0), y: y + rnd(-1, 1) * (o.radius || 0),
        vx: Math.cos(a) * s + (o.vx || 0), vy: Math.sin(a) * s + (o.vy || 0),
        life, max: life,
        color: Array.isArray(o.color) ? o.color[(Math.random() * o.color.length) | 0] : (o.color || '#ffffff'),
        size: o.size || (Math.random() < 0.3 ? 2 : 1),
        grav: o.grav === undefined ? 300 : o.grav, drag: o.drag === undefined ? 1.5 : o.drag,
        fade: o.fade !== false, light: o.light || 0, shrink: !!o.shrink, streak: !!o.streak,
      });
    }
  }
  dust(x, y, dir = 0, n = 4) {
    this.burst(x, y, n, { color: ['#c9c2b4', '#9c958b', '#e4ddd0'], speed: 12, speedMax: 45, angle: -Math.PI / 2 + dir * 0.9, spread: 1.6, grav: -20, drag: 3.5, life: 0.22, lifeMax: 0.45, size: 2, shrink: true });
  }
  sparks(x, y, color = '#ffe9a0', n = 6, dir = null) {
    this.burst(x, y, n, { color: [color, '#ffffff'], speed: 60, speedMax: 190, angle: dir === null ? 0 : dir, spread: dir === null ? TAU : 1.3, grav: 420, drag: 1.2, life: 0.15, lifeMax: 0.4, streak: true, light: 1 });
  }
  debris(x, y, colors, n = 8) {
    this.burst(x, y, n, { color: colors, speed: 50, speedMax: 170, angle: -Math.PI / 2, spread: 2.6, grav: 520, drag: 0.6, life: 0.4, lifeMax: 0.8, size: 2 });
  }
  smoke(x, y, n = 5, color = ['#6b6b78', '#8a8a96', '#4c4c58']) {
    this.burst(x, y, n, { color, speed: 6, speedMax: 28, grav: -40, drag: 2, life: 0.4, lifeMax: 0.9, size: 3, shrink: true, radius: 4 });
  }
  embers(x, y, n = 4, color = ['#ffb347', '#ff7a2e', '#ffe08a']) {
    this.burst(x, y, n, { color, speed: 10, speedMax: 40, angle: -Math.PI / 2, spread: 1.4, grav: -90, drag: 1, life: 0.35, lifeMax: 0.8, light: 1 });
  }
  frost(x, y, n = 6) {
    this.burst(x, y, n, { color: ['#dff6ff', '#9fdcff', '#ffffff'], speed: 15, speedMax: 60, grav: 30, drag: 2.5, life: 0.3, lifeMax: 0.7 });
  }

  text(x, y, str, color = '#ffffff', o = {}) {
    this.texts.push({ x: x + rnd(-4, 4), y, str: String(str), color, life: o.life || 0.75, max: o.life || 0.75, size: o.size || 10, vy: o.vy === undefined ? -42 : o.vy, vx: o.vx || rnd(-10, 10), big: !!o.big });
  }

  ring(x, y, color = '#ffffff', r0 = 4, r1 = 36, dur = 0.3, thick = 1) {
    this.rings.push({ x, y, color, r0, r1, life: dur, max: dur, thick });
  }

  bolt(x1, y1, x2, y2, color = '#bfe9ff', dur = 0.12, jitter = 6) {
    this.bolts.push({ pts: boltPoints(x1, y1, x2, y2, jitter), color, life: dur, max: dur, x1, y1, x2, y2, jitter });
  }

  /** 直线光束（激光等）：width 像素，带淡出 */
  beam(x1, y1, x2, y2, color = '#ff5a5a', width = 3, dur = 0.15) {
    this.beams.push({ x1, y1, x2, y2, color, width, life: dur, max: dur });
  }

  /** 精灵残影 */
  ghost(spr, x, y, flip, color = '#9fe8ff', dur = 0.25) {
    this.ghosts.push({ spr, x, y, flip, color, life: dur, max: dur });
  }

  /** 斩击弧光：以 (x,y) 为圆心，半径 r，从角度 a0 扫到 a1（弧度，朝右为 0，顺时针为正） */
  slash(x, y, r, a0, a1, color = '#ffffff', dur = 0.14, width = 6, follow = null) {
    this.slashes.push({ x, y, r, a0, a1, color, life: dur, max: dur, width, follow, ox: follow ? x - follow.x : 0, oy: follow ? y - follow.y : 0 });
  }

  update(dt) {
    let arr = this.parts;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); continue; }
      p.vy += p.grav * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    arr = this.texts;
    for (let i = arr.length - 1; i >= 0; i--) {
      const t = arr[i];
      t.life -= dt;
      if (t.life <= 0) { arr.splice(i, 1); continue; }
      t.y += t.vy * dt; t.x += t.vx * dt;
      t.vy *= Math.max(0, 1 - 3.2 * dt); t.vx *= Math.max(0, 1 - 3 * dt);
    }
    for (const list of [this.rings, this.bolts, this.ghosts, this.slashes, this.beams]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].life -= dt;
        if (list[i].life <= 0) list.splice(i, 1);
      }
    }
    // 闪电抖动重算
    for (const b of this.bolts) if (Math.random() < 0.5) b.pts = boltPoints(b.x1, b.y1, b.x2, b.y2, b.jitter);
  }

  drawBack(ctx, cx, cy) {
    for (const g of this.ghosts) {
      drawSil(ctx, g.spr, g.x - cx, g.y - cy, g.flip, g.color, 0.55 * (g.life / g.max));
    }
  }

  draw(ctx, cx, cy) {
    // 光束
    for (const b of this.beams) {
      const k = b.life / b.max;
      const w = Math.max(1, Math.round(b.width * k));
      ctx.globalAlpha = 0.35 + 0.65 * k;
      pxLine(ctx, b.x1 - cx, b.y1 - cy, b.x2 - cx, b.y2 - cy, b.color, w + 2);
      pxLine(ctx, b.x1 - cx, b.y1 - cy, b.x2 - cx, b.y2 - cy, '#ffffff', Math.max(1, w - 1));
      ctx.globalAlpha = 1;
    }
    // 斩击
    for (const s of this.slashes) {
      const k = 1 - s.life / s.max;            // 0 -> 1
      const fx = s.follow ? s.follow.x + s.ox : s.x, fy = s.follow ? s.follow.y + s.oy : s.y;
      const head = Math.min(1, k * 1.9);       // 弧光头部推进
      const tail = Math.max(0, k * 1.9 - 0.75);
      const steps = Math.max(8, Math.round(Math.abs(s.a1 - s.a0) * s.r / 2.2));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        if (t > head || t < tail) continue;
        const rel = (t - tail) / Math.max(0.001, head - tail);   // 0 尾 -> 1 头
        const a = s.a0 + (s.a1 - s.a0) * t;
        const wdt = Math.max(1, Math.round(s.width * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.35 + 0.65 * rel)));
        const px = fx + Math.cos(a) * s.r - cx, py = fy + Math.sin(a) * s.r - cy;
        ctx.globalAlpha = clamp(0.25 + rel * 0.75, 0, 1) * (s.life / s.max > 0.25 ? 1 : s.life / s.max * 4);
        ctx.fillStyle = s.color;
        ctx.fillRect(Math.round(px - wdt / 2), Math.round(py - wdt / 2), wdt, wdt);
        if (rel > 0.55 && wdt > 2) {
          ctx.fillStyle = '#ffffff';
          const w2 = Math.max(1, wdt - 3);
          ctx.fillRect(Math.round(px - w2 / 2), Math.round(py - w2 / 2), w2, w2);
        }
      }
      ctx.globalAlpha = 1;
    }
    // 粒子
    for (const p of this.parts) {
      const k = p.life / p.max;
      if (p.fade) ctx.globalAlpha = k < 0.5 ? k * 2 : 1;
      ctx.fillStyle = p.color;
      const sz = p.shrink ? Math.max(1, Math.round(p.size * (0.4 + k * 0.8))) : p.size;
      if (p.streak) {
        const lx = clamp(Math.round(p.vx * 0.03), -4, 4), ly = clamp(Math.round(p.vy * 0.03), -4, 4);
        ctx.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), 1, 1);
        ctx.fillRect(Math.round(p.x - cx - lx), Math.round(p.y - cy - ly), 1, 1);
        if (Math.abs(lx) + Math.abs(ly) > 3) ctx.fillRect(Math.round(p.x - cx - lx / 2), Math.round(p.y - cy - ly / 2), 1, 1);
      } else ctx.fillRect(Math.round(p.x - cx - sz / 2), Math.round(p.y - cy - sz / 2), sz, sz);
    }
    ctx.globalAlpha = 1;
    // 冲击环
    for (const r of this.rings) {
      const k = 1 - r.life / r.max;
      const e = 1 - (1 - k) * (1 - k);
      ctx.globalAlpha = Math.min(1, (1 - k) * 2);
      pxCircle(ctx, r.x - cx, r.y - cy, r.r0 + (r.r1 - r.r0) * e, r.color, r.thick);
      ctx.globalAlpha = 1;
    }
    // 闪电
    for (const b of this.bolts) {
      ctx.globalAlpha = Math.min(1, b.life / b.max * 2);
      for (let i = 0; i < b.pts.length - 1; i++) {
        pxLine(ctx, b.pts[i][0] - cx, b.pts[i][1] - cy, b.pts[i + 1][0] - cx, b.pts[i + 1][1] - cy, b.color, 2);
      }
      for (let i = 0; i < b.pts.length - 1; i++) {
        pxLine(ctx, b.pts[i][0] - cx, b.pts[i][1] - cy, b.pts[i + 1][0] - cx, b.pts[i + 1][1] - cy, '#ffffff', 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  drawTexts(ctx, cx, cy) {
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = t.big ? (k > 0.85 ? 1 : 0) : 0;
      drawText(ctx, t.str, t.x - cx, t.y - cy - pop, { size: t.size, color: t.color, align: 'center', outline: '#14101a', alpha: k < 0.3 ? k / 0.3 : 1 });
    }
  }

  /** 给光照层用：发光粒子的位置 */
  forEachLight(fn) {
    for (const p of this.parts) if (p.light) fn(p.x, p.y, 10 + p.light * 6, p.color, Math.min(1, p.life / p.max * 1.5) * 0.5);
    for (const b of this.bolts) {
      const m = b.pts[(b.pts.length / 2) | 0];
      fn(m[0], m[1], 60, b.color, 0.8);
      fn(b.x2, b.y2, 40, b.color, 0.8);
    }
    for (const b of this.beams) {
      const n = Math.max(1, Math.round(Math.hypot(b.x2 - b.x1, b.y2 - b.y1) / 48));
      for (let i = 0; i <= n; i++) fn(b.x1 + (b.x2 - b.x1) * i / n, b.y1 + (b.y2 - b.y1) * i / n, 36, b.color, 0.6 * b.life / b.max);
    }
    for (const r of this.rings) fn(r.x, r.y, r.r1 * 1.2, r.color, 0.5 * r.life / r.max);
  }
}

export { drawSprite };
