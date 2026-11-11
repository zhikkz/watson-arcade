"""Run with Python Playwright installed and Chromium available on PATH.

Uses the game's existing __zg debugging interface to place real pickups and
hazards, then exercises the production update loop, UI and localStorage.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import shutil
from threading import Thread
import unittest

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class GameTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT))
        )
        Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}/"
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH") or shutil.which("chromium"),
            args=["--no-sandbox"],
        )

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1280, "height": 800})
        # External fonts do not affect game behavior; avoid network-dependent tests.
        self.context.route("https://fonts.googleapis.com/**", lambda route: route.abort())
        self.errors = []
        self.page = self.context.new_page()
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def load(self):
        self.page.goto(self.url)
        self.page.wait_for_function("window.__zg && __zg.ATLAS.complete && __zg.P.fi !== undefined")

    def seed(self, balance):
        self.page.evaluate("""p => localStorage.setItem('zg_progress', JSON.stringify(p))""", {
            "version": 1, "balance": balance, "total": balance,
            "owned": ["zhangzhen"], "selected": "zhangzhen",
        })
        self.load()

    def progress(self):
        return self.page.evaluate("JSON.parse(localStorage.getItem('zg_progress'))")

    def collect(self, count=1):
        self.page.evaluate("""n => {
            const {S,P,world,pick,gen}=__zg;
            S.paused=false; S.teach=false; S.frozen=false;
            gen.done=true; world.ents=[]; world.picks=[];
            for(let i=0;i<n;i++)pick(P.x+3,P.y-30);
        }""", count)

    def wait_balance(self, amount):
        self.page.wait_for_function(
            "n => JSON.parse(localStorage.getItem('zg_progress'))?.balance === n", arg=amount
        )

    def test_initial_names_shop_and_keyboard(self):
        self.load()
        self.assertEqual(self.page.title(), "震哥快跑")
        self.assertEqual(self.page.locator("#dlg b").inner_text(), "张震")
        self.assertEqual(self.page.locator("#current-skin").inner_text(), "皮肤：张震")
        self.page.locator("#b-shop").click()
        for skin in ("dingjia", "woshen"):
            button = self.page.locator(f'[data-skin="{skin}"] button')
            self.assertTrue(button.is_disabled())
            self.assertEqual(button.inner_text(), "还差 500")
        self.page.locator("#b-shop-close").evaluate("el => el.blur()")
        self.page.keyboard.press("Space")
        self.assertEqual(self.page.evaluate("__zg.S.mode"), "title")
        self.assertTrue(self.page.locator("#shop").is_visible())
        self.page.keyboard.press("Escape")
        self.assertTrue(self.page.locator("#title").is_visible())

    def test_purchase_each_skin_once_and_restore_selection(self):
        self.load()
        original = self.page.evaluate("__zg.ATLAS.src")
        self.seed(1000)
        self.page.locator("#b-shop").click()
        self.page.locator('[data-skin="dingjia"] button').dblclick()
        self.assertEqual(self.progress()["balance"], 500)
        dingjia = self.page.evaluate("__zg.ATLAS.src")
        self.assertNotEqual(original, dingjia)
        self.page.locator('[data-skin="woshen"] button').click()
        state = self.progress()
        self.assertEqual(state["balance"], 0)
        self.assertEqual(state["total"], 1000)
        self.assertEqual(state["owned"], ["zhangzhen", "dingjia", "woshen"])
        self.assertEqual(state["selected"], "woshen")
        woshen = self.page.evaluate("__zg.ATLAS.src")
        self.assertNotEqual(woshen, dingjia)
        self.load()
        self.assertEqual(self.page.evaluate("__zg.ATLAS.src"), woshen)
        self.page.locator("#b-shop").click()
        for skin in ("zhangzhen", "dingjia", "woshen"):
            self.page.locator(f'[data-skin="{skin}"] button').click()
            self.assertEqual(self.progress()["balance"], 0)
            self.assertEqual(self.progress()["total"], 1000)
        self.page.locator("#b-shop-close").click()
        self.page.locator("#b-endless").click()
        self.assertEqual(self.page.evaluate("__zg.ATLAS.src"), woshen)
        # Confirm the selected atlas works through jump, double-jump and slide.
        self.page.keyboard.press("Space")
        self.page.wait_for_function("__zg.P.fi >= 14 && __zg.P.fi <= 17")
        self.page.keyboard.press("Space")
        self.page.wait_for_function("__zg.P.fi >= 20 && __zg.P.fi <= 25")
        self.page.wait_for_function("__zg.P.ground")
        self.page.keyboard.down("ArrowDown")
        self.page.wait_for_function("__zg.P.fi >= 29 && __zg.P.fi <= 32")
        self.page.keyboard.up("ArrowDown")

    def test_pickups_persist_through_checkpoint_death_quit_and_refresh(self):
        self.load()
        self.page.locator("#b-endless").click()
        self.collect(3)
        self.wait_balance(3)
        self.page.evaluate("""() => {
            __zg.S.cp={sec:1,energy:3,hits:0,time:10};
            __zg.startGame(false,true);
        }""")
        self.assertEqual(self.progress()["balance"], 3)
        self.collect()
        self.wait_balance(4)
        self.assertEqual(self.page.evaluate("__zg.S.energy"), 4)
        self.page.evaluate("__zg.S.hp=1; __zg.P.ground=false; __zg.P.y=500; __zg.P.inPit=true")
        self.page.locator("#over").wait_for(state="visible")
        self.assertTrue(self.page.locator("#over-q").inner_text().startswith("张震："))
        self.page.locator("#b-retry").click()
        self.assertEqual(self.progress()["balance"], 4)
        self.assertEqual(self.page.evaluate("__zg.S.energy"), 3)
        self.page.locator("#b-pause").click()
        self.page.locator("#b-quit").click()
        self.assertEqual(self.page.locator("#title .wallet-balance").inner_text(), "4")
        self.load()
        self.assertEqual(self.progress()["total"], 4)
        self.assertEqual(self.page.locator("#title .wallet-balance").inner_text(), "4")

    def test_bonus_energy_is_spendable(self):
        self.load()
        self.page.locator("#b-endless").click()
        self.collect()
        self.wait_balance(1)
        self.page.evaluate("""() => {
            const {P,world}=__zg;
            world.ents=[{type:'portal',x:P.x+3,y:P.y-30,tx:P.x+300,ty:268}];
        }""")
        self.wait_balance(11)
        self.page.evaluate("""() => {
            const {P,world}=__zg;
            P.ground=true;P.y=296;P.dash=2;
            world.ents=[{type:'laser',x:P.x+3}];
        }""")
        self.wait_balance(13)
        self.page.evaluate("""() => {
            const {S,P,world}=__zg;
            P.dash=0;P.ground=true;P.y=296;
            world.ents=[{type:'pad',x:P.x,c0:0,A:0,om:0,ph:-Math.PI/2,kt:0}];
        }""")
        self.wait_balance(18)
        self.assertEqual(self.progress()["total"], 18)

    def test_invalid_or_old_storage_does_not_break_game(self):
        self.load()
        for raw in ("{", "null", "[]", '{"balance":-4,"total":"500","owned":{},"selected":"dingjia"}'):
            self.page.evaluate("v => localStorage.setItem('zg_progress',v)", raw)
            self.load()
            self.assertEqual(self.page.locator("#title .wallet-balance").inner_text(), "0")
            self.assertEqual(self.page.locator("#current-skin").inner_text(), "皮肤：张震")
        self.page.evaluate("localStorage.setItem('zg_best','123');localStorage.setItem('zg_mute','true')")
        self.load()
        self.assertIn("123M", self.page.locator("#b-endless").inner_text())
        self.assertIn("off", self.page.locator("#b-mute").get_attribute("class"))

    def test_storage_blocked_keeps_session_playable(self):
        self.context.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
        self.load()
        self.page.locator("#b-shop").click()
        self.assertIn("仅在本次", self.page.locator("#save-note").inner_text())
        self.page.locator("#b-shop-close").click()
        self.page.locator("#b-endless").click()
        self.collect(2)
        self.page.wait_for_function("__zg.S.energy === 2")
        self.page.locator("#b-pause").click()
        self.page.locator("#b-quit").click()
        self.page.locator("#b-shop").click()
        self.assertIn("仅在本次", self.page.locator("#save-note").inner_text())
        self.assertEqual(self.page.locator("#shop .wallet-balance").inner_text(), "2")

    def test_other_tab_purchase_updates_balance_and_skin(self):
        self.load()
        self.seed(500)
        self.page.locator("#b-shop").click()
        other = self.context.new_page()
        other.on("pageerror", lambda error: self.errors.append(str(error)))
        other.goto(self.url)
        other.wait_for_function("window.__zg && __zg.P.fi !== undefined")
        other.locator("#b-shop").click()
        other.locator('[data-skin="dingjia"] button').click()
        self.page.wait_for_function("document.querySelector('#current-skin').textContent.includes('丁甲')")
        self.assertEqual(self.page.locator("#shop .wallet-balance").inner_text(), "0")
        self.assertTrue(self.page.locator('[data-skin="woshen"] button').is_disabled())
        self.page.locator('[data-skin="zhangzhen"] button').click()
        other.wait_for_function("document.querySelector('#current-skin').textContent.includes('张震')")
        self.assertEqual(self.progress()["balance"], 0)

    def test_mobile_shop_buttons_fit_and_touch_purchase_works(self):
        self.context.close()
        for width, height in ((390,844), (844,390), (320,568)):
            with self.subTest(size=(width,height)):
                self.context = self.browser.new_context(
                    viewport={"width":width,"height":height}, is_mobile=True, has_touch=True
                )
                self.page = self.context.new_page()
                self.page.on("pageerror", lambda error: self.errors.append(str(error)))
                self.load()
                self.seed(500)
                self.page.locator("#b-shop").tap()
                self.page.locator('[data-skin="dingjia"] button').tap()
                self.assertEqual(self.progress()["balance"], 0)
                self.assertEqual(self.progress()["selected"], "dingjia")
                bounds = self.page.locator("#stage").bounding_box()
                for selector in ("#b-shop-close", "[data-skin] button"):
                    for button in self.page.locator(selector).all():
                        rect = button.bounding_box()
                        self.assertGreaterEqual(rect["x"], bounds["x"])
                        self.assertLessEqual(rect["x"]+rect["width"], bounds["x"]+bounds["width"])
                self.assertEqual(self.page.locator("#shop").evaluate("e=>e.scrollWidth>e.clientWidth"), False)
                self.page.locator("#b-shop-close").tap()
                self.assertIn("丁甲", self.page.locator("#current-skin").inner_text())
                self.context.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
