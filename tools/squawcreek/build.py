import numpy as np, math, json
src=np.array([[178,45],[88,378],[245,560]],float); dst=np.array([[943,1103],[575,2404],[1209,3097]],float)
T=np.linalg.solve(np.c_[src,np.ones(3)],dst); f=lambda p: np.array([*p,1])@T
G={'A':(943,1103),'B':(575,2404),'C':(1250,2440),'D':(1209,3097),'E1':(1800,3560),'E2':(1730,3700),'F':(3820,3480),
 'G':(3770,3920),'Q':(3974,4007),'H':(1200,3890),'I':(1545,3990),'J':(2300,4170),'K':(1772,4429),'L':(2771,4531),'M':(1570,4763),
 'N':(2739,5216),'O':(3030,5440),'P':(1430,6010)}
green={1:'G',2:'L',3:'E2',4:'C',5:'E1',6:'J',7:'F',8:'Q',9:'O',10:'K',11:'P',12:'M',13:'I',14:'B',15:'A',16:'D',17:'H',18:'N'}
FIX={10:(2880,5600)}
toward={1:(700,1040),2:(900,740),3:(560,960),4:(330,690),5:(300,420),6:(450,700),7:(600,820),8:(950,670),9:(950,830),
 10:(700,1160),11:(380,960),12:(320,1250),13:(335,990),14:(200,800),15:(110,460),16:(190,60),17:(245,560),18:(300,800)}
cfg=json.load(open('/home/user/stats/tools/squawcreek.config.json'))
PX=3.64
z,X0,Y0=19,119929,211589; N=256*2**z
def ll(x,y):
    gx,gy=x+X0*256,y+Y0*256
    return [round(math.degrees(math.atan(math.sinh(math.pi*(1-2*gy/N)))),6), round(gx/N*360-180,6)]
holes=[];tees=[];info=[]
for n in range(1,19):
    g=np.array(G[green[n]],float); t=np.array(FIX[n],float) if n in FIX else f(toward[n]); u=(t-g)/np.linalg.norm(t-g)
    MAXLEN={12:380}  # 12's tee sits just behind 11's green, inside the boundary
    yd=min(cfg['tees'][0]['yards'][n-1],MAXLEN.get(n,999))
    back=g+u*yd*PX
    holes.append({'n':n,'par':cfg['par'][n-1],'hcp':cfg['hcp'][n-1],'line':[ll(*back),ll(*g)],'tee':ll(*back),'pin':ll(*g)})
    for ts in cfg['tees']:
        c=g+u*min(ts['yards'][n-1],MAXLEN.get(n,999))*PX; w=np.array([-u[1],u[0]])
        box=[c+u*12+w*14,c+u*12-w*14,c-u*12-w*14,c-u*12+w*14]
        tees.append({'t':'tee','p':[[ll(*p) for p in box]+[ll(*box[0])]]})
    info.append((n,green[n],back.round().tolist(),round(math.dist(back,f(toward[n]))/PX)))
for i in info: print(i)
json.dump({'holes':holes,'tees':tees},open('sq/holes.json','w'))
