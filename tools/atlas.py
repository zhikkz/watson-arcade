import sys, glob, os, json, base64, io
from PIL import Image
import numpy as np
root=sys.argv[1]; out=sys.argv[2]
S=3; CW,CH=128,107
anims=['01_idle','02_run','03_jump','04_air_tuck','05_slide']
frames=[]; meta={}
for a in anims:
    fs=sorted(glob.glob(os.path.join(root,'frames',a,'*.png')))
    meta[a[3:]]={'start':len(frames),'n':len(fs),'bottom':[]}
    for f in fs:
        im=Image.open(f).convert('RGBA').convert('RGBa').resize((CW,CH),Image.BOX).convert('RGBA')
        arr=np.array(im)
        al=arr[...,3]>=128
        arr[...,3]=np.where(al,255,0); arr[~al]=0
        im=Image.fromarray(arr,'RGBA')
        bb=im.getbbox(); meta[a[3:]]['bottom'].append(bb[3])
        frames.append(im)
COLS=8; rows=(len(frames)+COLS-1)//COLS
sheet=Image.new('RGBA',(COLS*CW,rows*CH),(0,0,0,0))
for i,im in enumerate(frames):
    sheet.paste(im,((i%COLS)*CW,(i//COLS)*CH))
# quantize colours (keep binary alpha)
arr=np.array(sheet); mask=arr[...,3]>0
rgb=Image.fromarray(arr[...,:3],'RGB').quantize(colors=64,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE).convert('RGB')
q=np.array(rgb); arr[...,:3]=q; arr[~mask]=0
sheet=Image.fromarray(arr,'RGBA')
sheet.save(os.path.join(out,'atlas.png'),optimize=True)
buf=io.BytesIO(); sheet.save(buf,'PNG',optimize=True)
open(os.path.join(out,'atlas.b64'),'w').write(base64.b64encode(buf.getvalue()).decode())
json.dump(meta,open(os.path.join(out,'atlas.json'),'w'))
print(sheet.size, len(buf.getvalue()), json.dumps(meta))
prev=Image.new('RGBA',sheet.size,(24,28,48,255)); prev.alpha_composite(sheet)
prev.resize((sheet.size[0]*2,sheet.size[1]*2),Image.NEAREST).save(os.path.join(out,'atlas_prev.png'))
