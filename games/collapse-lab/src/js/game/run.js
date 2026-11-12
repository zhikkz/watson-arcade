// 一局游戏的数据：生命、装备、定理、文献、货币、进度，以及由它们导出的数值
import { RNG, sign } from '../core/util.js';
import { audio } from '../core/audio.js';
import { G } from './state.js';
import { PERKS } from './perks.js';
import { makeItem, ITEMS, AFFIXES, unlockedItems } from './items.js';

// 流程：关卡 -> 茶水间 -> 关卡 -> … -> 首领
export const STAGES = [
  { type: 'level', biome: 'mech', name: '力学实验楼', sub: '摆锤、弹簧与砝码都活了过来', music: 'mech' },
  { type: 'rest' },
  { type: 'level', biome: 'em', name: '电磁实验室', sub: '请勿触摸带电设备', music: 'em' },
  { type: 'rest' },
  { type: 'boss', boss: 'tyrant', biome: 'em', name: '配电大厅', sub: '嘟礼·暴君', music: 'boss' },
  { type: 'rest' },
  { type: 'level', biome: 'thermo', name: '热学车间', sub: '冷得刺骨，烫得冒烟', music: 'thermo' },
  { type: 'rest' },
  { type: 'level', biome: 'quantum', name: '量子对撞机', sub: '这里的一切既在又不在', music: 'quantum' },
  { type: 'rest' },
  { type: 'boss', boss: 'singularity', biome: 'quantum', name: '对撞核心', sub: '奇点', music: 'boss' },
];

export class Run {
  constructor(save, seed) {
    this.save = save;
    this.seed = seed >>> 0;
    this.rng = new RNG(this.seed);
    this.stage = 0;
    this.entropy = save.entropy || 0;         // 已解锁的难度层级（通关次数）
    this.scrolls = { force: 0, tech: 0, vital: 0 };
    this.perks = [];
    this.weapons = [makeItem('wrench', 1, this.rng, 0), null];
    this.skill = null;
    this.skillCd = 0; this.skillCdMax = 1;
    this.wcd = [0, 0];
    this.gold = save.unlocks.gold1 ? 50 : 0;
    this.data = 0;                            // 本局携带、尚未上传的数据
    this.flaskMax = 2 + (save.unlocks.flask1 ? 1 : 0) + (save.unlocks.flask2 ? 1 : 0);
    this.flask = this.flaskMax;
    this.baseHp = 100 + (save.unlocks.hp1 ? 15 : 0) + (save.unlocks.hp2 ? 20 : 0);
    this.maxHp = this.baseHp;
    this.hp = this.maxHp;
    this.revives = save.unlocks.revive ? 1 : 0;
    this.kills = 0; this.time = 0; this.dmgTaken = 0; this.eliteKills = 0;
    this.momentumT = 0; this.shieldT = 6; this.regenAcc = 0;
    this.orbits = [];
    this.stats = {};
    this.seenPerks = [];
    if (save.unlocks.starter) {
      const pool = unlockedItems(save).filter((id) => ITEMS[id].kind === 'weapon' && ITEMS[id].type !== 'melee');
      if (pool.length) this.weapons[1] = makeItem(this.rng.pick(pool), 1, this.rng, 0);
    }
    this.recalc();
  }

  get stageDef() { return STAGES[this.stage]; }
  /** 战斗深度：0=力学 1=电磁 2=暴君 3=热学 4=量子 5=奇点 */
  get depth() {
    let d = 0;
    for (let i = 0; i < this.stage; i++) if (STAGES[i].type !== 'rest') d++;
    return d;
  }
  enemyHpMul() { return (1 + 0.42 * this.depth) * (1 + 0.4 * this.entropy); }
  enemyDmgMul() { return (1 + 0.2 * this.depth) * (1 + 0.25 * this.entropy); }
  difficultyDmg() { return 1; }
  itemLevel() { return 1 + this.depth + this.entropy; }

  hasPerk(id) { return this.perks.includes(id); }

  // ---------------------------------------------------------------- 存档
  /** 把这一局的状态拍成可以写进存档的纯数据（不含世界里的东西：继续时从当前区域的入口重新生成） */
  snapshot() {
    const item = (it) => (it ? { id: it.id, lv: it.lv, affixes: it.affixes.slice(), rarity: it.rarity } : null);
    return {
      seed: this.seed, rng: this.rng.s, stage: this.stage, entropy: this.entropy,
      scrolls: { force: this.scrolls.force, tech: this.scrolls.tech, vital: this.scrolls.vital },
      perks: this.perks.slice(), seenPerks: this.seenPerks.slice(),
      weapons: this.weapons.map(item), skill: item(this.skill),
      gold: this.gold, data: this.data, flask: this.flask, flaskMax: this.flaskMax,
      baseHp: this.baseHp, maxHp: this.maxHp, hp: this.hp, revives: this.revives,
      kills: this.kills, time: this.time, dmgTaken: this.dmgTaken, eliteKills: this.eliteKills,
    };
  }

  /** 从快照还原一局。存档里出现不认识的装备 / 定理（比如版本更新后）会被丢掉，而不是让游戏崩掉 */
  static restore(save, snap) {
    const num = (v, d, lo = 0, hi = 1e9) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    const item = (it) => (it && ITEMS[it.id]
      ? { id: it.id, lv: Math.max(1, Math.floor(num(it.lv, 1))), affixes: (Array.isArray(it.affixes) ? it.affixes : []).filter((a) => AFFIXES[a]), rarity: Math.floor(num(it.rarity, 0, 0, 4)) }
      : null);
    const run = new Run(save, num(snap.seed, 1, 0, 0xffffffff));
    run.stage = Math.floor(num(snap.stage, 0, 0, STAGES.length - 1));
    run.entropy = Math.floor(num(snap.entropy, 0, 0, 99));
    const sc = snap.scrolls || {};
    run.scrolls = { force: Math.floor(num(sc.force, 0, 0, 99)), tech: Math.floor(num(sc.tech, 0, 0, 99)), vital: Math.floor(num(sc.vital, 0, 0, 99)) };
    run.perks = (Array.isArray(snap.perks) ? snap.perks : []).filter((id, i, a) => PERKS[id] && a.indexOf(id) === i);
    run.seenPerks = (Array.isArray(snap.seenPerks) ? snap.seenPerks : []).filter((id) => PERKS[id]);
    const ws = Array.isArray(snap.weapons) ? snap.weapons : [];
    const w0 = item(ws[0]), w1 = item(ws[1]);
    run.weapons = [w0 && ITEMS[w0.id].kind === 'weapon' ? w0 : makeItem('wrench', 1, run.rng, 0), w1 && ITEMS[w1.id].kind === 'weapon' ? w1 : null];
    const sk = item(snap.skill);
    run.skill = sk && ITEMS[sk.id].kind === 'skill' ? sk : null;
    run.skillCd = 0; run.wcd = [0, 0];
    run.gold = Math.floor(num(snap.gold, 0)); run.data = Math.floor(num(snap.data, 0));
    run.baseHp = num(snap.baseHp, run.baseHp, 1, 9999);
    // 先放回存档时的上限，再重新推导数值：这样不会被当成「刚获得加成」而多补血 / 多补保温杯
    run.maxHp = num(snap.maxHp, run.baseHp, 1, 99999);
    run.flaskMax = Math.floor(num(snap.flaskMax, run.flaskMax, 0, 9));
    run.hp = run.maxHp; run.flask = run.flaskMax;
    run.recalc();
    run.hp = num(snap.hp, run.maxHp, 1, run.maxHp);
    run.flask = Math.floor(num(snap.flask, run.flaskMax, 0, run.flaskMax));
    run.revives = Math.floor(num(snap.revives, 0, 0, 9));
    run.kills = Math.floor(num(snap.kills, 0)); run.time = num(snap.time, 0);
    run.dmgTaken = num(snap.dmgTaken, 0); run.eliteKills = Math.floor(num(snap.eliteKills, 0));
    // 随机数状态放在最后恢复：关卡、掉落会和存档时走同一条序列
    run.rng.s = num(snap.rng, run.seed, 0, 0xffffffff) >>> 0;
    return run;
  }

  recalc() {
    const s = this.scrolls, P = (id) => this.perks.includes(id);
    this.stats = {
      speed: 0,
      jump: P('hooke') ? 0.15 : 0,
      airJumps: P('hooke') ? 1 : 0,
      rollLen: P('tunneling') ? 0.3 : 0,
      rollCd: P('tunneling') ? 0.4 : 0,
      armor: 0,
      healSpeed: P('carnot') ? 0.35 : 0,
      healAmt: P('carnot') ? 0.17 : 0,
      crit: 0.05,
      cdr: (P('superconduct') ? 0.3 : 0) + Math.min(0.24, s.tech * 0.03),
      loot: P('emc2') ? 0.4 : 0,
      melee: 1 + 0.15 * s.force,
      tech: 1 + 0.15 * s.tech,
      dot: P('entropy') ? 1.5 : 1,
      dotDur: P('entropy') ? 2 : 1,
      freezeDur: P('absolute0') ? 1.5 : 1,
    };
    const oldMax = this.maxHp;
    this.maxHp = Math.round(this.baseHp * (1 + 0.06 * (s.force + s.tech) + 0.22 * s.vital) * (P('archimedes') ? 1.25 : 1));
    if (this.maxHp > oldMax) this.hp += this.maxHp - oldMax;
    this.hp = Math.min(this.hp, this.maxHp);
    const fm = 2 + (this.save.unlocks.flask1 ? 1 : 0) + (this.save.unlocks.flask2 ? 1 : 0) + (P('archimedes') ? 1 : 0);
    if (fm > this.flaskMax) this.flask += fm - this.flaskMax;
    this.flaskMax = fm;
  }

  stat(name) { return this.stats[name] || 0; }

  /** 基础伤害 -> 套用文献加成后的伤害 */
  dmg(kind, base) {
    return base * (kind === 'melee' ? this.stats.melee : this.stats.tech);
  }

  addPerk(id) {
    if (!this.perks.includes(id)) this.perks.push(id);
    this.recalc();
  }

  addScroll(kind) {
    this.scrolls[kind]++;
    const before = this.maxHp;
    this.recalc();
    if (kind === 'vital') this.hp = Math.min(this.maxHp, this.hp + Math.round((this.maxHp - before) * 0.5));
  }

  heal(amt, player) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amt);
    const got = Math.round(this.hp - before);
    if (got > 0 && player && player.world) player.world.fx.text(player.x, player.y - 58, '+' + got, '#7be07b', { size: 12 });
    return got;
  }

  tickCooldowns(dt) {
    this.time += dt;
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.wcd[0] = Math.max(0, this.wcd[0] - dt);
    this.wcd[1] = Math.max(0, this.wcd[1] - dt);
    this.momentumT = Math.max(0, this.momentumT - dt);
    const p = G.world && G.world.player;
    if (!p || p.dead) return;
    if (this.hasPerk('halflife') && this.hp < this.maxHp * 0.5) {
      this.regenAcc += dt * 1.5;
      if (this.regenAcc >= 1) { this.regenAcc -= 1; this.hp = Math.min(this.maxHp, this.hp + 1); }
    }
    if (this.hasPerk('faraday')) {
      if (p.shield <= 0) {
        this.shieldT -= dt;
        if (this.shieldT <= 0) { this.shieldT = 12; p.shield = 20; p.world.fx.ring(p.x, p.cy, '#62e6ff', 6, 26, 0.3); audio.sfx('phase'); }
      }
    }
  }

  // ---------------------------------------------------------------- 钩子
  /** 命中前的伤害倍率（定理） */
  hitMul(player, enemy, info) {
    let m = 1;
    const direct = info.src === 'melee' || info.src === 'ranged';
    if (direct && this.momentumT > 0 && this.hasPerk('momentum')) { m *= 1.6; info.momentum = true; }
    if (this.hasPerk('doppler') && Math.abs(player.vx) > 40 && sign(player.vx) === sign(enemy.x - player.x)) m *= 1.2;
    if (this.hasPerk('bernoulli') && !player.onGround) m *= 1.35;
    if (this.hasPerk('leverage') && (enemy.elite || enemy.boss)) m *= 1.25;
    if (this.hasPerk('resonance')) m *= 1 + Math.min(0.4, 0.04 * player.combo);
    return m;
  }

  onHit(player, enemy, dmg, info) {
    const w = player.world;
    if (info.momentum) this.momentumT = 0;
    if (info.src !== 'dot') { player.combo++; player.comboT = 2.5; }
    if (info.crit && this.hasPerk('photoelectric') && info.src !== 'perk') w.chainLightning(enemy.x, enemy.cy, dmg * 0.5, 3, enemy);
    if (this.hasPerk('blackbody') && info.src !== 'dot' && info.src !== 'perk' && Math.random() < 0.25) enemy.applyEffects({ burn: 3 });
  }

  onKill(player, enemy, info) {
    const w = player.world;
    this.kills++;
    if (enemy.elite) this.eliteKills++;
    if (this.hasPerk('conserve')) this.heal(2, player);
    if (this.hasPerk('chain') && Math.random() < 0.3) w.explode(enemy.x, enemy.cy, 44, this.dmg('skill', 16 + 5 * this.depth), { src: 'perk' });
    if (this.hasPerk('absolute0') && enemy.frozenT > 0) {
      audio.sfx('shatter');
      w.fx.burst(enemy.x, enemy.cy, 16, { color: ['#dff6ff', '#9fdcff', '#ffffff'], speed: 80, speedMax: 220, life: 0.3, lifeMax: 0.5, grav: 200 });
      for (const e of w.enemiesInRadius(enemy.x, enemy.cy, 64)) if (e !== enemy) w.hitEnemy(e, this.dmg('skill', 14 + 4 * this.depth), { src: 'perk', effects: { chill: 3 } });
    }
  }

  onRoll() { if (this.hasPerk('momentum')) this.momentumT = 1.5; }

  onDodge(player) {
    const w = player.world;
    w.fx.text(player.x, player.y - 58, '闪避', '#bfe9ff');
    if (this.hasPerk('relativity')) w.slowmo(0.55, 0.35);
  }

  onHurt(player, dmg) {
    const w = player.world;
    if (this.hasPerk('newton3')) {
      w.fx.ring(player.x, player.cy, '#ffb0a0', 8, 70, 0.3, 2);
      for (const e of w.enemiesInRadius(player.x, player.cy, 72)) w.hitEnemy(e, dmg * 3, { src: 'perk', kbx: sign(e.x - player.x) * 240, kby: -160 });
    }
    if (this.hasPerk('pauli')) {
      player.invuln += 1;
      for (const e of w.enemiesInRadius(player.x, player.cy, 60)) e.knock(sign(e.x - player.x) * 260, -140);
      w.fx.ring(player.x, player.cy, '#c98bff', 6, 56, 0.25);
    }
  }

  tryRevive(player) {
    if (this.revives <= 0) return false;
    this.revives--;
    const w = player.world;
    this.hp = Math.round(this.maxHp * 0.5);
    player.invuln = 2.5; player.flash = 0.3;
    w.fx.text(player.x, player.y - 70, '观测结果：存活', '#62e6ff', { size: 12, life: 1.6 });
    w.fx.ring(player.x, player.cy, '#62e6ff', 10, 120, 0.5, 2);
    w.explode(player.x, player.cy, 110, 40, { src: 'perk', silent: false });
    w.slowmo(0.8, 0.3);
    audio.sfx('meow');
    return true;
  }

  /** 开普勒卫星 */
  spawnOrbit(player) {
    if (this.orbits.filter((o) => !o.dead).length >= 3) return;
    const o = player.world.spawnOrbit(player);
    this.orbits = this.orbits.filter((x) => !x.dead);
    this.orbits.push(o);
  }

  /** 随机抽 n 个尚未拥有的定理 */
  rollPerks(n) {
    const pool = Object.keys(PERKS).filter((id) => !this.perks.includes(id));
    return this.rng.sample(pool, Math.min(n, pool.length));
  }
}
