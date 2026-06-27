/* ============================================================
   ui-contracts.js — Auftragsbrett, Auto-Profile und Krisenmodal.
   Erweitert GameUI nach ui.js; klassisches Script ohne Build.
   ============================================================ */
(function () {
  'use strict';
  var UI = window.GameUI, H = window.GameUIInternal;
  if (!UI || !H) throw new Error('ui-contracts.js muss nach ui.js geladen werden');
  var SYS = window.GameSystems, GC = window.GameContracts;
  var el = H.el, btn = H.btn, bar = H.bar, costText = H.costText;
  var openModal = H.openModal, closeModal = H.closeModal, toast = H.toast;

  function timeText(ticks) {
    ticks = Math.max(0, Math.floor(Number(ticks) || 0));
    var minutes = Math.floor(ticks / 60), seconds = ticks % 60;
    return minutes ? (minutes + ':' + String(seconds).padStart(2, '0') + ' min') : (seconds + ' s');
  }
  function contractCard(state, contract, ui) {
    var progress = SYS.contractProgress(state, contract);
    return el('div', { class: 'contract-card' + (progress.complete ? ' complete' : '') + (contract.pacing ? ' pacing' : '') }, [
      el('div', { class: 'contract-head' }, [
        el('span', { class: 'contract-icon', text: contract.icon }),
        el('div', { class: 'contract-title' }, [
          el('div', { class: 'name', text: contract.title }),
          el('div', { class: 'meta', text: contract.desc })
        ]),
        el('span', { class: 'pill', text: progress.value + '/' + progress.target })
      ]),
      bar(progress.ratio, progress.complete ? 'good' : 'gold'),
      el('div', { class: 'contract-meta' }, [
        el('span', { text: progress.complete ? 'Bereit zur Abgabe' : ('Noch ' + timeText(progress.remaining)) }),
        el('span', { text: 'Belohnung: ' + costText(contract.reward) })
      ]),
      progress.complete ? btn('Belohnung holen', function () {
        var result = SYS.claimContract(state, contract.id);
        toast(result.ok ? (contract.icon + ' Auftrag eingelöst.') : result.reason, result.ok ? 'gold' : 'bad');
        ui.commit();
      }, { small: true, cls: 'btn-gold' }) : null
    ]);
  }
  function crisisCard(state, ui) {
    var status = SYS.activeCrisis(state);
    if (!status) return null;
    return el('div', { class: 'crisis-banner' }, [
      el('div', { class: 'contract-head' }, [
        el('span', { class: 'contract-icon', text: status.crisis.icon }),
        el('div', { class: 'contract-title' }, [
          el('div', { class: 'name', text: status.crisis.title }),
          el('div', { class: 'meta', text: status.stage.title + ' · Entscheidung ' + (status.active.stage + 1) + '/' + status.crisis.stages.length })
        ])
      ]),
      btn('Entscheiden', function () { ui.openCrisisModal(); }, { small: true, cls: 'btn-primary' })
    ]);
  }

  Object.assign(UI, {
    buildContractBoard: function () {
      var state = this.state, self = this;
      var contracts = SYS.ensureContractBoard(state);
      var section = el('section', { class: 'contract-board', 'aria-label': 'Auftragsbrett und Reichskrisen' });
      section.appendChild(el('div', { class: 'contract-board-head' }, [
        el('div', null, [
          el('div', { class: 'section-label', text: 'Auftragsbrett' }),
          el('div', { class: 'muted contract-subtitle', text: 'Drei kurze Ziele rotieren mit klarer Laufzeit und skalierter Belohnung.' })
        ]),
        el('span', { class: 'pill', text: state.contracts.completed + ' erfüllt · ' + state.contracts.failed + ' verpasst' })
      ]));

      var profileRow = el('div', { class: 'contract-profiles', role: 'group', 'aria-label': 'Auto-Profil' });
      SYS.CONTRACT_PROFILES.forEach(function (entry) {
        var active = state.contracts.autoProfile === entry.id;
        profileRow.appendChild(el('button', {
          type: 'button',
          class: 'profile-segment' + (active ? ' active' : ''),
          'aria-pressed': active ? 'true' : 'false',
          title: entry.desc,
          onclick: function () {
            SYS.setContractAutoProfile(state, entry.id);
            toast(entry.icon + ' Auto-Profil: ' + entry.name, 'gold');
            self.commit();
          }
        }, [el('span', { text: entry.icon }), el('span', { text: entry.name })]));
      });
      section.appendChild(profileRow);

      var activeCrisis = crisisCard(state, self);
      if (activeCrisis) section.appendChild(activeCrisis);
      var grid = el('div', { class: 'contract-grid' });
      contracts.forEach(function (contract) { grid.appendChild(contractCard(state, contract, self)); });
      section.appendChild(grid);
      return section;
    },

    openCrisisModal: function () {
      var state = this.state, self = this, status = SYS.activeCrisis(state);
      if (!status) return;
      var content = el('div', { class: 'crisis-modal-body' }, [
        el('div', { class: 'crisis-stage' }, [
          el('span', { class: 'pill', text: 'Entscheidung ' + (status.active.stage + 1) + '/' + status.crisis.stages.length }),
          el('h3', { text: status.stage.title }),
          el('p', { class: 'muted', text: status.stage.desc })
        ])
      ]);
      var choices = el('div', { class: 'crisis-choices' });
      status.stage.choices.forEach(function (choice) {
        var affordable = !choice.effect || !choice.effect.cost || SYS.canAfford(state, choice.effect.cost);
        choices.appendChild(el('div', { class: 'crisis-choice' }, [
          el('div', { class: 'name', text: choice.label }),
          el('div', { class: 'meta', text: choice.desc }),
          btn('Wählen', function () {
            var result = SYS.resolveCrisis(state, choice.id);
            if (!result.ok) { toast(result.reason, 'bad'); return; }
            toast(status.crisis.icon + ' ' + choice.label, result.finished ? 'gold' : 'good');
            closeModal();
            self.commit();
            if (!result.finished) self.openCrisisModal();
          }, { small: true, cls: affordable ? 'btn-primary' : '', disabled: !affordable, cost: affordable ? '' : 'Ressourcen fehlen' })
        ]));
      });
      content.appendChild(choices);
      openModal(status.crisis.icon + ' ' + status.crisis.title, content, status.crisis.icon, 'crisis-modal');
    }
  });
})();
