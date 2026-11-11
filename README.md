# Shot Tracker

A golf stat tracker for Bridlewood Golf Club (Flower Mound, TX). Tap where each
shot finished on a satellite map; the app works out the lie (fairway, rough,
bunker, water, green) from mapped course outlines and computes strokes gained.
No GPS is used.

It is a static site with no build step: open `index.html` through any web
server, or host the repo with GitHub Pages.

    python3 -m http.server 8000

## Using it

- **Rounds**: pick a date and tees, then *New round*.
- **Playing a hole**: the tee marker (1) and the pin are placed for you; drag
  either to the real position (tee positions are remembered per tee set).
  Tap where each shot finished. A tap in water adds a penalty stroke and asks
  for the drop spot. On the green, set the putt length in feet, then *Holed* or
  *+ Putt*. *OB / lost* adds a penalty and replays from the same spot. The lie
  of any shot can be overridden in the shot list.
- **Stats**: strokes gained per 18 holes by category (off the tee, approach,
  around the green, putting), by distance, and per round. The baseline is PGA
  Tour averages.
- **Course**: fix or redraw any outline. Anything inside no outline is rough.
- **Settings**: sync, offline imagery, backup, delete rounds.

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
