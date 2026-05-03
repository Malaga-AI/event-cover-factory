#!/usr/bin/env node
/**
 * Event Cover Factory – Generator
 * Usage: node scripts/generate.js <input-dir> [template] [output-path]
 *
 * Example:
 *   node scripts/generate.js input/01-community-session-sample
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');
const zlib = require('zlib');

function renderToPng(chromePath, htmlFile, pngFile, userDataDir, w, h) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      `--screenshot=${pngFile}`,
      `--window-size=${w},${h}`,
      '--hide-scrollbars',
      '--disable-gpu',
      '--no-sandbox',
      '--force-device-scale-factor=1',
      `--user-data-dir=${userDataDir}`,
      '--disable-component-update',
      '--disable-background-networking',
      '--no-first-run',
      '--no-default-browser-check',
      `file://${htmlFile}`
    ];
    const proc = spawn(chromePath, args, { stdio: 'ignore', detached: true });
    proc.unref();

    // Poll for the screenshot file
    const start = Date.now();
    const timeout = 30000;
    const tick = () => {
      if (fs.existsSync(pngFile) && fs.statSync(pngFile).size > 1000) {
        // file stable check
        const sizeA = fs.statSync(pngFile).size;
        setTimeout(() => {
          if (!fs.existsSync(pngFile)) return reject(new Error('PNG vanished'));
          const sizeB = fs.statSync(pngFile).size;
          if (sizeA === sizeB) {
            try { process.kill(-proc.pid, 'SIGKILL'); } catch {}
            try { proc.kill('SIGKILL'); } catch {}
            resolve();
          } else {
            setTimeout(tick, 200);
          }
        }, 300);
      } else if (Date.now() - start > timeout) {
        try { process.kill(-proc.pid, 'SIGKILL'); } catch {}
        try { proc.kill('SIGKILL'); } catch {}
        reject(new Error('Chrome screenshot timed out'));
      } else {
        setTimeout(tick, 200);
      }
    };
    tick();
  });
}

function cropPng(src, dst, targetW, targetH) {
  const data = fs.readFileSync(src);
  let idx = 8;
  const chunks = {};
  while (idx < data.length) {
    const len = data.readUInt32BE(idx);
    const type = data.slice(idx + 4, idx + 8).toString('ascii');
    const chunk = data.slice(idx + 8, idx + 8 + len);
    (chunks[type] = chunks[type] || []).push(chunk);
    idx += 12 + len;
  }
  const ihdr = chunks['IHDR'][0];
  const W = ihdr.readUInt32BE(0), H = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8], colorType = ihdr[9];
  const channels = { 2: 3, 6: 4 }[colorType] || 3;
  const rowSize = W * channels;

  const raw = zlib.inflateSync(Buffer.concat(chunks['IDAT']));
  // keep only targetH rows
  const cropH = Math.min(targetH, H);
  const cropRows = raw.slice(0, cropH * (rowSize + 1));
  const newIdat = zlib.deflateSync(cropRows);

  function chunk(type, payload) {
    const buf = Buffer.alloc(12 + payload.length);
    buf.writeUInt32BE(payload.length, 0);
    buf.write(type, 4, 'ascii');
    payload.copy(buf, 8);
    const crc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), payload]));
    buf.writeUInt32BE(crc, 8 + payload.length);
    return buf;
  }
  function crc32(buf) {
    const table = crc32.table || (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c;
      }
      return t;
    })());
    let c = 0xFFFFFFFF;
    for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const newIhdr = Buffer.alloc(13);
  newIhdr.writeUInt32BE(targetW, 0);
  newIhdr.writeUInt32BE(cropH, 4);
  ihdr.copy(newIhdr, 8, 8, 13);

  const out = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', newIhdr),
    chunk('IDAT', newIdat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(dst, out);
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.resolve(__dirname, '..');

const inputDir = path.resolve(process.argv[2] || path.join(ROOT, 'input/01-community-session-sample'));
const data = JSON.parse(fs.readFileSync(path.join(inputDir, 'data.json'), 'utf8'));

const templateName = process.argv[3] || `${data.type || 'community'}-session`;
const templatePath = path.join(ROOT, 'template', `${templateName}.html`);
const outputPath = process.argv[4] || path.join(ROOT, 'output', `${path.basename(inputDir)}.png`);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

function toBase64(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
}

// Resolve speaker photo: tries <firstName>.png (case-insensitive) in input dir
function resolvePhoto(speaker) {
  if (speaker.photo) return path.join(inputDir, speaker.photo);
  const firstName = speaker.name.split(/\s+/)[0].toLowerCase();
  const candidates = fs.readdirSync(inputDir).filter(f =>
    f.toLowerCase() === `${firstName}.png` ||
    f.toLowerCase() === `${firstName}.jpg`
  );
  if (candidates.length) return path.join(inputDir, candidates[0]);
  return null;
}

// Build speaker card HTML for each speaker
function speakerCardHTML(speaker) {
  const photoPath = resolvePhoto(speaker);
  const photoSrc = photoPath ? toBase64(photoPath) : '';
  const photoTag = photoSrc
    ? `<img src="${photoSrc}" alt="${speaker.name}" />`
    : `<div style="width:100%;height:100%;background:#ddd;"></div>`;

  return `<div class="speaker-card">
      <div class="speaker-photo">${photoTag}</div>
      <div class="speaker-info">
        <div class="talk-title">${speaker.talk}</div>
        <div class="speaker-name">${speaker.name}</div>
        <div class="speaker-role">${speaker.role}</div>
      </div>
    </div>`;
}

const VENUE_MAP = {
  marlife: {
    name: 'Marlife Business Hub - Larios',
    logo: 'marlife_logo.png',
    circular: true,
  },
  innovation_campus: {
    name: 'Innovation Campus',
    logo: 'innovation_campus_logo.png',
    circular: false,
  },
};

let html = fs.readFileSync(templatePath, 'utf8');
const type = data.type || 'community';

if (type === 'community') {
  const cardHTMLs = data.speakers.map(s => speakerCardHTML(s));
  const speakerCards = cardHTMLs.join('\n    <div class="divider"></div>\n    ');

  html = html
    .replace('{{BACKGROUND_IMAGE}}', toBase64(path.join(ROOT, 'sources/background_community_session.png')))
    .replace('{{MALAGA_LOGO}}', toBase64(path.join(ROOT, 'sources/logo_horizontal.png')))
    .replace('{{SPONSOR_LOGO}}', toBase64(path.join(ROOT, 'sources/grupo_billingham_sponsor.png')))
    .replace('{{DATE}}', data.date)
    .replace('{{HOUR}}', data.hour)
    .replace('{{VENUE}}', data.venue)
    .replace('{{SPEAKER_CARDS}}', speakerCards);
} else if (type === 'networking') {
  const venue = VENUE_MAP[data.venue];
  if (!venue) throw new Error(`Unknown venue "${data.venue}". Known: ${Object.keys(VENUE_MAP).join(', ')}`);

  const monthRaw = (data.month || '').trim();
  const monthParts = monthRaw.split(/\s+/);
  const monthTop = monthParts[0] || '';
  const monthBottom = monthParts.slice(1).join(' ');

  const tagline = data.tagline || 'Connect with AI enthusiasts and industry professionals in Málaga';

  html = html
    .replace('{{SIDE_PHOTO}}', toBase64(path.join(ROOT, 'sources/side_panel_networking_session.png')))
    .replace('{{MALAGA_LOGO_VERTICAL}}', toBase64(path.join(ROOT, 'sources/logo_vertical.png')))
    .replace('{{SPONSOR_LOGO}}', toBase64(path.join(ROOT, 'sources/grupo_billingham_sponsor.png')))
    .replace('{{VENUE_LOGO}}', toBase64(path.join(ROOT, 'sources', venue.logo)))
    .replace('{{VENUE_LOGO_CLASS}}', venue.circular ? 'circular' : '')
    .replace('{{VENUE_NAME}}', venue.name)
    .replace('{{MONTH_TOP}}', monthTop)
    .replace('{{MONTH_BOTTOM}}', monthBottom)
    .replace('{{TAGLINE}}', tagline)
    .replace('{{DATE}}', data.date)
    .replace('{{TIME}}', data.time);
} else {
  throw new Error(`Unknown type "${type}"`);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-poster-'));
const tmpHtml = path.join(tmpDir, 'poster.html');
const tmpUserData = path.join(tmpDir, 'chrome-user-data');
fs.mkdirSync(tmpUserData, { recursive: true });
fs.writeFileSync(tmpHtml, html, 'utf8');

// Save debug copy of generated HTML
const debugHtml = path.join(ROOT, 'output', path.basename(outputPath, '.png') + '-debug.html');
fs.writeFileSync(debugHtml, html, 'utf8');
console.log(`Debug HTML saved: ${debugHtml}`);

// Chrome's headless viewport is smaller than --window-size, so render into a
// generously-tall window then crop the PNG to POSTER_H.
const POSTER_W = 2160;
const POSTER_H = 1080;
const RENDER_H = 1500;        // window-size height (must be > POSTER_H)
const tmpPng = path.join(tmpDir, 'raw.png');

console.log(`Rendering ${templateName} → ${outputPath}`);

(async () => {
  await renderToPng(CHROME, tmpHtml, tmpPng, tmpUserData, POSTER_W, RENDER_H);
  cropPng(tmpPng, outputPath, POSTER_W, POSTER_H);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('Done.');
})().catch(err => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});
