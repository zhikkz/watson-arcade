"""Build this game's standalone page and artifact into its own dist directory."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
fragment = (root / 'src/game.html').read_text(encoding='utf-8')
for placeholder, path in {
    '__ATLAS__': 'tools/atlas.b64',
    '__DINGJIA_ATLAS__': 'tools/skins/dingjia.b64',
    '__WOSHEN_ATLAS__': 'tools/skins/woshen.b64',
}.items():
    fragment = fragment.replace(placeholder, (root / path).read_text().strip())

head = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
split = fragment.index('<div id="app">')
page = head + fragment[:split] + '</head>\n<body>\n' + fragment[split:] + '\n</body>\n</html>\n'
output = root / 'dist'
output.mkdir(exist_ok=True)
(output / 'index.html').write_text(page, encoding='utf-8')
(output / 'artifact.html').write_text(fragment, encoding='utf-8')
print(f'Built zhenge-run: {len(page.encode())} bytes')
