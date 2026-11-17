# Grapevine Golf Course – Pecan nine (Grapevine, TX)

Built from the nine's yardage book (`yardage-book.pdf`, the vector one) with the
shared scripts in `tools/`. Pecan is the south nine, running north–south along the
dam: holes 1 and 2 south of Mockingbird's ponds, down past the two ponds to the
4th green, and back. (The bright green holes east of it are Cowboys Golf Club.)
`course.py` holds the scorecard and the middle of each green as seen in the imagery.

1. `python3 ../fetch_tiles.py 19 32.9600 -97.0565 32.9800 -97.0430 m19.png` — the zoom-19 imagery the app shows.
2. From `tools/`: `python3 build_from_book.py grapevine-pecan grapevine-pecan/yardage-book.pdf grapevine-pecan/m19.png ../data/grapevine-pecan.json [check.png]`
   (needs `pymupdf` and `opencv-python`; takes a few minutes).

By their shared shapes and trees the pages make three plans: {3, 4, 5, 6, 7},
{1, 8, 9} and hole 2 on its own; each is placed by its greens and then fine-tuned on
the sand and ponds (two tree links that contradicted the shapes are dropped). `DROP`
in `course.py` leaves out any pond the book draws where the imagery has none.
Scorecard from the book; no ratings, slopes or OB yet.
