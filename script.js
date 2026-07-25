/* =========================================================================
   CHRONOGRAPH — Stopwatch Web App
   Clean, modular vanilla JavaScript.
   Sections:
     1. DOM references
     2. State
     3. Persistence (localStorage)
     4. Time formatting helpers
     5. Core timer engine (start / pause / resume / reset)
     6. Lap tracking
     7. Rendering
     8. UI utilities (ripple, toast, dialog)
     9. Event wiring (mouse + keyboard)
   ========================================================================= */

'use strict';

(() => {

  /* ----------------------------------------------------------------------
     1. DOM references
     ---------------------------------------------------------------------- */
  const els = {
    hours: document.getElementById('hours'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
    milliseconds: document.getElementById('milliseconds'),
    readout: document.getElementById('timeReadout'),

    statusIndicator: document.getElementById('statusIndicator'),
    statusDot: document.getElementById('statusDot'),
    statusLabel: document.getElementById('statusLabel'),

    startPauseBtn: document.getElementById('startPauseBtn'),
    startPauseLabel: document.getElementById('startPauseLabel'),
    startIcon: document.getElementById('startIcon'),
    pauseIcon: document.getElementById('pauseIcon'),
    lapBtn: document.getElementById('lapBtn'),
    resetBtn: document.getElementById('resetBtn'),
    exportBtn: document.getElementById('exportBtn'),

    lapsList: document.getElementById('lapsList'),
    lapsEmpty: document.getElementById('lapsEmpty'),
    lapCounter: document.getElementById('lapCounter'),

    dialogBackdrop: document.getElementById('dialogBackdrop'),
    dialogCancel: document.getElementById('dialogCancel'),
    dialogConfirm: document.getElementById('dialogConfirm'),

    toast: document.getElementById('toast'),
  };

  const STORAGE_KEY = 'chronograph.session.v1';

  /* ----------------------------------------------------------------------
     2. State
     ---------------------------------------------------------------------- */
  // timerState: 'ready' | 'running' | 'paused'
  let timerState = 'ready';

  // accumulatedMs: total elapsed time locked in from previous run segments
  // segmentStart: performance.now() timestamp when the current running segment began
  let accumulatedMs = 0;
  let segmentStart = null;

  // rafId guards against ever having more than one animation-frame loop
  // running at the same time (prevents "multiple timers" bugs).
  let rafId = null;

  // laps: { number, splitMs, totalMs }
  let laps = [];

  /* ----------------------------------------------------------------------
     3. Persistence — localStorage
     ---------------------------------------------------------------------- */
  function saveSession() {
    try {
      const payload = {
        accumulatedMs: getElapsedMs(),
        laps,
        timerState: timerState === 'running' ? 'paused' : timerState, // never persist mid-run tick
        savedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      // localStorage may be unavailable (e.g. private browsing quota) — fail silently
      console.warn('Chronograph: could not save session', err);
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.accumulatedMs === 'number') accumulatedMs = data.accumulatedMs;
      if (Array.isArray(data.laps)) laps = data.laps;
      if (data.timerState === 'paused' && accumulatedMs > 0) {
        timerState = 'paused';
      }
    } catch (err) {
      console.warn('Chronograph: could not load session', err);
    }
  }

  /* ----------------------------------------------------------------------
     4. Time formatting helpers
     ---------------------------------------------------------------------- */
  function pad(num, size = 2) {
    return String(num).padStart(size, '0');
  }

  // Splits a millisecond count into { h, m, s, ms }
  function splitMs(totalMs) {
    const ms = Math.floor(totalMs % 1000);
    const totalSeconds = Math.floor(totalMs / 1000);
    const s = totalSeconds % 60;
    const m = Math.floor(totalSeconds / 60) % 60;
    const h = Math.floor(totalSeconds / 3600);
    return { h, m, s, ms };
  }

  function formatHMS(totalMs) {
    const { h, m, s } = splitMs(totalMs);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function formatFull(totalMs) {
    const { h, m, s, ms } = splitMs(totalMs);
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
  }

  /* ----------------------------------------------------------------------
     5. Core timer engine
     ---------------------------------------------------------------------- */

  // Returns the true elapsed time right now, accounting for whether we're
  // mid-segment (running) or stopped (idle/paused).
  function getElapsedMs() {
    if (timerState === 'running' && segmentStart !== null) {
      return accumulatedMs + (performance.now() - segmentStart);
    }
    return accumulatedMs;
  }

  function tick() {
    if (timerState !== 'running') return; // safety guard
    renderTime(getElapsedMs());
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (timerState === 'running') return; // prevent double-start / duplicate loops
    timerState = 'running';
    segmentStart = performance.now();

    // Belt-and-braces: cancel any stray loop before starting a fresh one,
    // guaranteeing only a single animation-frame timer is ever active.
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);

    updateControlsUI();
    updateStatusUI();
  }

  function pause() {
    if (timerState !== 'running') return;
    accumulatedMs += performance.now() - segmentStart;
    segmentStart = null;
    timerState = 'paused';

    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    renderTime(accumulatedMs);
    updateControlsUI();
    updateStatusUI();
    saveSession();
  }

  function resetTimer() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    timerState = 'Ready';
    accumulatedMs = 0;
    segmentStart = null;
    laps = [];

    renderTime(0);
    renderLaps();
    updateControlsUI();
    updateStatusUI();
    saveSession();
    showToast('Stopwatch reset');
  }

  /* ----------------------------------------------------------------------
     6. Lap tracking
     ---------------------------------------------------------------------- */
  function recordLap() {
    if (timerState !== 'running') return;
    const totalMs = getElapsedMs();
    const previousTotal = laps.length ? laps[laps.length - 1].totalMs : 0;
    const splitMsVal = totalMs - previousTotal;

    laps.push({
      number: laps.length + 1,
      splitMs: splitMsVal,
      totalMs,
    });

    renderLaps();
    saveSession();
  }

  /* ----------------------------------------------------------------------
     7. Rendering
     ---------------------------------------------------------------------- */
  function renderTime(totalMs) {
    const { h, m, s, ms } = splitMs(totalMs);
    els.hours.textContent = pad(h);
    els.minutes.textContent = pad(m);
    els.seconds.textContent = pad(s);
    els.milliseconds.textContent = pad(ms, 3);
  }

  function updateStatusUI() {
    els.statusIndicator.classList.remove('is-running', 'is-paused');
    els.readout.classList.remove('is-running');

    if (timerState === 'running') {
      els.statusIndicator.classList.add('is-running');
      els.statusLabel.textContent = 'Running';
      els.readout.classList.add('is-running');
    } else if (timerState === 'paused') {
      els.statusIndicator.classList.add('is-paused');
      els.statusLabel.textContent = 'Paused';
    } else {
      els.statusLabel.textContent = 'Ready';
    }
  }

  function updateControlsUI() {
    const isRunning = timerState === 'running';

    els.startIcon.hidden = isRunning;
    els.pauseIcon.hidden = !isRunning;
    els.startPauseLabel.textContent = isRunning ? 'Pause' : (timerState === 'paused' ? 'Resume' : 'Start');
    els.startPauseBtn.setAttribute('aria-label', isRunning ? 'Pause stopwatch' : 'Start stopwatch');
    els.startPauseBtn.classList.toggle('is-paused-state', timerState === 'paused');

    els.lapBtn.disabled = !isRunning;
    els.resetBtn.disabled = timerState === 'Ready' && laps.length === 0 && accumulatedMs === 0;
    els.exportBtn.disabled = laps.length === 0;
  }

  function renderLaps() {
    // Clear existing lap items (keep the empty-state node around for reuse)
    els.lapsList.querySelectorAll('.lap-item').forEach((node) => node.remove());

    els.lapsEmpty.hidden = laps.length > 0;
    els.lapCounter.textContent = `${laps.length} lap${laps.length === 1 ? '' : 's'}`;
    els.exportBtn.disabled = laps.length === 0;

    if (laps.length === 0) return;

    // Determine fastest / slowest splits (only meaningful with 2+ laps)
    let fastestNum = null;
    let slowestNum = null;
    if (laps.length > 1) {
      let fastest = laps[0];
      let slowest = laps[0];
      for (const lap of laps) {
        if (lap.splitMs < fastest.splitMs) fastest = lap;
        if (lap.splitMs > slowest.splitMs) slowest = lap;
      }
      fastestNum = fastest.number;
      slowestNum = slowest.number;
    }

    const fragment = document.createDocumentFragment();

    // Show most recent lap first for quick scanning
    [...laps].reverse().forEach((lap) => {
      const li = document.createElement('li');
      li.className = 'lap-item';
      li.dataset.lapNumber = String(lap.number);

      if (lap.number === fastestNum) li.classList.add('is-fastest');
      if (lap.number === slowestNum) li.classList.add('is-slowest');

      const badge = lap.number === fastestNum
        ? '<span class="lap-item__badge">Fastest</span>'
        : lap.number === slowestNum
          ? '<span class="lap-item__badge">Slowest</span>'
          : '';

      li.innerHTML = `
        <span class="lap-item__index">#${pad(lap.number)}</span>
        <span class="lap-item__times">
          <span class="lap-item__split">${formatFull(lap.splitMs)}</span>
          <span class="lap-item__total">Total ${formatHMS(lap.totalMs)}</span>
        </span>
        ${badge}
      `;

      fragment.appendChild(li);
    });

    els.lapsList.insertBefore(fragment, els.lapsEmpty);

    // Auto-scroll so the newest lap (rendered at the top) is visible
    els.lapsList.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ----------------------------------------------------------------------
     8. UI utilities — ripple, toast, confirmation dialog
     ---------------------------------------------------------------------- */
  function attachRipple(button) {
    button.addEventListener('click', (e) => {
      const rect = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      const size = Math.max(rect.width, rect.height);
      ripple.className = 'ripple';
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      button.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  }

  let toastTimeout = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      els.toast.classList.remove('is-visible');
    }, 2200);
  }

  function openResetDialog() {
    // Nothing to confirm if there's nothing to lose
    if (timerState === 'Ready' && accumulatedMs === 0 && laps.length === 0) return;
    els.dialogBackdrop.hidden = false;
    els.dialogConfirm.focus();
  }

  function closeResetDialog() {
    els.dialogBackdrop.hidden = true;
    els.startPauseBtn.focus();
  }

  /* ----------------------------------------------------------------------
     9. CSV export
     ---------------------------------------------------------------------- */
  function exportLapsAsCSV() {
    if (laps.length === 0) return;

    const header = ['Lap', 'Split Time (HH:MM:SS.ms)', 'Total Time (HH:MM:SS.ms)'];
    const rows = laps.map((lap) => [lap.number, formatFull(lap.splitMs), formatFull(lap.totalMs)]);

    const csvContent = [header, ...rows]
      .map((row) => row.join(','))
      .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

    link.href = url;
    link.download = `chronograph-laps-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Lap history exported as CSV');
  }

  /* ----------------------------------------------------------------------
     10. Event wiring
     ---------------------------------------------------------------------- */
  function toggleStartPause() {
    if (timerState === 'running') {
      pause();
    } else {
      start();
    }
  }

  function handleResetClick() {
    openResetDialog();
  }

  [els.startPauseBtn, els.lapBtn, els.resetBtn, els.exportBtn].forEach(attachRipple);

  els.startPauseBtn.addEventListener('click', toggleStartPause);
  els.lapBtn.addEventListener('click', recordLap);
  els.resetBtn.addEventListener('click', handleResetClick);
  els.exportBtn.addEventListener('click', exportLapsAsCSV);

  els.dialogCancel.addEventListener('click', closeResetDialog);
  els.dialogConfirm.addEventListener('click', () => {
    closeResetDialog();
    resetTimer();
  });
  els.dialogBackdrop.addEventListener('click', (e) => {
    if (e.target === els.dialogBackdrop) closeResetDialog();
  });

  // Keyboard shortcuts: Space = Start/Pause, R = Reset, L = Lap, Esc = close dialog
  document.addEventListener('keydown', (e) => {
    const dialogOpen = !els.dialogBackdrop.hidden;

    if (dialogOpen) {
      if (e.key === 'Escape') { closeResetDialog(); e.preventDefault(); }
      if (e.key === 'Enter') { closeResetDialog(); resetTimer(); e.preventDefault(); }
      return;
    }

    switch (e.key.toLowerCase()) {
      case ' ':
        e.preventDefault(); // stop page scroll
        toggleStartPause();
        break;
      case 'l':
        if (!els.lapBtn.disabled) recordLap();
        break;
      case 'r':
        handleResetClick();
        break;
      default:
        break;
    }
  });

  // Persist periodically while running, and on tab close
  window.addEventListener('beforeunload', saveSession);

  /* ----------------------------------------------------------------------
     Init
     ---------------------------------------------------------------------- */
  function init() {
    loadSession();
    renderTime(getElapsedMs());
    renderLaps();
    updateControlsUI();
    updateStatusUI();
  }

  init();

})();
