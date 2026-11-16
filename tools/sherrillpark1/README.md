# Sherrill Park Golf Course – Course 1 (Richardson, TX)

Traced from Esri World Imagery; OpenStreetMap has only the club's boundary.
Course 1 is the eighteen north of East Lookout Drive (Course 2 is to the south).

1. `python3 ../fetch_tiles.py 18 32.9775 -96.6960 32.9967 -96.6832 m18.png` — the imagery (both courses).
2. `python3 build.py ../../data/sherrillpark1.json [check.png]` — the course file, and a picture to check it by eye.

Built the same way as `../sherrillpark2` (see its README); `build.py` differs
only where this side of the road looks different: the greens are the greenest
turf rather than the brightest, the fairways are drier, and most ponds are
brown rather than dark. `holes.py` holds the hole lines, the club's scorecard
and the pale ground that is not sand. The hole numbers come from a GPS app's
routing map.
