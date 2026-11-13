Squaw Creek isn't mapped in OpenStreetMap beyond its boundary, so it's built from the club's
yardage book (two PDFs: a satellite one and a flat-line one, rendered with `pdftoppm -r 200` to
`s-NN.png` / `f-NN.png`; hole n is page 3+2n).

1. `detect_pages.py` finds each hole page's tee (blue dot), green marker and north arrow.
2. `match_pages.py` turns each satellite page north-up, scales it by the tee-to-green yardage and
   template-matches it against the z19 Esri mosaic (`fetch_tiles.py 19 32.7505 -97.6512 32.7655 -97.6392`)
   to find the hole's real tee and green. Weak matches (8, 14, 15) are searched near their expected
   greens; 14 and 15 are finally placed from the book's bearings.
3. `build_from_book.py` segments the flat-line pages into fairways, bunkers, water and greens and
   maps them into place with each hole's page-to-world transform; one tee box per tee set.
4. Missing greens filled with a circle, then `clean_course.py` and `add_ob.py` with the OSM boundary.

`scorecard-map.webp` is the club's routing map, used to check the layout.
