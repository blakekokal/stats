# Sherrill Park Golf Course – Course 2 (Richardson, TX)

Traced from Esri World Imagery; OpenStreetMap has only the club's boundary.
Course 2 is the eighteen south of East Lookout Drive (Course 1 is to the north).

1. `python3 ../fetch_tiles.py 18 32.9775 -96.6960 32.9967 -96.6832 m18.png` — the imagery (both courses).
2. `python3 build.py ../../data/sherrillpark2.json [check.png]` — the course file, and a picture to check it by eye.

`holes.py` holds what was worked out by eye: each hole's line (back tee, bends,
green) in zoom-18 mosaic pixels, and the club's scorecard
(sherrillparkgolf.com/scorecard). The hole numbers come from a GPS app's routing
map; the traced lines come out within a few yards of the card on most holes.
Greens are the brightest, smoothest turf at the end of each line; fairways are
the turf within 19 m of a line; ponds are dark and flat (tree shadow is dark but
never flat); trees are split by nearest hole. Each tee set's box sits on the
hole's first leg at its scorecard yardage, but never more than 15 yards behind
the traced tee.
