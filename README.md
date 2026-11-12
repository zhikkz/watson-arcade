# Watson Arcade · 实验室街机厅

集中维护和发布像素网页游戏。仓库：[zhikkz/watson-arcade](https://github.com/zhikkz/watson-arcade)。

在线大厅：**https://watsonwowosen.com/**

| 游戏 | 在线地址 | 源码 |
| --- | --- | --- |
| 震哥快跑 | [/zhenge-run/](https://watsonwowosen.com/zhenge-run/) | [games/zhenge-run/](games/zhenge-run/) |
| 坍缩实验室 | [/collapse-lab/](https://watsonwowosen.com/collapse-lab/) | [games/collapse-lab/](games/collapse-lab/) |

## 仓库结构

```text
watson-arcade/
├── games/                    # 每个游戏的源码、素材、封面和独立构建工具
│   ├── zhenge-run/
│   │   ├── game.json         # 大厅信息和发布配置
│   │   ├── src/
│   │   ├── tools/
│   │   └── tests/
│   └── collapse-lab/
│       ├── game.json
│       ├── src/
│       ├── assets-src/
│       └── tools/
├── site/                     # 大厅模板、共享样式、字体和域名配置
├── scripts/build.py          # 自动发现游戏，构建完整网站
├── tests/                    # 多游戏接入、大厅与存档兼容测试
├── docs/adding-a-game.md      # 新游戏接入说明
├── .github/workflows/        # 推送后自动检查、构建、发布
├── requirements-build.txt
└── requirements-test.txt
```

`dist/` 是生成的完整网站；每款游戏自己的 `dist/` 是中间产物。它们与 `node_modules/` 均不提交 Git。GitHub Actions 会从仓库源码重新构建，并且只发布根目录的 `dist/`，不会把开发文件发布到网站。

## 添加新游戏

在 `games/<英文短名>/` 放入游戏和一个 `game.json` 即可。大厅卡片、排列和游戏数量自动生成。支持已有的单文件 HTML、多文件静态游戏，以及需要 npm 或 Python 构建的源码项目。

详见 **[添加新游戏](docs/adding-a-game.md)**，其中包含可直接复制的配置示例。

## 本地构建与预览

需要 Python 3.10+、Node 18+（发布环境使用 Python 3.12 与 Node 22）。

```sh
python3 -m pip install -r requirements-build.txt
python3 scripts/build.py --install
python3 -m http.server 8000 --directory dist
```

打开 `http://localhost:8000/`。后续依赖未变化时可以省略 `--install`；只改大厅时可用 `--skip-game-builds` 复用已有游戏产物。

单独修改游戏美术或运行游戏专用测试，请参阅相应游戏的 README。

## 自动发布

推送到 `main` 后，工作流会安装依赖、构建全部启用的游戏、运行测试，再发布到 GitHub Pages。PR 会进行检查，合并后发布。也可在 **Actions → Build and deploy Watson Arcade → Run workflow** 手动触发。

Pages 使用 **GitHub Actions** 作为发布来源，自定义域名仍为 `watsonwowosen.com`，域名配置在 `site/CNAME`。无需提交构建产物或手工维护首页卡片。

## 验证

```sh
python3 -m pip install -r requirements-test.txt
python3 -m playwright install chromium
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 games/zhenge-run/tests/browser_smoke.py
python3 tests/lobby_smoke.py
```

## 存档与素材

两款游戏的正式地址与存档键保持稳定。它们使用不同的 localStorage 键，互不覆盖。存档属于当前设备、浏览器和域名，不跨设备同步。

大厅沿用 Fusion Pixel 中文像素字体，完整字体与许可证位于 `site/assets/`。游戏原始素材、图集和生成工具保留在各自的游戏目录中。
