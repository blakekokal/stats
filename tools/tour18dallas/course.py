# Tour 18 Golf Course Dallas: what build_from_book.py needs besides the yardage book.
ID = 'tour18dallas'
NAME = 'Tour 18 Golf Course Dallas'
LOCATION = 'Flower Mound, TX'
# The middle of each green as found in the Esri imagery, [lat, lng]: the book's hole groups
# matched to ponds and sand (9 is the island green in the clubhouse pond).
GREENS = {
    1: [33.056467, -97.167596],
    2: [33.053581, -97.16637],
    3: [33.05143, -97.164452],
    4: [33.046247, -97.165984],
    5: [33.045366, -97.164338],
    6: [33.049924, -97.162655],
    7: [33.054307, -97.163981],
    8: [33.058638, -97.164383],
    9: [33.058672, -97.165883],
    10: [33.065007, -97.168392],
    11: [33.06648, -97.164138],
    12: [33.068115, -97.161375],
    13: [33.064716, -97.16224],
    14: [33.058346, -97.16112],
    15: [33.06391, -97.159424],
    16: [33.059962, -97.16202],
    17: [33.059287, -97.162333],
    18: [33.059968, -97.166387],
}
# The club's scorecard (GolfPass; ratings and handicaps agree with 18Birdies). Men's ratings;
# Blue/White is a combo tee with no rating.
TEES = [
 {"name": "Gold", "rating": 74.5, "slope": 137, "yards": [401, 374, 435, 507, 195, 582, 470, 409, 132, 425, 445, 170, 338, 625, 430, 455, 155, 485]},
 {"name": "Blue", "rating": 72.6, "slope": 131, "yards": [344, 360, 403, 457, 174, 568, 458, 389, 121, 408, 425, 151, 335, 563, 413, 432, 145, 465]},
 {"name": "Blue/White", "rating": None, "slope": None, "yards": [344, 360, 357, 457, 174, 558, 428, 374, 121, 388, 405, 151, 335, 543, 363, 380, 145, 465]},
 {"name": "White", "rating": 70.6, "slope": 128, "yards": [324, 342, 357, 437, 154, 558, 428, 374, 105, 388, 405, 141, 321, 543, 363, 380, 135, 447]},
 {"name": "Red", "rating": 67.3, "slope": 121, "yards": [299, 325, 342, 418, 143, 545, 330, 264, 97, 375, 385, 126, 288, 353, 318, 370, 125, 390]},
]
PAR = [4, 4, 4, 5, 3, 5, 4, 4, 3, 4, 4, 3, 4, 5, 4, 4, 3, 5]
HCP = [11, 13, 3, 5, 15, 1, 7, 9, 17, 12, 4, 16, 14, 2, 10, 6, 18, 8]
