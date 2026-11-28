# Thorntree Golf Club (DeSoto, TX)

OpenStreetMap has only the 18 hole lines (no par tags), one green and the course boundary (relation 9347183);
everything else comes from the zoom-19 Esri imagery, which is winter with all the grass dormant, so this is the
roughest of the imagery-built courses:
- Greens: `green_from_seed.py` from each hole line's end, the best of several settings per green (`--auto` for
  1, 3, 5, 6, 8, 12, 14, 15, 17; `--tol 9 --open 3 --hull` for 2, 4, 7, 9, 13; tol 14 for 11, tol 12 for 16;
  10 and 18 are the hull of two seeds' pieces). They sit on the putting surfaces.
- Fairways and tee boxes: `fill_from_imagery.py --fairways missing --tees`; approximate (dormant fairway and rough
  differ little).
- Bunkers: `fill_from_imagery.py --bunkers --sand 170,80,14` (the sand is beige), only the eleven finds that are
  clearly bunkers kept (`keep_found_bunkers.py`). Many bunkers are missing: worth adding in the editor, or
  rebuilding from a yardage book.
No shift is applied (the hole lines end on the greens). #1's and #18's tees are just outside OSM's boundary.

Scorecard from GolfPass (14585, Thorntree Country Club); the hole lines' lengths fit its pars (par 72). Ratings by
total yards: Championship, Tournament = Members (6454), White = Regular (5764), men's; Ladies = Forward (W) (5241,
the women's); Mens has none.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.8910,32.6170,-96.8725,32.6275" -o map.json`
2. `python3 tools/thorntree/osm_to_geom.py map.json`; `thorntree.paths.osm.json` is the export's cart paths and paths
3. From `tools/`: `build_course.py`, `fetch_tiles.py 19 32.6183 -96.8895 32.6260 -96.8739 thorntree/m19.png`, the
   greens as above, `fill_from_imagery.py ... --fairways missing --tees --paths thorntree.paths.osm.json`, `add_ob.py`,
   `fill_from_imagery.py ... --bunkers --sand 170,80,14` then `keep_found_bunkers.py ... 32.619901,-96.880681 32.61989,-96.88105 32.619986,-96.876649 32.620005,-96.877025 32.620629,-96.877369 32.620717,-96.877346 32.621008,-96.875882 32.621272,-96.87642 32.622398,-96.876274 32.622546,-96.876289 32.624764,-96.882211`,
   `trees_from_imagery.py`; from the repo root `soften_shapes.py data/thorntree.json` and `elevation.py thorntree`.
