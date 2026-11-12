"""Build the runner at /zhenge-run/ and the arcade lobby at /."""
import os
proj=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src=open(proj+'/src/game.html',encoding='utf-8').read()
out=src
for placeholder,path in {
    '__ATLAS__':'tools/atlas.b64',
    '__DINGJIA_ATLAS__':'tools/skins/dingjia.b64',
    '__WOSHEN_ATLAS__':'tools/skins/woshen.b64',
}.items():
    out=out.replace(placeholder,open(proj+'/'+path).read().strip())
open(proj+'/zhenge-run.html','w',encoding='utf-8').write(out)
head='<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
i=out.index('<div id="app">')
os.makedirs(proj+'/zhenge-run',exist_ok=True)
open(proj+'/zhenge-run/index.html','w',encoding='utf-8').write(head+out[:i]+'</head>\n<body>\n'+out[i:]+'\n</body>\n</html>\n')
from shutil import copyfile
copyfile(proj+'/src/lobby.html',proj+'/index.html')
print('built',len(out))
