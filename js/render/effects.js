/* ============================================================
   effects.js — Kleine, zustandslose Animations-Timeline.
   Animation bestätigt nur bereits berechnete Kampfergebnisse.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;

  var durations = { move: 360, attack: 320, magic: 460, hit: 260, heal: 420, death: 520 };
  function clamp01(n) { return Math.max(0, Math.min(1, n)); }
  function easeOut(n) { n = clamp01(n); return 1 - Math.pow(1 - n, 3); }
  function easeInOut(n) { n = clamp01(n); return n < 0.5 ? 2 * n * n : 1 - Math.pow(-2 * n + 2, 2) / 2; }

  function createTimeline(events, mode) {
    var queue = Array.isArray(events) ? events.slice(0, 12) : [];
    var factor = mode === 'reduced' ? 0.5 : 1;
    if (mode === 'off') queue = [];
    var startedAt = null, total = 0, spans = [];
    queue.forEach(function (event) {
      var duration = Math.max(80, (durations[event.type] || 300) * factor);
      spans.push({ event: event, start: total, end: total + duration, duration: duration });
      total += duration;
    });

    function sample(now) {
      if (!spans.length) return { done: true, progress: 1, event: null };
      if (startedAt == null) startedAt = now;
      var elapsed = Math.max(0, now - startedAt), current = spans[spans.length - 1];
      for (var i = 0; i < spans.length; i++) { if (elapsed <= spans[i].end) { current = spans[i]; break; } }
      var progress = clamp01((elapsed - current.start) / current.duration);
      return { done: elapsed >= total, progress: progress, event: current.event, index: spans.indexOf(current), elapsed: elapsed };
    }

    return { sample: sample, active: function () { return spans.length > 0; }, duration: total };
  }

  root.GameCanvasEffects = { createTimeline: createTimeline, easeOut: easeOut, easeInOut: easeInOut };
})();
