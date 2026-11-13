# Shot Tracker

A golf stat tracker for Bridlewood Golf Club (Flower Mound, TX) and Bear Creek
Golf Club – West and East (DFW Airport, TX) and Cowboys Golf Club (Grapevine, TX) and Tangle Ridge Golf Club (Grand Prairie, TX) and Squaw Creek Golf Course (Willow Park, TX); pick the course on New Round or GPS Scouting. It shows each hole on
satellite imagery with mapped outlines for fairway, rough, bunker, water and
green, and a movable target for measuring distances. No GPS is used.

It is a static site with no build step: open `index.html` through any web
server, or host the repo with GitHub Pages.

    python3 -m http.server 8000

## Using it

- **Home**: version number, tee choice and the list of holes.
- **Holes**: each hole is shown with the tee at the bottom and the green at
  the top, with only that hole's fairways, green and tees outlined (plus any
  bunker or water near it). A crosshair dot stays a third of the way down the screen; pan, zoom
  or rotate the map under it to see how far that spot is from the tee, how far
  is left to the pin, and the strokes gained by a tee shot finishing there.
  The top-right corner shows the expected strokes for the hole and a handicap
  dropdown that sets the benchmark. **Lines** shows or hides the outlines.
  **Width** measures the fairway
  along an arc through the crosshair (every point on it is the same distance
  from the tee). **Arc** draws a dispersion arc there, 10 to 80 yards wide in
  total, set with the slider. **Comp** (left side) compares 2–3 clubs on one
  target line: each is drawn as an arc at its yardage, sized to its arc width,
  with the average strokes gained over the spots that arc covers. Drag a club's
  dot to give it its own line (tap it to put it back); lines reset after each shot. The tee and pin dots can be dragged. The tee
  starts on the hole's tee box whose yardage is closest to the scorecard's for
  the chosen tees.
- **Course** (admin accounts only, listed in `config.js` by email hash; the
  Course tab and Edit boundaries are hidden for everyone else, and only an
  admin's saved edits are used): fix or redraw any outline. Anything inside no outline is rough.
- **Edit boundaries** (GPS Scouting, ☰ menu): edits only the boundaries of the hole
  on screen (the ones its map outlines). Tap one to select it, drag the ✥ in its middle to move the
  whole shape, the ⤡ at its corner (or Size − / +) to resize it, drag its white points (drag a small dot
  between two to add a point; tap a point to delete it), change its type,
  cut it in two between two corners (✂ Cut; on the course OB line, a
  cut through OB cuts off the OB beyond it as its own shape, and a cut across
  the course picks the stretch of line between them to drag as one unit), or delete it. A
  cut-out in the course OB is removed by tapping one of its corners, then
  **Delete cutout**. **Draw new boundary** picks a type (fairway, rough, bunker, water,
  recovery, tee box, green, OB) and adds corners where you tap. A rough
  boundary overrides fairway and recovery. Fairways, tee boxes, greens and rough drawn or edited
  there stay tied to that hole. Tee boxes are labelled with the tee sets that play
  from them and their yardage. ‹ › move between holes while editing; one Save keeps the edits
  from every hole on this device.
- **Out of bounds**: everything outside the course boundary (from OpenStreetMap,
  built with `tools/add_ob.py`) is OB, drawn as one white line. A shot finishing
  there is stroke and distance: a penalty stroke and the next shot from the same
  spot (−2 strokes gained), and the SG heat map and Comp arcs score it that way.
- **Stats**: strokes gained per 18 holes by category (off the tee, approach,
  around the green, putting), plus fairways, greens in regulation and putts,
  compared to any handicap level (defaults to the one on your profile).
- **Account**: log in with the same account as the coaching app. Your
  strokes-gained handicap is saved on that shared profile.
- **Settings**: offline imagery, backup, rounds.

## Recording a hole

Tap **+** to record where each shot finished. When a shot reaches the green,
move the crosshair onto the hole and tap **Set pin**; putts are then recorded in
feet. Tap **Holed** to finish. A shot that finishes in water costs a penalty
stroke.

## Accounts and sync

Accounts are the ones in the coaching app's Supabase project (`config.js`).
This app keeps its rounds in its own table there, `shot_tracker_docs`, which is
created once by running the SQL in `SETUP_SQL` (`js/store.js`) in the Supabase
SQL editor. Rounds are saved on the device and synced whenever you are logged
in; each document syncs whole and the most recently changed copy wins.

## Expected strokes

`js/expected-data.js` is generated from the expected-strokes workbook (strokes
to hole out by lie, distance and handicap level):

    python3 tools/build_expected.py expected_strokes.xlsx js/expected-data.js

## Course data

`data/bridlewood.json` is generated from OpenStreetMap by
`tools/build_course.py` (inputs: `tools/bridlewood.osm.json`, an Overpass
export, and `tools/bridlewood.config.json`, the scorecard and fixes).

    python3 tools/build_course.py tools/bridlewood.osm.json tools/bridlewood.config.json data/bridlewood.json

Course outlines © OpenStreetMap contributors (ODbL). Imagery © Esri and its
data providers, loaded from Esri World Imagery at run time.

## Adding a course

1. Export its OpenStreetMap golf features (`nwr["golf"]`, water and the
   `leisure=golf_course` outline) and its roads and buildings with Overpass.
2. Write `tools/<id>.config.json` (pars, handicaps, tees; `courseName` picks
   one course where several share the grounds).
3. `python3 tools/build_course.py <osm> <config> data/<id>.json`, then
   `python3 tools/add_ob.py <osm> <roads_houses> <config> data/<id>.json`.
4. Optional, when OSM is out of date or loose: download the imagery with
   `tools/fetch_tiles.py`, replace the bunkers with the sand it shows using
   `tools/detect_sand.py`, fit the fairways and greens to the turf with
   `tools/trace_turf.py`, then run `add_ob.py` again.
5. `python3 tools/clean_course.py data/<id>.json` merges overlapping outlines.
6. Add it to `COURSES` in `js/app.js`.
