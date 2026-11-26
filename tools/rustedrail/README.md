# Rusted Rail Golf Club (Crandall, TX)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers,
ponds, the creek and the 18 hole lines (with par). Only what lies inside the course boundary
(way 550943599) is kept. The outlines sit on the Esri imagery as they are (no shift: `fit_shift.py`
gives under 0.5 m from the greens; the winter imagery's sand is too dull for the bunker fit).

OSM draws the fairways wide (fairway and rough together, most of each hole's corridor); the winter
imagery doesn't show the mown edge, so they are kept as drawn: trim them in the hole editor, or
redo them from summer imagery or a yardage book.

Scorecard from GolfPass (2845, formerly Creekview); its pars match OpenStreetMap's hole tags (par 72).
Men's ratings, except Red's (71.2 for 5459 yards is presumably the women's).

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.4530,32.6090,-96.4370,32.6285" -o map.json`
2. `python3 tools/rustedrail/osm_to_geom.py map.json`
3. From `tools/`:
   - `python3 build_course.py rustedrail.osm.json rustedrail.config.json ../data/rustedrail.json`
   - `python3 fetch_tiles.py 19 32.6101 -96.4517 32.6273 -96.4382 rustedrail/m19.png`
   - Bunkers: `python3 hazards_from_imagery.py ../data/rustedrail.json rustedrail/m19.png imagery.json`,
     `python3 bunkers_from_imagery.py ../data/rustedrail.json imagery.json rustedrail/m19.png checked.json`, judged by eye:
     two OSM bunkers on grass are dropped (`drop`), and of its finds only the round bunker by #6's green is
     a bunker: `python3 keep_found_bunkers.py ../data/rustedrail.json checked.json ../data/rustedrail.json 32.619141,-96.442888`
   - `python3 add_ob.py rustedrail.boundary.osm.json rustedrail.roads_houses.osm.json rustedrail.config.json ../data/rustedrail.json`
   - `python3 trees_from_imagery.py ../data/rustedrail.json rustedrail/m19.png ../data/rustedrail.json`
   - from the repo root: `python3 tools/soften_shapes.py data/rustedrail.json` and `python3 tools/elevation.py rustedrail`
