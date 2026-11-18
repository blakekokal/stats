# Prairie Lakes Golf Course (Grand Prairie, TX): Red, White and Blue nines

Built with no yardage book and next to nothing in OpenStreetMap (one green, the course
boundary): every shape is traced from the zoom-19 Esri imagery. Any two nines are played
as 18, like Grapevine (`nines: 'prairielakes'` in `js/app.js`).

- **Routing** from the club's course map (Red: the north-west, White: the east side and
  the lake shore, Blue: the south). `course.py` holds each nine's greens (the middle of
  each green in the imagery, found by their smooth mown turf and checked by eye), the
  first tee, and the scorecard. A hole's back tee is placed on the line back towards the
  previous green at the card's yardage, except the ones set by hand (`TEE`) from the map
  and the imagery. Red 8 is a dogleg left round the big lake (`BENDS`).
- **Fairways** are the mown, still-green grass within 38 m of the hole line (`seed.py`);
  greens are regrown onto the putting surface with `trace_turf.py`; bunkers and ponds from
  `hazards_from_imagery.py` (very few bunkers, as on the club's map; the clubhouse car park
  and creek water outside the boundary are dropped); trees with `trees_from_imagery.py`;
  OB from the OpenStreetMap course boundary with `add_ob.py`.
- **Tee boxes**: one back tee box per hole, 12 x 8 m; the imagery doesn't show the others.
- **Scorecard** from GolfPass (Blue 2966, Red 2967, White 2970). GolfPass rates each pair of
  nines (Blue+Red, Red+White, White+Blue); the app adds two nines' ratings and averages
  their slopes, so each nine's own rating and slope is solved from the three pairs (`PAIRS`).
  The chipping green and practice putting green are left out.

1. `python3 fetch_tiles.py 19 32.6925 -96.9868 32.7068 -96.9737 prairielakes/m19.png`
2. `curl -A course-builder "https://api.openstreetmap.org/api/0.6/map.json?bbox=-96.9880,32.6915,-96.9725,32.7080" -o map.json`,
   then from `tools/prairielakes/`: `python3 osm_to_geom.py map.json` (the boundary, roads and houses)
3. From `tools/`: `python3 prairielakes/build.py` writes `data/prairielakes-red|white|blue.json`
   (seed, trace_turf, hazards, split by nearest hole, add_ob, trees, soften).
4. From the repo root: `python3 tools/elevation.py prairielakes-red` (and `-white`, `-blue`).
