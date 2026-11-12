// 程序关卡生成：格子路径 + 房间模板 + 支线房 + 可达性校验
import { TILE, CELL_W, CELL_H, GRAVITY, MAX_FALL, STEP, T_EMPTY, T_SOLID, T_PLAT, T_SPIKE, T_ACID, T_PHASE } from '../core/config.js';
import { RNG, approach } from '../core/util.js';
import { Level } from './level.js';
import { TEMPLATES, FIXED, ROOM_W, ROOM_H } from './templates.js';
import { BIOMES } from './biomes.js';
import { assets } from '../core/assets.js';
import { BODY_W, STAND_H, ROLL_H, RUN, ACC_A, FRIC, JUMP_V, DJUMP_V, ledgeTarget } from './movement.js';

const HOLE_X0 = 11, HOLE_X1 = 14;       // 上下连通口所在的格内列（含边框坐标）
const DOOR_Y0 = 11, DOOR_Y1 = 13;       // 左右门洞所在的格内行
const DIRS = { L: [-1, 0, 'R'], R: [1, 0, 'L'], U: [0, -1, 'D'], D: [0, 1, 'U'] };
const GROUND_MARKS = 'eEbTSVI@XJ';

function safeTemplate(tag) {
  const base = TEMPLATES.find((t) => t.tags.includes('start'));
  const row = new Array(ROOM_W).fill('.');
  const marks = { start: [[3, '@'], [9, 'I'], [14, 'I']], exit: [[4, 'e'], [17, 'X']], shop: [[11, 'V']], treasure: [[7, 'e'], [17, 'T']], scroll: [[7, 'e'], [17, 'S']], normal: [[4, 'e'], [8, 'b'], [19, 'e']] };
  for (const [x, ch] of marks[tag] || marks.normal) row[x] = ch;
  return { name: '安全通道·' + tag, rows: [...base.rows.slice(0, -1), row.join('')] };
}

function mirrorRows(rows) { return rows.map((r) => r.split('').reverse().join('')); }

function pickTemplate(rng, tag, open, biome, avoid) {
  let pool = TEMPLATES.filter((t) => t.tags.includes(tag) && (!t.biomes || t.biomes.includes(biome)) && !(open.U && t.noU) && !(open.D && t.noD));
  if (!pool.length) pool = TEMPLATES.filter((t) => t.tags.includes('normal') && !t.biomes && !(open.U && t.noU) && !(open.D && t.noD));
  const fresh = pool.filter((t) => !avoid.includes(t.name));
  if (fresh.length) pool = fresh;
  return rng.pick(pool);
}

/** 在格子上规划主路径与支线 */
function planGrid(rng, GW, GH, depth) {
  const grid = [];
  for (let y = 0; y < GH; y++) grid.push(new Array(GW).fill(null));
  const cell = (x, y) => (x >= 0 && y >= 0 && x < GW && y < GH ? grid[y][x] : undefined);
  const make = (x, y, type) => { const c = { x, y, type, open: { L: false, R: false, U: false, D: false }, main: true }; grid[y][x] = c; return c; };
  const link = (a, dir) => {
    const [dx, dy, back] = DIRS[dir];
    const b = grid[a.y + dy][a.x + dx];
    a.open[dir] = true; b.open[back] = true;
  };
  let cx = 0, cy = rng.int(0, GH - 1);
  const start = make(cx, cy, 'start');
  const path = [start];
  let vert = 0, lastV = null, vertTotal = 0;
  while (cx < GW - 1) {
    const opts = [['R', 3]];
    if (vert < 2 && path.length > 1) {
      if (cy > 0 && cell(cx, cy - 1) === null && lastV !== 'D') opts.push(['U', 1.3]);
      if (cy < GH - 1 && cell(cx, cy + 1) === null && lastV !== 'U') opts.push(['D', 1.6]);
    }
    // 保证至少有两次纵向转折
    let dir = rng.weighted(opts);
    if (vertTotal < 2 && cx >= GW - 3 && opts.length > 1 && dir === 'R') dir = rng.pick(opts.slice(1))[0];
    const [dx, dy] = DIRS[dir];
    const prev = grid[cy][cx];
    cx += dx; cy += dy;
    make(cx, cy, 'normal');
    link(prev, dir);
    path.push(grid[cy][cx]);
    if (dir === 'R') { vert = 0; lastV = null; } else { vert++; lastV = dir; vertTotal++; }
  }
  path[path.length - 1].type = 'exit';
  // 支线房
  const cands = [];
  for (const c of path) {
    if (c.type === 'start') continue;
    for (const d of ['U', 'D', 'L', 'R']) {
      const [dx, dy] = DIRS[d];
      if (cell(c.x + dx, c.y + dy) === null) cands.push([c, d]);
    }
  }
  rng.shuffle(cands);
  const want = ['treasure', 'shop', 'scroll', depth >= 1 ? 'scroll' : 'treasure'];
  const side = [];
  for (const [c, d] of cands) {
    if (!want.length) break;
    const [dx, dy] = DIRS[d];
    if (grid[c.y + dy][c.x + dx] !== null) continue;
    // 宝箱房的模板不支持下方开口：避免从上方接入
    const type = want[0];
    if (type === 'treasure' && d === 'U') continue;
    const s = make(c.x + dx, c.y + dy, type);
    s.main = false;
    link(c, d);
    side.push(s);
    want.shift();
  }
  return { grid, path, side, missing: want };
}

function stampCell(level, c, tpl, flip, rng, biome, spawns) {
  const ox = c.x * CELL_W, oy = c.y * CELL_H;
  const rows = flip ? mirrorRows(tpl.rows) : tpl.rows;
  const B = BIOMES[biome];
  // 边框
  for (let j = 0; j < CELL_H; j++) for (let i = 0; i < CELL_W; i++) {
    const border = i === 0 || j === 0 || i === CELL_W - 1 || j === CELL_H - 1;
    if (!border) continue;
    let t = T_SOLID;
    if (j === 0 && i >= HOLE_X0 && i <= HOLE_X1 && c.open.U) t = T_EMPTY;
    if (j === CELL_H - 1 && i >= HOLE_X0 && i <= HOLE_X1 && c.open.D) t = T_PLAT;
    if (i === 0 && j >= DOOR_Y0 && j <= DOOR_Y1 && c.open.L) t = T_EMPTY;
    if (i === CELL_W - 1 && j >= DOOR_Y0 && j <= DOOR_Y1 && c.open.R) t = T_EMPTY;
    level.set(ox + i, oy + j, t);
    if (t !== T_SOLID) level.back[level.idx(ox + i, oy + j)] = 1;
  }
  // 内部
  for (let j = 0; j < ROOM_H; j++) for (let i = 0; i < ROOM_W; i++) {
    const ch = rows[j][i];
    const tx = ox + 1 + i, ty = oy + 1 + j;
    let t = T_EMPTY;
    switch (ch) {
      case '#': t = T_SOLID; break;
      case '-': t = T_PLAT; break;
      case 'u': t = c.open.U ? T_PLAT : T_EMPTY; break;
      case '^': t = T_SPIKE; break;
      case '~': t = B.liquid ? T_ACID : T_SPIKE; break;
      case '?': t = rng.chance(0.5) ? T_SOLID : T_EMPTY; break;
      case '=': t = rng.chance(0.5) ? T_PLAT : T_EMPTY; break;
      case 'P': t = T_PHASE; level.hasPhase = true; break;
      case '.': case ' ': break;
      default: spawns.push({ ch, tx, ty, cell: c }); break;
    }
    level.set(tx, ty, t);
    level.back[level.idx(tx, ty)] = 1;
  }
  // 门口两格强制留空，避免模板挡门
  for (const [side, col] of [['L', 1], ['R', CELL_W - 2]]) {
    if (!c.open[side]) continue;
    for (let j = DOOR_Y0; j <= DOOR_Y1; j++) for (const cc of [col, side === 'L' ? col + 1 : col - 1]) {
      if (level.get(ox + cc, oy + j) === T_SOLID) level.set(ox + cc, oy + j, T_EMPTY);
    }
  }
  if (c.open.D) for (let i = HOLE_X0; i <= HOLE_X1; i++) { if (level.get(ox + i, oy + CELL_H - 2) === T_SOLID) level.set(ox + i, oy + CELL_H - 2, T_EMPTY); }
}

/** 把模板里的标记字符转成具体的生成物 */
function resolveSpawns(level, raw, rng, biome, run, out) {
  const B = BIOMES[biome];
  const depth = run.depth;
  const pEnemy = Math.min(0.95, 0.72 + 0.05 * depth + 0.05 * run.entropy);
  const eliteP = 0.05 + 0.02 * depth + 0.03 * run.entropy;
  const groundY = (tx, ty) => { let y = ty; while (y < level.h - 1 && !level.isFloor(tx, y + 1)) y++; return (y + 1) * TILE; };
  for (const s of raw) {
    const { ch, tx, ty } = s;
    const px = tx * TILE + TILE / 2;
    const ground = GROUND_MARKS.includes(ch), first = out.length;
    const gy = ground ? groundY(tx, ty) : (ty + 1) * TILE;
    switch (ch) {
      case 'e':
        if (rng.chance(pEnemy)) out.push({ type: 'enemy', id: rng.weighted(B.spawn.ground.filter((e) => (e[2] || 0) <= depth)), x: px, y: gy, elite: rng.chance(eliteP) });
        break;
      case 'E': out.push({ type: 'enemy', id: rng.pick(B.spawn.elite), x: px, y: gy, elite: true }); break;
      case 'f': if (rng.chance(pEnemy - 0.1)) out.push({ type: 'enemy', id: rng.weighted(B.spawn.fly), x: px, y: ty * TILE + TILE / 2 + 8, elite: rng.chance(eliteP * 0.6) }); break;
      case 'c': if (rng.chance(pEnemy) && B.spawn.ceil.length) out.push({ type: 'enemy', id: rng.weighted(B.spawn.ceil), x: px, y: ty * TILE, ceil: true }); break;
      case 'b': if (rng.chance(0.75)) out.push({ type: 'crate', x: px, y: gy }); break;
      case 'T': out.push({ type: 'chest', x: px, y: gy }); break;
      case 'S': out.push({ type: 'scroll', x: px, y: gy }); break;
      case 'V': out.push({ type: 'vending', x: px + TILE / 2, y: gy }); break;
      case 'I': out.push({ type: 'pedestal', x: px, y: gy }); break;
      case 'X': out.push({ type: 'exit', x: px, y: gy }); break;
      case '@': level.start = { x: px, y: gy }; break;
      case 'J': out.push({ type: 'spring', x: px, y: gy, tx, ty: gy / TILE - 1 }); break;
      case 'M': out.push({ type: 'mover', x: px, y: ty * TILE + 4, tx, ty, range: 3 }); break;
      case 'H': {
        const ceil = level.isSolid(tx, ty - 1);
        const floor = level.isSolid(tx, ty + 1);
        if (!ceil && !floor) break;
        const kinds = ceil ? B.hazards.ceil : B.hazards.floor;
        if (!kinds.length || !rng.chance(0.85)) break;
        out.push({ type: 'hazard', kind: rng.pick(kinds), mount: ceil ? 'ceil' : 'floor', x: px, y: ceil ? ty * TILE : (ty + 1) * TILE, phase: rng.next() });
        break;
      }
      default: break;
    }
    if (ground) for (let i = first; i < out.length; i++) out[i].ground = true;
  }
}

// ---------------------------------------------------------------- 可达性校验
function buildNav(level, spawns) {
  const W = level.w, H = level.h;
  const solid = (x, y) => level.isSolid(x, y);
  // 主路线必须依靠永久落脚点。移动平台和会消失的平台不能充当必经通路。
  const floorT = (x, y) => level.isSolid(x, y) || level.get(x, y) === T_PLAT;
  const springs = new Set();
  for (const s of spawns) {
    if (s.type === 'spring') springs.add((s.ty + 1) * W + s.tx);
  }
  const clearBody = (x, y, h) => !level.rectSolid((x + 0.5) * TILE - BODY_W / 2, y * TILE - h, BODY_W, h);
  const low = new Uint8Array(W * H), high = new Uint8Array(W * H);
  for (let y = 1; y < H; y++) for (let x = 1; x < W - 1; x++) if (floorT(x, y)) {
    low[y * W + x] = +clearBody(x, y, ROLL_H);
    high[y * W + x] = +clearBody(x, y, STAND_H);
  }
  const crawl = (x, y) => level.inside(x, y) && !!low[y * W + x];
  const stand = (x, y) => level.inside(x, y) && !!high[y * W + x];
  const dropTo = (x, y) => {
    for (let yy = y; yy < H; yy++) {
      if (!clearBody(x, yy, ROLL_H)) return -1;
      if (floorT(x, yy)) return yy;
    }
    return -1;
  };
  const edges = (x, y) => {
    const out = [];
    const canStand = stand(x, y);
    for (const d of [-1, 1]) {
      const nx = x + d;
      if (crawl(nx, y)) out.push(nx, y);
      else if (!solid(nx, y - 1) && !solid(nx, y - 2) && !floorT(nx, y)) { const yy = dropTo(nx, y + 1); if (yy > 0) out.push(nx, yy); }
    }
    const t = level.get(x, y);
    if (t === T_PLAT) { const yy = dropTo(x, y + 1); if (yy > 0) out.push(x, yy); }
    if (!canStand) return out;
    const spring = springs.has(y * W + x);
    // 用真实重力、二段跳和碰撞验证弧线。旧的「先上再平移」矩形连线会穿过墙角，
    // 还会把顶头后实际上跳不高的路线判成可达。
    for (let dx = -6; dx <= 6; dx++) {
      const nx = x + dx;
      let target = false;
      for (let ny = Math.max(1, y - (spring ? 15 : 9)); ny <= Math.min(H - 1, y + 9); ny++) if (stand(nx, ny)) { target = true; break; }
      if (!target) continue;
      for (const double of [false, true]) {
        const b = { x: (x + 0.5) * TILE, y: y * TILE, w: BODY_W, h: STAND_H, vx: 0, vy: spring ? -860 : -JUMP_V, onGround: false };
        let jumped = !double;
        for (let frame = 0; frame < 110; frame++) {
          // 顶头时不要立即消耗二段跳；离开低天花板后再起跳才能到达侧面的高台。
          if (!jumped && frame >= 16 && b.vy >= -40) { b.vy = -DJUMP_V; jumped = true; }
          const delta = (nx + 0.5) * TILE - b.x;
          const ax = Math.abs(delta) > Math.abs(b.vx) * STEP + 0.1 ? Math.sign(delta) : 0;
          b.vx = approach(b.vx, ax * RUN, (ax ? ACC_A : FRIC * 0.35) * STEP);
          b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * (b.vy > 0 ? 1.12 : 1) * STEP);
          level.moveBody(b, STEP);
          if (!b.onGround && b.hitWall && b.hitWall === ax && b.vy >= -140) {
            const ledge = ledgeTarget(level, b, ax);
            if (ledge) { b.x = ledge.x; b.y = ledge.y; b.onGround = true; }
          }
          if (b.onGround) {
            const lx = Math.floor(b.x / TILE), ly = Math.round(b.y / TILE);
            if (stand(lx, ly)) out.push(lx, ly);
            break;
          }
          if (b.y > (y + 10) * TILE) break;
        }
      }
    }
    return out;
  };
  return { edges, stand, crawl, W, H };
}

export function validateLevel(level, spawns) {
  const phase = level.phaseOn;
  level.phaseOn = false;
  try { return validateStaticLevel(level, spawns); }
  finally { level.phaseOn = phase; }
}

function validateStaticLevel(level, spawns) {
  const nav = buildNav(level, spawns);
  const W = nav.W;
  const key = (x, y) => y * W + x;
  const sx = Math.floor(level.start.x / TILE), sy = Math.round(level.start.y / TILE);
  if (!nav.stand(sx, sy)) return { ok: false, why: 'start not standable' };
  const seen = new Map();          // key -> 出边目标 key 列表
  const queue = [sx, sy];
  seen.set(key(sx, sy), null);
  for (let qi = 0; qi < queue.length; qi += 2) {
    const x = queue[qi], y = queue[qi + 1];
    const es = nav.edges(x, y);
    const list = [];
    for (let i = 0; i < es.length; i += 2) {
      const k = key(es[i], es[i + 1]);
      list.push(k);
      if (!seen.has(k)) { seen.set(k, null); queue.push(es[i], es[i + 1]); }
    }
    seen.set(key(x, y), list);
  }
  const nodeOf = (s) => {
    const tx = Math.floor(s.x / TILE), ty = Math.round(s.y / TILE);
    for (const dx of [0, -1, 1]) if (seen.has(key(tx + dx, ty))) return key(tx + dx, ty);
    return -1;
  };
  let exitKey = -1;
  for (const s of spawns) {
    if (!['exit', 'chest', 'scroll', 'vending', 'pedestal'].includes(s.type)) continue;
    const k = nodeOf(s);
    if (k < 0) return { ok: false, why: s.type + ' unreachable' };
    if (s.type === 'exit') exitKey = k;
  }
  if (exitKey < 0) return { ok: false, why: 'no exit' };
  // 玩家还可能通过攀沿或空中冲刺落在图搜索没有走到的地面上。
  // 这些位置也必须属于连通区域，不能因「没从入口搜索到」而漏掉困人的坑。
  const isolated = [];
  for (let y = 1; y < nav.H; y++) for (let x = 1; x < W - 1; x++) {
    if (nav.crawl(x, y) && !seen.has(key(x, y))) isolated.push([x, y]);
  }
  if (isolated.length) return { ok: false, why: 'isolated floor', isolated };
  // 反向：所有可达点都必须能走到出口（不存在困死的坑）
  const rev = new Map();
  for (const [k, list] of seen) for (const t of list || []) { if (!rev.has(t)) rev.set(t, []); rev.get(t).push(k); }
  const back = new Set([exitKey]);
  const q2 = [exitKey];
  for (let i = 0; i < q2.length; i++) for (const k of rev.get(q2[i]) || []) if (!back.has(k)) { back.add(k); q2.push(k); }
  let stuck = 0;
  for (const k of seen.keys()) if (!back.has(k)) stuck++;
  if (stuck > 0) return { ok: false, why: 'softlock nodes: ' + stuck };
  return { ok: true, nodes: seen.size };
}

// ---------------------------------------------------------------- 装饰与灯光
const PROP_LIGHTS = {
  'prop/console': [44, '#62e6ff'], 'prop/furnace': [64, '#ff8a3a'], 'prop/screen': [46, '#62e6ff'], 'prop/window': [76, '#9db4ff'],
  'prop/coilbig': [54, '#b58cff'], 'prop/scope_wall': [32, '#7be07b'], 'prop/rack': [30, '#7be07b'], 'prop/vdg': [40, '#bfe9ff'],
  'prop/cryostat': [40, '#8fdcff'], 'prop/detector': [50, '#b8fff0'], 'prop/ring': [50, '#b8fff0'], 'prop/boiler': [36, '#ffb070'],
};

function decorate(level, rooms, rng, biome) {
  const B = BIOMES[biome];
  const F = assets.frames;
  if (!F) return;                      // 无图集（命令行测试）时跳过
  const avail = (list) => list.filter(([spr]) => F[spr]);
  const floorProps = avail(B.props), wallProps = avail(B.wallProps);
  const lamp = F[B.lamp || 'prop/lamp'] ? (B.lamp || 'prop/lamp') : null;
  const overlaps = (x, y, w, h) => level.decor.some((d) => d.x < x + w && d.x + d.w > x && d.y < y + h && d.y + d.h > y);
  for (const r of rooms) {
    const ox = r.x * CELL_W, oy = r.y * CELL_H;
    // 通往右侧房间的门框（画在前景层）
    if (r.open.R && F['prop/doorframe']) {
      const f = F['prop/doorframe'];
      level.decor.push({ spr: 'prop/doorframe', x: (ox + CELL_W - 1) * TILE - 4, y: (oy + DOOR_Y0) * TILE - 10, w: f[2], h: f[3], fg: true });
    }
    // 吊灯：天花板下方
    for (const col of [6, 19]) {
      const tx = ox + col + rng.int(-1, 1), ty = oy + 1;
      if (level.isSolid(tx, ty - 1) && level.get(tx, ty) === T_EMPTY && level.get(tx, ty + 1) === T_EMPTY) {
        if (lamp) level.decor.push({ spr: lamp, x: tx * TILE + ((TILE - F[lamp][2]) >> 1), y: ty * TILE, w: F[lamp][2], h: F[lamp][3] });
        level.lights.push({ x: tx * TILE + TILE / 2, y: ty * TILE + 12, r: 150, color: B.lampColor, flicker: rng.chance(0.2) ? rng.range(0.6, 2) : 0 });
      }
    }
    // 地面摆设：沿地板找连续空位
    if (floorProps.length) {
      const fy = oy + CELL_H - 2;
      let x = ox + 2;
      while (x < ox + CELL_W - 3) {
        if (rng.chance(0.45)) { x += rng.int(1, 3); continue; }
        const spr = rng.weighted(floorProps);
        const pw = F[spr][2], ph = F[spr][3];
        const wT = Math.ceil(pw / TILE), hT = Math.ceil(ph / TILE);
        let ok = x + wT < ox + CELL_W - 2;
        for (let i = 0; i < wT && ok; i++) {
          if (!level.isSolid(x + i, fy + 1)) ok = false;
          for (let j = 0; j < hT && ok; j++) if (level.get(x + i, fy - j) !== T_EMPTY) ok = false;
        }
        if (ok) {
          const px = x * TILE + ((wT * TILE - pw) >> 1), py = (fy + 1) * TILE - ph;
          level.decor.push({ spr, x: px, y: py, w: pw, h: ph, flip: rng.chance(0.5) });
          const L = PROP_LIGHTS[spr];
          if (L) level.lights.push({ x: px + pw / 2, y: py + ph / 2, r: L[0], color: L[1], flicker: 0 });
          x += wT + rng.int(1, 4);
        } else x += 1;
      }
    }
    // 墙面挂件
    if (wallProps.length) {
      for (let n = 0; n < 4; n++) {
        const spr = rng.weighted(wallProps);
        const pw = F[spr][2], ph = F[spr][3];
        const wT = Math.ceil(pw / TILE), hT = Math.ceil(ph / TILE);
        const tx = ox + rng.int(2, CELL_W - 3 - wT), ty = oy + rng.int(2, 8);
        let ok = true;
        for (let i = 0; i < wT && ok; i++) for (let j = 0; j < hT && ok; j++) if (level.get(tx + i, ty + j) !== T_EMPTY) ok = false;
        const px = tx * TILE + ((wT * TILE - pw) >> 1), py = ty * TILE + ((hT * TILE - ph) >> 1);
        if (ok && !overlaps(px - 10, py - 10, pw + 20, ph + 20)) {
          level.decor.push({ spr, x: px, y: py, w: pw, h: ph, flip: false });
          const L = PROP_LIGHTS[spr];
          if (L) level.lights.push({ x: px + pw / 2, y: py + ph / 2, r: L[0], color: L[1], flicker: 0 });
        }
      }
    }
  }
}

// ---------------------------------------------------------------- 入口
export function generateLevel(run, biome, seed) {
  const depth = run.depth;
  const GW = Math.min(8, 6 + Math.floor((depth + 1) / 2)), GH = 3;
  let lastWhy = '';
  for (let attempt = 0; attempt < 16; attempt++) {
    const rng = new RNG((seed + attempt * 7919) >>> 0);
    const plan = planGrid(rng, GW, GH, depth);
    const level = new Level(GW * CELL_W, GH * CELL_H, biome);
    level.seed = (seed + attempt) | 0;
    level.repairedPlatforms = 0;
    const raw = [];
    const rooms = [];
    const used = [];
    for (const row of plan.grid) for (const c of row) {
      if (!c) continue;
      const tag = c.type;
      // 高复杂度组合多次失败后使用开阔房间，仍保留随机路径、特殊房和奖励。
      // 兜底也必须通过同一套碰撞校验，不能把未通过的地图交给玩家。
      const tpl = attempt >= 8 ? safeTemplate(tag) : pickTemplate(rng, tag, c.open, biome, used.slice(-3));
      used.push(tpl.name);
      const flip = rng.chance(0.5);
      stampCell(level, c, tpl, flip, rng, biome, raw);
      rooms.push({ x: c.x, y: c.y, type: c.type, open: c.open, name: tpl.name, main: c.main });
    }
    const spawns = [];
    resolveSpawns(level, raw, rng, biome, run, spawns);
    if (!level.start) { lastWhy = 'no start'; continue; }
    // 没排上的支线奖励：直接放到主路径某个房间的地面上
    for (const type of plan.missing) {
      if (type === 'shop') continue;
      const c = rng.pick(plan.path.slice(1, -1));
      if (!c) continue;
      const tx = c.x * CELL_W + rng.pick([4, 5, 19, 20]), ty = c.y * CELL_H + CELL_H - 2;
      if (level.get(tx, ty) === T_EMPTY && level.isSolid(tx, ty + 1)) spawns.push({ type: type === 'treasure' ? 'chest' : 'scroll', x: tx * TILE + TILE / 2, y: (ty + 1) * TILE });
    }
    let v = validateLevel(level, spawns);
    // 一些模板在厚台面下面留了无法连通的零散单向台阶。只移除这些孤立台阶，
    // 再让静态奖励落到新的地面并完整复验，优先保留本来可玩的房间组合。
    for (let repair = 0; repair < 3 && v.isolated?.length && v.isolated.every(([x, y]) => level.get(x, y) === T_PLAT); repair++) {
      level.repairedPlatforms += v.isolated.length;
      for (const [x, y] of v.isolated) level.set(x, y, T_EMPTY);
      for (const s of spawns) if (s.ground || ['chest', 'scroll'].includes(s.type)) {
        const y = level.groundBelow(s.x, s.y, level.h);
        if (y !== null) { s.y = y; if (s.type === 'spring') s.ty = y / TILE - 1; }
      }
      v = validateLevel(level, spawns);
    }
    if (!v.ok) { lastWhy = v.why; continue; }
    decorate(level, rooms, rng, biome);
    level.spawns = spawns;
    level.rooms = rooms;
    level.grid = { w: GW, h: GH };
    level.attempts = attempt + 1;
    return level;
  }
  throw new Error('level generation failed: ' + lastWhy);
}

/** 手工关卡（茶水间 / 首领房） */
export function buildFixedLevel(id, run) {
  const F = FIXED[id];
  const rows = F.rows;
  const level = new Level(rows[0].length, rows.length, F.biome);
  level.seed = 7;
  level.fixed = id;
  const spawns = [];
  const rng = new RNG(run.seed + run.stage * 131);
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const ch = rows[y][x];
    let t = T_EMPTY;
    const px = x * TILE + TILE / 2, gy = (y + 1) * TILE;
    switch (ch) {
      case '#': t = T_SOLID; break;
      case '-': t = T_PLAT; break;
      case '@': level.start = { x: px, y: gy }; break;
      case 'X': spawns.push({ type: 'exit', x: px, y: gy, locked: id !== 'rest' }); break;
      case 'W': spawns.push({ type: 'dispenser', x: px, y: gy }); break;
      case 'B': spawns.push(id === 'rest' ? { type: 'blackboard', x: px + TILE / 2, y: gy } : { type: 'boss', id, x: px, y: id === 'singularity' ? gy - 6 : gy }); break;
      case 'C': spawns.push({ type: 'terminal', x: px, y: gy }); break;
      default: break;
    }
    level.set(x, y, t);
    if (t !== T_SOLID) level.back[level.idx(x, y)] = 1;
  }
  const rooms = [{ x: 0, y: 0, type: id, open: { D: false }, name: id, main: true, wide: true }];
  // 手工关卡的灯光与摆设
  const B = BIOMES[F.biome];
  const FR = assets.frames;
  const lamp = FR && FR[B.lamp || 'prop/lamp'] ? (B.lamp || 'prop/lamp') : null;
  for (let x = 4; x < level.w - 3; x += 7) {
    let ty = 1; while (ty < level.h && level.isSolid(x, ty)) ty++;
    if (lamp) level.decor.push({ spr: lamp, x: x * TILE + ((TILE - FR[lamp][2]) >> 1), y: ty * TILE, w: FR[lamp][2], h: FR[lamp][3] });
    level.lights.push({ x: x * TILE + TILE / 2, y: ty * TILE + 12, r: 170, color: B.lampColor, flicker: 0 });
  }
  if (FR && id !== 'rest') {
    const fy = level.h - 1;
    const put = (spr, tx) => { if (FR[spr]) level.decor.push({ spr, x: tx * TILE, y: fy * TILE - FR[spr][3], w: FR[spr][2], h: FR[spr][3] }); };
    const hang = (spr, px, py) => { if (FR[spr]) level.decor.push({ spr, x: Math.round(px - FR[spr][2] / 2), y: Math.round(py - FR[spr][3] / 2), w: FR[spr][2], h: FR[spr][3] }); };
    if (id === 'tyrant') {
      put('prop/coilbig', 2); put('prop/rack', 6); put('prop/vdg', 10); put('prop/console', 17); put('prop/rack', 25); put('prop/coilbig', 32);
      for (const tx of [5, 13, 22, 30]) hang('prop/warn_elec', tx * TILE, 4 * TILE);
      hang('prop/cables', 9 * TILE, 2.6 * TILE); hang('prop/cables', 27 * TILE, 2.6 * TILE);
    } else {
      // 束流管道穿过房间，探测器正对着奇点
      const b = spawns.find((s) => s.type === 'boss');
      if (b) {
        const cy = b.y - 20;
        if (FR['prop/ring']) for (let x = TILE; x < level.pxW - TILE; x += FR['prop/ring'][2]) { if (Math.abs(x + 23 - b.x) > 40) hang('prop/ring', x + 23, cy); }
        hang('prop/detector', b.x, cy);
        level.lights.push({ x: b.x, y: cy, r: 120, color: '#c98bff', flicker: 0 });
      }
      put('prop/cryostat', 2); put('prop/console', 8); put('prop/console', 24); put('prop/cryostat', 32);
      for (const tx of [6, 30]) hang('prop/warn_rad', tx * TILE, 9 * TILE);
    }
  }
  if (id === 'rest' && FR) {
    const fy = level.h - 1;
    const put = (spr, tx) => { if (FR[spr]) level.decor.push({ spr, x: tx * TILE, y: fy * TILE - FR[spr][3], w: FR[spr][2], h: FR[spr][3] }); };
    put('prop/sofa', 4); put('prop/plant', 12); put('prop/fridge', 19); put('prop/plant', 27);
    const hang = (spr, tx, ty) => { if (FR[spr]) level.decor.push({ spr, x: tx * TILE, y: ty * TILE, w: FR[spr][2], h: FR[spr][3] }); };
    hang('prop/clock', 5, 6); hang('prop/window', 11, 5); hang('prop/poster2', 20, 6); hang('prop/poster1', 28, 6);
  }
  level.spawns = spawns;
  level.rooms = rooms;
  level.grid = { w: 1, h: 1 };
  void rng;
  return level;
}
