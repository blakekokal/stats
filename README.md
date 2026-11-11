# Shot Tracker

A golf stat tracker for Bridlewood Golf Club (Flower Mound, TX). It shows each hole on
satellite imagery with mapped outlines for fairway, rough, bunker, water and
green, and a movable target for measuring distances. No GPS is used.

It is a static site with no build step: open `index.html` through any web
server, or host the repo with GitHub Pages.

    python3 -m http.server 8000

## Using it

- **Home**: version number, tee choice and the list of holes.
- **Holes**: each hole is shown with the tee at the bottom and the green at
  the top. A crosshair dot stays a third of the way down the screen; pan, zoom
  or rotate the map under it to see how far that spot is from the tee, how far
  is left to the pin, and the strokes gained by a tee shot finishing there.
  The top-right corner shows the expected strokes for the hole and a handicap
  dropdown that sets the benchmark. **Width** measures the fairway
  along an arc through the crosshair (every point on it is the same distance
  from the tee). **Arc** draws a dispersion arc there, 10 to 80 yards wide in
  total, set with the slider. The tee and pin dots can be dragged; tee
  positions are remembered per tee set.
- **Course**: fix or redraw any outline. Anything inside no outline is rough.
- **Settings**: sync, offline imagery, backup.

Shot logging and strokes-gained stats are switched off for now; their code
(`js/model.js`, `js/sg.js`, `js/stats.js`) is kept for when they return.

## Sync across devices

Rounds are stored on the device and, optionally, synced through a free
[Supabase](https://supabase.com) project:

1. Create a project and run the SQL shown under Settings → Sync in its SQL editor.
2. Put the project URL and anon key in `config.js` (or enter them per device in Settings).
3. Create an account in Settings on one device and sign in on the others.

Each document (a round, the outline edits, settings) syncs whole; the most
recently changed copy wins.

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
