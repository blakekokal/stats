"""Prairie Lakes Golf Course (Grand Prairie, TX): three nines, Red, White and Blue.

Routing from the club's course map; the middle of each green from the zoom-19 Esri
imagery. A hole's back tee is placed on the line from its green back towards the
previous green (or the first tee) at the card's back-tee yardage, unless TEE gives it.
"""
NINES = {
  'red': dict(name='Red', par=[5,4,4,5,3,4,3,4,4], hcp=[3,9,13,1,11,17,7,5,15],
    greens=[[32.701963,-96.98489],[32.704387,-96.982653],[32.705126,-96.979661],[32.702713,-96.983577],
            [32.701521,-96.984209],[32.703179,-96.981334],[32.702244,-96.979768],[32.701072,-96.982728],
            [32.698529,-96.9845]],
    start=[32.6978,-96.9845],
    yards={'Blue':[510,380,420,540,165,400,210,340,385],'White':[480,360,385,495,150,375,170,320,360],
           'Black':[435,322,342,445,125,325,140,300,320],'Red':[390,285,300,395,100,276,110,280,280]}),
  'white': dict(name='White', par=[5,4,4,4,3,4,4,3,4], hcp=[13,9,11,15,5,1,3,7,17],
    greens=[[32.698686,-96.979159],[32.701419,-96.980169],[32.698789,-96.978198],[32.700835,-96.978935],
            [32.701872,-96.976803],[32.7044,-96.978117],[32.701823,-96.978642],[32.701121,-96.982028],
            [32.69838,-96.983965]],
    start=[32.6983,-96.9837],
    yards={'Blue':[480,390,395,365,195,365,365,190,370],'White':[445,375,365,325,180,340,350,170,350],
           'Black':[410,315,335,290,155,290,310,132,335],'Red':[375,255,305,255,130,240,270,105,320]}),
  'blue': dict(name='Blue', par=[4,4,4,3,5,3,4,5,4], hcp=[15,11,7,13,1,17,9,5,3],
    greens=[[32.697568,-96.979663],[32.698003,-96.976278],[32.697182,-96.97877],[32.696185,-96.977766],
            [32.694934,-96.983439],[32.694215,-96.984551],[32.695681,-96.982639],[32.695825,-96.978409],
            [32.696967,-96.983161]],
    start=[32.6973,-96.9836],
    yards={'Blue':[400,445,365,190,555,160,295,520,430],'White':[360,390,350,170,530,140,280,495,410],
           'Black':[322,337,310,133,490,130,260,473,370],'Red':[285,285,270,95,450,120,240,450,330]}),
}
# GolfPass rates each pair of nines as 18: Blue course = Blue+Red, Red course = Red+White,
# White course = White+Blue. The app adds two nines' ratings and averages their slopes, so
# each nine's own rating/slope is solved from the three pairs.
PAIRS = {  # tee: (Blue+Red, Red+White, White+Blue) as (rating, slope)
  'Blue': ((72.5,128),(71.4,126),(71.1,124)), 'White': ((69.9,123),(68.7,119),(69.0,119)),
  'Black': ((66.6,113),(65.2,109),(65.6,109)), 'Red': ((63.5,108),(62.3,104),(63.2,105)),
}
# Back tees set by hand where the line back to the previous green misses the tee (from the
# club's map and the imagery); BENDS are a hole line's turns between tee and green.
TEE = {('red', 1): [32.69831, -96.984515], ('red', 2): [32.702204, -96.984757],
       ('red', 6): [32.701696, -96.983952], ('red', 8): [32.7022, -96.98],
       ('red', 9): [32.700906, -96.982678], ('white', 4): [32.698423, -96.978051],
       ('blue', 2): [32.69815, -96.9815], ('white', 7): [32.7049, -96.97869]}  # north of the trees between Blue 1 and 2
BENDS = {('red', 8): [[32.70242, -96.98155]]}  # dogleg left round the big lake, over its west arm
CHIPPING = [32.69729, -96.983459]   # chipping green west of Blue 9's green
PUTTING = [32.69841, -96.98322]     # the practice putting green
# Dark ground the imagery scripts take for ponds that are not (the clubhouse car park).
NOT_WATER = [[32.697295, -96.984622]]
