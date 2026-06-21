/* ============================================================
   ui-action.js — Sturmeinsatz-Oberfläche (Phase 40).
   Erweitert GameUI um eine prominente Übersichtskarte und das
   kompakte Konter-/Kombo-Gefechtsmodal.
   ============================================================ */
(function () {
  'use strict';
  var UI = window.GameUI, H = window.GameUIInternal, SYS = window.GameSystems;
  if (!UI || !H || !SYS) throw new Error('ui-action.js muss nach ui.js und systems-skirmish.js geladen werden');
  var el = H.el, btn = H.btn, bar = H.bar, fmt = H.fmt;
  var openModal = H.openModal, closeModal = H.closeModal, toast = H.toast, costText = H.costText;

  function heatPips(value) {
    var row = el('div', { class: 'skirmish-heat', 'aria-label': 'Eskalation ' + value + ' von ' + SYS.SKIRMISH_MAX_HEAT });
    for (var i = 0; i < SYS.SKIRMISH_MAX_HEAT; i++) row.appendChild(el('span', { class: i < value ? 'on' : '' }));
    return row;
  }

  function focusPips(value) {
    var row = el('div', { class: 'skirmish-focus', 'aria-label': 'Fokus ' + value + ' von ' + SYS.SKIRMISH_MAX_FOCUS });
    for (var i = 0; i < SYS.SKIRMISH_MAX_FOCUS; i++) row.appendChild(el('span', { class: i < value ? 'on' : '', text: i < value ? '◆' : '◇' }));
    return row;
  }

  function resultReward(result) {
    if (!result || !result.reward) return 'Keine Beute';
    return costText(result.reward) + (result.xp ? '  +' + result.xp + ' EP' : '');
  }
  function findById(list, id) {
    return (list || []).filter(function (entry) { return entry.id === id; })[0] || null;
  }

  Object.assign(UI, {
    buildSkirmishCard: function () {
      var self = this, status = SYS.skirmishStatus(this.state), active = status.active;
      var card = el('div', { class: 'card skirmish-card' + (active ? ' active' : '') }, [
        el('div', { class: 'skirmish-card-glow' }),
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-emoji', text: active ? '🔥' : '⚡' }),
          el('div', { class: 'card-title' }, [
            el('div', { class: 'name' }, ['Sturmeinsätze', active ? el('span', { class: 'pill tag-bad', text: '● Gefecht läuft' }) : el('span', { class: 'pill', text: 'AKTIV' })]),
            el('div', { class: 'meta', text: active ? (status.mission.name + ' · ' + status.profile.name + ' · ' + status.phase.name + ' · Runde ' + active.round + '/' + active.maxRounds) : 'Gegnerprofile lesen, Bossphasen meistern und Optionalziele erfüllen.' })
          ])
        ]),
        el('div', { class: 'skirmish-card-stats' }, [
          el('div', null, [el('small', { text: 'Eskalation' }), heatPips(status.heat)]),
          el('div', null, [el('small', { text: 'Siegesserie' }), el('b', { text: '🔥 ' + status.streak })]),
          el('div', null, [el('small', { text: 'Beste Kombo' }), el('b', { text: '⚡ ' + status.bestCombo })])
        ]),
        el('div', { class: 'card-actions' }, [
          btn(active ? '⚔️ Gefecht fortsetzen' : '⚡ Jetzt kämpfen', function () { self.openSkirmishHub(); }, { cls: 'btn-action' })
        ])
      ]);
      return card;
    },

    openSkirmishHub: function () {
      var self = this, s = this.state, status = SYS.skirmishStatus(s);
      if (status.active) { this.openSkirmishBattle(); return; }
      var body = el('div', { class: 'skirmish-hub' }, [
        el('p', { class: 'muted', text: 'Jeder Einsatz dauert nur wenige Entscheidungen. Korrekte Konter bauen Fokus und Kombo auf; Siege erhöhen die Eskalation und damit Beute und Gefahr.' }),
        el('div', { class: 'skirmish-summary' }, [
          el('span', { text: '🔥 Serie ' + status.streak }),
          el('span', { text: '⚡ Rekord ' + status.bestCombo }),
          el('span', { text: '🎯 Eskalation ' + status.heat + '/' + SYS.SKIRMISH_MAX_HEAT }),
          el('span', { text: '🏅 Optionalziele ' + status.objectivesCompleted })
        ])
      ]);

      // Kampfhaltung wählen (aktive Vor-Kampf-Entscheidung, Phase 41).
      body.appendChild(el('div', { class: 'section-label', text: 'Kampfhaltung' }));
      var stancePicker = el('div', { class: 'skirmish-stances' });
      SYS.SKIRMISH_STANCES.forEach(function (st) {
        var selected = status.stanceId === st.id;
        stancePicker.appendChild(el('button', {
          type: 'button',
          class: 'skirmish-stance' + (selected ? ' selected' : ''),
          'aria-pressed': selected ? 'true' : 'false',
          onclick: function () { SYS.setSkirmishStance(s, st.id); self.persist(s); self.openSkirmishHub(); }
        }, [
          el('span', { class: 'stance-icon', text: st.icon }),
          el('b', { text: st.name }),
          el('small', { text: st.desc })
        ]));
      });
      body.appendChild(stancePicker);

      body.appendChild(el('div', { class: 'section-label', text: 'Einsatz wählen' }));
      var grid = el('div', { class: 'skirmish-missions' });
      SYS.SKIRMISH_MISSIONS.forEach(function (m) {
        var unlocked = SYS.missionUnlocked(s, m), preview = SYS.skirmishPreview(s, m.id);
        grid.appendChild(el('div', { class: 'skirmish-mission' + (unlocked ? '' : ' locked') }, [
          el('div', { class: 'skirmish-mission-icon', text: unlocked ? m.icon : '🔒' }),
          el('div', { class: 'skirmish-mission-copy' }, [
            el('b', { text: m.name }),
            el('p', { text: unlocked ? m.desc : m.hint }),
            el('div', { class: 'skirmish-mission-tags' }, [
              el('span', { text: preview.profile.icon + ' ' + preview.profile.name }),
              el('span', { text: preview.modifier.icon + ' ' + preview.modifier.name })
            ]),
            unlocked ? el('small', { text: preview.objective.icon + ' Optionalziel: ' + preview.objective.desc }) : null,
            unlocked ? el('small', { text: 'Basisbeute: ' + costText(m.reward) + ' · ' + preview.modifier.desc }) : null
          ]),
          btn(unlocked ? 'Start' : 'Gesperrt', function () {
            var res = SYS.startSkirmish(s, m.id, SYS.skirmishStatus(s).stanceId);
            if (!res.ok) { toast(res.reason, 'bad'); return; }
            self.persist(s); self.refresh(); self.openSkirmishBattle();
          }, { small: true, cls: unlocked ? 'btn-action' : '', disabled: !unlocked })
        ]));
      });
      body.appendChild(grid);
      openModal('Sturmeinsätze', body, '⚡', 'skirmish-modal');
    },

    openSkirmishBattle: function () {
      var self = this, s = this.state, status = SYS.skirmishStatus(s), active = status.active;
      if (!active) { this.openSkirmishHub(); return; }
      var intent = status.intent;
      var body = el('div', { class: 'skirmish-battle' });
      body.appendChild(el('div', { class: 'skirmish-versus' }, [
        el('div', { class: 'skirmish-fighter hero-side' }, [
          el('div', { class: 'skirmish-avatar', text: '💧' }),
          el('b', { text: s.herrscher.name }),
          bar(active.heroHp / active.heroMaxHp, 'good'),
          el('small', { text: Math.ceil(active.heroHp) + ' / ' + active.heroMaxHp + ' LP' })
        ]),
        el('div', { class: 'skirmish-vs', text: 'VS' }),
        el('div', { class: 'skirmish-fighter enemy-side' }, [
          el('div', { class: 'skirmish-avatar', text: status.mission.icon }),
          el('b', { text: status.mission.name }),
          bar(active.enemyHp / active.enemyMaxHp, 'bad'),
          el('small', { text: Math.ceil(active.enemyHp) + ' / ' + active.enemyMaxHp + ' LP' })
        ])
      ]));
      body.appendChild(el('div', { class: 'skirmish-encounter' + (active.phase === 'boss' ? ' boss' : '') }, [
        el('div', null, [el('small', { text: 'PROFIL' }), el('b', { text: status.profile.icon + ' ' + status.profile.name }), el('span', { text: status.profile.desc })]),
        el('div', null, [el('small', { text: 'MODIFIKATOR' }), el('b', { text: status.modifier.icon + ' ' + status.modifier.name }), el('span', { text: status.modifier.desc })]),
        el('div', null, [el('small', { text: 'OPTIONALZIEL' }), el('b', { text: status.objective.icon + ' ' + status.objective.name }), el('span', { text: status.objectiveProgress })])
      ]));
      body.appendChild(el('div', { class: 'skirmish-phase' + (active.phase === 'boss' ? ' boss' : '') }, [
        el('b', { text: status.phase.icon + ' ' + status.phase.name }),
        el('span', { text: status.phase.desc })
      ]));
      body.appendChild(el('div', { class: 'skirmish-telegraph' }, [
        el('small', { text: (active.phase === 'boss' ? 'BOSSPHASE' : 'GEGNERABSICHT') + ' · RUNDE ' + active.round + '/' + active.maxRounds }),
        el('div', { class: 'skirmish-intent-icon', text: intent.icon }),
        el('b', { text: intent.name }),
        el('span', { text: intent.hint })
      ]));
      body.appendChild(el('div', { class: 'skirmish-meters' }, [
        el('div', null, [el('small', { text: 'Fokus' }), focusPips(active.focus)]),
        el('div', null, [el('small', { text: 'Kombo' }), el('b', { class: active.combo ? 'combo-live' : '', text: '⚡ x' + active.combo })]),
        el('div', null, [el('small', { text: 'Haltung' }), el('b', { text: status.stance.icon + ' ' + status.stance.name })])
      ]));

      function actButton(id, hint) {
        var a = SYS.SKIRMISH_ACTIONS[id], available = SYS.skirmishActionAvailable(s, id);
        var liveHint = intent.counter === id ? ('✓ kontert ' + intent.name) : hint;
        return btn(a.icon + ' ' + a.name, function () {
          var res = SYS.skirmishAction(s, id);
          if (!res.ok) { toast(res.reason, 'bad'); return; }
          self.persist(s); self.updateTopbar(); self.render();
          if (res.finished) self.openSkirmishResult(res.result);
          else self.openSkirmishBattle();
        }, { cls: 'skirmish-action action-' + id, disabled: !available, cost: liveHint + (a.cost ? ' · ' + a.cost + ' Fokus' : '') });
      }
      body.appendChild(el('div', { class: 'skirmish-actions' }, [
        actButton('angriff', 'kontert Ritual'),
        actButton('block', 'kontert Hieb'),
        actButton('magie', 'bricht Haltung'),
        actButton('finisher', 'massiver Treffer + Heilung')
      ]));
      var history = el('div', { class: 'skirmish-log' });
      (active.log || []).forEach(function (line) { history.appendChild(el('div', { text: line })); });
      body.appendChild(history);
      body.appendChild(el('div', { class: 'skirmish-foot' }, [
        btn('🏳️ Rückzug', function () {
          SYS.retreatSkirmish(s); self.persist(s); closeModal(); self.refresh();
        }, { small: true, cls: 'btn-ghost' }),
        el('span', { text: 'Falsche Reaktion bricht die Kombo.' })
      ]));
      openModal(status.mission.name, body, status.mission.icon, 'skirmish-modal battle');
    },

    openSkirmishResult: function (result) {
      var self = this, status = SYS.skirmishStatus(this.state);
      var objective = findById(SYS.SKIRMISH_OBJECTIVES, result.objectiveId);
      var modifier = findById(SYS.SKIRMISH_MODIFIERS, result.modifierId);
      var body = el('div', { class: 'skirmish-result ' + (result.won ? 'won' : 'lost') }, [
        el('div', { class: 'skirmish-result-icon', text: result.won ? '🏆' : '💥' }),
        el('h4', { text: result.won ? 'Einsatz gewonnen!' : 'Linie durchbrochen' }),
        el('p', { text: result.won ? ('Kombo ' + result.combo + ' · ' + result.rounds + ' Runden') : 'Kein dauerhafter Verlust. Eskalation wurde gesenkt.' }),
        result.won ? el('div', { class: 'skirmish-loot', text: resultReward(result) }) : null,
        objective ? el('div', { class: 'skirmish-objective-result ' + (result.objectiveMet ? 'complete' : 'missed') }, [
          el('b', { text: (result.objectiveMet ? '✓ ' : '○ ') + objective.name }),
          el('span', { text: result.objectiveMet ? ('Bonus: ' + costText(result.objectiveReward || {}) + ' +' + (result.objectiveXp || 0) + ' EP') : 'Optionalziel nicht erfüllt – der Einsatzfortschritt bleibt erhalten.' })
        ]) : null,
        modifier ? el('div', { class: 'skirmish-result-meta', text: modifier.icon + ' ' + modifier.name + ' war aktiv.' }) : null,
        el('div', { class: 'skirmish-result-meta', text: 'Eskalation ' + result.heatBefore + ' → ' + result.heatAfter + ' · Siegesserie ' + status.streak }),
        el('div', { class: 'card-actions' }, [
          btn('⚡ Nächster Einsatz', function () { self.openSkirmishHub(); }, { cls: 'btn-action' }),
          btn('Zur Übersicht', function () { closeModal(); self.refresh(); }, { small: true })
        ])
      ]);
      openModal(result.won ? 'Sieg' : 'Niederlage', body, result.won ? '🏆' : '💥', 'skirmish-modal result');
    }
  });
})();
