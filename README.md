# 震哥快跑

像素风地牢跑酷，单文件静态网页小游戏。

## 在线游玩

https://zhikkz.github.io/zhenge-run/

## 文件说明

- `index.html`：可直接部署的成品，游戏图片已内嵌。
- `src/game.html`：源码，人物图集以 `__ATLAS__` 占位。
- `tools/build.py`：运行 `python3 tools/build.py` 重新构建。
- `tools/atlas.py`：将动作帧 PNG 压成图集。
- `tools/atlas.b64`：人物图集数据。

## 部署

GitHub Pages 从 `main` 分支的根目录发布。
