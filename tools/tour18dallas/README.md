# Tour 18 Golf Course Dallas (Flower Mound, TX)

Built from the course's yardage book (`yardage-book.pdf`, the vector one, without
the Apple Maps picture) with the shared scripts in `tools/`.
`course.py` holds the club's scorecard and the middle of each green as seen in the imagery.

1. `python3 ../fetch_tiles.py 19 33.0445 -97.1705 33.0705 -97.1555 m19.png` — the zoom-19 imagery the app shows.
2. From `tools/`: `python3 build_from_book.py tour18dallas tour18dallas/yardage-book.pdf tour18dallas/m19.png ../data/tour18dallas.json [check.png]`
   (needs `pymupdf` and `opencv-python`; takes several minutes).
3. `python3 hazards_from_imagery.py ../data/tour18dallas.json tour18dallas/m19.png imagery.json`, then
   `python3 bunkers_from_imagery.py ../data/tour18dallas.json imagery.json tour18dallas/m19.png ../data/tour18dallas.json`
   — the book's bunkers are partly wrong: some are on grass (holes 1, 2, 6, and a long strip on 15)
   and some sand has none (two fairway bunkers on 2, two by the green on 15, the church pews
   on 10, the big fairway bunker on 4). The imagery alone misses big and odd-shaped bunkers
   that the book has right, so the book's bunkers on sand are kept, those on grass dropped,
   and the imagery's added where the book has none. Ponds and trees stay as built.

How it lines up: houses keep many holes apart, so few bunkers or ponds are drawn on
two pages. The book's tree circles are, and a tree drawn on two pages is the same
circle to 0.002 yd, so trees join pages too. Even so the book makes six separate
plans: holes 1–7, 8 and 14–18, 12–13, and 9, 10 and 11 on their own. All share the
book's one scale and turn (rings and north arrow); each group gets its own shift.

The greens in `course.py` were found by sliding each group's ponds, bunkers and trees
over the imagery (holes 1–7 and 8/14–18 found themselves; 9 is the island green in
the clubhouse pond, 10 and 11 the two greens north-west of the clubhouse, 12 the
green at the top, 414 yd north of 13 as the book has it).

OpenStreetMap has no course boundary here, so there is no OB yet: the owner draws it
in the hole editor (Draw new boundary → Course boundary).
