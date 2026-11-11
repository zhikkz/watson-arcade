# 震哥快跑

像素风地牢跑酷，单文件静态网页小游戏。

## 在线游玩

https://watsonwowosen.com/

## 能量子与皮肤

- 初始皮肤为「张震」，「丁甲」和「沃神」各需 500 能量子，购买后可免费切换。
- 标题页进入「皮肤商店」，查看可用余额、累计收集数和皮肤预览。
- 拾取、同相起跳、冲刺击碎障碍和量子隧穿获得的能量子立即入账，失败、重试、返回标题或刷新均保留；从检查点恢复的本局分数不会重复入账。
- 使用 `localStorage` 的 `zg_progress` 保存可用余额、累计收集数、已购买皮肤和当前皮肤。进度属于当前浏览器和网站域名，不跨设备同步，清除网站数据会重置；浏览器禁止保存时会在商店提示。
- 游戏标题保留「震哥快跑」，角色名称使用「张震」。

## 文件说明

- `index.html`：可直接部署的成品，游戏图片已内嵌。
- `src/game.html`：源码，人物图集以 `__ATLAS__` 占位。
- `tools/build.py`：运行 `python3 tools/build.py` 重新构建。
- `tools/atlas.py`：将动作帧 PNG 压成图集。
- `tools/atlas.b64`：人物图集数据。
- `tools/skins/*.b64`：从上传的「丁甲」「沃神」动作包生成的皮肤图集，沿用原角色的 37 帧、尺寸和碰撞体。
- `tests/browser_smoke.py`：浏览器回归检查（需 Python Playwright 和 Chromium），运行 `python3 tests/browser_smoke.py`。

三套人物图集均内嵌进成品，无需单独部署素材文件。重新处理动作包时，可运行 `python3 tools/atlas.py <解压目录> <输出目录>`，将生成的 `atlas.b64` 放入对应位置后重新构建。

## 部署

GitHub Pages 从 `main` 分支的根目录发布。
