# Grapevine Golf Course – Pecan nine (Grapevine, TX): what build_from_book.py needs besides the yardage book.
ID = 'grapevine-pecan'
NAME = 'Grapevine Golf Course – Pecan'
LOCATION = 'Grapevine, TX'
# The middle of each green as seen in the Esri imagery, [lat, lng]. The pages make three plans by their
# shared shapes ({3, 4, 5, 6, 7}, {1, 8, 9} and 2 on its own); 3, 4, 6, 7 were found by laying theirs
# on the ponds and sand, 1 and 2 by eye, 5, 8 and 9 from their plans and checked on the imagery.
GREENS = {
    1: [32.975269, -97.05326],
    2: [32.973644, -97.053947],
    3: [32.969909, -97.054239],
    4: [32.964811, -97.053543],
    5: [32.966905, -97.050787],
    6: [32.969658, -97.053323],
    7: [32.972143, -97.052567],
    8: [32.974484, -97.051798],
    9: [32.97843, -97.053266],
}
# Ponds the book draws that aren't in the imagery (round hole 3's green, and in the woods east of hole 6).
DROP = [['water', [32.969662, -97.054121]], ['water', [32.969594, -97.051747]]]
# Yardages from the yardage book: Black from each hole page, the other tees from the
# numbers beside their boxes (yards shorter than Black). No ratings or slopes.
TEES = [
 {"name": "Black", "rating": None, "slope": None, "yards": [429, 168, 426, 578, 405, 442, 370, 184, 569]},
 {"name": "Blue", "rating": None, "slope": None, "yards": [405, 159, 393, 545, 385, 417, 340, 159, 535]},
 {"name": "White", "rating": None, "slope": None, "yards": [379, 138, 370, 495, 363, 396, 312, 145, 506]},
 {"name": "Red", "rating": None, "slope": None, "yards": [347, 111, 326, 440, 340, 364, 298, 113, 427]},
]
PAR = [4, 3, 4, 5, 4, 4, 4, 3, 5]
HCP = [9, 17, 3, 7, 5, 1, 13, 15, 11]
