"""Discover games/*/game.json, build each game, and assemble the public dist/ site."""
import argparse
from html import escape
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile


RESERVED_SLUGS = {'assets', 'site', 'games'}


def local_path(directory, value):
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise ValueError(f'Expected a relative path: {value!r}')
    path = (directory / value).resolve()
    if not path.is_relative_to(directory.resolve()):
        raise ValueError(f'Path leaves its game directory: {value}')
    return path


def command(value, label):
    if not isinstance(value, list) or not all(isinstance(x, str) and x for x in value):
        raise ValueError(f'{label} must be an array of command arguments')
    return value


def discover_games(root):
    games = []
    for path in sorted((root / 'games').glob('*/game.json')):
        data = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(data, dict):
            raise ValueError(f'{path}: expected a JSON object')
        if data.get('enabled', True) is False:
            continue
        slug = path.parent.name
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) or slug in RESERVED_SLUGS:
            raise ValueError(f'Invalid or reserved game directory name: {slug}')
        title = data.get('title')
        if not isinstance(title, str) or not title.strip():
            raise ValueError(f'{slug}: title is required')
        order = data.get('order', 100)
        if not isinstance(order, int):
            raise ValueError(f'{slug}: order must be an integer')
        accent = data.get('accent', '#60e8d1')
        if not isinstance(accent, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', accent):
            raise ValueError(f'{slug}: accent must be a six-digit hex color')
        cover = local_path(path.parent, data.get('cover'))
        if not cover.is_file():
            raise ValueError(f'{slug}: cover does not exist: {cover}')
        description = data.get('description', [])
        if isinstance(description, str):
            description = [description]
        if not isinstance(description, list) or not all(isinstance(x, str) for x in description):
            raise ValueError(f'{slug}: description must contain text')
        publish = data.get('publish', ['.'])
        if not isinstance(publish, list) or not publish:
            raise ValueError(f'{slug}: publish must be a nonempty array of relative paths')
        output = local_path(path.parent, data.get('output', 'public'))
        for item in publish:
            local_path(output, item)
        games.append({
            **data, 'slug': slug, 'title': title, 'order': order, 'accent': accent,
            'description': description, 'cover_path': cover, 'output_path': output,
            'directory': path.parent, 'publish': publish,
            'build': command(data.get('build', []), f'{slug}.build'),
            'install': command(data.get('install', []), f'{slug}.install'),
        })
    if not games:
        raise ValueError('No enabled games/*/game.json files found')
    return sorted(games, key=lambda game: (game['order'], game['slug']))


def render(template, values):
    return re.sub(r'\{\{([A-Z_]+)\}\}', lambda match: values[match[1]], template)


def render_card(template, game, index, cover_url):
    text = lambda key, default='': escape(str(game.get(key, default)), quote=True)
    badge = text('badge')
    return render(template, {
        'ACCENT': game['accent'], 'SLUG': game['slug'], 'INDEX': str(index),
        'NUMBER': f'{index:02d}', 'TITLE': text('title'), 'COVER': escape(cover_url),
        'COVER_ALT': text('coverAlt', game['title']),
        'IMAGE_LOADING': 'fetchpriority="high"' if index <= 2 else 'loading="lazy"',
        'BADGE': f'              <span class="new-label">{badge}</span>' if badge else '',
        'SCENE_LABEL': text('sceneLabel'), 'CATEGORY': text('category', 'PLAY & EXPLORE'),
        'GENRE': text('genre', '像素游戏'), 'DETAIL': text('detail', '点击即玩'),
        'DESCRIPTION': '<br>'.join(escape(line) for line in game['description']),
    })


def build_site(root, install=False, skip_game_builds=False):
    root = Path(root).resolve()
    games = discover_games(root)
    site = root / 'site'
    card_template = (site / 'card.template.html').read_text(encoding='utf-8')
    cards = []
    # Assemble away from the live preview; a failed game leaves the previous build intact.
    with tempfile.TemporaryDirectory(prefix='watson-arcade-') as temp:
        output = Path(temp) / 'dist'
        output.mkdir()
        shutil.copytree(site / 'assets', output / 'assets')
        for name in ('CNAME', '.nojekyll'):
            if (site / name).exists():
                shutil.copyfile(site / name, output / name)
        for index, game in enumerate(games, 1):
            if install and game['install']:
                subprocess.run(game['install'], cwd=game['directory'], check=True)
            if not skip_game_builds and game['build']:
                subprocess.run(game['build'], cwd=game['directory'], check=True)
            source = game['output_path']
            target = output / game['slug']
            target.mkdir()
            for relative in game['publish']:
                item = local_path(source, relative)
                destination = target / item.relative_to(source)
                if item.is_dir():
                    shutil.copytree(item, destination, dirs_exist_ok=True)
                elif item.is_file():
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(item, destination)
                else:
                    raise ValueError(f"{game['slug']}: missing publish item: {relative}")
            if not (target / 'index.html').is_file():
                raise ValueError(f"{game['slug']}: published files need an index.html")
            cover_url = f"assets/covers/{game['slug']}{game['cover_path'].suffix.lower()}"
            (output / 'assets/covers').mkdir(exist_ok=True)
            shutil.copyfile(game['cover_path'], output / cover_url)
            cards.append(render_card(card_template, game, index, cover_url))
            print(f"Ready /{game['slug']}/ · {game['title']}")
        page = render((site / 'index.template.html').read_text(encoding='utf-8'), {
            'GAME_CARDS': '\n'.join(cards), 'GAME_COUNT': f'{len(games):02d}',
        })
        (output / 'index.html').write_text(page, encoding='utf-8')
        destination = root / 'dist'
        if destination.exists():
            shutil.rmtree(destination)
        shutil.move(str(output), destination)
    print(f'Built {len(games)} games → {root / "dist"}')
    return games


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--install', action='store_true', help='Run each game\'s install command first')
    parser.add_argument('--skip-game-builds', action='store_true', help='Reuse each game\'s existing output')
    args = parser.parse_args()
    build_site(Path(__file__).resolve().parents[1], args.install, args.skip_game_builds)
