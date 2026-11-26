# The Courses at Watters Creek – Traditions (Plano, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the Traditions course's 18 hole lines (with par). Only what lies inside the boundary
(way 372377445) is kept. The boundary also holds The Futures (the 9-hole short course, whose
hole lines are left out), practice holes, the range and practice greens east of #1 and #18:
`trim.py` drops their greens, tees, bunkers and fairways. The outlines sit 0.3 m east and 1.3 m
south of the Esri imagery (measured by fitting the bunkers to the sand; the greens agree) and
are shifted onto it.

Scorecard from GolfPass (3239, the Traditions course, formerly Blackjack at Chase Oaks); its pars
match OpenStreetMap's hole tags (par 72). Men's ratings; Red has only the women's. The WCSGA tee
(no rating) is left out.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.7095,33.0670,-96.6850,33.0850" -o map.json`
2. `python3 tools/watterscreek/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py watterscreek.osm.json watterscreek.config.json ../data/watterscreek.json`
   - `python3 watterscreek/trim.py ../data/watterscreek.json`
   - `python3 fetch_tiles.py 19 33.0682 -96.7082 33.0842 -96.6860 watterscreek/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: the one it
     would drop is in shade by a green, its finds are roofs and bare ground, so OSM's are kept.
   - `python3 add_ob.py watterscreek.boundary.osm.json watterscreek.roads_houses.osm.json watterscreek.config.json ../data/watterscreek.json`
   - `python3 trees_from_imagery.py ../data/watterscreek.json watterscreek/m19.png ../data/watterscreek.json`
   - from the repo root: `python3 tools/soften_shapes.py data/watterscreek.json` and `python3 tools/elevation.py watterscreek`
