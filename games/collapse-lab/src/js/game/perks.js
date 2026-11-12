// 「定理」——每次在茶水间黑板前三选一的被动能力。
// 只作为玩法设计：描述里写的就是效果，不需要懂物理。
export const PERKS = {
  newton3: { name: '牛顿第三定律', icon: 'perk/newton3', desc: '受到伤害时，把 {y}3 倍{/}伤害反弹给周围的敌人并将其击退。' },
  conserve: { name: '能量守恒', icon: 'perk/conserve', desc: '每击杀一名敌人，回复 {g}2 点{/}生命。' },
  momentum: { name: '动量守恒', icon: 'perk/momentum', desc: '翻滚或冲刺后的 {y}1.5 秒{/}内，下一次攻击伤害 {y}+60%{/}。' },
  entropy: { name: '熵增原理', icon: 'perk/entropy', desc: '灼烧、辐射等持续伤害 {y}+50%{/}，持续时间翻倍。' },
  uncertainty: { name: '不确定性原理', icon: 'perk/uncertainty', desc: '受到攻击时有 {y}15%{/} 概率完全闪避。' },
  relativity: { name: '狭义相对论', icon: 'perk/relativity', desc: '生命越低移动越快（最多 {y}+30%{/}）；翻滚躲开攻击时，时间短暂变慢。' },
  photoelectric: { name: '光电效应', icon: 'perk/photoelectric', desc: '暴击时释放一道在敌人之间跳跃的{c}闪电链{/}。' },
  doppler: { name: '多普勒效应', icon: 'perk/doppler', desc: '朝敌人方向移动时，造成的伤害 {y}+20%{/}。' },
  tunneling: { name: '量子隧穿', icon: 'perk/tunneling', desc: '翻滚距离 {y}+30%{/}，翻滚冷却 {y}-40%{/}。' },
  superconduct: { name: '超导', icon: 'perk/superconduct', desc: '技能冷却时间 {y}-30%{/}。' },
  emc2: { name: '质能方程', icon: 'perk/emc2', desc: '敌人掉落的{y}经费{/}与{c}数据{/} {y}+40%{/}。' },
  hooke: { name: '胡克定律', icon: 'perk/hooke', desc: '跳得更高（{y}+15%{/}），并且可以在空中{y}多跳一次{/}。' },
  bernoulli: { name: '伯努利原理', icon: 'perk/bernoulli', desc: '身在空中时，造成的伤害 {y}+35%{/}。' },
  kepler: { name: '开普勒定律', icon: 'perk/kepler', desc: '二段跳时生成一颗环绕你的{c}小卫星{/}（最多 3 颗），撞击敌人造成伤害。' },
  archimedes: { name: '阿基米德原理', icon: 'perk/archimedes', desc: '生命上限 {g}+25%{/}，保温杯容量 {g}+1{/}。' },
  carnot: { name: '卡诺循环', icon: 'perk/carnot', desc: '保温杯回复量 {g}+30%{/}，喝得更快。' },
  halflife: { name: '半衰期', icon: 'perk/halflife', desc: '生命低于一半时，每秒回复 {g}1.5 点{/}生命。' },
  leverage: { name: '杠杆原理', icon: 'perk/leverage', desc: '对{p}变异体{/}与{r}首领{/}的伤害 {y}+25%{/}。' },
  pauli: { name: '泡利不相容', icon: 'perk/pauli', desc: '受伤后的无敌时间延长 {y}1 秒{/}，并弹开身边的敌人。' },
  resonance: { name: '共振', icon: 'perk/resonance', desc: '连续命中不被打断时，每次命中伤害 {y}+4%{/}（最多 +40%）。受伤后清零。' },
  blackbody: { name: '黑体辐射', icon: 'perk/blackbody', desc: '你的攻击有 {y}25%{/} 概率{o}点燃{/}敌人。' },
  absolute0: { name: '绝对零度', icon: 'perk/absolute0', desc: '冰冻持续时间 {y}+50%{/}；击杀冰冻的敌人会迸出冰片，伤害周围敌人。' },
  faraday: { name: '法拉第笼', icon: 'perk/faraday', desc: '每 {y}12 秒{/}获得一层可抵挡 {c}20 点{/}伤害的屏蔽。' },
  chain: { name: '链式反应', icon: 'perk/chain', desc: '击杀敌人时有 {y}30%{/} 概率引发一次爆炸。' },
};

export const PERK_IDS = Object.keys(PERKS);

// 「文献」——关卡中找到的卷轴，三选一提升基础属性
export const SCROLLS = {
  force: { name: '力学文献', color: '#ff7a5e', icon: 'ui/scroll_force', desc: '近战伤害 {y}+15%{/}\n生命上限 +6%' },
  tech: { name: '电磁学文献', color: '#b58cff', icon: 'ui/scroll_tech', desc: '远程与技能伤害 {y}+15%{/}\n生命上限 +6%' },
  vital: { name: '热学文献', color: '#7be07b', icon: 'ui/scroll_vital', desc: '生命上限 {g}+22%{/}\n并回复等量生命' },
};
