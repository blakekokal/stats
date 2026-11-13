import cv2, numpy as np, json, math
z,X0,Y0=19,119929,211589; N=256*2**z
mpp=156543.03*math.cos(math.radians(32.758))/2**z
def ll(x,y):
    gx,gy=x+X0*256,y+Y0*256
    return [round(math.degrees(math.atan(math.sinh(math.pi*(1-2*gy/N)))),6), round(gx/N*360-180,6)]
def px(lat,lon):
    gx=(lon+180)/360*N; gy=(1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*N
    return np.array([gx-X0*256, gy-Y0*256])
cfg=json.load(open('/home/user/stats/tools/squawcreek.config.json'))
H=json.load(open('sq/holes.json'))
feats=list(H['tees'])
ring=lambda c,r,n=24: [ll(*(c+r*np.array([math.cos(2*math.pi*k/n),math.sin(2*math.pi*k/n)]))) for k in range(n+1)]
for h in H['holes']:
    t,g=px(*h['tee']),px(*h['pin'])
    feats.append({'t':'green','p':[ring(g,9/mpp)]})
    if h['par']>=4:
        u=(g-t)/np.linalg.norm(g-t); w=np.array([-u[1],u[0]])*16/mpp
        a=t+u*130*0.9144/mpp; b=g-u*25*0.9144/mpp
        feats.append({'t':'fairway','seed':1,'p':[[ll(*p) for p in (a+w,b+w,b-w,a-w,a+w)]]})
# water: dark, smooth, large
i=cv2.imread('sq/mosaic.png'); L=cv2.cvtColor(i,cv2.COLOR_BGR2LAB)[...,0].astype(np.float32)
g=cv2.cvtColor(i,cv2.COLOR_BGR2GRAY).astype(np.float32); mu=cv2.blur(g,(15,15)); sd=np.sqrt(np.maximum(cv2.blur(g*g,(15,15))-mu*mu,0))
m=((cv2.blur(L,(9,9))<95)&(sd<6)).astype(np.uint8)
k=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(15,15)); m=cv2.morphologyEx(cv2.morphologyEx(m,cv2.MORPH_OPEN,k),cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(61,61)))
cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
nw=0
for c in cs:
    if cv2.contourArea(c)*mpp*mpp<1500: continue
    c=cv2.approxPolyDP(c,1.0/mpp,True).reshape(-1,2)
    r=[ll(*p) for p in c]; feats.append({'t':'water','p':[r+[r[0]]]}); nw+=1
course={k:cfg[k] for k in ('id','name','location','tees')}
course['holes']=H['holes']; course['features']=feats
course['attribution']='Course boundary © OpenStreetMap contributors (ODbL); holes from the club scorecard map; outlines traced from Esri imagery'
json.dump(course,open('/home/user/stats/data/squawcreek.json','w'),separators=(',',':'))
print('water',nw,'features',len(feats))
