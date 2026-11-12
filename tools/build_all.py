"""Build both games and the lobby. Run npm ci in games/collapse-lab first."""
from pathlib import Path
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(root / 'tools/build.py')], check=True)
collapse = root / 'games/collapse-lab'
subprocess.run(['node', str(collapse / 'tools/build.mjs')], cwd=collapse, check=True)
(root / 'collapse-lab').mkdir(exist_ok=True)
shutil.copyfile(collapse / 'dist/index.html', root / 'collapse-lab/index.html')
print('Built /, /zhenge-run/, /collapse-lab/')
