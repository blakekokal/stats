# Isabella Golf Course (Hot Springs Village, AR): Nina, Pinta and Santa Maria nines

Built with no yardage book, from OpenStreetMap: all 27 hole lines (with par), greens,
fairways, tee boxes, bunkers and ponds inside the course boundary (relation 3949169).
Any two nines are played as 18 (`nines: 'isabella'` in `js/app.js`).

- **Nines**: OSM numbers Pinta's holes 10-18 and both other nines 1-9; `course.py` names
  each nine's holes by OSM way id. Pars (OSM's and the card's) and hole lengths (within a
  few yards of the Black tees) say which set is which. OSM tags Santa Maria 8 par 5; the
  card's par 4 is used.
- Each shape goes to the nine of its nearest hole line; ponds also to any nine with a hole
  line within 40 m (`build.py`).
- **Alignment**: OSM's outlines already sit on the zoom-19 Esri imagery (the best bunker fit
  is under half a metre off), so no shift.
- **Dropped** (`drop.json`): the practice putting green by the clubhouse.
- **Scorecard**: the club's nine-hole cards as golfingrecord.com has them: each nine's own
  9-hole men's rating and slope for Black, Blue, White, Silver and Gold, and its stroke
  index (Santa Maria's card ranks its holes 1-9; given here as 1, 3 ... 17).

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-92.888,34.620,-92.840,34.642" -o map.json`
   plus `api/0.6/relation/3949169/full.json` (the boundary's far ways), joined into one file,
   then `python3 tools/isabella/osm_to_geom.py map.json`
2. From `tools/`:
   - `python3 fetch_tiles.py 19 34.6232 -92.8848 34.6398 -92.8432 isabella/m19.png`
   - `python3 isabella/build.py` (build_course.py and add_ob.py for each nine)
   - bunkers checked per nine with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye
   - `python3 trees_from_imagery.py ../data/isabella-<nine>.json isabella/m19.png ../data/isabella-<nine>.json`
     (one nine at a time: the image is large)
   - from the repo root: `python3 tools/soften_shapes.py data/isabella-<nine>.json` and
     `python3 tools/elevation.py isabella-<nine>`
