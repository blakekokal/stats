# Grapevine Golf Course – Mockingbird nine (Grapevine, TX): what build_from_book.py needs besides the yardage book.
ID = 'grapevine-mockingbird'
NAME = 'Grapevine Golf Course – Mockingbird'
LOCATION = 'Grapevine, TX'
# The middle of each green as seen in the Esri imagery, [lat, lng], found by laying the book's plan on it.
GREENS = {
    1: [32.977528, -97.048733],
    2: [32.97895, -97.045643],
    3: [32.979058, -97.042161],
    4: [32.980926, -97.044704],
    5: [32.984017, -97.041485],
    6: [32.982577, -97.043985],
    7: [32.981173, -97.045423],
    8: [32.978131, -97.047783],
    9: [32.97936, -97.052198],
}
# Yardages from the yardage book: Black from each hole page, the other tees from the
# numbers beside their boxes (yards shorter than Black). The book doesn't name the boxes;
# holes 1, 7 and 9 have a fourth one (-20, -6, -173) left out here, and on hole 2 Blue
# plays from the Black box. Ratings and slopes still to come from the club.
TEES = [
 {"name": "Black", "rating": None, "slope": None, "yards": [445, 228, 386, 411, 524, 319, 181, 382, 515]},
 {"name": "Blue", "rating": None, "slope": None, "yards": [422, 228, 366, 388, 506, 302, 158, 359, 490]},
 {"name": "White", "rating": None, "slope": None, "yards": [398, 184, 345, 368, 491, 284, 135, 340, 429]},
 {"name": "Red", "rating": None, "slope": None, "yards": [352, 154, 274, 321, 432, 222, 119, 232, 363]},
]
PAR = [4, 3, 4, 4, 5, 4, 3, 4, 5]
HCP = [1, 15, 7, 3, 5, 13, 17, 11, 9]
