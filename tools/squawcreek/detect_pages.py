import cv2, numpy as np, json, math
res={}
for n in range(1,19):
    im=cv2.imread(f'yb/s-{3+2*n:02d}.png'); g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).astype(int)
    b,gg,r=[im[...,i].astype(int) for i in range(3)]
    blue=((b>180)&(r<90)&(gg>80)&(gg<170)).astype(np.uint8)
    nb,lb,sb,cb=cv2.connectedComponentsWithStats(blue); tee=cb[1+np.argmax(sb[1:,4])].tolist()
    white=(g>225).astype(np.uint8)
    nw,lw,sw,cw=cv2.connectedComponentsWithStats(white)
    cands=[]
    for j in range(1,nw):
        x,y,w,h,a=sw[j]
        if not (15<=a<=150 and w<=16 and h<=16) or y<140 or y>1020: continue
        cx,cy=cw[j]
        yy,xx=np.ogrid[:g.shape[0],:g.shape[1]]; d=np.sqrt((xx-cx)**2+(yy-cy)**2)
        ring=(d>max(w,h)/2+0.5)&(d<max(w,h)/2+3.5)
        if g[ring].mean()<60: cands.append([float(cx),float(cy),float(g[ring].mean())])
    cx,cy=674,224; sub=g[cy-35:cy+35,cx-35:cx+35]; yy,xx=np.mgrid[-35:35,-35:35]
    m=(sub<90)&(np.sqrt(xx**2+yy**2)<26); v=[float(xx[m].mean()),float(yy[m].mean())]
    res[n]={'tee':tee,'greens':cands,'arrow':v}
    print(n,[round(t) for t in tee],[[round(c[0]),round(c[1])] for c in cands])
json.dump(res,open('yb/detect.json','w'))
