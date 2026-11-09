# Déclinaison du logo métal kontrolshop : recolore l'orange (aiguille, cadran,
# SHOP) vers la teinte du secteur, efface GARAGE et pose le mot rendu par mot.cjs.
# Usage : python3 scripts/logo-metal/recolor.py public/marque/kontrolshop-metal-garage.png mot.png sortie.png <teinte> <étendue> <saturation> <luminosité>
# Réglages utilisés : ferme 120 0.6 0.8 0.68 · copropriété 212 0.6 0.95 0.95 · premium 40 0.3 0.75 0.86 (teinte -1 : pas de recoloration)
import sys, numpy as np
from PIL import Image
def rgb2hsv(a):
    r,g,b=a[...,0],a[...,1],a[...,2]; mx=a.max(-1); mn=a.min(-1); d=mx-mn
    h=np.zeros_like(mx); m=d>0
    rm=m&(mx==r); gm=m&(mx==g)&~rm; bm=m&~rm&~gm
    h[rm]=((g-b)[rm]/d[rm])%6; h[gm]=(b-r)[gm]/d[gm]+2; h[bm]=(r-g)[bm]/d[bm]+4
    s=np.where(mx>0,d/np.maximum(mx,1e-6),0); return h*60,s,mx
def hsv2rgb(h,s,v):
    c=v*s; x=c*(1-np.abs((h/60)%2-1)); m=v-c; z=np.zeros_like(h); i=(h//60).astype(int)%6
    sel=[(c,x,z),(x,c,z),(z,c,x),(z,x,c),(x,z,c),(c,z,x)]
    out=np.zeros(h.shape+(3,))
    for k,(r,g,b) in enumerate(sel):
        mk=i==k; out[mk]=np.stack([r[mk],g[mk],b[mk]],-1)
    return out+m[...,None]
def recolorer(img, cible, etendue, sat, lum):
    a=np.asarray(img).astype(float)/255; rgb=a[...,:3]
    h,s,v=rgb2hsv(rgb)
    hh=np.where(h>300,h-360,h)          # rouges proches de 360 -> négatifs
    poids=np.clip((s-0.18)/0.2,0,1)*np.clip((60-hh)/12,0,1)*np.clip((hh+40)/12,0,1)
    nh=(cible+(hh-22)*etendue)%360
    nrgb=hsv2rgb(nh,np.clip(s*sat,0,1),np.clip(v*lum,0,1))
    rgb2=rgb*(1-poids[...,None])+nrgb*poids[...,None]
    out=np.concatenate([rgb2,a[...,3:]],-1)
    return Image.fromarray((out*255+0.5).astype(np.uint8),'RGBA')
if __name__=='__main__':
    src,mot,dest,cible,etendue,sat,lum=sys.argv[1:8]
    img=Image.open(src).convert('RGBA')
    if float(cible)>=0: img=recolorer(img,float(cible),float(etendue),float(sat),float(lum))
    a=np.asarray(img).copy(); a[740:840,:,3]=0; img=Image.fromarray(a,'RGBA')   # efface GARAGE et ses traits
    img.alpha_composite(Image.open(mot).convert('RGBA'))
    img.save(dest)
