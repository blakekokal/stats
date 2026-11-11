# Shot Tracker

A golf stat tracker for Bridlewood Golf Club (Flower Mound, TX). It shows each hole on
satellite imagery with mapped outlines for fairway, rough, bunker, water and
green, and a movable target for measuring distances. No GPS is used.

It is a static site with no build step: open `index.html` through any web
server, or host the repo with GitHub Pages.

    python3 -m http.server 8000

## Using it

- **Holes**: each hole is shown with the tee at the bottom and the green at
  the top. A crosshair dot stays at the centre of the screen; pan, zoom or
  rotate the map under it to see how far that spot is from the tee, how far is
  left to the pin, and what it is sitting on. The Width button measures the
  fairway at the crosshair, square to the line from the tee. The tee and pin
  markers can be dragged; tee positions are remembered per tee set. The menu
  button picks the tees.
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

## Course data

`data/bridlewood.json` is generated from OpenStreetMap by
`tools/build_course.py` (inputs: `tools/bridlewood.osm.json`, an Overpass
export, and `tools/bridlewood.config.json`, the scorecard and fixes).

    python3 tools/build_course.py tools/bridlewood.osm.json tools/bridlewood.config.json data/bridlewood.json

Course outlines © OpenStreetMap contributors (ODbL). Imagery © Esri and its
data providers, loaded from Esri World Imagery at run time.
