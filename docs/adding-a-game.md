# 添加一个游戏

每个游戏拥有自己的目录。大厅自动读取 `games/*/game.json`；无需修改大厅 HTML、游戏计数或构建脚本。

## 已经有可玩的网页

把游戏放进一个新目录（名字使用小写字母、数字和短横线）：

```text
games/my-game/
├── game.json
├── cover.webp          # 大厅封面，也支持 PNG / JPG / SVG
├── public/
│   ├── index.html      # 可直接运行的网页
│   └── assets/         # 网页使用的图片、声音、脚本等
└── src/                # 如果有额外源码，也放在同一个游戏目录里
```

创建 `game.json`：

```json
{
  "title": "我的新游戏",
  "order": 30,
  "genre": "像素冒险",
  "category": "PLAY & EXPLORE",
  "description": ["一句话介绍玩法。", "再写一句游戏特色。"],
  "detail": "单人冒险",
  "accent": "#ffd16b",
  "cover": "cover.webp",
  "coverAlt": "游戏画面的文字描述",
  "sceneLabel": "MY GAME",
  "badge": "新游戏",
  "output": "public"
}
```

`output` 目录里的所有文件会被复制到网站的 `/my-game/`。`src/`、`game.json`、构建工具和其他开发文件不会被发布。文件名和相对资源路径应与游戏原网页保持一致；例如 `./assets/player.png`。

推送到 `main` 后，GitHub Actions 会自动构建、运行测试并发布。游戏地址是 `https://watsonwowosen.com/my-game/`。可在仓库的 **Actions → Build and deploy Watson Arcade** 查看结果。也可以先开 PR，自动检查通过后再合并。

## 需要先构建源码的游戏

保留游戏自己的源码、依赖和工具，只在 `game.json` 增加命令和输出目录。例如一个 npm 项目：

```json
{
  "title": "我的新游戏",
  "cover": "cover.webp",
  "install": ["npm", "ci", "--no-audit", "--no-fund"],
  "build": ["npm", "run", "build"],
  "output": "dist"
}
```

命令在当前游戏的目录内执行，采用参数数组，适用于包含空格的路径；不要把 `&&` 等 shell 语法写进数组。需要多条命令时，把它们写进该游戏自己的构建脚本。

构建环境已有 Python 3.12、Node 22、Pillow 与 numpy。如新游戏需要别的运行时，在 `.github/workflows/deploy-pages.yml` 中添加对应安装步骤。

## 可选设置

| 字段 | 用途 |
| --- | --- |
| `order` | 数字越小越靠前，默认 100；相同时按目录名排序 |
| `enabled` | 设为 `false` 可暂时关闭该游戏的展示与发布 |
| `publish` | 只发布输出目录中的指定文件或文件夹；默认 `["."]` 发布整个目录。例如 `["index.html", "assets"]` |
| `accent` | 卡片的强调色，六位十六进制颜色 |
| `badge` | 可选角标，例如「新游戏」；不需要时删掉 |
| `description` | 一句或多句介绍，可用字符串或字符串数组 |

`title` 和 `cover` 必填；`output` 默认 `public`。`cover` 相对于游戏目录，`publish` 相对于输出目录。路径必须留在相应目录内。目录名 `assets`、`site`、`games` 保留给站点使用。

## 存档和返回大厅

- 已发布游戏的目录名就是公开网址，建议保持稳定。
- 为新游戏的 `localStorage` 键增加游戏名前缀，例如 `my-game:save-v1`。清档时只删除自己的键，避免使用 `localStorage.clear()`。
- 现有游戏的存档键保持原样。《震哥快跑》使用 `zg_...`，《坍缩实验室》使用 `collapse-lab-...`。
- 在标题页或暂停菜单加入 `<a href="../">← 游戏大厅</a>`。如果游戏捕获触摸事件，需要让该链接正常接收点击。
- 大厅字体包含完整中文字符集，新增游戏名称无需手工补充字体子集。

## 本地预览

在仓库根目录：

```sh
python3 -m pip install -r requirements-build.txt
python3 scripts/build.py --install
python3 -m http.server 8000 --directory dist
```

打开 `http://localhost:8000/`。如果只改大厅、封面或介绍，且游戏产物已存在，可以用 `python3 scripts/build.py --skip-game-builds` 快速重新生成大厅。
