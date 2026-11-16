# Grapevine Golf Course – Bluebonnet nine (Grapevine, TX): what build_from_book.py needs besides the yardage book.
ID = 'grapevine-bluebonnet'
NAME = 'Grapevine Golf Course – Bluebonnet'
LOCATION = 'Grapevine, TX'
# The middle of each green as seen in the Esri imagery, [lat, lng], found by laying the book's plan on it.
GREENS = {
    1: [32.979486, -97.047225],
    2: [32.981758, -97.050444],
    3: [32.983999, -97.046453],
    4: [32.984296, -97.043535],
    5: [32.982658, -97.04862],
    6: [32.982775, -97.044715],
    7: [32.9817, -97.048207],
    8: [32.980525, -97.04626],
    9: [32.980552, -97.051624],
}
# Yardages from the yardage book: Black from each hole page, the other tees from the
# numbers beside their boxes (yards shorter than Black). Ratings and slopes still to come from the club.
TEES = [
 {"name": "Black", "rating": None, "slope": None, "yards": [552, 389, 456, 220, 506, 414, 303, 178, 421]},
 {"name": "Blue", "rating": None, "slope": None, "yards": [531, 361, 431, 199, 479, 384, 285, 153, 391]},
 {"name": "White", "rating": None, "slope": None, "yards": [506, 326, 409, 186, 454, 362, 265, 131, 356]},
 {"name": "Red", "rating": None, "slope": None, "yards": [457, 306, 317, 91, 375, 327, 227, 112, 321]},
]
PAR = [5, 4, 4, 3, 5, 4, 4, 3, 4]
HCP = [11, 5, 1, 7, 13, 9, 15, 17, 3]
