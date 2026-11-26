# Stonebriar Country Club – Fazio and Country Club courses (Frisco, TX; private)

Built with no yardage book, from OpenStreetMap: greens, fairways, tee boxes, bunkers, ponds and both
courses' 36 hole lines (with par). One boundary (relation 3652901) holds both courses; the hole lines
carry no course name: ways 1071122469-1071122486 are the Country Club course's, the rest the Fazio
course's (their pars and lengths match each card). Like Fields Ranch, each course file has both
courses' shapes and its own 18 holes. The outlines sit 1.8 m east of the Esri imagery (bunker fit; the
greens agree) and are shifted onto it.

- Fazio #7 has no green in OSM (only the collar round it): `green_from_seed.py` grows it in the imagery
  from a point on it and moves #7's pin onto it.
- Country Club #7 and #15 share a double green: `pinAtLineEnd`.
- The practice greens and bunkers by the clubhouse are dropped with `trim_far.py` (greens kept within
  30 m of a pin, for the double green; each file counts the other course's holes too).
- One OSM bunker on sunlit grass is dropped (`drop`); the others the sand check would drop are shaded.

Scorecards from GolfPass: Fazio (22706) and Country Club (2935), par 72 each, pars match OSM.
Combination tees left out. Ratings matched by total yards (Fazio's Green has none: its rating is for 5647
yards, not 6054; Country Club Purple has none); Red's are the women's.

1. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.8585,33.0855,-96.8385,33.1080" -o map.json`
2. `python3 tools/stonebriar/osm_to_geom.py map.json`
3. From `tools/` (imagery: `python3 fetch_tiles.py 19 33.0866 -96.8573 33.1067 -96.8398 stonebriar/m19.png`), for c in fazio, cc:
   - `python3 build_course.py stonebriar-$c.osm.json stonebriar-$c.config.json ../data/stonebriar-$c.json`
   - `python3 green_from_seed.py ../data/stonebriar-$c.json stonebriar/m19.png ../data/stonebriar-$c.json 33.09178,-96.85638 --tol 16`
   then `python3 trim_far.py ../data/stonebriar-fazio.json 30 45 - ../data/stonebriar-cc.json` and the same the other way
   round, then for each: `add_ob.py stonebriar.boundary.osm.json stonebriar.roads_houses.osm.json stonebriar-$c.config.json ../data/stonebriar-$c.json`,
   `trees_from_imagery.py ../data/stonebriar-$c.json stonebriar/m19.png ../data/stonebriar-$c.json`
4. From the repo root: `python3 tools/soften_shapes.py data/stonebriar-$c.json` and `python3 tools/elevation.py stonebriar-$c`
