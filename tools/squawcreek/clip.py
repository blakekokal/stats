import cv2, numpy as np, json, math
from shapely.geometry import Polygon
z,X0,Y0=19,119929,211589; N=256*2**z
mpp=156543.03*math.cos(math.radians(32.758))/2**z
def ll(x,y):
    gx,gy=x+X0*256,y+Y0*256
    return [round(math.degrees(math.atan(math.sinh(math.pi*(1-2*gy/N)))),6), round(gx/N*360-180,6)]
def px(q):
    lat,lon=q; gx=(lon+180)/360*N; gy=(1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*N
    return [gx-X0*256, gy-Y0*256]
p='/home/user/stats/data/squawcreek.json'; c=json.load(open(p))
i=cv2.imread('/tmp/claude-0/-home-user-stats/d9fae9bb-aefb-5809-968c-8c192b0428a4/scratchpad/sq/mosaic.png')
g=cv2.cvtColor(i,cv2.COLOR_BGR2GRAY).astype(np.float32); mu=cv2.blur(g,(11,11)); sd=np.sqrt(np.maximum(cv2.blur(g*g,(11,11))-mu*mu,0))
L=cv2.blur(cv2.cvtColor(i,cv2.COLOR_BGR2LAB)[...,0].astype(np.float32),(9,9))
grass=((L>115)&(sd<9)).astype(np.uint8)
k=lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*r+1,2*r+1))
grass=cv2.morphologyEx(cv2.morphologyEx(grass,cv2.MORPH_OPEN,k(6)),cv2.MORPH_CLOSE,k(16))
out=[];n=0
for f in c['features']:
    r=f['p'][0]
    if f['t']=='fairway' and f.get('seed'):
        P=np.array([px(q) for q in r],np.int32)
        x0,y0=P.min(0)-5; x1,y1=P.max(0)+5
        m=np.zeros((y1-y0,x1-x0),np.uint8); cv2.fillPoly(m,[P-[x0,y0]],1)
        m&=grass[y0:y1,x0:x1]
        m=cv2.morphologyEx(m,cv2.MORPH_OPEN,k(8))
        cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
        for cn in cs:
            if cv2.contourArea(cn)*mpp*mpp<300: continue
            cn=cv2.approxPolyDP(cn,0.6/mpp,True).reshape(-1,2)
            rr=[ll(a+x0,b+y0) for a,b in cn]; out.append({'t':'fairway','p':[rr+[rr[0]]]})
        n+=1
    else: out.append(f)
c['features']=out; json.dump(c,open(p,'w'),separators=(',',':')); print('clipped',n)
