"""Verify that a new game can be published without editing the lobby or build script."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('arcade_build', ROOT / 'scripts/build.py')
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / 'site', self.root / 'site')
        (self.root / 'games').mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def game(self, slug, **changes):
        directory = self.root / 'games' / slug
        (directory / 'public/assets').mkdir(parents=True)
        (directory / 'public/index.html').write_text('<!doctype html><title>Game</title><script src="./assets/game.js"></script>')
        (directory / 'public/assets/game.js').write_text('console.log("game");')
        (directory / 'cover.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
        data = {'title': slug, 'cover': 'cover.svg', **changes}
        (directory / 'game.json').write_text(json.dumps(data, ensure_ascii=False))
        return directory

    def test_new_game_is_discovered_packaged_and_added_to_lobby(self):
        self.game('first-game', order=10)
        self.game('second-game', order=20)
        builder.build_site(self.root)
        self.game('third-game', order=15, title='第三款游戏')
        builder.build_site(self.root)
        page = (self.root / 'dist/index.html').read_text()
        self.assertIn('03 GAMES', page)
        self.assertIn('第三款游戏', page)
        self.assertLess(page.index('href="./third-game/"'), page.index('href="./second-game/"'))
        self.assertTrue((self.root / 'dist/third-game/assets/game.js').is_file())
        self.assertTrue((self.root / 'dist/assets/covers/third-game.svg').is_file())
        self.assertEqual((self.root / 'dist/CNAME').read_text(), (ROOT / 'site/CNAME').read_text())
        self.assertFalse((self.root / 'dist/third-game/game.json').exists())

    def test_metadata_is_escaped_and_disabled_games_are_omitted(self):
        self.game('visible-game', title='<script>alert(1)</script>', description=['<b>text</b>'])
        self.game('hidden-game', enabled=False)
        builder.build_site(self.root)
        page = (self.root / 'dist/index.html').read_text()
        self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt;', page)
        self.assertIn('&lt;b&gt;text&lt;/b&gt;', page)
        self.assertNotIn('hidden-game', page)
        self.assertIn('01 GAMES', page)

    def test_invalid_paths_and_colors_are_rejected(self):
        directory = self.game('test-game')
        original = json.loads((directory / 'game.json').read_text())
        for change in [{'output': '../../..'}, {'publish': ['../README.md']}, {'accent': 'red;display:none'}, {'build': 'npm run build'}]:
            with self.subTest(change=change):
                (directory / 'game.json').write_text(json.dumps({**original, **change}))
                with self.assertRaises(ValueError):
                    builder.discover_games(self.root)

    def test_failed_game_preserves_previous_site_build(self):
        directory = self.game('test-game')
        builder.build_site(self.root)
        previous = (self.root / 'dist/index.html').read_bytes()
        (directory / 'public/index.html').unlink()
        with self.assertRaisesRegex(ValueError, 'index.html'):
            builder.build_site(self.root)
        self.assertEqual((self.root / 'dist/index.html').read_bytes(), previous)


if __name__ == '__main__':
    unittest.main(verbosity=2)
