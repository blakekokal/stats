# Grapevine Golf Course – Bluebonnet nine (Grapevine, TX)

Built from the nine's yardage book (`yardage-book.pdf`, the vector one) with the
shared scripts in `tools/`. Bluebonnet is the north part of the course: holes 1
and 9 between the clubhouse and the creek, 2–8 north of it.
`course.py` holds the scorecard and the middle of each green as seen in the imagery.

1. `python3 ../fetch_tiles.py 19 32.9772 -97.0550 32.9853 -97.0402 m19.png` — the zoom-19 imagery the app shows.
2. From `tools/`: `python3 build_from_book.py grapevine-bluebonnet grapevine-bluebonnet/yardage-book.pdf grapevine-bluebonnet/m19.png ../data/grapevine-bluebonnet.json [check.png]`
   (needs `pymupdf` and `opencv-python`; takes a few minutes).

Eight of the nine pages share shapes and join into one plan (to 0.07 yd); hole 4,
a par 3 along the north edge, shares none, so it is placed by its green. The plan
fits the imagery at scale 1.0006, turned 0.12°; greens within 4.8 m.

The scorecard is from the book: par, HCP and Black yardages from each hole page,
Blue/White/Red from the numbers beside their tee boxes. Ratings and slopes are not
in it (to come from the club). No OB boundary yet.
