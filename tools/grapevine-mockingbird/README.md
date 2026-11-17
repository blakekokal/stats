# Grapevine Golf Course – Mockingbird nine (Grapevine, TX)

Built from the nine's yardage book (`yardage-book.pdf`, the vector one) with the
shared scripts in `tools/`. Mockingbird is the east nine plus the strip south of
Bluebonnet's 1st: holes 1, 8 and 9 round the three ponds by the clubhouse, 2–7
east of them, 5 and 6 along the two long ponds in the north-east.
`course.py` holds the scorecard and the middle of each green as seen in the imagery.

1. `python3 ../fetch_tiles.py 19 32.9760 -97.0550 32.9853 -97.0395 m19.png` — the zoom-19 imagery the app shows.
2. From `tools/`: `python3 build_from_book.py grapevine-mockingbird grapevine-mockingbird/yardage-book.pdf grapevine-mockingbird/m19.png ../data/grapevine-mockingbird.json [check.png]`
   (needs `pymupdf` and `opencv-python`; takes a few minutes).

The scorecard is from the book: par, HCP and Black yardages from each hole page,
Blue/White/Red from the numbers beside their tee boxes. The book doesn't name the
boxes; holes 1, 7 and 9 have a fourth (left out), and on hole 2 Blue plays from
Black. Ratings and slopes are not in it (to come from the club). No OB boundary yet.
