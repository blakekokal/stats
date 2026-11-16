# Sherrill Park Golf Course – Course 1 (Richardson, TX)

Built from the course's yardage book (`yardage-book.pdf`, a vector PDF); the
first version was traced from Esri World Imagery, as OpenStreetMap has only the club's boundary.
Course 1 is the eighteen north of East Lookout Drive (Course 2 is to the south).

1. `python3 ../fetch_tiles.py 18 32.9775 -96.6960 32.9967 -96.6832 m18.png` — the imagery (both courses).
2. `python3 ../fetch_tiles.py 19 32.9832 -96.6966 32.9964 -96.6843 m19.png` — the zoom-19 imagery the app shows (Course 1 only).
3. `python3 build_book.py yardage-book.pdf m19.png ../../data/sherrillpark1.json [check.png]` — the course
   file, and a picture to check it by eye. Needs `pymupdf` and `opencv-python`.

`book.py` reads the book. Each hole page is drawn round the pin: the dashed rings
are 50-yard steps (on a par 3, the tee's "N yd to green" gives the scale) and the
north arrow gives the turn. Bunkers, water, fairways, the green and the hole's
own tee boxes (the ones with a yardage label) come straight from the drawing; the
book prints the slope every 50 yards along the hole's centre line, so those marks
give the line's bends.

`build_book.py` puts each pin on the green as seen in the imagery (`holes.py`),
moves the hole until its trees and ponds are on dark ground, then until its
bunkers are on sand and its green on green turf (tree shadows fall north-west,
so the trees alone leave a hole a few metres north). Then each bunker and green
is moved on its own, by up to 3 m. The book's tree circles are generous, so the
trees are the leafy canopy in the imagery inside those circles.

The older `build.py` (everything traced from the imagery) still works:
`python3 build.py ../../data/sherrillpark1.json [check.png]`.

That traced build reads the satellite picture by colour. On this course the greens are the greenest
turf rather than the brightest, the fairways are drier, and most ponds are
brown rather than dark. `holes.py` holds the hole lines, the club's scorecard
and the pale ground that is not sand. The hole numbers come from a GPS app's
routing map.
