import cv2, numpy as np
im = cv2.imread('m19.png')
OFF = 256  # m19 px = 2*m18 - (256, 0)
lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
L, A, B = lab[..., 0] * 100 / 255, lab[..., 1] - 128, lab[..., 2] - 128
g = cv2.GaussianBlur(L, (0, 0), 1.5)
m = cv2.blur(g, (15, 15)); sd = np.sqrt(np.maximum(cv2.blur(g * g, (15, 15)) - m * m, 0))
np.savez_compressed('feat.npz', L=L.astype(np.float16), A=A.astype(np.float16), B=B.astype(np.float16), sd=sd.astype(np.float16))
def at(x, y, r=6):
    X, Y = 2 * x - OFF, 2 * y
    s = np.s_[Y - r:Y + r, X - r:X + r]
    return [round(float(v[s].mean()), 1) for v in (L, A, B, sd)]
pts = {'green G_i': (1825,1629), 'green G_h': (2032,1550), 'green G_k': (1346,2020), 'green G_p':(1638,2440), 'fw c2': (1640,1700), 'fw pond': (1100,1450), 'fw 15': (1000,2440), 'fw 7':(1700,2700),
 'rough tan': (1150,2350), 'rough tan2': (1000,2060), 'trees': (1000,1650), 'trees2': (2300,1420), 'trees3':(1900,2400), 'pond': (1150,1300), 'bunker': (1612,1640), 'bunker2': (2064,1553), 'lot': (1200,1712), 'creek algae': (1300,1050), 'fw 2': (2300,1330), 'shadow': (1560,1560), 'path': (1700,1450)}
for k, p in pts.items(): print(k, at(*p))
