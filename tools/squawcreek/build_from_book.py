import cv2, numpy as np, json, math
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union
D=json.load(open('yb/detect.json'))
M=json.load(open('yb/match_all.json')); M.update(json.load(open('yb/match_8_14_15.json')))
YD={1:535,2:425,3:399,4:387,5:369,6:163,7:406,8:202,9:390,10:404,11:329,12:435,13:227,14:389,15:433,16:567,17:182,18:491}
PX=3.64
W={}  # world green/tee (mosaic px)
for n in range(1,19): W[n]={'g':np.array(M[str(n)]['green']),'t':np.array(M[str(n)]['tee'])}
# 14: green B, tee along B->13 green; 15: green A, tee by the book's bearing
B=np.array([575,2404.]); A=np.array([943,1103.]); Hg=W[13]['g']
u=(Hg-B)/np.linalg.norm(Hg-B); W[14]={'g':B,'t':B+u*YD[14]*PX}
v=np.array(D['15']['arrow']); a=math.atan2(v[0],-v[1])   # north, clockwise from page-up
brg=-a  # bearing of page-up (tee->green)
W[15]={'g':A,'t':A-np.array([math.sin(brg),-math.cos(brg)])*YD[15]*PX}
for n in (14,15): print(n,W[n]['t'].round())
z,X0,Y0=19,119929,211589; N=256*2**z
def ll(p):
    gx,gy=p[0]+X0*256,p[1]+Y0*256
    return [round(math.degrees(math.atan(math.sinh(math.pi*(1-2*gy/N)))),6), round(gx/N*360-180,6)]
def sim(p0,p1,q0,q1):  # page->world similarity from two point pairs (complex numbers)
    a=complex(*(q1-q0))/complex(*(p1-p0))
    return lambda p: (lambda c: np.array([c.real,c.imag]))(a*complex(*(np.array(p)-p0))+complex(*q0))
shapes={'fairway':[],'bunker':[],'water':[],'green':[]}
fill=lambda m: (lambda cs: cv2.drawContours(np.zeros_like(m),cs,-1,1,-1))(cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)[0])
for n in range(1,19):
    d=D[str(n)]; pg=np.array(d['greens'][0][:2]); pt=np.array(d['tee'])
    T=sim(pg,pt,W[n]['g'],W[n]['t'])
    f=cv2.imread(f'yb/f-{3+2*n:02d}.png'); fi=f.astype(int); Bc,G,R=fi[...,0],fi[...,1],fi[...,2]
    area=np.zeros(G.shape,np.uint8); area[150:1015,:]=1
    k=lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*r+1,2*r+1))
    fw=(((G>=234)&(G<=246)&(R>=210)&(R<=230)&(Bc>=218)&(Bc<=234)).astype(np.uint8))&area
    fw=cv2.morphologyEx(fw,cv2.MORPH_OPEN,k(3)); fw=cv2.morphologyEx(fw,cv2.MORPH_CLOSE,k(6)); fw=fill(fw)
    wt=(((Bc-R>25)&(Bc>190)).astype(np.uint8))&area; wt=cv2.morphologyEx(wt,cv2.MORPH_CLOSE,k(4)); wt=fill(cv2.morphologyEx(wt,cv2.MORPH_OPEN,k(2)))
    bk=(((R-Bc>30)&(R>200)&(G>190)).astype(np.uint8))&area; bk=fill(cv2.morphologyEx(bk,cv2.MORPH_CLOSE,k(2)))
    # green: flood from just below the marker inside the green outline
    gr=np.zeros((f.shape[0]+2,f.shape[1]+2),np.uint8); seed=(int(pg[0]),int(pg[1])+10)
    cv2.floodFill(f.copy(),gr,seed,0,(8,8,8),(8,8,8),cv2.FLOODFILL_MASK_ONLY|(255<<8)|4)
    gm=(gr[1:-1,1:-1]>0).astype(np.uint8); gm=fill(cv2.morphologyEx(gm,cv2.MORPH_CLOSE,k(4)))
    if gm.sum()>20000: gm[:]=0  # flooded out of the green
    for kind,m,minA in (('fairway',fw,300),('water',wt,150),('bunker',bk,20),('green',gm,60)):
        cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
        for c in cs:
            if cv2.contourArea(c)<minA: continue
            c=cv2.approxPolyDP(c,1.2,True).reshape(-1,2)
            if len(c)<3: continue
            P=Polygon([T(p) for p in c]).buffer(0)
            if P.is_valid and not P.is_empty: shapes[kind].append(P)
    print(n,{k_:len(v_) for k_,v_ in shapes.items()})
cfg=json.load(open('/home/user/stats/tools/squawcreek.config.json'))
feats=[]
def add(kind,geom):
    for g in (geom.geoms if hasattr(geom,'geoms') else [geom]):
        if g.geom_type!='Polygon' or g.area<20: continue
        g=g.simplify(1.5)
        r=[ll(p) for p in g.exterior.coords]; feats.append({'t':kind,'p':[r]})
U={k_:unary_union(v_) for k_,v_ in shapes.items()}
U['fairway']=U['fairway'].difference(U['green'].buffer(1)).difference(U['bunker']).difference(U['water'])
for k_ in U: add(k_,U[k_])
holes=[]
for n in range(1,19):
    g,t=W[n]['g'],W[n]['t']; holes.append({'n':n,'par':cfg['par'][n-1],'hcp':cfg['hcp'][n-1],'line':[ll(t),ll(g)],'tee':ll(t),'pin':ll(g)})
    u=(t-g)/np.linalg.norm(t-g); w=np.array([-u[1],u[0]])
    for ts in cfg['tees']:
        c=g+u*ts['yards'][n-1]*PX*YD[n]/cfg['tees'][0]['yards'][n-1]
        box=[c+u*12+w*14,c+u*12-w*14,c-u*12-w*14,c-u*12+w*14,c+u*12+w*14]
        feats.append({'t':'tee','p':[[ll(p) for p in box]]})
course={k_:cfg[k_] for k_ in ('id','name','location','tees')}
course['holes']=holes; course['features']=feats
course['attribution']='Course boundary © OpenStreetMap contributors (ODbL); holes and outlines from the club yardage book, placed on Esri imagery'
json.dump(course,open('/home/user/stats/data/squawcreek.json','w'),separators=(',',':'))
from collections import Counter; print(Counter(f['t'] for f in feats))
