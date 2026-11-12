"""Exercise the deployed folder structure, navigation, touch layout and save isolation."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os
import shutil
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class LobbyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
        Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/'
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium'), args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 900})
        self.context.route('https://fonts.googleapis.com/**', lambda r: r.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.failures = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.on('response', lambda r: self.failures.append(r.url) if r.status >= 400 and r.url.startswith(self.url) else None)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failures, [])

    def test_lobby_assets_and_responsive_cards(self):
        self.page.goto(self.url)
        self.page.evaluate('document.fonts.ready')
        self.assertEqual(self.page.locator('.game-card').count(), 2)
        self.assertTrue(self.page.locator('.game-image img').evaluate_all('els=>els.every(e=>e.complete && e.naturalWidth>0)'))
        self.assertTrue(self.page.evaluate('document.fonts.check("12px ArcadePixel")'))
        for width, height in [(1440, 900), (1024, 768), (844, 390), (760, 900), (390, 844), (320, 568)]:
            with self.subTest(viewport=(width, height)):
                self.page.set_viewport_size({'width': width, 'height': height})
                self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))
                for card in self.page.locator('.game-card').all():
                    bounds = card.bounding_box()
                    for part in card.locator('.genre, .play-button, .game-detail, h3').all():
                        r = part.bounding_box()
                        self.assertGreaterEqual(r['x'], bounds['x'])
                        self.assertLessEqual(r['x'] + r['width'], bounds['x'] + bounds['width'])

    def test_keyboard_enters_selected_game_and_returns(self):
        self.page.goto(self.url)
        self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.page.locator(':focus').get_attribute('data-game'), '1')
        self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.page.locator(':focus').get_attribute('data-game'), '2')
        self.page.keyboard.press('Enter')
        self.page.wait_for_function('window.__cl')
        self.assertEqual(self.page.title(), '坍缩实验室')
        self.page.locator('#hall-link').click()
        self.page.wait_for_url(self.url)
        self.page.locator('[data-game="1"]').click()
        self.page.wait_for_function('window.__zg && __zg.P.fi !== undefined')
        self.assertEqual(self.page.title(), '震哥快跑')
        self.page.locator('#title a[href="../"]').click()
        self.page.wait_for_url(self.url)

    def test_original_progress_survives_both_games_and_refresh(self):
        self.page.goto(self.url)
        progress = {'version': 1, 'balance': 123, 'total': 623, 'owned': ['zhangzhen', 'dingjia'], 'selected': 'dingjia'}
        self.page.evaluate('p=>{localStorage.setItem("zg_progress",JSON.stringify(p));localStorage.setItem("zg_best","678")}', progress)
        self.page.locator('[data-game="1"]').click()
        self.page.wait_for_function('window.__zg && __zg.P.fi !== undefined')
        self.assertIn('丁甲', self.page.locator('#current-skin').inner_text())
        self.assertEqual(self.page.locator('#title .wallet-balance').inner_text(), '123')
        self.assertIn('678M', self.page.locator('#b-endless').inner_text())
        self.page.locator('#title a[href="../"]').click()
        self.page.locator('[data-game="2"]').click()
        self.page.wait_for_function('window.__cl')
        self.page.evaluate('__cl.G.save.introSeen = true')
        self.page.wait_for_function('__cl.game.ui.active.t > 0.3')
        self.page.locator('#game').focus()
        self.page.keyboard.press('Enter')
        self.page.wait_for_function('__cl.G.world && !__cl.game.fade.cb')
        self.assertTrue(self.page.locator('#hall-link').is_hidden())
        self.page.wait_for_function('localStorage.getItem("collapse-lab-run-v1") !== null')
        self.page.keyboard.press('p')
        self.page.locator('#hall-link').wait_for(state='visible')
        saved_run = self.page.evaluate('localStorage.getItem("collapse-lab-run-v1")')
        self.page.locator('#hall-link').click()
        self.page.wait_for_url(self.url)
        self.page.reload()
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.getItem("zg_progress"))'), progress)
        self.assertEqual(self.page.evaluate('localStorage.getItem("collapse-lab-run-v1")'), saved_run)
        self.page.locator('[data-game="2"]').click()
        self.page.wait_for_function('window.__cl && __cl.game.runSave')
        self.assertEqual(self.page.evaluate('__cl.game.runSave.run.stage'), 0)

    def test_touch_cards_and_rotated_game_return(self):
        self.context.close()
        self.context = self.browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.goto(self.url)
        self.page.locator('[data-game="2"]').tap()
        self.page.wait_for_function('window.__cl && __cl.VIEW.rot')
        self.page.locator('#hall-link').tap()
        self.page.wait_for_url(self.url)
        self.page.locator('[data-game="1"]').tap()
        self.page.wait_for_function('window.__zg && __zg.P.fi !== undefined')
        self.page.locator('#title a[href="../"]').tap()
        self.page.wait_for_url(self.url)

    def test_links_work_without_javascript(self):
        with self.browser.new_context(java_script_enabled=False) as context:
            page = context.new_page()
            page.goto(self.url)
            page.locator('[data-game="2"]').click()
            page.wait_for_url(self.url + 'collapse-lab/')
            page.wait_for_load_state('load')
            self.assertEqual(page.title(), '坍缩实验室')


if __name__ == '__main__':
    unittest.main(verbosity=2)
