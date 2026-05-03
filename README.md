# Event Cover Factory

Generate 2160×1080 PNG covers for Málaga AI events from a JSON spec and an HTML template.

## Requirements

- Node.js (no npm dependencies — uses built-ins only)
- Google Chrome installed at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (used in headless mode for rendering)

## Usage

```bash
node scripts/generate.js <input-dir> [template] [output-path]
```

- `<input-dir>`: folder containing a `data.json` (and any speaker photos). Defaults to `input/01-community-session-sample`.
- `[template]`: template basename in `template/` (without `.html`). Defaults to `<data.type>-session`.
- `[output-path]`: PNG path. Defaults to `output/<input-dir-name>.png`.

Examples:

```bash
node scripts/generate.js input/01-community-session-sample
node scripts/generate.js input/02-networking-night-sample
node scripts/generate.js input/03-panel-sample
```

Each run also writes a `<name>-debug.html` next to the PNG so you can open the rendered HTML in a browser to inspect layout.

## How it works

1. Reads `data.json` from the input directory.
2. Picks `template/<type>-session.html` based on `data.type` (`community` or `networking`).
3. Inlines all images as base64 (backgrounds, logos from `sources/`, and speaker photos from the input dir) and substitutes `{{PLACEHOLDERS}}` in the template.
4. Renders the HTML with headless Chrome at 2160×1500 and crops to 2160×1080.

## Template types

### `community` → `template/community-session.html`

Used for both regular community sessions (with talk titles) and panels (no talk titles). The `talk` field is optional per speaker — omit it and only the name + role render.

```json
{
  "type": "community",
  "date": "19 February 2026",
  "hour": "18:00",
  "venue": "GSEC - Málaga",
  "speakers": [
    { "name": "Lola Burgueño", "role": "Associate Professor at UMA", "talk": "Low-code, AI and the new era of Software Development" },
    { "name": "Olmo Gallegos", "role": "Senior Android Developer",   "talk": "Mobile Apps with AI using Claude Code" }
  ]
}
```

Panel example (no `talk` fields → titles are omitted, otherwise identical):

```json
{
  "type": "community",
  "date": "26 March 2026",
  "hour": "18:30",
  "venue": "GSEC - Málaga",
  "speakers": [
    { "name": "Dani Ruiz",   "role": "Staff ML Engineer" },
    { "name": "Fran López",  "role": "AI Product Lead" },
    { "name": "Katy Martín", "role": "Head of Data Science" }
  ]
}
```

### `networking` → `template/networking-session.html`

```json
{
  "type": "networking",
  "month": "JAN 2026",
  "venue": "marlife",
  "date": "29 January 2026",
  "time": "18:30h - 20:30h"
}
```

`venue` must be a key in the `VENUE_MAP` defined in `scripts/generate.js` (currently `marlife`, `innovation_campus`). Add new venues there with their logo file (in `sources/`) and whether the logo should be rendered as a circle.

## Speaker photos

For `community` covers (including panel use), drop a photo named `<firstname>.png` (or `.jpg`) into the input directory — e.g. `lola.png` for `Lola Burgueño`. Matching is case-insensitive on the first whitespace-separated token of `name`. You can also set `"photo": "custom-file.png"` in a speaker entry to override.

If no photo is found, a grey placeholder is rendered.

## Adding a new event

1. Create `input/NN-my-event/`.
2. Add `data.json` with the right `type` and fields.
3. Drop speaker photos (`<firstname>.png`) into the same folder.
4. Run `node scripts/generate.js input/NN-my-event`.
5. PNG lands in `output/NN-my-event.png`.

## Layout

```
input/      one folder per event (data.json + photos)
template/   HTML templates with {{PLACEHOLDERS}}
sources/    shared assets (backgrounds, logos, sponsors)
output/     generated PNGs (and debug HTML)
references/ design references for templates
scripts/    generate.js
```
