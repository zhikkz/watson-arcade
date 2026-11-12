// 构建：生成字体图集 -> 打包 JS -> 把全部资源内联成单个静态 HTML
//   dist/index.html     完整的独立网页（可直接双击打开或丢到任何静态托管）
//   dist/artifact.html  不含 <html>/<head>/<body> 的片段版本（用于 Claude Artifact 发布）
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => join(root, 'src', p);
const minify = !process.argv.includes('--dev');

execFileSync('python3', [join(root, 'tools', 'gen_font.py')], { stdio: 'inherit' });

const result = await build({
  entryPoints: [src('js/main.js')],
  bundle: true, format: 'iife', minify, write: false, target: ['es2019'],
  charset: 'utf8', legalComments: 'none', logLevel: 'warning',
});
const js = result.outputFiles[0].text;

const b64 = (p) => 'data:image/png;base64,' + readFileSync(src(p)).toString('base64');
const assets = {
  atlas: JSON.parse(readFileSync(src('assets/atlas.json'), 'utf8')),
  atlasPng: b64('assets/atlas.png'),
  font: JSON.parse(readFileSync(src('assets/font.json'), 'utf8')),
  fontPng: b64('assets/font.png'),
};
// 防止内联脚本被 </script> 或 <!-- 截断
const safe = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
const assetScript = `<script>window.__CL_ASSETS__=${safe(JSON.stringify(assets))};</script>`;
const bundleScript = `<script>${safe(js)}</script>`;

const page = readFileSync(src('page.html'), 'utf8');
const fragment = page.replace('<!--ASSETS-->', () => assetScript).replace('<!--BUNDLE-->', () => bundleScript);

const titleMatch = page.match(/<title>(.*?)<\/title>/);
const full = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="description" content="坍缩实验室：张震在失控的物理实验楼里闯关的横版像素 Roguelite 动作游戏。">
<meta name="theme-color" content="#07060c">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>[hidden]{display:none!important}</style>
</head>
<body>
${fragment}
</body>
</html>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'index.html'), full);
writeFileSync(join(root, 'dist', 'artifact.html'), fragment);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
console.log(`build ok: js ${kb(js)}, index.html ${kb(full)}${titleMatch ? '  <' + titleMatch[1] + '>' : ''}`);
