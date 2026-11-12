"""生成全部美术资源 -> src/assets/atlas.png + atlas.json

用法：python3 tools/build_assets.py [预览输出目录]
"""
import importlib
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from px import Atlas, Sprite, preview  # noqa: E402

OUT_DIR = os.path.join(HERE, '..', 'src', 'assets')
MODULES = ['gen_tiles', 'gen_props', 'gen_monsters', 'gen_items', 'gen_fx']


def main():
    t0 = time.time()
    os.makedirs(OUT_DIR, exist_ok=True)
    atlas = Atlas(width=1024)

    import gen_chars
    for name, spr in gen_chars.gen_all().items():
        atlas.add(name, spr)

    for mod in MODULES:
        path = os.path.join(HERE, mod + '.py')
        if not os.path.exists(path):
            continue
        m = importlib.import_module(mod)
        m.register(atlas)

    sheet, frames = atlas.save(os.path.join(OUT_DIR, 'atlas.png'), os.path.join(OUT_DIR, 'atlas.json'))
    print(f'atlas: {len(frames)} sprites, {sheet.shape[1]}x{sheet.shape[0]}, {time.time() - t0:.1f}s')

    if len(sys.argv) > 1:
        from PIL import Image
        Image.fromarray(sheet, 'RGBA').save(os.path.join(sys.argv[1], 'atlas_preview.png'))


if __name__ == '__main__':
    main()
