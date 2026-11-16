# Sherrill Park Golf Course – Course 1 (Richardson, TX)

Built from the course's yardage book (`yardage-book.pdf`, a vector PDF); the
first version was traced from Esri World Imagery, as OpenStreetMap has only the club's boundary.
Course 1 is the eighteen north of East Lookout Drive (Course 2 is to the south).

1. `python3 ../fetch_tiles.py 18 32.9775 -96.6960 32.9967 -96.6832 m18.png` — the imagery (both courses).
2. `python3 build_book.py yardage-book.pdf m18.png ../../data/sherrillpark1.json [check.png]` — the course
   file, and a picture to check it by eye. Needs `pymupdf` and `opencv-python`.

`book.py` reads the book. Each hole page is drawn round the pin: the dashed rings
are 50-yard steps (on a par 3, the tee's "N yd to green" gives the scale) and the
north arrow gives the turn. Trees, bunkers, water, fairways, the green and the
hole's own tee boxes (the ones with a yardage label) come straight from the
drawing; the book prints the slope every 50 yards along the hole's centre line,
so those marks give the line's bends. `build_book.py` puts each pin on the green
in the imagery (`holes.py`), nudges the hole a few metres until its trees and
ponds sit on dark ground, and draws shapes that appear on several pages once.

The older `build.py` (everything traced from the imagery) still works:
`python3 build.py ../../data/sherrillpark1.json [check.png]`.

That traced build reads the satellite picture by colour. On this course the greens are the greenest
turf rather than the brightest, the fairways are drier, and most ponds are
brown rather than dark. `holes.py` holds the hole lines, the club's scorecard
and the pale ground that is not sand. The hole numbers come from a GPS app's
routing map.
