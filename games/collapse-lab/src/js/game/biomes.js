// 各实验区的配置：环境光、怪物表、机关、摆设
// 怪物表条目：[怪物 id, 权重, 最低出现深度]
export const BIOMES = {
  mech: {
    name: '力学实验楼', ambient: '#9292ae', lampColor: '#ffe6b8', liquid: false,
    sky: ['#1a1c34', '#262a4a', '#3a3f66'],
    spawn: {
      ground: [['grad', 4], ['hopper', 3], ['weight', 2], ['cart', 2], ['duli', 1.6]],
      fly: [['bat', 1]],
      ceil: [['bat', 1]],
      elite: ['duli', 'weight', 'grad'],
    },
    hazards: { ceil: ['pendulum', 'pendulum', 'crusher'], floor: ['piston'] },
    props: [['prop/bench_mech', 3], ['prop/cabinet', 2], ['prop/cradle', 2], ['prop/boxes', 2], ['prop/stool', 2], ['prop/globe', 1], ['prop/extinguisher', 1], ['prop/weights', 2], ['prop/incline', 2]],
    wallProps: [['prop/blackboard', 2], ['prop/poster1', 2], ['prop/poster2', 2], ['prop/clock', 1], ['prop/window', 3], ['prop/pulley', 2], ['prop/shelf', 2]],
  },
  em: {
    name: '电磁实验室', ambient: '#7676a4', lampColor: '#cfe8ff', liquid: true, liquidColor: ['#3a7bd5', '#62c8ff', '#bfeaff'], liquidEffect: 'chill',
    sky: ['#101226', '#1a1e3c', '#2a2f5a'],
    spawn: {
      ground: [['crab', 3], ['scope', 3], ['grad', 2], ['duli', 1.6], ['cart', 1]],
      fly: [['orb', 3], ['sentinel', 2]],
      ceil: [['tesla', 1]],
      elite: ['duli', 'crab', 'scope'],
    },
    hazards: { ceil: ['arc', 'arc', 'laser'], floor: ['arc'] },
    props: [['prop/bench_em', 3], ['prop/rack', 3], ['prop/vdg', 2], ['prop/coilbig', 2], ['prop/boxes', 1], ['prop/console', 2], ['prop/magnet', 2]],
    wallProps: [['prop/warn_elec', 2], ['prop/scope_wall', 2], ['prop/cables', 3], ['prop/poster3', 2], ['prop/fusebox', 2]],
  },
  thermo: {
    name: '热学车间', ambient: '#94727a', lampColor: '#ffc890', liquid: true, liquidColor: ['#c2410c', '#ff8a3a', '#ffd070'], liquidEffect: 'burn',
    sky: ['#1c1016', '#2e1a20', '#4a2a2a'],
    spawn: {
      ground: [['cryo', 3], ['watt', 3], ['grad', 1.5], ['duli', 1.6], ['weight', 1]],
      fly: [['joule', 3], ['imp', 1.5]],
      ceil: [['bat', 1]],
      elite: ['duli', 'watt', 'imp'],
    },
    hazards: { ceil: ['steam', 'icicle', 'icicle'], floor: ['flame', 'steam'] },
    props: [['prop/boiler', 3], ['prop/dewar', 3], ['prop/furnace', 2], ['prop/barrel', 2], ['prop/valve', 2], ['prop/boxes', 1]],
    wallProps: [['prop/pipes', 4], ['prop/gauge', 3], ['prop/warn_hot', 2], ['prop/thermo', 2]],
  },
  quantum: {
    name: '量子对撞机', ambient: '#687e96', lampColor: '#b8fff0', liquid: true, liquidColor: ['#6a2fd0', '#c98bff', '#f0d8ff'], liquidEffect: 'burn',
    sky: ['#0a1018', '#101a26', '#16283a'],
    spawn: {
      ground: [['cat', 3], ['quark', 3], ['duli', 2], ['scope', 1]],
      fly: [['neutrino', 3], ['singlet', 2], ['sentinel', 2]],
      ceil: [['tesla', 1]],
      elite: ['duli', 'cat', 'quark'],
    },
    hazards: { ceil: ['laser', 'beam', 'beam'], floor: ['beam'] },
    props: [['prop/console', 3], ['prop/cryostat', 3], ['prop/detector', 2], ['prop/rack', 2], ['prop/hazbarrel', 2]],
    wallProps: [['prop/warn_rad', 2], ['prop/screen', 3], ['prop/cables', 2], ['prop/ring', 2]],
  },
  rest: {
    name: '茶水间', ambient: '#c4b8a8', lampColor: '#ffe9c0', liquid: false,
    sky: ['#1a1c34', '#262a4a', '#3a3f66'],
    spawn: { ground: [], fly: [], ceil: [], elite: [] },
    hazards: { ceil: [], floor: [] },
    props: [], wallProps: [],
  },
};
