# 实验室街机厅 · Watson Arcade

两款像素游戏共用一个 GitHub Pages 网站和自定义域名。

| 入口 | 地址 |
| --- | --- |
| 游戏大厅 | https://watsonwowosen.com/ |
| 震哥快跑 | https://watsonwowosen.com/zhenge-run/ |
| 坍缩实验室 | https://watsonwowosen.com/collapse-lab/ |

大厅提供两款游戏的实机封面，点击整张卡片即可进入。电脑上也可以使用左右方向键选择、Enter 进入。手机上卡片纵向排列，两款游戏均支持触屏；《坍缩实验室》沿用其横屏操作与自动旋转布局。

游戏标题页和暂停菜单提供「游戏大厅」返回入口。两款游戏在同一域名下使用不同的 localStorage 键，存档互不干扰。原《震哥快跑》的 `zg_progress`、`zg_best`、`zg_mute` 等键保持不变，从根地址移动到子目录不会清除原有皮肤、余额或纪录。存档属于当前设备的浏览器和域名，清除网站数据会重置。

## 文件与构建

- `index.html`：已构建的大厅，源文件为 `src/lobby.html`。
- `assets/`：大厅样式、键盘交互、实机封面、像素字体子集与字体许可证。大厅无需外部字体或 CDN。
- `zhenge-run/index.html`：已构建的《震哥快跑》，图片内嵌。
- `src/game.html`、`tools/atlas.b64`、`tools/skins/`：《震哥快跑》源码和人物图集。
- `collapse-lab/index.html`：已构建的《坍缩实验室》，图片、字体与脚本均内嵌。
- `games/collapse-lab/`：《坍缩实验室》的完整源码、素材、构建工具和原有测试。详见该目录的 README。
- `CNAME`、`.nojekyll`：保留自定义域名和静态文件发布配置。

只修改大厅或《震哥快跑》后：

```sh
python3 tools/build.py
```

修改《坍缩实验室》源码后，需要 Node 18+、Python 3、Pillow 与 numpy：

```sh
cd games/collapse-lab
npm ci
cd ../..
python3 tools/build_all.py
```

若原始美术发生变化，先在 `games/collapse-lab` 下运行 `npm run assets`。大厅字体使用《坍缩实验室》同款的 Fusion Pixel 12px，按大厅字符裁剪，许可证见 `assets/FONT-LICENSE.txt`。

## 验证

需要 Python Playwright 与 Chromium：

```sh
python3 tests/browser_smoke.py  # 原有跑酷、皮肤商店与存档回归
python3 tests/lobby_smoke.py    # 大厅、响应式布局、两款游戏跳转与存档兼容
```

GitHub Pages 继续从 `main` 分支根目录发布。上传已构建的三个入口与 `assets/` 即可，无需改域名、DNS 或添加服务器。

## 震哥快跑的皮肤与能量子

初始皮肤为「张震」，「丁甲」和「沃神」各需 500 能量子，购买后可免费切换。拾取、同相起跳、冲刺击碎障碍和量子隧穿获得的能量子立即入账，失败、重试、返回标题或刷新均保留；从检查点恢复的本局分数不会重复入账。浏览器禁止保存时，商店会提示仅在本次会话有效。
