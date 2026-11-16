# Sherrill Park Course Two. A point on each green (zoom-18 mosaic pixels), numbered from a
# GPS app's routing map; tees, hole lines and fairways come from the yardage book (book.json).
GREENS = {1: (1554,3374), 2: (1101,3826), 3: (1015,3117), 4: (847,2756), 5: (1203,3647), 6: (1525,3985),
          7: (1651,3513), 8: (1803,3531), 9: (1830,2783), 10: (1998,3370), 11: (2183,3849), 12: (2019,3636),
          13: (1690,4037), 14: (996,4011), 15: (973,2774), 16: (1355,2877), 17: (1417,3484), 18: (1726,2724)}
# The club's scorecard (sherrillparkgolf.com/scorecard). Forward is rated for women.
TEES = [
 {"name": "Pro", "rating": 69.4, "slope": 125, "yards": [373,350,437,189,555,332,378,154,425, 356,405,183,390,365,573,187,323,400]},
 {"name": "Champion", "rating": 67.7, "slope": 121, "yards": [347,331,417,170,543,313,363,135,401, 338,390,163,325,348,530,157,301,362]},
 {"name": "Middle", "rating": 65.0, "slope": 115, "yards": [325,319,389,152,522,298,337,103,372, 322,371,143,310,331,516,129,287,348]},
 {"name": "Forward", "rating": 66.9, "slope": 116, "yards": [247,265,344,120,462,277,262,83,331, 282,310,122,270,290,492,112,253,288]},
]
# Pale ground that is not a bunker: sandbars in the creek, the clubhouse paths, a back yard.
NOT_SAND = [(1497,2983),(1522,3040),(1645,3127),(1662,3153),(1703,3192),(1743,3312),(1765,3860),(1985,3695),(1897,3472),(2045,3558),
            (1720,2620),(1780,2640),(1800,2670),(1180,4145),(1655,3375)]
PAR = [4,4,4,3,5,4,4,3,4, 4,4,3,4,4,5,3,4,4]
HCP = [8,4,6,17,2,13,9,18,7, 11,3,14,10,12,1,15,16,5]
MPP = 0.5009  # metres per zoom-18 pixel at this latitude
