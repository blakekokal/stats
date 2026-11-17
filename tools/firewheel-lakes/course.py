# Firewheel Golf Park – Lakes: what build_from_book.py needs besides the yardage book.
ID = 'firewheel-lakes'
NAME = 'Firewheel Golf Park – Lakes'
LOCATION = 'Garland, TX'
# The middle of each green in the Esri imagery, [lat, lng]. Each hole page's bunkers and trees
# (turned by its north arrow) were slid over the sand and tree canopy in the zoom-19 imagery of the
# whole park (Old, Lakes and Bridges); 12 holes locked on clearly. The book joins all 18 pages into one
# plan (shared shapes and trees, to 0.24 yd); fitted to those 12 (4 m at most), the plan gives every pin.
GREENS = {
    1: [32.97933, -96.631661],
    2: [32.983092, -96.628166],
    3: [32.981667, -96.626436],
    4: [32.979952, -96.630377],
    5: [32.978185, -96.627365],
    6: [32.975461, -96.624328],
    7: [32.976571, -96.627906],
    8: [32.97735, -96.626959],
    9: [32.978066, -96.631946],
    10: [32.974412, -96.63103],
    11: [32.973369, -96.629469],
    12: [32.976678, -96.630992],
    13: [32.973879, -96.62854],
    14: [32.970628, -96.628654],
    15: [32.968351, -96.62721],
    16: [32.970921, -96.630097],
    17: [32.974414, -96.631741],
    18: [32.97668, -96.634043],
}
# Par, handicap and Gold yardage per hole from the book (7,134 yd, the club's total). Blue, White and
# Red per hole are the book's other tee boxes (labelled in yards from the Gold); they come within about
# 1% of the published totals (6,680, 6,141, 5,502). Ratings from GolfAdvisor; Red is rated for women.
TEES = [
 {"name": "Gold", "rating": 75.5, "slope": 139, "yards": [414, 431, 184, 512, 447, 468, 414, 189, 558, 440, 183, 426, 554, 418, 165, 393, 532, 406]},
 {"name": "Blue", "rating": 73.6, "slope": 134, "yards": [393, 400, 159, 486, 435, 438, 388, 163, 538, 383, 158, 403, 532, 379, 148, 364, 518, 406]},
 {"name": "White", "rating": 70.7, "slope": 125, "yards": [376, 366, 127, 455, 435, 401, 351, 129, 501, 355, 144, 373, 487, 335, 140, 346, 501, 350]},
 {"name": "Red", "rating": 73.6, "slope": 126, "yards": [342, 333, 95, 429, 351, 355, 319, 105, 451, 355, 121, 318, 459, 310, 120, 320, 456, 326]},
]
PAR = [4,4,3,5,4,4,4,3,5, 4,3,4,5,4,3,4,5,4]
HCP = [12,10,18,4,8,6,14,16,2, 5,11,7,1,9,17,15,3,13]
