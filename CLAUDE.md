# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A no-build web app that displays a listening log (text observations) synchronized with audio playback. Pages of log entries appear and fade on a p5.js canvas, with previous pages lingering as ghost layers. Deployed on GitHub Pages.

## No Build System

No package manager, bundler, or build step. Run with `python3 -m http.server 8000` (required for `fetch` to work on `log.txt`), then open `http://localhost:8000`.

## Architecture

Two files:

- `index.html` — HTML structure + CSS only (overlay button, mute, HUD, error display)
- `sketch.js` — everything else: CONFIG, log parser, p5.js sketch, audio/entry logic

### Configuration block (`sketch.js` top)

```javascript
const AUDIO_URL    = '...';    // path or HTTPS URL
const LOG_URL      = 'log.txt';
const TARGET_CHARS = 280;      // characters per page
const FADE_MS      = 1400;     // fade duration (ms)
const GAP_MS       = 700;      // gap between marker/obs layer transitions
const HOLD_MS      = 12000;    // hold time while fully visible
const GHOST_ALPHAS = [0.22, 0.12, 0.06, 0.03]; // opacity of ghost layers
```

### JS pipeline (`sketch.js`)

1. `parseLog` — parses Korean date/time format (`YYYY.M.D 요일`, `HH:MM`)
2. `groupBlocks` — keeps time markers with their observations together
3. `paginate` — splits into pages by `TARGET_CHARS`, respecting block boundaries
4. `computeLayout(segments)` — measures each character with `p.textWidth()`, returns `[{ch, type, x, y}]` array pre-baked for the current canvas size
5. `p.draw()` — state machine: `idle → intro → markers → all → fadeout_obs → fadeout_all → (loop)`

### Animation state machine

Phases managed by `millis()` elapsed time, alpha computed via `p.map()`:

| phase | tA (markers) | oA (observations) | duration |
|---|---|---|---|
| `markers` | 0 → 255 | 0 | FADE_MS + GAP_MS |
| `all` | 255 | 0 → 255 | FADE_MS + HOLD_MS |
| `fadeout_obs` | 255 | 255 → 0 | FADE_MS + GAP_MS |
| `fadeout_all` | 255 → 0 | 0 | FADE_MS |

### Ghost layers

On each page transition, the current layout is pushed into a `ghosts` array with `GHOST_ALPHAS[0]`. Older ghosts shift to dimmer alpha values; beyond `GHOST_ALPHAS.length` they are dropped. Ghosts are recomputed on `windowResized`.

### DOM / canvas split

- p5 canvas: `z-index: 0`, full-screen, handles all text and ghost rendering
- DOM overlay (`#overlay`, `#hud`, `#err`): `z-index: 5–10`, handles entry button, mute, errors
- `sketchInstance.startCycle()` is called from the entry button handler after `document.fonts.ready` resolves

## Log Format

```
2024.3.15 금
06:30 첫 번째 관찰 내용
06:45 두 번째 관찰 내용
```

Blank lines ignored. Date lines detected by regex. `HH:MM` patterns anywhere in a line become time markers.

## Audio Options

- **Local file**: place `seoul_gusan.mp3` alongside `index.html`
- **Live stream**: set `AUDIO_URL` to a full HTTPS URL (mixed-content restrictions require HTTPS on GitHub Pages)
