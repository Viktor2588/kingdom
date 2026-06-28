/* ============================================================
   ui-chronicle.js — Chronikraum, New Game+ und Archivexport
   (Phase 52). Erweitert GameUI über gemeinsame DOM-Helfer.
   ============================================================ */
(function () {
  'use strict';
  var UI = window.GameUI, H = window.GameUIInternal, GST = window.GameState;
  if (!UI || !H || !GST) throw new Error('ui-chronicle.js muss nach ui.js geladen werden');
  var el = H.el, btn = H.btn, bar = H.bar, openModal = H.openModal, toast = H.toast;
  function API() { return window.GameChronicle; }
  function option(value, text, selected) {
    return el('option', { value: value, text: text, selected: selected ? 'selected' : null });
  }
  function downloadArchive(summary) {
    var json = GST.exportChronicleArchive(summary.id);
    if (!json) { toast('Archiv konnte nicht gelesen werden.', 'bad'); return; }
    try {
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = summary.id + '.json';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast('📜 Versiegelten Run exportiert.', 'gold');
    } catch (e) { toast('Archivexport fehlgeschlagen.', 'bad'); }
  }
  function archiveRow(summary) {
    var rare = summary.rarestSpecies;
    return el('div', { class: 'chronicle-archive-row' }, [
      el('span', { class: 'chronicle-archive-icon', text: rare ? rare.icon : '📜' }),
      el('div', { class: 'chronicle-archive-copy' }, [
        el('div', { class: 'name', text: 'Chronik ' + (summary.generation + 1) + ' · ' + summary.challengeName }),
        el('div', { class: 'meta', text: summary.ticks + ' Ticks · Seed ' + summary.seed + ' · ' + summary.deaths + ' Verluste · ' + summary.bossAttempts + ' Bossversuche' })
      ]),
      btn('⬇ Export', function () { downloadArchive(summary); }, { small: true })
    ]);
  }

  Object.assign(UI, {
    buildChronicleMark: function () {
      var chronicle = API().ensure(this.state), selected = API().challenge(this.state), legacy = API().banner(this.state);
      if (!chronicle.generation && selected.id === 'standard' && !legacy) return null;
      return el('div', { class: 'scene-chronicle', 'aria-label': 'Aktiver Chronik-Run' }, [
        el('span', { class: 'scene-chronicle-icon', text: legacy ? legacy.icon : selected.icon }),
        el('span', { text: 'Chronik ' + (chronicle.generation + 1) }),
        el('small', { text: selected.name + ' · ' + chronicle.simSpeed + '×' })
      ]);
    },

    buildChronicleBoard: function () {
      var self = this, state = this.state, api = API(), chronicle = api.ensure(state);
      var selected = api.challenge(state), progress = api.objectiveProgress(state), complete = api.challengeComplete(state);
      var section = el('section', { class: 'chronicle-board', 'aria-label': 'Chronik-Runs' });
      section.appendChild(el('div', { class: 'chronicle-head' }, [
        el('div', null, [
          el('div', { class: 'section-label', text: 'Chronik-Runs' }),
          el('div', { class: 'chronicle-title', text: 'Chronik ' + (chronicle.generation + 1) + ' · ' + selected.name })
        ]),
        el('span', { class: 'pill' + (complete ? ' tag-ok' : ''), text: complete ? 'Versiegelbar' : progress.done + ' / ' + progress.total })
      ]));
      section.appendChild(el('div', { class: 'chronicle-status' }, [
        el('div', null, [el('span', { class: 'meta', text: 'Ziel' }), el('b', { text: selected.objective })]),
        el('div', null, [el('span', { class: 'meta', text: 'Seed' }), el('b', { text: chronicle.seed })]),
        el('div', null, [el('span', { class: 'meta', text: 'Tempo' }), el('b', { text: chronicle.simSpeed + '×' })]),
        el('div', null, [el('span', { class: 'meta', text: 'Versiegelt' }), el('b', { text: chronicle.meta.seals })])
      ]));
      section.appendChild(bar(progress.total ? progress.done / progress.total : 0, complete ? 'good' : 'gold'));
      if (complete) {
        section.appendChild(el('div', { class: 'chronicle-actions' }, [
          btn('📜 Chronik versiegeln', function () { self.openChronicleRunModal(); }, { cls: 'btn-gold' })
        ]));
      }
      var best = chronicle.meta.bestTicks && chronicle.meta.bestTicks[selected.id];
      if (best) section.appendChild(el('div', { class: 'chronicle-best', text: 'Bestzeit · ' + selected.name + ': ' + best + ' Ticks' }));
      var archives = (chronicle.meta.archives || []).slice().reverse();
      if (archives.length) {
        section.appendChild(el('div', { class: 'section-label', text: 'Versiegelte Runs' }));
        var list = el('div', { class: 'chronicle-archives' });
        archives.forEach(function (entry) { list.appendChild(archiveRow(entry)); });
        section.appendChild(list);
      }
      return section;
    },

    openChronicleRunModal: function () {
      var state = this.state, api = API(), chronicle = api.ensure(state);
      if (!api.challengeComplete(state)) { toast('Chronik-Ziel noch nicht abgeschlossen.', 'bad'); return; }
      var content = el('div', { class: 'chronicle-modal-body' });
      var variantSelect = el('select', { class: 'btn chronicle-select', 'aria-label': 'Startlinie' });
      api.availableVariants(state).forEach(function (entry) {
        variantSelect.appendChild(option(entry.id, entry.icon + ' ' + entry.name, entry.id === chronicle.startVariantId));
      });
      var challengeSelect = el('select', { class: 'btn chronicle-select', 'aria-label': 'Challenge' });
      api.CHALLENGES.forEach(function (entry) {
        challengeSelect.appendChild(option(entry.id, entry.icon + ' ' + entry.name, entry.id === 'standard'));
      });
      var challengeInfo = el('p', { class: 'notice chronicle-challenge-info' });
      function updateChallengeInfo() {
        var selected = api.CHALLENGES.filter(function (entry) { return entry.id === challengeSelect.value; })[0];
        challengeInfo.textContent = selected ? selected.desc + ' Ziel: ' + selected.objective + '.' : '';
      }
      challengeSelect.addEventListener('change', updateChallengeInfo);
      var speedSelect = el('select', { class: 'btn chronicle-select', 'aria-label': 'Simulationsgeschwindigkeit' });
      [1, 2, 4].filter(function (speed) { return speed <= api.nextMaxSimSpeed(state); }).forEach(function (speed) {
        speedSelect.appendChild(option(speed, speed + '× Simulation', speed === chronicle.simSpeed));
      });
      var bannerSelect = el('select', { class: 'btn chronicle-select', 'aria-label': 'Chronikbanner' });
      bannerSelect.appendChild(option('', 'Kein Chronikbanner', !chronicle.bannerId));
      Array.from(new Set((chronicle.meta.unlockedBanners || []).concat(state.bosses && state.bosses.hardDefeated || []))).forEach(function (id) {
        var boss = window.GameBosses && window.GameBosses.boss(id);
        if (boss) bannerSelect.appendChild(option(id, boss.icon + ' ' + boss.name, id === chronicle.bannerId));
      });
      var seedInput = el('input', { class: 'btn chronicle-seed', type: 'number', min: '1', max: '2147483646', value: chronicle.seed, 'aria-label': 'Run-Seed' });
      var autoInput = el('input', { type: 'checkbox', id: 'chronicle-auto' });
      content.appendChild(el('div', { class: 'chronicle-options' }, [
        el('label', null, [el('span', { text: 'Startlinie' }), variantSelect]),
        el('label', null, [el('span', { text: 'Challenge' }), challengeSelect]),
        el('label', null, [el('span', { text: 'Simulation' }), speedSelect]),
        el('label', null, [el('span', { text: 'Banner' }), bannerSelect]),
        el('label', null, [el('span', { text: 'Seed' }), seedInput])
      ]));
      updateChallengeInfo();
      content.appendChild(challengeInfo);
      content.appendChild(el('label', { class: 'chronicle-auto' }, [autoInput, el('span', { text: 'Zuschauer-Modus direkt starten' })]));
      content.appendChild(el('div', { class: 'chronicle-actions' }, [
        btn('📜 Versiegeln & neuen Run starten', function () {
          if (!window.confirm('Aktuellen Run versiegeln und einen neuen Chronik-Run beginnen?')) return;
          var runtime = window.__TEMPEST__;
          var result = runtime && runtime.startChronicleRun ? runtime.startChronicleRun({
            variantId: variantSelect.value,
            challengeId: challengeSelect.value,
            simSpeed: Number(speedSelect.value),
            bannerId: bannerSelect.value || null,
            seed: Number(seedInput.value),
            auto: autoInput.checked
          }) : { ok: false, reason: 'Laufzeit nicht verfügbar.' };
          if (!result.ok) toast(result.reason, 'bad');
        }, { cls: 'btn-gold' })
      ]));
      openModal('Neue Chronik', content, '📜', 'chronicle-modal');
    }
  });
})();
