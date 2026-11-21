"""Isabella Golf Course (Hot Springs Village, AR): three nines, Nina, Pinta and Santa Maria.

OpenStreetMap has all 27 hole lines (with par), greens, tee boxes, bunkers and ponds, but
only one fairway. OSM numbers Pinta's holes 10-18 and Nina's and Santa Maria's 1-9, so each
nine's holes are named by their OSM way ids here, in playing order.
Scorecard: the club's nine-hole cards as golfingrecord.com has them (each nine's own
9-hole rating and slope; men's ratings and stroke index). Santa Maria's card ranks its
holes 1-9; they are given here as the odd numbers 1-17 like the other two nines.
"""
NINES = {
  'nina': dict(name='Nina', par=[5,4,4,3,5,4,4,3,4], hcp=[7,3,17,13,15,9,1,5,11],
    ways=[1118775174,1118775187,1118775199,1118786563,1118788053,1118788054,1118793060,1118793061,1118793062],
    tees={'Black': (37.3,130,[541,325,454,175,510,413,431,185,452]),
          'Blue':  (36.5,127,[510,307,387,151,490,378,405,163,414]),
          'White': (35.1,125,[485,284,350,136,474,338,375,161,384]),
          'Silver':(34.5,121,[467,284,330,129,424,320,355,140,365]),
          'Gold':  (32.5,114,[401,250,286,106,415,279,311,107,312])}),
  'pinta': dict(name='Pinta', par=[5,4,3,4,4,4,5,3,4], hcp=[9,17,1,3,7,15,5,13,11],
    ways=[1118786557,1118784730,1118784721,1118784715,1118784705,1118777362,1118793066,1118777337,1118775925],
    tees={'Black': (37.6,134,[538,454,201,409,428,334,586,164,461]),
          'Blue':  (36.5,129,[514,414,177,377,399,311,563,134,434]),
          'White': (35.2,121,[498,383,157,342,362,300,543,118,404]),
          'Silver':(34.1,116,[477,363,138,322,346,272,516,101,347]),
          'Gold':  (32.9,112,[423,325,105,267,305,226,454,88,312])}),
  'santamaria': dict(name='Santa Maria', par=[4,5,4,3,5,4,3,4,4], hcp=[13,17,5,15,7,9,1,11,3],
    ways=[1118910407,1118910408,1118910410,1118910411,1118910412,1118910415,1118910417,1118910418,1118910420],
    tees={'Black': (37.4,133,[412,530,438,158,580,444,210,371,487]),
          'Blue':  (36.2,128,[391,504,398,133,552,418,184,335,461]),
          'White': (34.9,123,[319,471,359,113,522,364,157,300,424]),
          'Silver':(34.0,119,[308,465,307,100,459,326,139,270,407]),
          'Gold':  (32.8,114,[256,428,301,94,452,317,132,262,382])}),
}
REL = 3949169  # the course boundary (multipolygon) in OSM
