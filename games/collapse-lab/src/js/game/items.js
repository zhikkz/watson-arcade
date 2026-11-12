// 装备定义：武器 / 技能 / 词条。物理元素只是题材——每件装备的说明写的都是实际效果。
import { COLORS } from '../core/config.js';

// 主角姿势时间线：[结束时间, 帧名, 纵向偏移]
const LIGHT_A = [[0.05, 'hero/run/4'], [0.17, 'hero/run/0'], [9, 'hero/run/3']];
const LIGHT_B = [[0.05, 'hero/run/1'], [0.17, 'hero/run/3'], [9, 'hero/run/1']];
const HEAVY = [[0.16, 'hero/jump/1'], [0.3, 'hero/jump/4', -7], [9, 'hero/slide/7']];
const STAB_A = [[0.03, 'hero/run/4'], [9, 'hero/run/0']];
const STAB_B = [[0.03, 'hero/run/1'], [9, 'hero/run/3']];

const sw = (o) => Object.assign({
  dur: 0.27, hit: [0.07, 0.15], box: [2, -50, 42, 48], mul: 1, kb: 90, lift: -30, lunge: 90,
  poses: LIGHT_A, arc: { r: 27, a0: -105, a1: 50, w: 7 }, wa: [-120, 60], sfx: 'swing', stop: 0.035, shake: 1.5,
}, o);

export const ITEMS = {
  // ------------------------------------------------------------ 近战
  wrench: {
    name: '活动扳手', kind: 'weapon', type: 'melee', base: 15, free: true, color: '#cfd6e6',
    desc: '三连击，第三下重击能{y}击退并眩晕{/}敌人。实验室里最趁手的工具。',
    combo: [
      sw({}),
      sw({ poses: LIGHT_B, arc: { r: 27, a0: 60, a1: -95, w: 7 }, wa: [70, -110] }),
      sw({ dur: 0.5, hit: [0.2, 0.3], box: [0, -60, 50, 60], mul: 1.9, kb: 260, lift: -120, lunge: 150, poses: HEAVY, arc: { r: 34, a0: -140, a1: 70, w: 10 }, wa: [-150, 80], sfx: 'swingHeavy', stop: 0.08, shake: 4, stun: 0.4 }),
    ],
  },
  caliper: {
    name: '游标卡尺', kind: 'weapon', type: 'melee', base: 9, free: true, color: '#e8edf5',
    desc: '出手极快的精确刺击。从{y}背后{/}命中必定暴击。',
    crit: 'back',
    combo: [
      sw({ dur: 0.17, hit: [0.04, 0.1], box: [4, -38, 42, 18], kb: 40, lunge: 70, poses: STAB_A, arc: null, thrust: 14, sfx: 'stab', stop: 0.02, shake: 1 }),
      sw({ dur: 0.17, hit: [0.04, 0.1], box: [4, -36, 42, 18], kb: 40, lunge: 70, poses: STAB_B, arc: null, thrust: 14, sfx: 'stab', stop: 0.02, shake: 1 }),
    ],
  },
  pendulum: {
    name: '傅科摆锤', kind: 'weapon', type: 'melee', base: 28, color: '#ffcf70',
    desc: '缓慢而沉重的一砸，落地震波波及周围。对{y}眩晕或冰冻{/}的敌人暴击。',
    crit: 'helpless',
    combo: [
      sw({ dur: 0.62, hit: [0.3, 0.4], box: [-4, -62, 56, 62], kb: 300, lift: -150, lunge: 110, poses: [[0.26, 'hero/jump/1'], [0.42, 'hero/jump/4', -9], [9, 'hero/slide/7']], arc: { r: 38, a0: -160, a1: 75, w: 12 }, wa: [-170, 85], sfx: 'swingHeavy', stop: 0.1, shake: 6, stun: 0.8, quake: 48 }),
    ],
  },
  pointer: {
    name: '激光教鞭', kind: 'weapon', type: 'melee', base: 11, color: '#ff5a6a',
    desc: '攻击范围很长的光刃，命中会{o}点燃{/}敌人。用{y}最远端{/}击中时暴击。',
    crit: 'tip', effects: { burn: 2.5 }, blade: 30,
    combo: [
      sw({ dur: 0.24, hit: [0.06, 0.14], box: [4, -48, 58, 44], kb: 50, lunge: 50, arc: { r: 46, a0: -80, a1: 40, w: 5 }, wa: [-90, 45], sfx: 'laser' }),
      sw({ dur: 0.24, hit: [0.06, 0.14], box: [4, -48, 58, 44], kb: 50, lunge: 50, poses: LIGHT_B, arc: { r: 46, a0: 50, a1: -75, w: 5 }, wa: [55, -85], sfx: 'laser' }),
    ],
  },
  fork: {
    name: '音叉', kind: 'weapon', type: 'melee', base: 12, color: '#9fe8ff',
    desc: '每次挥击都会放出一道穿透敌人的{c}声波{/}。声波击中刚被音叉敲过的敌人时暴击。',
    crit: 'resonate',
    combo: [
      sw({ dur: 0.28, wave: true }),
      sw({ dur: 0.28, poses: LIGHT_B, arc: { r: 27, a0: 60, a1: -95, w: 7 }, wa: [70, -110], wave: true }),
    ],
  },
  gloves: {
    name: '特斯拉拳套', kind: 'weapon', type: 'melee', base: 6, color: '#fff36a',
    desc: '极快的连打，命中使敌人{y}感电{/}。每第四拳放出{c}闪电链{/}。',
    effects: { shock: 3 },
    combo: [
      sw({ dur: 0.13, hit: [0.03, 0.08], box: [2, -42, 32, 24], kb: 30, lunge: 60, poses: STAB_A, arc: null, punch: true, sfx: 'stab', stop: 0.015, shake: 0.8 }),
      sw({ dur: 0.13, hit: [0.03, 0.08], box: [2, -42, 32, 24], kb: 30, lunge: 60, poses: STAB_B, arc: null, punch: true, sfx: 'stab', stop: 0.015, shake: 0.8 }),
      sw({ dur: 0.13, hit: [0.03, 0.08], box: [2, -42, 32, 24], kb: 30, lunge: 60, poses: STAB_A, arc: null, punch: true, sfx: 'stab', stop: 0.015, shake: 0.8 }),
      sw({ dur: 0.26, hit: [0.06, 0.13], box: [2, -46, 38, 30], mul: 1.6, kb: 170, lunge: 110, poses: STAB_B, arc: null, punch: true, chain: true, sfx: 'zap', stop: 0.05, shake: 3 }),
    ],
  },
  // ------------------------------------------------------------ 远程
  laserpen: {
    name: '激光笔', kind: 'weapon', type: 'gun', base: 7, free: true, color: '#ff4a5a', auto: true, cd: 0.15,
    desc: '按住连发。光束碰到墙壁会{y}反射{/}两次，反射后的光束暴击。',
    crit: 'bounced', sfx: 'laser',
    proj: { speed: 520, life: 1.1, r: 2, bounces: 2, look: 'laser' },
  },
  leyden: {
    name: '莱顿瓶', kind: 'weapon', type: 'throw', base: 16, free: true, color: '#9fd0ff', cd: 0.7,
    desc: '抛出后炸开一片电光，使范围内敌人{y}感电{/}并留下带电区域。',
    sfx: 'throw',
    proj: { speed: 250, ang: -0.55, grav: 760, r: 4, look: 'jar', explode: { r: 40, effects: { shock: 3 }, field: 1.6, color: '#bfe9ff', sfx: 'zap' } },
  },
  railgun: {
    name: '电磁轨道炮', kind: 'weapon', type: 'charge', base: 14, color: '#b58cff', cd: 0.28,
    desc: '按住蓄力，松开射出{y}贯穿{/}一整排敌人的弹丸。蓄满时暴击。',
    crit: 'charged', chargeT: 0.75, chargeMul: 2.6,
  },
  gyro: {
    name: '陀螺飞盘', kind: 'weapon', type: 'boomerang', base: 14, color: '#ffd24a', cd: 0.2,
    desc: '飞出去再飞回来，来回都会切割路径上的敌人。{y}返程{/}命中暴击。',
    crit: 'returning', sfx: 'throw',
  },
  cryo: {
    name: '液氮喷枪', kind: 'weapon', type: 'spray', base: 3, color: '#8fdcff', auto: true,
    desc: '按住持续喷射。寒气会逐渐减慢敌人，叠满后将其{b}冻结{/}。',
    effects: { chill: 1 },
  },
  cathode: {
    name: '阴极射线管', kind: 'weapon', type: 'gun', base: 5, color: '#7be07b', cd: 0.62,
    desc: '一次喷出五束粒子，贴脸威力惊人。{y}近距离{/}命中暴击。',
    crit: 'near', sfx: 'shoot', count: 5, spread: 0.5, recoil: 130,
    proj: { speed: 430, life: 0.3, r: 2, look: 'pellet' },
  },
  // ------------------------------------------------------------ 技能
  coil: {
    name: '特斯拉线圈', kind: 'skill', type: 'coil', base: 9, free: true, color: '#b58cff', cd: 14,
    desc: '在脚下架设线圈，{y}8 秒{/}内不断电击附近的敌人。',
  },
  dryice: {
    name: '干冰手雷', kind: 'skill', type: 'dryice', base: 12, free: true, color: '#8fdcff', cd: 12,
    desc: '炸开一团寒雾，把范围内的敌人{b}冻结{/} 2.5 秒。',
  },
  gravity: {
    name: '引力阱', kind: 'skill', type: 'gravity', base: 42, color: '#c98bff', cd: 16,
    desc: '把周围的敌人{y}吸到一起{/}，随后坍缩造成大量伤害。',
  },
  catbox: {
    name: '薛定谔的猫箱', kind: 'skill', type: 'catbox', base: 12, color: '#ffb13a', cd: 15,
    desc: '打开前谁也不知道：{g}活猫{/}会替你扑咬敌人；{r}死猫{/}则放出一团辐射毒云。',
  },
  wormhole: {
    name: '虫洞', kind: 'skill', type: 'wormhole', base: 28, color: '#62e6ff', cd: 5,
    desc: '向前{y}瞬移{/}一段距离，穿过并伤害路径上的敌人，期间无敌。',
  },
  antimatter: {
    name: '反物质胶囊', kind: 'skill', type: 'antimatter', base: 110, color: '#ff7ad9', cd: 22,
    desc: '丢出一颗延时引爆的胶囊，造成{r}毁灭性{/}的大范围爆炸。',
  },
  demon: {
    name: '麦克斯韦妖', kind: 'skill', type: 'demon', base: 11, color: '#ff9a4a', cd: 20,
    desc: '召唤一只小妖跟随 {y}12 秒{/}，交替向敌人投掷{o}火球{/}与{b}冰弹{/}。',
  },
};

for (const [id, d] of Object.entries(ITEMS)) { d.id = id; d.icon = 'item/' + id; d.spr = 'wpn/' + id; }

// 词条
export const AFFIXES = {
  sharp: { name: '高精度', desc: '伤害 +20%' },
  burn: { name: '灼热', desc: '命中附加灼烧', effects: { burn: 2.5 } },
  chill: { name: '低温', desc: '命中附加寒冷', effects: { chill: 1 } },
  shock: { name: '带电', desc: '命中附加感电', effects: { shock: 3 } },
  rad: { name: '放射性', desc: '命中附加辐射', effects: { rad: 1 } },
  vamp: { name: '回流', desc: '击杀回复 3 点生命' },
  crit: { name: '校准', desc: '暴击率 +12%' },
  boom: { name: '不稳定', desc: '击杀时引发爆炸' },
  rich: { name: '横向课题', desc: '击杀额外掉落经费' },
  brittle: { name: '脆性断裂', desc: '对冰冻目标伤害 +60%' },
  fuel: { name: '助燃', desc: '对灼烧目标伤害 +40%' },
  quick: { name: '轻量化', desc: '冷却 / 出手更快 15%' },
};
const AFFIX_IDS = Object.keys(AFFIXES);

export function makeItem(id, lv, rng, affixCount) {
  const def = ITEMS[id];
  let n = affixCount;
  if (n === undefined) { const r = rng.next(); n = r < 0.5 ? 0 : r < 0.86 ? 1 : 2; }
  const pool = AFFIX_IDS.filter((a) => {
    if (def.kind === 'skill') return ['sharp', 'quick', 'crit'].includes(a);
    if (def.effects && AFFIXES[a].effects && Object.keys(AFFIXES[a].effects)[0] in def.effects) return false;
    return true;
  });
  const affixes = rng.sample(pool, Math.min(n, pool.length));
  return { id, lv: Math.max(1, lv), affixes, rarity: Math.min(4, affixes.length + (lv >= 4 ? 1 : 0)) };
}

export function itemDef(item) { return ITEMS[item.id]; }

export function itemDmg(item) {
  const def = ITEMS[item.id];
  return def.base * (1 + 0.16 * (item.lv - 1)) * (item.affixes.includes('sharp') ? 1.2 : 1);
}

export function itemColor(item) { return COLORS.rare[item.rarity] || COLORS.rare[0]; }

export function itemTitle(item) {
  const def = ITEMS[item.id];
  const pre = item.affixes.length ? AFFIXES[item.affixes[0]].name + '的' : '';
  return `${pre}${def.name}`;
}

export function itemEffects(item) {
  const def = ITEMS[item.id];
  const eff = Object.assign({}, def.effects || {});
  for (const a of item.affixes) if (AFFIXES[a].effects) Object.assign(eff, AFFIXES[a].effects);
  return eff;
}

export function hasAffix(item, a) { return item && item.affixes.includes(a); }

/** 已解锁的装备 id 列表 */
export function unlockedItems(save) {
  const out = [];
  for (const [id, d] of Object.entries(ITEMS)) {
    if (d.free) { out.push(id); continue; }
    const key = (d.kind === 'skill' ? 's_' : 'w_') + id;
    if (save.unlocks[key]) out.push(id);
  }
  return out;
}

/** 随机掉落一件装备。kind: 'weapon' | 'skill' | undefined */
export function rollItem(run, rng, kind, minAffix) {
  let pool = unlockedItems(run.save);
  if (kind) pool = pool.filter((id) => ITEMS[id].kind === kind);
  // 少给玩家手上已经有的同名装备
  const held = [run.weapons[0], run.weapons[1], run.skill].filter(Boolean).map((i) => i.id);
  const fresh = pool.filter((id) => !held.includes(id));
  if (fresh.length >= 2) pool = fresh;
  const id = rng.pick(pool);
  let n;
  if (minAffix !== undefined) { const r = rng.next(); n = Math.max(minAffix, r < 0.5 ? 0 : r < 0.86 ? 1 : 2); }
  return makeItem(id, run.itemLevel(), rng, n);
}

export const KIND_LABEL = { melee: '近战', gun: '远程', throw: '投掷', charge: '蓄力', boomerang: '回旋', spray: '喷射' };
