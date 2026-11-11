"""Build: embeds tools/atlas.b64 into src/game.html -> zhenge-run.html (artifact body) and index.html (standalone page)."""
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
open(proj+'/index.html','w',encoding='utf-8').write(head+out[:i]+'</head>\n<body>\n'+out[i:]+'\n</body>\n</html>\n')
print('built',len(out))
