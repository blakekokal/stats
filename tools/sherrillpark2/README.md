# Sherrill Park Golf Course – Course 2 (Richardson, TX)

Built from the course's yardage book (`yardage-book.pdf`) with the shared scripts
in `tools/`. Course 2 is the eighteen south of East Lookout Drive.
`course.py` holds the club's scorecard and the middle of each green as seen in the imagery.

1. `python3 ../fetch_tiles.py 19 32.9778 -96.6925 32.9859 -96.6833 m19.png` — the zoom-19 imagery the app shows.
2. From `tools/`: `python3 build_from_book.py sherrillpark2 sherrillpark2/yardage-book.pdf sherrillpark2/m19.png ../data/sherrillpark2.json [check.png]`
   (needs `pymupdf` and `opencv-python`; takes about 7 minutes).

How it lines up: a bunker or pond drawn on two pages is the same shape, so the
18 pages join into one plan of the course (they agree to 0.07 yd). That plan is
put on the imagery in one piece (a shift, a turn and a scale): first from the
greens, then fine-tuned so the bunkers sit on sand and the ponds and trees on dark
ground. Each bunker and green may then move up to 3 m on its own. Trees are the
canopy in the imagery inside the book's tree circles.
