/* ============================================================
   ui-director.js — Director-Feed und ereignisbasierter Zeitraffer.
   ============================================================ */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var UI = root.GameUI, H = root.GameUIInternal;
  if (!UI || !H) throw new Error('ui-director.js muss nach ui.js geladen werden');

  UI.buildDirectorFeed = function () {
    var feed = root.GameDirector.ensure(this.state).feed;
    if (!feed.length) return null;
    var box = H.el('div', { class: 'director-feed', 'aria-label': 'Director-Highlights' });
    feed.slice(0, 5).forEach(function (entry) {
      var copy = entry.type === 'group' ? entry.latest : String(entry.before) + ' → ' + String(entry.after);
      box.appendChild(H.el('div', { class: 'director-entry' + (entry.important ? ' important' : '') }, [
        H.el('span', { class: 'director-icon', text: entry.icon }),
        H.el('div', { class: 'director-copy' }, [
          H.el('b', { text: entry.title }),
          H.el('small', { text: copy })
        ]),
        H.el('span', { class: 'director-tick', text: 'T+' + (entry.lastTick == null ? entry.tick : entry.lastTick) })
      ]));
    });
    return box;
  };

  UI.fastForwardUntil = function (mode) {
    var result = root.GameDirector.runUntil(this.state, mode, 1200);
    if (result.reason === 'decision') this.state.settings.watch = false;
    var labels = { milestone: 'Meilenstein', decision: 'Entscheidung', raid: 'Risiko', expedition: 'Risiko', combat: 'Risiko', limit: 'Limit' };
    H.toast('⏩ ' + result.ticks + ' Ticks · ' + (labels[result.reason] || result.reason), result.reason === 'limit' ? '' : 'gold');
    this.commit();
    return result;
  };
})();
