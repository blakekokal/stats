# Rockwall Golf & Athletic Club (Rockwall, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds and the 18 hole lines (with par). Only what lies inside the course boundary (way 675683662) is kept.
The outlines sit 0.5 m east and 1.0 m south of the Esri imagery (measured by fitting all bunkers to the sand)
and are shifted onto it.

Scorecard from GolfPass (3275); its pars match OpenStreetMap's hole tags. GolfPass's ratings are for older tees (Black 7281, Blue 6813, White 6323, Red 5522 yds); they are matched to the current card's Gold, Blue, White and Silver by total yards. The combo tees (Blue/White, White/Silver) have no published rating. Men's ratings.

Some OSM hole lines start from a middle tee box (the back tees are drawn), so a line can be shorter than the
back tee's yards.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.5000,32.9420,-96.4700,32.9600" -o map.json`
2. `python3 tools/rockwall/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py rockwall.osm.json rockwall.config.json ../data/rockwall.json`
   - `python3 fetch_tiles.py 19 32.9437437 -96.4970222 32.9588825 -96.4730375 rockwall/m19.png`
   - Bunkers checked with `hazards_from_imagery.py` + `bunkers_from_imagery.py` and by eye: the six OSM bunkers it
     would drop are on grass (in `drop`); its 15 new finds are pools, roofs and grass, so nothing is added.
   - `python3 add_ob.py rockwall.boundary.osm.json rockwall.roads_houses.osm.json rockwall.config.json ../data/rockwall.json`
   - `python3 trees_from_imagery.py ../data/rockwall.json rockwall/m19.png ../data/rockwall.json`
   - from the repo root: `python3 tools/soften_shapes.py data/rockwall.json` and `python3 tools/elevation.py rockwall`

Dropped (`drop` in the config): the two practice greens by the clubhouse, six bunkers on grass, and the driving range (OSM draws it as a fairway) with its tees and a stray tee by the pond on 5.
