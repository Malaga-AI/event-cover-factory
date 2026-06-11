# Event Cover Factory

Generate publish-ready covers for Málaga AI events from a JSON spec and an HTML template.

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
node scripts/generate.js input/03-panel-may-2026
node scripts/generate.js input/06-project-showcase-OSC
```

Each run also writes a `<name>-debug.html` next to the PNG so you can open the rendered HTML in a browser to inspect layout.

## How it works

1. Reads `data.json` from the input directory.
2. Picks `template/<type>-session.html` based on `data.type` (`community`, `networking`, or `showcase`).
3. Inlines all images as base64 (backgrounds, logos from `sources/`, and speaker photos from the input dir) and substitutes `{{PLACEHOLDERS}}` in the template.
4. Renders the HTML with headless Chrome at 2160×1500 and crops to 2160×1080.

## Event kinds

Each kind is driven by a `data.json` (selected by its `type` field) and its template in `template/`. See the linked sample input for the exact fields:

- **Community Session** — `community` → [`input/01-community-session-sample/data.json`](input/01-community-session-sample/data.json)
- **Networking Night** — `networking` → [`input/02-networking-night-sample/data.json`](input/02-networking-night-sample/data.json)
- **Expert Panel** — `community` with speakers that omit the `talk` field → [`input/03-panel-may-2026/data.json`](input/03-panel-may-2026/data.json)
- **Project Showcase** — `showcase` → [`input/06-project-showcase-OSC/data.json`](input/06-project-showcase-OSC/data.json)

For `networking`, `venue` must be a key in the `VENUE_MAP` in `scripts/generate.js` (currently `marlife`, `innovation_campus`).

## Speaker photos

For `community` covers (including panel use), drop a photo named `<firstname>.png` (or `.jpg`) into the input directory — e.g. `lola.png` for `Lola Burgueño`. Matching is case-insensitive on the first whitespace-separated token of `name`. You can also set `"photo": "custom-file.png"` in a speaker entry to override.

**Style-guide requirement:** speaker photos must be transparent-background PNG cutouts (subject cut out from its background). This cutout is prepared externally before the file is added to the input folder — the generator does not remove backgrounds.

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
