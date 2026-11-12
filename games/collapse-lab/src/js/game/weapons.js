// 武器与技能的行为实现
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { approach, clamp, easeOut, rectsOverlap, segRect, rnd, sign } from '../core/util.js';
import { drawSpriteRot, drawSprite } from '../core/assets.js';
import { ITEMS, itemDmg, itemEffects, hasAffix } from './items.js';
import { G } from './state.js';
import { pxLine, pxDisc } from './fx.js';
import { Turret, GravityWell, CatBox, Demon } from './summons.js';

// 各姿势帧中「前手」相对脚底中心的位置（朝右）
export const HAND = {
  'hero/run/0': [11, -30], 'hero/run/1': [9, -27], 'hero/run/2': [10, -30], 'hero/run/3': [11, -29], 'hero/run/4': [5, -22], 'hero/run/5': [10, -31],
  'hero/jump/1': [-21, -18], 'hero/jump/2': [8, -30], 'hero/jump/3': [14, -28], 'hero/jump/4': [17, -28], 'hero/jump/5': [12, -28], 'hero/jump/6': [-23, -18],
  'hero/slide/2': [7, -22], 'hero/slide/7': [15, -20], 'hero/slide/8': [6, -19],
  'hero/tuck/0': [12, -25], 'hero/tuck/1': [12, -25], 'hero/tuck/2': [13, -29], 'hero/tuck/3': [13, -28], 'hero/tuck/4': [8, -25], 'hero/tuck/5': [12, -25],
};
const DEFAULT_HAND = [9, -26];
const ACTION = ['atk1', 'atk2'];

function poseAt(timeline, t) {
  for (const p of timeline) if (t < p[0]) return p;
  return timeline[timeline.length - 1];
}

function affixMul(item, e) {
  let m = 1;
  if (hasAffix(item, 'brittle') && e.frozenT > 0) m *= 1.6;
  if (hasAffix(item, 'fuel') && e.burnT > 0) m *= 1.4;
  return m;
}

function critCheck(def, item, p, e, extra) {
  let c = false;
  switch (def.crit) {
    case 'back': c = !e.boss && e.facing === sign(e.x - p.x) && !e.flying; break;
    case 'helpless': c = e.stunT > 0 || e.frozenT > 0; break;
    case 'tip': c = Math.abs(e.x - p.x) - e.w / 2 > 30; break;
    case 'charged': c = !!extra; break;
    default: break;
  }
  if (!c) c = Math.random() < p.run.stat('crit') + (hasAffix(item, 'crit') ? 0.12 : 0);
  return c;
}

function projCrit(def, item, p) {
  const bonus = p.run.stat('crit') + (hasAffix(item, 'crit') ? 0.12 : 0);
  return (pr, e) => {
    if (def.crit === 'bounced' && pr.bounced > 0) return true;
    if (def.crit === 'near' && pr.traveled < 46) return true;
    if (def.crit === 'returning' && pr.returning) return true;
    if (def.crit === 'resonate' && e.resonateT > 0) return true;
    return Math.random() < bonus;
  };
}

function muzzle(p) {
  const f = p.facing;
  const name = p.spriteName();
  const h = HAND[name] || DEFAULT_HAND;
  return [p.x + f * (h[0] + 6), p.y + h[1] + (p.pose && p.pose.oy ? p.pose.oy : 0)];
}

// ---------------------------------------------------------------- 近战
function drawMelee(ctx, camX, camY) {
  const a = this, p = a.p, s = a.s, def = a.def, f = p.facing;
  const name = p.spriteName();
  const h = HAND[name] || DEFAULT_HAND;
  const oy = p.pose && p.pose.oy ? p.pose.oy : 0;
  const hx = p.x + f * h[0] - camX, hy = p.y + h[1] + oy - camY;
  const k = clamp((a.t - s.hit[0] + 0.04) / (s.hit[1] - s.hit[0] + 0.07), 0, 1);
  const e = easeOut(k);
  if (s.punch) {
    if (k > 0 && k < 1) {
      pxDisc(ctx, hx + f * 3, hy, 4, def.color);
      pxDisc(ctx, hx + f * 3, hy, 2, '#ffffff');
    }
    return;
  }
  let ang = (s.wa[0] + (s.wa[1] - s.wa[0]) * e) * Math.PI / 180;
  let ox = 0;
  if (s.thrust) { ang = 0; ox = s.thrust * Math.sin(Math.PI * k) - 4; }
  drawSpriteRot(ctx, def.spr, hx + f * ox, hy, ang, f < 0);
  if (def.blade) {
    const c = Math.cos(ang) * f, sn = Math.sin(ang);
    const x0 = hx + c * 9, y0 = hy + sn * 9, x1 = hx + c * (9 + def.blade), y1 = hy + sn * (9 + def.blade);
    pxLine(ctx, x0, y0, x1, y1, def.color, 3);
    pxLine(ctx, x0, y0, x1, y1, '#ffffff', 1);
  }
  if (s.thrust && k > 0.1 && k < 0.9) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(Math.round(f > 0 ? hx + 10 : hx - 10 - 26), Math.round(hy - 1), 26, 1);
    ctx.globalAlpha = 1;
  }
}

function meleeHit(p, a, e, bx, bw) {
  const s = a.s, def = a.def, run = p.run, w = p.world;
  const dmg = run.dmg('melee', itemDmg(a.item) * s.mul) * affixMul(a.item, e);
  const crit = critCheck(def, a.item, p, e);
  const hit = w.hitEnemy(e, dmg, {
    src: 'melee', crit, kbx: p.facing * s.kb, kby: s.lift, stun: s.stun, effects: itemEffects(a.item), item: a.item,
    x: clamp(e.x, bx, bx + bw), y: e.y - e.h * 0.55, stop: s.stop, shake: s.shake, heavy: s.mul > 1.5 || s.quake,
  });
  if (def.id === 'fork') e.resonateT = 1.2;
  if (s.chain && hit) w.chainLightning(e.x, e.cy, dmg, 3, e);
}

const melee = {
  start(p, slot, item, def, ax) {
    let step = 0;
    if (p.comboNext && p.comboNext.slot === slot && p.comboNext.until > G.time) step = p.comboNext.step;
    if (step >= def.combo.length) step = 0;
    const s = def.combo[step];
    if (ax) p.facing = ax;
    p.setState('attack');
    p.atk = { p, slot, item, def, s, step, t: 0, k: hasAffix(item, 'quick') ? 1.15 : 1, hitSet: new Set(), began: false, canCancel: false, draw: drawMelee };
    p.comboNext = null;
    if (p.onGround) p.vx = p.facing * s.lunge; else if (p.vy > 60) p.vy *= 0.45;
    return true;
  },
  update(p, dt, ax) {
    const a = p.atk, s = a.s, def = a.def, w = p.world, f = p.facing;
    a.t += dt * a.k;
    const t = a.t;
    if (!p.onGround && !s.quake) p.pose = { frame: t < s.hit[0] ? 'hero/jump/3' : 'hero/jump/4', oy: 0 };
    else { const ps = poseAt(s.poses, t); p.pose = { frame: ps[1], oy: p.onGround ? (ps[2] || 0) : 0 }; }
    if (p.onGround) p.vx = approach(p.vx, 0, 1000 * dt);
    else p.vx = approach(p.vx, ax * p.moveSpeed() * 0.75, 900 * dt);

    if (!a.began && t >= s.hit[0]) {
      a.began = true;
      audio.sfx(s.sfx);
      if (s.arc) {
        const d2r = Math.PI / 180;
        const a0 = f > 0 ? s.arc.a0 * d2r : Math.PI - s.arc.a0 * d2r;
        const a1 = f > 0 ? s.arc.a1 * d2r : Math.PI - s.arc.a1 * d2r;
        w.fx.slash(p.x + f * 4, p.y - 28, s.arc.r, a0, a1, def.color, 0.16, s.arc.w, p);
      }
      if (s.wave) {
        w.spawnProj({ x: p.x + f * 18, y: p.y - 28, vx: f * 270, vy: 0, owner: 'player', dmg: p.run.dmg('ranged', itemDmg(a.item) * 0.45), src: 'ranged', item: a.item, look: 'wave', color: def.color, r: 9, life: 0.55, pierce: 4, noWall: false, kb: 30, crit: projCrit(def, a.item, p), light: null });
      }
      if (s.quake && p.onGround) {
        const qx = p.x + f * 30;
        w.fx.ring(qx, p.y - 2, '#ffe2a0', 6, s.quake, 0.25, 2);
        w.fx.dust(qx - 8, p.y, -1, 5); w.fx.dust(qx + 8, p.y, 1, 5);
        w.shake(s.shake, 0.22); audio.sfx('slam');
        for (const e of w.enemiesInRadius(qx, p.y - 8, s.quake)) {
          if (a.hitSet.has(e)) continue;
          a.hitSet.add(e);
          meleeHit(p, a, e, qx - 8, 16);
        }
        w.breakCratesInRect(qx - s.quake, p.y - 30, s.quake * 2, 32);
      }
    }
    if (t >= s.hit[0] && t <= s.hit[1]) {
      const bx = f > 0 ? p.x + s.box[0] : p.x - s.box[0] - s.box[2];
      const by = p.y + s.box[1];
      for (const e of w.enemies) {
        if (e.dead || e.untargetable || a.hitSet.has(e)) continue;
        if (!rectsOverlap(bx, by, s.box[2], s.box[3], e.x - e.w / 2, e.y - e.h, e.w, e.h)) continue;
        a.hitSet.add(e);
        meleeHit(p, a, e, bx, s.box[2]);
      }
      w.breakCratesInRect(bx, by, s.box[2], s.box[3]);
      w.reflectProjectiles(bx, by, s.box[2], s.box[3], p);
    }
    a.canCancel = t >= s.hit[1];
    if (t >= s.hit[1] + 0.03 && p.atkBufT > 0 && p.atkBuf === a.slot && a.step + 1 < def.combo.length) {
      p.atkBufT = 0;
      p.comboNext = { slot: a.slot, step: a.step + 1, until: G.time + 1 };
      melee.start(p, a.slot, a.item, def, input.axisX());
      return false;
    }
    if (t >= s.dur) {
      p.comboNext = { slot: a.slot, step: (a.step + 1) % def.combo.length, until: G.time + 0.42 };
      return true;
    }
    return false;
  },
};

// ---------------------------------------------------------------- 枪械类
function drawHeld(ctx, camX, camY) {
  const a = this, p = a.p, f = p.facing;
  const name = p.spriteName();
  const h = HAND[name] || DEFAULT_HAND;
  const kick = a.kick ? Math.max(0, 1 - a.t / 0.1) * a.kick : 0;
  drawSpriteRot(ctx, a.def.spr, p.x + f * (h[0] - kick) - camX, p.y + h[1] - camY, a.ang || 0, f < 0);
}

function fireGun(p, slot, item, def) {
  const run = p.run, w = p.world, f = p.facing;
  run.wcd[slot] = def.cd * (hasAffix(item, 'quick') ? 0.85 : 1);
  const [mx, my] = muzzle(p);
  const n = def.count || 1;
  for (let i = 0; i < n; i++) {
    const ang = (n > 1 ? (i / (n - 1) - 0.5) * def.spread : 0) + rnd(-0.015, 0.015);
    const sp = def.proj.speed * (n > 1 ? rnd(0.85, 1.1) : 1);
    w.spawnProj({
      x: mx, y: my, vx: f * Math.cos(ang) * sp, vy: Math.sin(ang) * sp, owner: 'player', src: 'ranged', item,
      dmg: run.dmg('ranged', itemDmg(item)), effects: itemEffects(item), color: def.color, look: def.proj.look, r: def.proj.r,
      life: def.proj.life, bounces: def.proj.bounces || 0, pierce: def.proj.pierce || 0, crit: projCrit(def, item, p), kb: n > 1 ? 50 : 30,
    });
  }
  audio.sfx(def.sfx);
  w.fx.sparks(mx, my, def.color, 3, f > 0 ? 0 : Math.PI);
  if (def.recoil) p.vx -= f * def.recoil;
}

const gun = {
  start(p, slot, item, def, ax) {
    if (ax) p.facing = ax;
    if (def.auto) {
      p.gunT = 0.16; p.gunItem = item;
      fireGun(p, slot, item, def);
      return false;            // 连发武器不锁移动
    }
    p.setState('attack');
    p.atk = { p, slot, item, def, t: 0, dur: 0.22, canCancel: true, draw: drawHeld, kick: 4, fired: false };
    return true;
  },
  update(p, dt, ax) {
    const a = p.atk;
    a.t += dt;
    p.pose = { frame: p.onGround ? 'hero/run/3' : 'hero/jump/4', oy: 0 };
    if (!a.fired) { a.fired = true; fireGun(p, a.slot, a.item, a.def); }
    if (p.onGround) p.vx = approach(p.vx, 0, 900 * dt); else p.vx = approach(p.vx, ax * p.moveSpeed() * 0.75, 900 * dt);
    return a.t >= a.dur;
  },
};

const thrower = {
  start(p, slot, item, def, ax) {
    if (ax) p.facing = ax;
    p.setState('attack');
    p.atk = { p, slot, item, def, t: 0, dur: 0.24, canCancel: false, fired: false };
    return true;
  },
  update(p, dt, ax) {
    const a = p.atk, def = a.def, run = p.run, w = p.world, f = p.facing;
    a.t += dt;
    p.pose = { frame: !p.onGround ? 'hero/jump/4' : (a.t < 0.07 ? 'hero/run/4' : 'hero/run/0'), oy: 0 };
    if (p.onGround) p.vx = approach(p.vx, 0, 900 * dt); else p.vx = approach(p.vx, ax * p.moveSpeed() * 0.75, 900 * dt);
    if (!a.fired && a.t >= 0.07) {
      a.fired = true; a.canCancel = true;
      run.wcd[a.slot] = def.cd * (hasAffix(a.item, 'quick') ? 0.85 : 1);
      const pr = def.proj;
      const up = input.down('up') ? -0.35 : input.down('down') ? 0.5 : 0;
      w.spawnProj({
        x: p.x + f * 10, y: p.y - 34, vx: f * Math.cos(pr.ang + up) * pr.speed + p.vx * 0.4, vy: Math.sin(pr.ang + up) * pr.speed,
        owner: 'player', src: 'ranged', item: a.item, dmg: run.dmg('ranged', itemDmg(a.item)), effects: itemEffects(a.item),
        color: def.color, look: pr.look, r: pr.r, grav: pr.grav, life: 3, spin: f * 9,
        explode: Object.assign({}, pr.explode, { effects: Object.assign({}, pr.explode.effects, itemEffects(a.item)) }),
      });
      audio.sfx(def.sfx);
    }
    return a.t >= a.dur;
  },
};

const charge = {
  start(p, slot, item, def, ax) {
    if (ax) p.facing = ax;
    p.setState('attack');
    p.atk = { p, slot, item, def, t: 0, phase: 0, charge: 0, canCancel: false, draw: drawHeld, full: false };
    audio.sfx('charge');
    return true;
  },
  update(p, dt, ax) {
    const a = p.atk, def = a.def, run = p.run, w = p.world, f = p.facing;
    a.t += dt;
    p.pose = { frame: p.onGround ? 'hero/slide/7' : 'hero/jump/4', oy: 0 };
    if (p.onGround) p.vx = approach(p.vx, 0, 1200 * dt); else p.vx = approach(p.vx, ax * p.moveSpeed() * 0.5, 600 * dt);
    const [mx, my] = muzzle(p);
    if (a.phase === 0) {
      a.charge = Math.min(1, a.t / (def.chargeT * (hasAffix(a.item, 'quick') ? 0.85 : 1)));
      if (Math.random() < 0.5 + a.charge * 0.5) {
        const ang = rnd(0, Math.PI * 2), d = rnd(10, 20);
        w.fx.burst(mx + Math.cos(ang) * d, my + Math.sin(ang) * d, 1, { color: [def.color, '#ffffff'], speed: 0, vx: -Math.cos(ang) * d * 5, vy: -Math.sin(ang) * d * 5, grav: 0, drag: 0, life: 0.18, lifeMax: 0.2, light: 1 });
      }
      if (a.charge >= 1 && !a.full) { a.full = true; audio.sfx('tick'); w.fx.ring(mx, my, '#ffffff', 2, 12, 0.15); }
      if (!input.down(ACTION[a.slot]) || a.t > 3) {
        a.phase = 1; a.ft = 0; a.kick = 3 + a.charge * 5; a.t = 0;
        const mul = 1 + (def.chargeMul - 1) * a.charge;
        const dist = w.level.raycast(mx, my, f, 0, 440);
        const x2 = mx + f * dist;
        const base = run.dmg('ranged', itemDmg(a.item) * mul);
        for (const e of w.enemies) {
          if (e.dead || e.untargetable) continue;
          if (!segRect(mx, my, x2, my, e.x - e.w / 2 - 2, e.y - e.h - 3, e.w + 4, e.h + 6)) continue;
          w.hitEnemy(e, base * affixMul(a.item, e), { src: 'ranged', crit: critCheck(def, a.item, p, e, a.full), kbx: f * (60 + 160 * a.charge), kby: -30, effects: itemEffects(a.item), item: a.item, x: e.x, y: my, stop: 0.03 + 0.05 * a.charge, shake: 1 + 3 * a.charge, heavy: a.full });
        }
        w.breakCratesInRect(Math.min(mx, x2), my - 4, Math.abs(x2 - mx), 8);
        w.fx.beam(mx, my, x2, my, def.color, 2 + Math.round(4 * a.charge), 0.2);
        w.fx.sparks(x2, my, def.color, 6, f > 0 ? Math.PI : 0);
        w.shake(1 + 3 * a.charge, 0.15);
        audio.sfx(a.full ? 'beam' : 'shoot');
        p.vx = -f * (50 + 150 * a.charge);
        run.wcd[a.slot] = def.cd;
        a.canCancel = true;
      }
      return false;
    }
    a.ft += dt;
    return a.ft >= 0.2;
  },
};

const spray = {
  start(p, slot, item, def, ax) {
    if (ax) p.facing = ax;
    p.setState('attack');
    p.atk = { p, slot, item, def, t: 0, tick: 0, n: 0, canCancel: true, draw: drawHeld };
    return true;
  },
  update(p, dt, ax) {
    const a = p.atk, def = a.def, run = p.run, w = p.world, f = p.facing;
    a.t += dt;
    const still = p.onGround && Math.abs(p.vx) < 14;
    p.pose = !p.onGround ? { frame: 'hero/jump/4', oy: 0 } : still ? { frame: 'hero/run/3', oy: 0 } : null;
    p.vx = approach(p.vx, ax * p.moveSpeed() * 0.5, 1400 * dt);
    a.tick -= dt;
    const [mx, my] = muzzle(p);
    if (a.tick <= 0) {
      a.tick = 0.075 * (hasAffix(a.item, 'quick') ? 0.85 : 1);
      a.n++;
      w.fx.burst(mx, my, 3, { color: ['#dff6ff', '#9fdcff', '#ffffff'], speed: 150, speedMax: 260, angle: f > 0 ? 0 : Math.PI, spread: 0.5, grav: 20, drag: 3.2, life: 0.22, lifeMax: 0.36, size: 2, shrink: true });
      if (a.n % 4 === 1) audio.sfx('steam', { gap: 0.25 });
      const bx = f > 0 ? mx : mx - 66;
      const eff = itemEffects(a.item);
      const effTick = a.n % 2 === 0 ? eff : Object.assign({}, eff, { chill: 0 });
      for (const e of w.enemies) {
        if (e.dead || e.untargetable) continue;
        if (!rectsOverlap(bx, my - 18, 66, 34, e.x - e.w / 2, e.y - e.h, e.w, e.h)) continue;
        w.hitEnemy(e, run.dmg('ranged', itemDmg(a.item)) * affixMul(a.item, e), { src: 'ranged', crit: false, kbx: f * 12, kby: 0, effects: effTick, item: a.item, x: e.x, y: my, stop: 0, shake: 0, quiet: true });
      }
    }
    return !input.down(ACTION[a.slot]) && a.t > 0.12;
  },
};

const boomerang = {
  start(p, slot, item, def, ax) {
    if (p.discOut) return false;
    if (ax) p.facing = ax;
    p.setState('attack');
    p.atk = { p, slot, item, def, t: 0, dur: 0.2, canCancel: true, fired: false };
    return true;
  },
  update(p, dt, ax) {
    const a = p.atk, def = a.def, run = p.run, w = p.world, f = p.facing;
    a.t += dt;
    p.pose = { frame: !p.onGround ? 'hero/jump/4' : (a.t < 0.05 ? 'hero/run/4' : 'hero/run/0'), oy: 0 };
    if (p.onGround) p.vx = approach(p.vx, 0, 900 * dt); else p.vx = approach(p.vx, ax * p.moveSpeed() * 0.75, 900 * dt);
    if (!a.fired && a.t >= 0.05) {
      a.fired = true;
      p.discOut = true;
      const slot = a.slot;
      audio.sfx(def.sfx);
      w.spawnProj({
        x: p.x + f * 12, y: p.y - 30, vx: f * 360, vy: 0, owner: 'player', src: 'ranged', item: a.item, noWall: true,
        dmg: run.dmg('ranged', itemDmg(a.item)), effects: itemEffects(a.item), color: def.color, look: 'disc', r: 6, life: 3.2, pierce: 999, kb: 40,
        crit: projCrit(def, a.item, p),
        update(pr, dt2, world) {
          const pl = world.player;
          if (!pr.returning) {
            pr.vx = approach(pr.vx, 0, 820 * dt2);
            if (Math.abs(pr.vx) < 30 || world.level.solidAt(pr.x + sign(pr.vx) * 6, pr.y)) { pr.returning = true; pr.hitSet.clear(); pr.sp = 120; }
          } else {
            pr.sp = Math.min(420, pr.sp + 1100 * dt2);
            const dx = pl.x - pr.x, dy = pl.cy - pr.y, d = Math.hypot(dx, dy) || 1;
            pr.vx = dx / d * pr.sp; pr.vy = dy / d * pr.sp;
            if (d < 14) { pr.dead = true; pl.discOut = false; pl.run.wcd[slot] = def.cd; audio.sfx('equip'); }
          }
          if (Math.random() < 0.3) world.fx.sparks(pr.x, pr.y, '#ffe9a0', 1);
        },
        onEnd() { p.discOut = false; },
      });
    }
    return a.t >= a.dur;
  },
};

const TYPES = { melee, gun, throw: thrower, charge, spray, boomerang };

// ---------------------------------------------------------------- 技能
const SKILLS = {
  coil(p, item, dmg) {
    const w = p.world;
    const gy = w.level.groundBelow(p.x, p.y - 4, 8);
    w.addActor(new Turret(p.x + p.facing * 4, gy === null ? p.y : gy, dmg, 8));
    audio.sfx('equip');
    return true;
  },
  dryice(p, item, dmg) {
    const f = p.facing;
    p.world.spawnProj({ x: p.x + f * 10, y: p.y - 34, vx: f * 240 + p.vx * 0.4, vy: -190, grav: 720, owner: 'player', src: 'skill', item, dmg, look: 'dryice', color: '#bfeaff', r: 4, life: 3, spin: f * 8, explode: { r: 60, effects: { freeze: 2.5 }, color: '#bfeaff', sfx: 'freeze' } });
    audio.sfx('throw');
    return true;
  },
  gravity(p, item, dmg) {
    const f = p.facing;
    p.world.spawnProj({ x: p.x + f * 10, y: p.y - 34, vx: f * 220 + p.vx * 0.4, vy: -210, grav: 640, owner: 'player', src: 'skill', item, dmg: 0, look: 'gwell', color: '#c98bff', r: 4, life: 3, trigger: true, onEnd: (pr, w) => w.addActor(new GravityWell(pr.x, pr.y, dmg)) });
    audio.sfx('throw');
    return true;
  },
  catbox(p, item, dmg) {
    const f = p.facing;
    p.world.spawnProj({ x: p.x + f * 10, y: p.y - 34, vx: f * 170 + p.vx * 0.4, vy: -220, grav: 700, owner: 'player', src: 'skill', item, dmg: 0, look: 'catbox', color: '#ffb13a', r: 5, life: 3, trigger: true, spin: f * 6, onEnd: (pr, w) => w.addActor(new CatBox(pr.x, pr.y, dmg)) });
    audio.sfx('throw');
    return true;
  },
  antimatter(p, item, dmg) {
    const f = p.facing;
    p.world.spawnProj({
      x: p.x + f * 10, y: p.y - 34, vx: f * 250 + p.vx * 0.4, vy: -160, grav: 700, owner: 'player', src: 'skill', item, dmg, look: 'bomb', color: '#ff7ad9', r: 4, life: 1.5, sticky: true,
      explode: { r: 74, color: '#ff9ae4', sfx: 'boom' },
      update(pr, dt) {
        if (pr.stuck && pr.stuckTo) { if (pr.stuckTo.dead) pr.stuckTo = null; else { pr.x = pr.stuckTo.x + pr.offX; pr.y = pr.stuckTo.y + pr.offY; } }
        pr.beep = (pr.beep || 0) - dt;
        if (pr.beep <= 0) { pr.beep = Math.max(0.08, pr.life * 0.25); audio.sfx('tick'); }
      },
    });
    audio.sfx('throw');
    return true;
  },
  wormhole(p, item, dmg) {
    const w = p.world, lv = w.level, f = p.facing;
    const x0 = p.x;
    let x = p.x, best = p.x;
    for (let d = 6; d <= 116; d += 6) {
      const nx = p.x + f * d;
      if (!lv.rectSolid(nx - p.w / 2, p.y - p.h, p.w, p.h - 1)) best = nx;
      else if (d > 60) break;
      x = nx;
    }
    if (Math.abs(best - x0) < 12) { audio.sfx('deny'); return false; }
    for (const e of w.enemies) {
      if (e.dead || e.untargetable) continue;
      if (rectsOverlap(Math.min(x0, best) - 6, p.y - p.h, Math.abs(best - x0) + 12, p.h, e.x - e.w / 2, e.y - e.h, e.w, e.h)) {
        w.hitEnemy(e, dmg, { src: 'skill', kbx: 0, kby: -60, item, x: e.x, y: e.cy, stop: 0.03, shake: 2 });
      }
    }
    for (let i = 0; i <= 5; i++) w.fx.ghost(p.spriteName(), x0 + (best - x0) * i / 5, p.y, f < 0, '#62e6ff', 0.2 + i * 0.05);
    w.fx.ring(x0, p.cy, '#62e6ff', 18, 3, 0.22, 2);
    p.x = best; p.vy = Math.min(p.vy, 0) * 0.3;
    w.fx.ring(best, p.cy, '#62e6ff', 3, 20, 0.25, 2);
    p.iframe = Math.max(p.iframe, 0.32);
    p.run.onRoll(p);
    audio.sfx('teleport');
    return true;
  },
  demon(p, item, dmg) {
    p.world.addActor(new Demon(p, dmg, 12));
    audio.sfx('perk');
    return true;
  },
};

export const Weapons = {
  isAuto(item) { return !!(item && ITEMS[item.id].auto); },

  tryStart(p, slot, ax) {
    const run = p.run, item = run.weapons[slot];
    if (!item || run.wcd[slot] > 0) return false;
    const def = ITEMS[item.id];
    return TYPES[def.type].start(p, slot, item, def, ax);
  },

  /** 返回 true 表示本次攻击结束 */
  update(p, dt, ax) {
    const a = p.atk;
    if (!a) return true;
    return TYPES[a.def.type].update(p, dt, ax);
  },

  useSkill(p) {
    const run = p.run, item = run.skill;
    if (!item) return false;
    if (run.skillCd > 0) { audio.sfx('deny', { gap: 0.3 }); return false; }
    const def = ITEMS[item.id];
    const dmg = run.dmg('skill', itemDmg(item));
    if (!SKILLS[def.type](p, item, dmg)) return false;
    run.skillCdMax = def.cd * (1 - run.stat('cdr')) * (hasAffix(item, 'quick') ? 0.85 : 1);
    run.skillCd = run.skillCdMax;
    return true;
  },

  /** 连发武器在常规状态下的持枪绘制 */
  drawGunOverlay(ctx, p, camX, camY) {
    if (!p.gunItem) return;
    const def = ITEMS[p.gunItem.id];
    const h = HAND[p.spriteName()] || DEFAULT_HAND;
    drawSprite(ctx, def.spr, p.x + p.facing * h[0] - camX, p.y + h[1] - camY, p.facing < 0);
  },
};
