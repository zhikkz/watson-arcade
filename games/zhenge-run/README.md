# 震哥快跑

像素风物理实验室跑酷。在线地址：https://watsonwowosen.com/zhenge-run/

## 目录

- `game.json`：大厅介绍、封面、排序、构建与发布配置。
- `cover.webp`：大厅使用的实机封面。
- `src/game.html`：游戏源码，使用图集占位符。
- `tools/atlas.b64`、`tools/skins/*.b64`：内嵌人物图集。
- `tools/atlas.py`：将原始动作帧处理成图集的工具。
- `tools/build.py`：生成 `dist/index.html` 和片段版 `dist/artifact.html`。
- `tests/browser_smoke.py`：玩法、皮肤商店、存档和触屏回归测试。

在本目录运行 `python3 tools/build.py` 可单独构建；要生成包含大厅的完整网站，在仓库根目录运行 `python3 scripts/build.py`。

## 存档

初始皮肤为「张震」，「丁甲」和「沃神」各需 500 能量子，购买后可免费切换。能量子获取后立即入账，失败或重试保留；从检查点恢复不会重复入账。

沿用 `zg_progress`、`zg_best`、`zg_mute` 等 localStorage 键。源码目录的整理不改变正式域名或游戏地址，已有皮肤、余额与纪录继续可用。存档保存在当前设备的浏览器中。
