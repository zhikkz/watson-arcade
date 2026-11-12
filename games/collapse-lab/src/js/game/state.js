// 全局游戏上下文（各模块共享，避免循环依赖）
export const G = {
  game: null,     // Game 实例
  world: null,    // 当前 World
  run: null,      // 当前一局的数据
  save: null,     // 存档对象
  time: 0,        // 全局时间（秒）
  frame: 0,
  debug: false,
};
