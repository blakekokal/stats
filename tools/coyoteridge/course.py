# Coyote Ridge Golf Club: what build_from_book.py needs besides the yardage book.
ID = 'coyoteridge'
NAME = 'Coyote Ridge Golf Club'
LOCATION = 'Carrollton, TX'
# The middle of each green in the Esri imagery, [lat, lng]: found by sliding each hole page's
# bunkers and trees (turned by its north arrow) over the sand and tree canopy in the zoom-19 imagery.
GREENS = {
    1: [33.028172, -96.939212],
    2: [33.030045, -96.93387],
    3: [33.033048, -96.934328],
    4: [33.038003, -96.933825],
    5: [33.03453, -96.933698],
    6: [33.030944, -96.933037],
    7: [33.029213, -96.932272],
    8: [33.027978, -96.936862],
    9: [33.02479, -96.938451],
    10: [33.030958, -96.943296],
    11: [33.028811, -96.942762],
    12: [33.032425, -96.943213],
    13: [33.033596, -96.940739],
    14: [33.03274, -96.942528],
    15: [33.028689, -96.94412],
    16: [33.024309, -96.943506],
    17: [33.026678, -96.944363],
    18: [33.026575, -96.941746],
}
# Scorecard from GolfPass; the Black yardage on 14 is the book's (221; GolfPass has 211), which
# makes the 7,013 the book and GolfNow give. Red is rated for women.
TEES = [
 {"name": "Black", "rating": 75.2, "slope": 141, "yards": [356,536,259,546,441,388,173,403,437, 591,231,406,376,221,501,416,361,371]},
 {"name": "Blue", "rating": 72.0, "slope": 135, "yards": [326,491,211,522,406,351,151,371,411, 561,186,366,351,176,456,376,331,311]},
 {"name": "White", "rating": 69.3, "slope": 131, "yards": [312,479,180,495,381,326,138,356,389, 544,167,351,339,160,416,358,319,292]},
 {"name": "Red", "rating": 71.4, "slope": 123, "yards": [275,415,145,406,340,300,105,300,340, 485,110,300,275,130,375,300,291,240]},
]
PAR = [4,5,3,5,4,4,3,4,4, 5,3,4,4,3,5,4,4,4]
HCP = [17,11,5,13,3,7,9,15,1, 2,4,16,6,18,10,8,12,14]
