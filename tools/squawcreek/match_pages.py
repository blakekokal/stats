import cv2, numpy as np, json, math, sys
D=json.load(open('yb/detect.json'))
YD={1:535,2:425,3:399,4:387,5:369,6:163,7:406,8:202,9:390,10:404,11:329,12:435,13:227,14:389,15:433,16:567,17:182,18:491}
M=cv2.imread('sq/mosaic.png'); DS=2
Mg=cv2.cvtColor(cv2.resize(M,(M.shape[1]//DS,M.shape[0]//DS),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2GRAY)
PX=3.64/DS
out={}
WIN={8:(3974,4007),14:(575,2404),15:(943,1103)}
holes=[int(a) for a in sys.argv[1:]] or range(1,19)
for n in holes:
    d=D[str(n)]; im=cv2.imread(f'yb/s-{3+2*n:02d}.png')
    tee=np.array(d['tee']); gr=np.array(d['greens'][0][:2]); v=np.array(d['arrow']); nv=v/np.linalg.norm(v)
    s=np.linalg.norm(tee-gr)/YD[n]  # page px per yard
    # rotation that turns page-north to up: angle of nv from up
    ang=math.degrees(math.atan2(nv[0],-nv[1]))  # clockwise from up
    best=None
    crop=im[145:1010, 10:740]; off=np.array([10,145])
    for da in (range(-20,21,2) if n in WIN else range(-6,7,2)):
        a=ang+da
        Hc,Wc=crop.shape[:2]; c=(Wc/2,Hc/2)
        R=cv2.getRotationMatrix2D(c,a,PX/s)  # rotate by +a (counterclockwise in cv2) and scale
        # output size
        cos,sin=abs(R[0,0]),abs(R[0,1]); nw,nh=int(Hc*sin+Wc*cos),int(Hc*cos+Wc*sin)
        R[0,2]+=nw/2-c[0]; R[1,2]+=nh/2-c[1]
        rot=cv2.warpAffine(crop,R,(nw,nh),borderValue=(255,255,255))
        mask=(cv2.cvtColor(rot,cv2.COLOR_BGR2GRAY)<215).astype(np.uint8)
        mask=cv2.erode(mask,np.ones((5,5),np.uint8))
        tg=cv2.cvtColor(rot,cv2.COLOR_BGR2GRAY)
        if tg.shape[0]>=Mg.shape[0] or tg.shape[1]>=Mg.shape[1]: continue
        r=cv2.matchTemplate(Mg,tg,cv2.TM_CCOEFF_NORMED,mask=mask)
        r[~np.isfinite(r)]=-1
        if n in WIN:
            gx,gy=(np.array([*(gr-off),1])@R.T); wx,wy=WIN[n][0]/DS-gx, WIN[n][1]/DS-gy
            yy,xx=np.mgrid[:r.shape[0],:r.shape[1]]; r[(np.abs(xx-wx)>150)|(np.abs(yy-wy)>150)]=-1
        _,mv,_,ml=cv2.minMaxLoc(r)
        if best is None or mv>best[0]:
            pts=np.array([[*(gr-off),1],[*(tee-off),1]])@R.T
            best=(mv,a,ml,(pts+ml)*DS)
    mv,a,ml,pts=best
    out[n]={'score':float(mv),'green':pts[0].tolist(),'tee':pts[1].tolist()}
    print(n,round(mv,3),'green',pts[0].round(),'tee',pts[1].round(),'len',round(np.linalg.norm(pts[0]-pts[1])/3.64))
json.dump(out,open('yb/match_%s.json'%('_'.join(map(str,holes)) or 'all'),'w'))
