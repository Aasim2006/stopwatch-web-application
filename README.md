# Chronograph — Precision Stopwatch Web App

A production-quality stopwatch web application built with **semantic HTML5, modern CSS3, and vanilla JavaScript** — no frameworks, no build step, no dependencies. Designed with a dark glassmorphism aesthetic and instrument-style typography to feel like a real digital chronograph.

## ✨ Features

### Core
- Start, Pause, Resume, and Reset the stopwatch
- Time displayed as `HH:MM:SS.MS`
- Unlimited lap recording with per-lap split time and running total
- Accurate timing via `performance.now()` + `requestAnimationFrame` (immune to `setInterval` drift)
- Guarded state machine that makes it impossible to run more than one timer loop at once

### UI / UX
- Glassmorphism cards over an animated gradient + ambient glow background
- Dark theme with a cyan/amber/rose accent system
- Smooth entrance, hover, and lap-insertion animations
- Ripple effect on every button press
- Fully responsive: mobile, tablet, and desktop layouts
- Accessible: ARIA labels, `aria-live` status/lap regions, visible focus rings, `prefers-reduced-motion` support

### Extras
- Live **Running / Paused / Idle** status indicator
- Total lap counter
- Automatic **fastest** / **slowest** lap highlighting (once 2+ laps exist)
- Auto-scroll to the newest lap
- Keyboard shortcuts:
  | Key | Action |
  |-----|--------|
  | `Space` | Start / Pause |
  | `L` | Record lap |
  | `R` | Reset (opens confirmation) |
  | `Esc` | Close the reset confirmation dialog |
- Confirmation dialog before destructive reset
- Session (elapsed time + lap history) persisted to `localStorage`, restored on reload
- One-click **CSV export** of full lap history

## 📁 Project Structure

```
├── index.html    # Semantic markup & structure
├── style.css     # Design tokens, layout, glassmorphism, animations
├── script.js     # Timer engine, lap logic, rendering, events
└── README.md     # This file
```

## 🚀 Getting Started

No build tools or package manager required.

1. Download/clone the three files (`index.html`, `style.css`, `script.js`) into the same folder.
2. Open `index.html` directly in any modern browser, **or** serve it locally:

   ```bash
   # Python 3
   python -m http.server 8000

   # or Node
   npx serve .
   ```
3. Navigate to `http://localhost:8000`.

## 🧠 How the Timing Works

Instead of relying on `setInterval` (which drifts under tab-throttling and long-running sessions), the stopwatch tracks:

- `accumulatedMs` — time locked in from all previously completed run segments
- `segmentStart` — the `performance.now()` timestamp when the *current* run segment began

The displayed time is always `accumulatedMs + (performance.now() - segmentStart)` while running, recalculated every animation frame. This keeps the readout accurate to the millisecond regardless of frame-rate hiccups, and pausing simply folds the current segment into `accumulatedMs`.

A single `rafId` reference is used as a lock — `start()` always cancels any existing frame loop before creating a new one, so it's structurally impossible to have two timers ticking simultaneously.

## ♿ Accessibility

- Semantic landmarks (`<main>`, `<section>`, `<header>`) and descriptive `aria-label`s on every control
- Live regions (`aria-live="polite"`) for status changes and new laps
- Full keyboard operability, with a visible focus outline on every interactive element
- The reset dialog uses `role="alertdialog"` with `aria-modal`, `aria-labelledby`, and `aria-describedby`
- Respects `prefers-reduced-motion` by disabling non-essential animation

## 🌐 Browser Support

Tested against current versions of Chrome, Firefox, Safari, and Edge. Uses only widely-supported standard Web APIs: `performance.now`, `requestAnimationFrame`, `localStorage`, `Blob`/`URL.createObjectURL`, and CSS `backdrop-filter` (with `-webkit-` fallback for Safari).

## 🛠️ Tech Notes

- **Fonts:** "Space Mono" for the tabular numeric readout (instrument feel), "Inter" for UI chrome.
- **No external JS dependencies.** All CSV export and persistence logic uses native browser APIs.
- Code is organized into clearly commented sections (state, persistence, formatting, timer engine, laps, rendering, UI utilities, event wiring) for easy review and extension.

---

Built as a demonstration of production-ready frontend engineering practices: accurate timing logic, accessible markup, resilient state handling, and a polished, original visual identity.
