// 永久解锁（在茶水间的终端机用「数据」购买，跨局保留）
export const META = [
  { id: 'flask1', name: '保温杯扩容 Ⅰ', desc: '保温杯容量 +1。', cost: 20, icon: 'item/flask' },
  { id: 'flask2', name: '保温杯扩容 Ⅱ', desc: '保温杯容量再 +1。', cost: 55, icon: 'item/flask', need: 'flask1' },
  { id: 'hp1', name: '体能训练 Ⅰ', desc: '初始生命上限 +15。', cost: 25, icon: 'ui/heart' },
  { id: 'hp2', name: '体能训练 Ⅱ', desc: '初始生命上限再 +20。', cost: 60, icon: 'ui/heart', need: 'hp1' },
  { id: 'gold1', name: '启动经费', desc: '每局开始时携带 50 经费。', cost: 15, icon: 'ui/coin' },
  { id: 'starter', name: '备用装备架', desc: '每局开始时随机获得一件副武器。', cost: 30, icon: 'ui/rack' },
  { id: 'recycle', name: '数据备份', desc: '死亡时保留的未上传数据从三成提高到六成半。', cost: 40, icon: 'ui/data' },
  { id: 'revive', name: '薛定谔协议', desc: '每局一次：生命归零时以半血“观测为存活”。', cost: 80, icon: 'ui/cat' },
  // 武器图纸
  { id: 'w_pendulum', name: '图纸：傅科摆锤', desc: '将「傅科摆锤」加入掉落池。', cost: 18, item: 'pendulum' },
  { id: 'w_pointer', name: '图纸：激光教鞭', desc: '将「激光教鞭」加入掉落池。', cost: 22, item: 'pointer' },
  { id: 'w_fork', name: '图纸：音叉', desc: '将「音叉」加入掉落池。', cost: 22, item: 'fork' },
  { id: 'w_gloves', name: '图纸：特斯拉拳套', desc: '将「特斯拉拳套」加入掉落池。', cost: 30, item: 'gloves' },
  { id: 'w_railgun', name: '图纸：电磁轨道炮', desc: '将「电磁轨道炮」加入掉落池。', cost: 26, item: 'railgun' },
  { id: 'w_gyro', name: '图纸：陀螺飞盘', desc: '将「陀螺飞盘」加入掉落池。', cost: 26, item: 'gyro' },
  { id: 'w_cryo', name: '图纸：液氮喷枪', desc: '将「液氮喷枪」加入掉落池。', cost: 30, item: 'cryo' },
  { id: 'w_cathode', name: '图纸：阴极射线管', desc: '将「阴极射线管」加入掉落池。', cost: 24, item: 'cathode' },
  { id: 's_gravity', name: '图纸：引力阱', desc: '将技能「引力阱」加入掉落池。', cost: 24, item: 'gravity' },
  { id: 's_catbox', name: '图纸：薛定谔的猫箱', desc: '将技能「薛定谔的猫箱」加入掉落池。', cost: 28, item: 'catbox' },
  { id: 's_wormhole', name: '图纸：虫洞', desc: '将技能「虫洞」加入掉落池。', cost: 28, item: 'wormhole' },
  { id: 's_antimatter', name: '图纸：反物质胶囊', desc: '将技能「反物质胶囊」加入掉落池。', cost: 36, item: 'antimatter' },
  { id: 's_demon', name: '图纸：麦克斯韦妖', desc: '将技能「麦克斯韦妖」加入掉落池。', cost: 34, item: 'demon' },
];

export const META_BY_ID = Object.fromEntries(META.map((m) => [m.id, m]));

export function metaOwned(save, id) { return !!save.unlocks[id]; }

export function metaAvailable(save, m) { return !m.need || !!save.unlocks[m.need]; }
