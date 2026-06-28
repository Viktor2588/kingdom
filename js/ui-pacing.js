/* ============================================================
   ui-pacing.js — einklappbares Entwickler-Dashboard für Pacing.
   ============================================================ */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var UI = root.GameUI;
  if (!UI) throw new Error('ui-pacing.js muss nach ui.js geladen werden');
  var H = root.GameUIInternal;

  function stallLabel(kind) {
    return ({
      warming_up: 'Startphase', healthy: 'Fluss stabil', saving: 'Bewusstes Sparen',
      decision_wait: 'Entscheidung offen', missing_resource: 'Ressource fehlt',
      cost_too_high: 'Kostenblocker', wrong_auto_priority: 'Auto-Priorität',
      locked_ui_path: 'UI-Pfad gesperrt', unsolvable_achievement: 'Completion blockiert',
      quest_stalled: 'Quest hängt', over_capacity: 'Über Kapazität', content_gap: 'Content-Lücke'
    })[kind] || kind;
  }

  UI.togglePacingOverlay = function () {
    var pacing = root.GamePacing.ensure(this.state);
    pacing.overlay = !pacing.overlay;
    this.commit();
  };
  UI.buildPacingOverlay = function () {
    var self = this, pacing = root.GamePacing.ensure(this.state);
    if (!pacing.overlay) return null;
    var report = root.GamePacing.report(this.state);
    var rows = H.el('div', { class: 'pacing-events' });
    report.events.forEach(function (event) {
      rows.appendChild(H.el('div', { class: 'pacing-event' }, [
        H.el('span', { text: event.label }),
        H.el('b', { text: event.since + ' T' }),
        H.el('small', { text: event.averageGap == null ? 'noch kein Abstand' : ('Ø ' + event.averageGap + ' · max ' + event.maxGap) })
      ]));
    });
    var actions = report.actions.slice(0, 5).map(function (entry) {
      return entry.id + ' ' + Math.round(entry.share * 100) + '%';
    }).join(' · ') || 'noch keine Auto-Aktionen';
    var blockers = report.blockers.length
      ? report.blockers.slice(0, 3).map(function (entry) { return H.el('li', { text: entry.detail }); })
      : [H.el('li', { text: 'Keine Blocker erkannt.' })];
    return H.el('section', { class: 'pacing-overlay', 'aria-label': 'Pacing-Dashboard' }, [
      H.el('div', { class: 'pacing-head' }, [
        H.el('div', null, [
          H.el('span', { class: 'section-label', text: 'PACING · TICK ' + report.tick }),
          H.el('div', { class: 'pacing-status', text: stallLabel(report.stall.kind) })
        ]),
        H.btn('✕', function () { self.togglePacingOverlay(); }, { small: true, cls: 'btn-ghost' })
      ]),
      H.el('p', { class: 'muted pacing-detail', text: report.stall.detail }),
      rows,
      H.el('div', { class: 'pacing-summary' }, [
        H.el('b', { text: 'Auto-Aktionen' }),
        H.el('span', { text: actions })
      ]),
      H.el('ul', { class: 'pacing-blockers' }, blockers)
    ]);
  };
})();
