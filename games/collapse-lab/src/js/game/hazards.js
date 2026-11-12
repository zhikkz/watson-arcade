// 场景机关：各实验区的物理主题陷阱（都有清晰的预警节奏）
import { TILE, W } from '../core/config.js';
import { audio } from '../core/audio.js';
import { rnd, segRect, rectsOverlap, clamp } from '../core/util.js';
import { drawSprite, hasSprite } from '../core/assets.js';
import { pxLine, pxDisc, boltPoints } from './fx.js';
import { G } from './state.js';

class Hazard {
  constructor(s, world) {
    this.x = s.x; this.y = s.y; this.world = world; this.dead = false;
    this.t = (s.phase || 0) * 4; this.mount = s.mount;
    this.scale = 1 + 0.15 * G.run.depth;
  }
  dmg(v) { return Math.round(v * this.scale); }
  onScreen(m = 80) { const c = this.world.camera; return this.x > c.x - m && this.x < c.x + W + m && this.y > c.y - m - 200 && this.y < c.y + 360 + m + 200; }
  hitPlayer(x, y, w, h, dmg, o) {
    const p = this.world.player;
    if (p.dead) return false;
    if (!rectsOverlap(x, y, w, h, p.x - p.w / 2, p.y - p.h, p.w, p.h)) return false;
    return p.hurt(this.dmg(dmg), Object.assign({ x: x + w / 2 }, o));
  }
  update(dt) { this.t += dt; }
  draw() {}
}

// ---------------------------------------------------------------- 移动平台
class Mover extends Hazard {
  constructor(s, world) {
    super(s, world);
    this.isMover = true;
    this.w = 48; this.x0 = s.x - 24; this.y = s.y; this.range = (s.range || 3) * TILE;
    this.x = this.x0; this.dx = 0; this.dy = 0; this.ph = rnd(0, 6);
  }
  update(dt) {
    this.t += dt;
    const nx = this.x0 + Math.sin(this.t * 0.9 + this.ph) * this.range;
    this.dx = nx - this.x; this.x = nx;
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    if (hasSprite('obj/mover')) { drawSprite(ctx, 'obj/mover', x, y); return; }
    ctx.fillStyle = '#14101a'; ctx.fillRect(x, y, this.w, 7);
    ctx.fillStyle = '#8a93b0'; ctx.fillRect(x + 1, y + 1, this.w - 2, 4);
    ctx.fillStyle = '#c8d0e8'; ctx.fillRect(x + 1, y + 1, this.w - 2, 1);
  }
}

// ---------------------------------------------------------------- 力学：摆锤 / 落锤 / 活塞
class Pendulum extends Hazard {
  constructor(s, world) {
    super(s, world);
    const gy = world.level.groundBelow(s.x, s.y + 4, 14);
    this.len = clamp((gy === null ? 120 : gy - s.y) - 34, 44, 110);
    this.amp = rnd(0.85, 1.1); this.w0 = Math.sqrt(900 / this.len) * 0.55;
    this.bx = this.x; this.by = this.y + this.len; this.hitCd = 0;
  }
  update(dt) {
    this.t += dt; this.hitCd -= dt;
    const a = this.amp * Math.sin(this.t * this.w0 * 2);
    this.bx = this.x + Math.sin(a) * this.len; this.by = this.y + Math.cos(a) * this.len;
    if (!this.onScreen()) return;
    if (this.hitCd <= 0 && this.hitPlayer(this.bx - 8, this.by - 8, 16, 16, 12, { kb: 220 })) { this.hitCd = 0.6; audio.sfx('hitHeavy'); }
    for (const e of this.world.enemies) {
      if (e.dead || e.flying || e.untargetable) continue;
      if (Math.abs(e.x - this.bx) < e.w / 2 + 8 && this.by > e.y - e.h - 8 && this.by < e.y + 8 && (!e.pendT || e.pendT < G.time)) {
        e.pendT = G.time + 0.8;
        this.world.hitEnemy(e, this.dmg(16), { src: 'dot', kbx: Math.sign(e.x - this.bx) * 160, kby: -80, x: this.bx, y: this.by, color: '#ffcf70' });
      }
    }
  }
  draw(ctx, cx, cy) {
    pxLine(ctx, this.x - cx, this.y - cy, this.bx - cx, this.by - cy, '#3a3540', 2);
    pxLine(ctx, this.x - cx, this.y - cy, this.bx - cx, this.by - cy, '#a8a090', 1);
    ctx.fillStyle = '#5a5560'; ctx.fillRect(Math.round(this.x - cx) - 4, Math.round(this.y - cy), 8, 3);
    if (hasSprite('obj/bob')) drawSprite(ctx, 'obj/bob', this.bx - cx, this.by - cy);
    else { pxDisc(ctx, this.bx - cx, this.by - cy, 9, '#14101a'); pxDisc(ctx, this.bx - cx, this.by - cy, 8, '#c89a3a'); pxDisc(ctx, this.bx - cx - 2, this.by - cy - 3, 3, '#ffe2a0'); }
  }
}

class Crusher extends Hazard {
  constructor(s, world) {
    super(s, world);
    this.w = 30; this.h = 22; this.top = s.y; this.cy = s.y; this.state = 'idle'; this.st = 0; this.vy = 0;
    const gy = world.level.groundBelow(s.x, s.y + 4, 14);
    this.floor = gy === null ? s.y + 200 : gy;
  }
  update(dt) {
    this.t += dt; this.st += dt;
    const p = this.world.player;
    switch (this.state) {
      case 'idle':
        if (!p.dead && Math.abs(p.x - this.x) < 26 && p.y > this.cy + this.h && p.y < this.floor + 6) { this.state = 'warn'; this.st = 0; audio.sfx('warn', { gap: 0.2 }); }
        break;
      case 'warn': if (this.st > 0.38) { this.state = 'fall'; this.vy = 0; } break;
      case 'fall':
        this.vy = Math.min(820, this.vy + 2600 * dt);
        this.cy += this.vy * dt;
        this.hitPlayer(this.x - this.w / 2 + 2, this.cy, this.w - 4, this.h, 20, { kb: 120 });
        if (this.cy + this.h >= this.floor) {
          this.cy = this.floor - this.h; this.state = 'rest'; this.st = 0;
          this.world.shake(4, 0.2); audio.sfx('slam');
          this.world.fx.dust(this.x - 12, this.floor, -1, 5); this.world.fx.dust(this.x + 12, this.floor, 1, 5);
          for (const e of this.world.enemies) if (!e.dead && !e.flying && Math.abs(e.x - this.x) < this.w / 2 + e.w / 2 && e.y > this.cy) this.world.hitEnemy(e, this.dmg(30), { src: 'dot', x: e.x, y: e.cy, color: '#ffcf70', stun: 0.8 });
        }
        break;
      case 'rest': if (this.st > 0.7) this.state = 'rise'; break;
      case 'rise': this.cy -= 60 * dt; if (this.cy <= this.top) { this.cy = this.top; this.state = 'idle'; } break;
      default: break;
    }
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx + (this.state === 'warn' ? Math.sin(this.t * 70) * 1.5 : 0)), y = Math.round(this.cy - cy);
    ctx.fillStyle = '#3a3540'; ctx.fillRect(x - 1, Math.round(this.top - cy), 2, y - Math.round(this.top - cy));
    if (hasSprite('obj/crusher')) { drawSprite(ctx, 'obj/crusher', x, y + this.h); return; }
    ctx.fillStyle = '#14101a'; ctx.fillRect(x - 15, y, 30, 22);
    ctx.fillStyle = '#8a8490'; ctx.fillRect(x - 14, y + 1, 28, 20);
    ctx.fillStyle = '#c8c0cc'; ctx.fillRect(x - 14, y + 1, 28, 2);
    ctx.fillStyle = '#e0b040'; for (let i = -12; i < 12; i += 6) ctx.fillRect(x + i, y + 17, 3, 4);
  }
}

class Piston extends Hazard {
  constructor(s, world) { super(s, world); this.ext = 0; }
  update(dt) {
    this.t += dt;
    const c = this.t % 2.6;
    const target = c > 1.7 ? 1 : 0;
    const was = this.ext;
    this.ext = clamp(this.ext + (target ? 9 : -4) * dt, 0, 1);
    if (target && was === 0 && this.onScreen()) audio.sfx('stab', { gap: 0.2 });
    this.warn = c > 1.35 && c <= 1.7;
    if (this.ext > 0.4) this.hitPlayer(this.x - 7, this.y - 30 * this.ext, 14, 30 * this.ext, 12, { kb: 80 });
  }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    const h = Math.round(30 * this.ext);
    ctx.fillStyle = '#4a4650'; ctx.fillRect(x - 9, y - 3, 18, 3);
    if (this.warn && Math.floor(this.t * 16) % 2) { ctx.fillStyle = '#ff5a4a'; ctx.fillRect(x - 9, y - 3, 18, 1); }
    if (h > 0) {
      ctx.fillStyle = '#14101a'; ctx.fillRect(x - 5, y - h - 1, 10, h);
      ctx.fillStyle = '#9aa0b0'; ctx.fillRect(x - 4, y - h, 8, h - 1);
      ctx.fillStyle = '#e8ecf4'; ctx.fillRect(x - 4, y - h, 2, h - 1);
      ctx.fillStyle = '#14101a'; ctx.fillRect(x - 6, y - h - 5, 12, 5);
      ctx.fillStyle = '#d8dce8'; ctx.fillRect(x - 5, y - h - 4, 10, 3);
      for (let i = -4; i <= 2; i += 3) ctx.fillRect(x + i, y - h - 7, 2, 3);
    }
  }
}

// ---------------------------------------------------------------- 电磁：电弧 / 激光
class Arc extends Hazard {
  constructor(s, world) {
    super(s, world);
    this.emissive = true;
    const lv = world.level;
    if (s.mount === 'ceil') { this.y0 = s.y; const gy = lv.groundBelow(s.x, s.y + 4, 14); this.y1 = gy === null ? s.y + 200 : gy; } else {
      this.y1 = s.y; let ty = Math.floor(s.y / TILE) - 1, n = 0; while (!lv.isSolid(Math.floor(s.x / TILE), ty) && n < 14) { ty--; n++; }
      this.y0 = (ty + 1) * TILE;
    }
    this.on = false; this.warn = false; this.pts = null;
  }
  update(dt) {
    this.t += dt;
    const c = this.t % 3.3;
    const wasOn = this.on;
    this.warn = c > 1.6 && c <= 2.15; this.on = c > 2.15;
    if (!this.onScreen()) return;
    if (this.on && !wasOn) audio.sfx('zap', { gap: 0.15 });
    if (this.on) {
      if (!this.pts || Math.random() < 0.6) this.pts = boltPoints(this.x, this.y0 + 4, this.x, this.y1 - 4, 7, 12);
      this.hitPlayer(this.x - 6, this.y0, 12, this.y1 - this.y0, 12, { kb: 160 });
    } else if (this.warn && Math.random() < 0.5) {
      this.world.fx.sparks(this.x + rnd(-3, 3), Math.random() < 0.5 ? this.y0 + 6 : this.y1 - 6, '#bfe9ff', 1);
    }
  }
  addLights(L, cx, cy) { if (this.on) { L.add(this.x - cx, (this.y0 + this.y1) / 2 - cy, 70, '#bfe9ff', 0.8); } }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx);
    // 上下电极
    for (const [yy, up] of [[this.y0, 1], [this.y1, -1]]) {
      const y = Math.round(yy - cy);
      ctx.fillStyle = '#14101a'; ctx.fillRect(x - 6, up > 0 ? y : y - 7, 12, 7);
      ctx.fillStyle = '#7a84a8'; ctx.fillRect(x - 5, up > 0 ? y : y - 6, 10, 5);
      ctx.fillStyle = this.on || (this.warn && Math.floor(this.t * 14) % 2) ? '#ffffff' : '#62a8ff';
      ctx.fillRect(x - 2, up > 0 ? y + 5 : y - 8, 4, 3);
    }
    if (this.on && this.pts) {
      for (let i = 0; i < this.pts.length - 1; i++) pxLine(ctx, this.pts[i][0] - cx, this.pts[i][1] - cy, this.pts[i + 1][0] - cx, this.pts[i + 1][1] - cy, '#8fd0ff', 3);
      for (let i = 0; i < this.pts.length - 1; i++) pxLine(ctx, this.pts[i][0] - cx, this.pts[i][1] - cy, this.pts[i + 1][0] - cx, this.pts[i + 1][1] - cy, '#ffffff', 1);
    } else if (this.warn) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = '#8fd0ff';
      for (let y = this.y0 + 8; y < this.y1 - 8; y += 6) ctx.fillRect(x, Math.round(y - cy), 1, 2);
      ctx.globalAlpha = 1;
    }
  }
}

class Laser extends Hazard {
  constructor(s, world) { super(s, world); this.emissive = true; this.ang = 0; this.ex = s.x; this.ey = s.y; this.ph = rnd(0, 6); this.color = world.level.biome === 'quantum' ? '#7dffd8' : '#ff5a6a'; }
  update(dt) {
    this.t += dt;
    this.ang = Math.sin(this.t * 0.9 + this.ph) * 0.62;
    if (!this.onScreen(160)) return;
    const dx = Math.sin(this.ang), dy = Math.cos(this.ang);
    const d = this.world.level.raycast(this.x, this.y + 6, dx, dy, 300);
    this.ex = this.x + dx * d; this.ey = this.y + 6 + dy * d;
    const p = this.world.player;
    if (!p.dead && segRect(this.x, this.y + 6, this.ex, this.ey, p.x - p.w / 2 + 1, p.y - p.h + 2, p.w - 2, p.h - 2)) p.hurt(this.dmg(10), { x: this.ex, burn: 1 });
    if (Math.random() < 0.3) this.world.fx.sparks(this.ex, this.ey, this.color, 1);
  }
  addLights(L, cx, cy) { L.add(this.ex - cx, this.ey - cy, 34, this.color, 0.8); L.add((this.x + this.ex) / 2 - cx, (this.y + this.ey) / 2 - cy, 50, this.color, 0.5); }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    pxLine(ctx, x, y + 6, this.ex - cx, this.ey - cy, this.color, 3);
    pxLine(ctx, x, y + 6, this.ex - cx, this.ey - cy, '#ffffff', 1);
    ctx.fillStyle = '#14101a'; ctx.fillRect(x - 6, y, 12, 8);
    ctx.fillStyle = '#6a7090'; ctx.fillRect(x - 5, y, 10, 6);
    ctx.fillStyle = this.color; ctx.fillRect(x - 2, y + 5, 4, 3);
  }
}

// ---------------------------------------------------------------- 热学：蒸汽 / 火焰 / 冰锥
class Jet extends Hazard {
  constructor(s, world, fire) {
    super(s, world);
    this.fire = fire; this.dir = s.mount === 'ceil' ? 1 : -1; this.len = fire ? 64 : 72;
    this.on = false; this.warn = false; this.emissive = fire;
  }
  update(dt) {
    this.t += dt;
    const c = this.t % 3.4;
    const wasOn = this.on;
    this.warn = c > 1.7 && c <= 2.2; this.on = c > 2.2;
    if (!this.onScreen()) return;
    const w = this.world;
    if (this.on && !wasOn) audio.sfx(this.fire ? 'burn' : 'steam', { gap: 0.2 });
    if (this.on) {
      const y0 = this.dir > 0 ? this.y : this.y - this.len;
      this.hitPlayer(this.x - 9, y0, 18, this.len, this.fire ? 10 : 8, { burn: this.fire ? 3 : 1.5, kb: 90 });
      const col = this.fire ? ['#ff7a2e', '#ffd070', '#ffffff'] : ['#e8e8f0', '#c0c4d0', '#ffffff'];
      w.fx.burst(this.x + rnd(-3, 3), this.y + this.dir * 4, 2, { color: col, speed: 150, speedMax: 240, angle: this.dir > 0 ? Math.PI / 2 : -Math.PI / 2, spread: 0.32, grav: this.fire ? -60 : 0, drag: 2.4, life: 0.25, lifeMax: 0.4, size: 3, shrink: true, light: this.fire ? 1 : 0 });
    } else if (this.warn && Math.random() < 0.4) {
      w.fx.burst(this.x + rnd(-2, 2), this.y + this.dir * 4, 1, { color: this.fire ? ['#ff9a4a'] : ['#d8d8e0'], speed: 20, speedMax: 50, angle: this.dir > 0 ? Math.PI / 2 : -Math.PI / 2, spread: 0.6, grav: 0, life: 0.2, lifeMax: 0.3 });
    }
  }
  addLights(L, cx, cy) { if (this.on && this.fire) L.add(this.x - cx, this.y + this.dir * this.len / 2 - cy, 60, '#ff9a4a', 0.8); }
  draw(ctx, cx, cy) {
    const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
    const oy = this.dir > 0 ? 0 : -6;
    ctx.fillStyle = '#14101a'; ctx.fillRect(x - 7, y + oy, 14, 6);
    ctx.fillStyle = this.fire ? '#7a4a40' : '#7a8088'; ctx.fillRect(x - 6, y + oy + (this.dir > 0 ? 0 : 1), 12, 5);
    ctx.fillStyle = this.warn && Math.floor(this.t * 14) % 2 ? '#ff5a4a' : '#2a2630'; ctx.fillRect(x - 3, y + (this.dir > 0 ? 4 : -6), 6, 2);
  }
}

class Icicle extends Hazard {
  constructor(s, world) { super(s, world); this.state = 'hang'; this.st = 0; this.iy = s.y; this.vy = 0; }
  update(dt) {
    this.t += dt; this.st += dt;
    const w = this.world, p = w.player;
    switch (this.state) {
      case 'hang': if (!p.dead && Math.abs(p.x - this.x) < 22 && p.y > this.y + 20 && p.y - this.y < 240) { this.state = 'shake'; this.st = 0; audio.sfx('glass', { gap: 0.2 }); } break;
      case 'shake': if (this.st > 0.4) { this.state = 'fall'; this.vy = 60; } break;
      case 'fall':
        this.vy = Math.min(640, this.vy + 1500 * dt); this.iy += this.vy * dt;
        if (this.hitPlayer(this.x - 4, this.iy, 8, 18, 11, { chill: 2.5, kb: 60 }) || w.level.solidAt(this.x, this.iy + 18) || w.level.floorAt(this.x, this.iy + 18)) {
          w.fx.frost(this.x, this.iy + 14, 8); audio.sfx('shatter', { gap: 0.1 });
          this.state = 'gone'; this.st = 0;
        }
        break;
      case 'gone': if (this.st > 4) { this.state = 'grow'; this.st = 0; this.iy = this.y; } break;
      case 'grow': if (this.st > 0.8) this.state = 'hang'; break;
      default: break;
    }
  }
  draw(ctx, cx, cy) {
    if (this.state === 'gone') return;
    const k = this.state === 'grow' ? this.st / 0.8 : 1;
    const x = Math.round(this.x - cx + (this.state === 'shake' ? Math.sin(this.t * 80) * 1.5 : 0)), y = Math.round(this.iy - cy);
    const h = Math.round(18 * k);
    for (let i = 0; i < h; i++) {
      const wd = Math.max(1, Math.round((1 - i / h) * 8));
      ctx.fillStyle = i % 5 === 1 ? '#ffffff' : '#9fdcff';
      ctx.fillRect(x - (wd >> 1), y + i, wd, 1);
      ctx.fillStyle = '#5aa0d0'; ctx.fillRect(x + (wd >> 1) - 1, y + i, 1, 1);
    }
  }
}

// ---------------------------------------------------------------- 量子：粒子束
class Beam extends Hazard {
  constructor(s, world) {
    super(s, world);
    this.emissive = true;
    const lv = world.level;
    this.horizontal = s.mount === 'floor';
    if (this.horizontal) {
      this.by = s.y - 13;
      this.x0 = s.x - lv.raycast(s.x, this.by, -1, 0, 400); this.x1 = s.x + lv.raycast(s.x, this.by, 1, 0, 400);
    } else {
      this.y0 = s.y; const gy = lv.groundBelow(s.x, s.y + 4, 14); this.y1 = gy === null ? s.y + 200 : gy;
    }
    this.on = false; this.warn = false;
  }
  update(dt) {
    this.t += dt;
    const c = this.t % 3.6;
    const wasOn = this.on;
    this.warn = c > 2.2 && c <= 3.0; this.on = c > 3.0 && c < 3.5;
    if (!this.onScreen(420)) return;
    if (this.warn && !this.warned) { this.warned = true; audio.sfx('charge', { gap: 0.3 }); }
    if (!this.warn) this.warned = false;
    if (this.on && !wasOn) { audio.sfx('beam', { gap: 0.2 }); this.world.shake(2, 0.2); }
    if (this.on) {
      if (this.horizontal) this.hitPlayer(this.x0, this.by - 6, this.x1 - this.x0, 12, 16, { kb: 120 });
      else this.hitPlayer(this.x - 8, this.y0, 16, this.y1 - this.y0, 16, { kb: 160 });
    }
  }
  addLights(L, cx, cy) {
    if (!this.on) return;
    if (this.horizontal) for (let x = this.x0; x < this.x1; x += 60) L.add(x - cx, this.by - cy, 50, '#7dffd8', 0.8);
    else L.add(this.x - cx, (this.y0 + this.y1) / 2 - cy, 80, '#7dffd8', 0.8);
  }
  draw(ctx, cx, cy) {
    const col = '#7dffd8';
    if (this.horizontal) {
      const y = Math.round(this.by - cy), x0 = Math.round(this.x0 - cx), x1 = Math.round(this.x1 - cx);
      // 两端发射口
      ctx.fillStyle = '#14101a'; ctx.fillRect(x0, y - 7, 6, 14); ctx.fillRect(x1 - 6, y - 7, 6, 14);
      ctx.fillStyle = '#3a5a66'; ctx.fillRect(x0, y - 6, 5, 12); ctx.fillRect(x1 - 5, y - 6, 5, 12);
      if (this.on) { ctx.fillStyle = col; ctx.fillRect(x0 + 5, y - 5, x1 - x0 - 10, 10); ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + 5, y - 2, x1 - x0 - 10, 4); } else if (this.warn && Math.floor(this.t * 18) % 2) { ctx.fillStyle = col; ctx.globalAlpha = 0.6; ctx.fillRect(x0 + 5, y, x1 - x0 - 10, 1); ctx.globalAlpha = 1; }
    } else {
      const x = Math.round(this.x - cx), y0 = Math.round(this.y0 - cy), y1 = Math.round(this.y1 - cy);
      ctx.fillStyle = '#14101a'; ctx.fillRect(x - 9, y0, 18, 6); ctx.fillRect(x - 9, y1 - 4, 18, 4);
      ctx.fillStyle = '#3a5a66'; ctx.fillRect(x - 8, y0, 16, 5); ctx.fillRect(x - 8, y1 - 3, 16, 3);
      if (this.on) { ctx.fillStyle = col; ctx.fillRect(x - 7, y0 + 5, 14, y1 - y0 - 8); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y0 + 5, 6, y1 - y0 - 8); } else if (this.warn && Math.floor(this.t * 18) % 2) { ctx.fillStyle = col; ctx.globalAlpha = 0.6; ctx.fillRect(x, y0 + 5, 1, y1 - y0 - 8); ctx.globalAlpha = 1; }
    }
  }
}

export function makeHazard(s, world) {
  if (s.type === 'mover') return new Mover(s, world);
  switch (s.kind) {
    case 'pendulum': return new Pendulum(s, world);
    case 'crusher': return new Crusher(s, world);
    case 'piston': return new Piston(s, world);
    case 'arc': return new Arc(s, world);
    case 'laser': return new Laser(s, world);
    case 'steam': return new Jet(s, world, false);
    case 'flame': return new Jet(s, world, true);
    case 'icicle': return new Icicle(s, world);
    case 'beam': return new Beam(s, world);
    default: return null;
  }
}
