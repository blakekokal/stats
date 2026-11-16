# Sherrill Park Golf Course – Course 1: what build_from_book.py needs besides the yardage book.
ID = 'sherrillpark1'
NAME = 'Sherrill Park Golf Course – Course 1'
LOCATION = 'Richardson, TX'
# The middle of each green as seen in the Esri imagery, [lat, lng]; the hole numbers come from a GPS
# app's routing map (holes.py has the hand-traced hole lines these came from).
GREENS = {
    1: [32.989313, -96.690465],
    2: [32.987869, -96.687809],
    3: [32.989052, -96.688871],
    4: [32.989781, -96.686849],
    5: [32.993921, -96.687037],
    6: [32.994978, -96.68606],
    7: [32.992251, -96.685406],
    8: [32.989246, -96.685545],
    9: [32.986109, -96.685266],
    10: [32.986919, -96.690121],
    11: [32.988751, -96.694343],
    12: [32.9875, -96.691232],
    13: [32.989003, -96.692567],
    14: [32.993975, -96.691645],
    15: [32.99514, -96.690014],
    16: [32.991536, -96.691157],
    17: [32.988305, -96.690733],
    18: [32.986087, -96.687321],
}
# The club's scorecard (sherrillparkgolf.com/scorecard). Forward is rated for women.
TEES = [
 {"name": "Pro", "rating": 74.4, "slope": 132, "yards": [524, 389, 197, 336, 541, 177, 423, 437, 403, 412, 524, 400, 174, 599, 188, 436, 433, 423]},
 {"name": "Champion", "rating": 70.2, "slope": 125, "yards": [504, 345, 177, 311, 504, 156, 386, 407, 361, 362, 488, 375, 148, 564, 167, 401, 411, 395]},
 {"name": "Middle", "rating": 68.0, "slope": 121, "yards": [484, 303, 142, 295, 466, 139, 350, 321, 328, 332, 459, 330, 123, 515, 125, 342, 351, 321]},
 {"name": "Forward", "rating": 69.4, "slope": 124, "yards": [441, 274, 95, 261, 440, 109, 326, 298, 295, 247, 408, 275, 101, 412, 105, 316, 326, 281]},
]
PAR = [5, 4, 3, 4, 5, 3, 4, 4, 4, 4, 5, 4, 3, 5, 3, 4, 4, 4]
HCP = [10, 2, 18, 14, 6, 16, 8, 4, 12, 5, 3, 11, 17, 9, 15, 13, 1, 7]
