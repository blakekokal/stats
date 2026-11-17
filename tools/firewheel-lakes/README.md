# Firewheel Golf Park – Lakes (Garland, TX)

Built from the course's yardage book (`yardage-book.pdf`, the vector one, without the
Apple Maps picture) with the shared scripts in `tools/`. Firewheel has three courses (Old,
Lakes, Bridges); OpenStreetMap maps only some greens and no holes, and one boundary for
the whole park. `course.py` holds the scorecard and the middle of each green in the imagery.

Finding the greens: each hole page's bunkers and trees, turned by its north arrow, were
slid over the sand and tree canopy in the zoom-19 imagery of the whole park; 12 holes
locked on clearly. The book joins all 18 pages into one plan (to 0.24 yd), and that plan,
fitted to those 12 greens (4 m at most), gives every pin.

1. `python3 ../fetch_tiles.py 19 32.9658 -96.6371 32.9856 -96.6213 m19.png` — the zoom-19 imagery (Lakes only).
2. From `tools/`: `python3 build_from_book.py firewheel-lakes firewheel-lakes/yardage-book.pdf firewheel-lakes/m19.png ../data/firewheel-lakes.json [check.png]`
3. Bunkers: `hazards_from_imagery.py` + `bunkers_from_imagery.py`. Six of the book's bunkers
   are on grass (grassed-over hollows next to real sand ones) and were dropped; what the
   imagery would add is paths, a sandy creek bank and bare dirt, so nothing was added.
4. OB from the park's OpenStreetMap boundary (all three courses):
   `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=<the park, in 4 parts>"`,
   `python3 firewheel-lakes/osm_boundary.py map.json`, then
   `python3 add_ob.py firewheel-lakes.boundary.osm.json firewheel-lakes.roads_houses.osm.json firewheel-lakes.config.json ../data/firewheel-lakes.json`;
   trees outside the boundary removed.
5. From the repo root: `python3 tools/elevation.py firewheel-lakes`.

Scorecard: par, handicap and Gold yardage from the book (7,134); Blue, White and Red per hole
from the book's other tee boxes, within about 1% of the published totals; ratings from GolfAdvisor.
GolfPass's hole-by-hole card is an older layout (different handicaps, 7,001 yd).
