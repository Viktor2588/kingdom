/* ============================================================
   ui-progress.js — Kompendium: Erfolge, Reichsstatistik & Bestiarium.
   Erweitert GameUI nach ui.js; klassisches Script ohne Build.
   Liest GameAchievements + state.metrics + state.seenSpecies;
   verändert keinen Zustand.
   ============================================================ */
(function () {
  'use strict';
  var UI = window.GameUI, H = window.GameUIInternal;
  if (!UI || !H) throw new Error('ui-progress.js muss nach ui.js geladen werden');
  var GD = window.GameData, GST = window.GameState, SYS = window.GameSystems;
  var el = H.el, fmt = H.fmt, bar = H.bar, btn = H.btn;
  var openModal = H.openModal, toast = H.toast, costText = H.costText, creatureArt = H.creatureArt, rankBadge = H.rankBadge, statsLine = H.statsLine;

  function ACH() { return window.GameAchievements; }

  // ---------- abgeleitete Statistikwerte ----------
  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function m(s, k) { return num(s.metrics && s.metrics[k]); }
  function namedCount(s) { return (s.creatures || []).filter(function (c) { return c.named; }).length; }
  function buildingsTotal(s) { var sum = 0; for (var id in (s.buildings || {})) sum += num(s.buildings[id]); return sum; }
  function arrLen(s, k) { return Array.isArray(s[k]) ? s[k].length : 0; }

  function playtime(s) {
    var t = Math.max(0, Math.floor(num(s.tick)));
    var h = Math.floor(t / 3600), mi = Math.floor((t % 3600) / 60), se = t % 60;
    if (h > 0) return h + ' h ' + mi + ' min';
    if (mi > 0) return mi + ' min ' + se + ' s';
    return se + ' s';
  }

  function strongestCreature(s) {
    var best = null, bestKey = -1;
    (s.creatures || []).forEach(function (c) {
      var sp = GD.creature(c.speciesId); if (!sp) return;
      var key = GD.rankIndex(sp.rank) * 1000 + num(c.level);
      if (key > bestKey) { bestKey = key; best = { c: c, sp: sp }; }
    });
    if (!best) return '—';
    return (best.c.named ? best.c.name : best.sp.name) + ' (' + best.sp.rank + ' · Lv ' + num(best.c.level) + ')';
  }

  function statGroups(s) {
    return [
      { label: 'Allgemein', rows: [
        ['⏳', 'Spielzeit', playtime(s)],
        ['💀', 'Seelen gesamt', fmt(m(s, 'seelenGesamt'))],
        ['👑', 'Herrscher', 'Lv ' + num(s.herrscher && s.herrscher.level) + ' · ' + (GD.rulerStages[num(s.herrscher && s.herrscher.stage)] || {}).name],
        ['🏆', 'Erfolge', ACH() ? (ACH().unlockedCount(s) + ' / ' + ACH().total()) : '—']
      ] },
      { label: 'Reich', rows: [
        ['🏰', 'Gebäudestufen', fmt(buildingsTotal(s))],
        ['🏳️', 'Regionen', arrLen(s, 'claimedRegions') + ' / ' + GD.regions.length],
        ['⛏️', 'Anlagen gesichert', '' + arrLen(s, 'claimedMapSites')],
        ['📚', 'Forschungen', '' + arrLen(s, 'research')]
      ] },
      { label: 'Kreaturen', rows: [
        ['✨', 'Beschworen', fmt(m(s, 'summoned'))],
        ['🎖️', 'Benannte Eliten', '' + namedCount(s)],
        ['🧬', 'Evolutionen', fmt(m(s, 'evolutions'))],
        ['🧪', 'Fusionen', '' + m(s, 'fused')],
        ['🐉', 'Stärkste Kreatur', strongestCreature(s)]
      ] },
      { label: 'Kampf', rows: [
        ['🗡️', 'Expeditionen gewonnen', m(s, 'expeditionsWon') + ' / ' + m(s, 'expeditions')],
        ['🛡️', 'Armee-Feldzüge', fmt(m(s, 'armyVictories'))],
        ['♟️', 'Taktik-Siege', fmt(m(s, 'tacticalWins'))],
        ['⚡', 'Sturmeinsätze', m(s, 'skirmishesWon') + ' / ' + m(s, 'skirmishesPlayed') + ' · Kombo ' + m(s, 'skirmishBestCombo') + ' · Ziele ' + m(s, 'skirmishObjectives')],
        ['🚧', 'Raids abgewehrt', '' + m(s, 'raidsRepelled')],
        ['😈', 'Rivalen besiegt', '' + arrLen(s, 'rivalsDefeated')],
        ['🌀', 'Echos geräumt', m(s, 'echoesCleared') + ' (Zyklus ' + num(s.echoes && s.echoes.cycle) + ')']
      ] },
      { label: 'Magie & Schmiede', rows: [
        ['🪄', 'Zauber gelernt', '' + (arrLen(s, 'learnedMagic') + arrLen(s, 'learnedFieldMagic'))],
        ['⚒️', 'Geschmiedet', fmt(m(s, 'crafted'))],
        ['🛠️', 'Aufgewertet', fmt(m(s, 'tempered'))],
        ['📜', 'Baupläne bekannt', '' + arrLen(s, 'unlockedRecipes')]
      ] }
    ];
  }

  function buildStats(s) {
    var box = el('div', { class: 'codex-stats' });
    statGroups(s).forEach(function (g) {
      box.appendChild(el('div', { class: 'section-label', text: g.label }));
      var grid = el('div', { class: 'stat-grid' });
      g.rows.forEach(function (r) {
        grid.appendChild(el('div', { class: 'stat-cell' }, [
          el('span', { class: 'stat-ico', text: r[0] }),
          el('div', { class: 'stat-body' }, [
            el('div', { class: 'stat-k', text: r[1] }),
            el('div', { class: 'stat-v', text: r[2] })
          ])
        ]));
      });
      box.appendChild(grid);
    });
    return box;
  }

  function achievementCard(s, a) {
    var p = ACH().progressOf(s, a);
    var head = el('div', { class: 'ach-head' }, [
      el('span', { class: 'ach-ico', text: a.icon }),
      el('div', { class: 'ach-text' }, [
        el('div', { class: 'ach-title' }, [a.title, el('span', { class: 'ach-state', text: p.done ? '✅' : '🔒' })]),
        el('div', { class: 'ach-desc', text: a.desc })
      ])
    ]);
    var foot = el('div', { class: 'ach-foot' }, [
      bar(p.frac, p.done ? 'good' : ''),
      el('div', { class: 'ach-meta' }, [
        el('span', { text: p.cur + ' / ' + p.max }),
        a.reward ? el('span', { class: 'ach-reward', text: (p.done ? '✔ ' : '🎁 ') + costText(a.reward) }) : null
      ])
    ]);
    return el('div', { class: 'ach-card' + (p.done ? ' done' : '') }, [head, foot]);
  }

  function buildAchievements(s) {
    var box = el('div', { class: 'codex-ach' });
    var done = ACH().unlockedCount(s), total = ACH().total();
    box.appendChild(el('div', { class: 'codex-summary' }, [
      bar(done / total, 'gold'),
      el('div', { class: 'bar-label', text: '🏆 ' + done + ' / ' + total + ' Erfolge freigeschaltet' })
    ]));
    ACH().CATEGORIES.forEach(function (cat) {
      var list = ACH().byCategory(cat.id);
      var unl = list.filter(function (a) { return ACH().progressOf(s, a).done; }).length;
      box.appendChild(el('div', { class: 'section-label', text: cat.icon + ' ' + cat.label + ' · ' + unl + '/' + list.length }));
      var grid = el('div', { class: 'ach-grid' });
      list.forEach(function (a) { grid.appendChild(achievementCard(s, a)); });
      box.appendChild(grid);
    });
    return box;
  }

  // ---------- Bestiarium ----------
  function reqText(req) {
    if (!req) return '';
    var parts = [];
    if (req.named) parts.push('benannt');
    if (req.level) parts.push('Lv ' + req.level);
    if (req.seelen) parts.push(req.seelen + ' Seelen');
    if (req.herrscherStufe) parts.push('Herrscher-Stufe ' + req.herrscherStufe);
    return parts.join(', ');
  }

  // Kreaturen nach Linie gruppieren, je Linie nach Rang sortiert.
  function speciesByLine() {
    var lines = [], byLine = {};
    GD.creatures.forEach(function (sp) {
      if (!byLine[sp.line]) { byLine[sp.line] = []; lines.push(sp.line); }
      byLine[sp.line].push(sp);
    });
    lines.forEach(function (ln) { byLine[ln].sort(function (a, b) { return GD.rankIndex(a.rank) - GD.rankIndex(b.rank); }); });
    return { lines: lines, byLine: byLine };
  }

  function seenSpecies(s, id) { return (s.seenSpecies || []).indexOf(id) >= 0; }

  function beastCard(s, sp) {
    if (!seenSpecies(s, sp.id)) {
      return el('div', { class: 'beast-card locked' }, [
        el('div', { class: 'beast-head' }, [
          el('div', { class: 'card-emoji', text: '❔' }),
          el('div', { class: 'beast-id' }, [
            el('div', { class: 'beast-name', text: '???' }),
            el('div', { class: 'beast-sub' }, [rankBadge(sp.rank)])
          ])
        ])
      ]);
    }
    var sk = sp.skill ? GD.skill(sp.skill) : null;
    var evo = (sp.evolvesTo || []).map(function (e) {
      var to = GD.creature(e.to), rt = reqText(e.req);
      return el('div', { class: 'beast-evo', text: '→ ' + (to ? to.name : e.to) + (rt ? ' (' + rt + ')' : '') });
    });
    return el('div', { class: 'beast-card' }, [
      el('div', { class: 'beast-head' }, [
        creatureArt(sp, 'beast-art'),
        el('div', { class: 'beast-id' }, [
          el('div', { class: 'beast-name', text: sp.name }),
          el('div', { class: 'beast-sub' }, [rankBadge(sp.rank), el('span', { class: 'pill', text: sp.role })])
        ])
      ]),
      statsLine(sp.base),
      sk ? el('div', { class: 'beast-skill', text: '✨ ' + sk.name }) : null,
      sp.desc ? el('div', { class: 'beast-desc', text: sp.desc }) : null,
      evo.length ? el('div', { class: 'beast-evos' }, evo) : null
    ]);
  }

  function buildBestiary(s) {
    var box = el('div', { class: 'codex-beast' });
    var grouped = speciesByLine(), total = GD.creatures.length;
    var seenCount = GD.creatures.filter(function (sp) { return seenSpecies(s, sp.id); }).length;
    box.appendChild(el('div', { class: 'codex-summary' }, [
      bar(seenCount / total, 'gold'),
      el('div', { class: 'bar-label', text: '📖 ' + seenCount + ' / ' + total + ' Formen entdeckt' })
    ]));
    grouped.lines.forEach(function (ln) {
      var forms = grouped.byLine[ln];
      var seen = forms.filter(function (sp) { return seenSpecies(s, sp.id); }).length;
      box.appendChild(el('div', { class: 'section-label', text: ln + ' · ' + seen + '/' + forms.length }));
      var grid = el('div', { class: 'beast-grid' });
      forms.forEach(function (sp) { grid.appendChild(beastCard(s, sp)); });
      box.appendChild(grid);
    });
    return box;
  }

  Object.assign(UI, {
    // Kompendium-Modal mit drei Unter-Ansichten: Erfolge, Statistik, Bestiarium.
    openCodexModal: function (tab) {
      var self = this, s = this.state;
      if (!ACH()) return;
      this._codexTab = tab || this._codexTab || 'erfolge';
      var body = el('div', { class: 'codex-body' });
      function tabBtn(id, label) {
        return btn(label, function () { self.openCodexModal(id); }, { small: true, cls: self._codexTab === id ? 'btn-gold' : '' });
      }
      body.appendChild(el('div', { class: 'codex-tabs' }, [
        tabBtn('erfolge', '🏆 Erfolge'),
        tabBtn('statistik', '📊 Statistik'),
        tabBtn('bestiarium', '📖 Bestiarium')
      ]));
      var view = this._codexTab === 'statistik' ? buildStats(s)
        : (this._codexTab === 'bestiarium' ? buildBestiary(s) : buildAchievements(s));
      body.appendChild(view);
      openModal('Kompendium', body, '📖', 'codex-modal');
    },

    fastForwardCompletion: function (kind) {
      var s = this.state, planner = window.GameCompletionPlanner;
      if (!planner) return;
      planner.ensure(s);
      s.completion.enabled = true;
      s.completion.target = kind;
      var before = planner.snapshot(s), advanced = 0, reached = false;
      for (var i = 0; i < 1200; i++) {
        SYS.autoPlayStep(s);
        SYS.tick(s);
        advanced++;
        var current = planner.snapshot(s);
        reached = kind === 'achievements'
          ? current.achievements.done > before.achievements.done
          : current.bestiary.done > before.bestiary.done;
        if (reached) break;
      }
      var status = planner.status(s);
      toast(reached
        ? ('⏩ Nächster ' + (kind === 'achievements' ? 'Erfolg' : 'Bestiarium-Eintrag') + ' nach ' + advanced + ' Ticks.')
        : ('⏸ Kein Fortschritt nach ' + advanced + ' Ticks' + (status.diagnostic ? ': ' + status.diagnostic : '.')),
      reached ? 'gold' : 'bad');
      this.commit();
    },

    // ---------- Zentrale Einstellungen (Phase 39) ----------
    openSettingsModal: function () {
      var self = this, s = this.state;
      var content = el('div', { class: 'settings-body' });

      // Darstellung / Leistung: Effektstufe (war bisher nur im Kampf erreichbar).
      content.appendChild(el('div', { class: 'section-label', text: 'Darstellung & Leistung' }));
      content.appendChild(el('p', { class: 'muted', text: 'Animationsstufe der Canvas-Szenen. „Reduziert"/„Aus" schont Akku & Leistung auf Handys; „prefers-reduced-motion" wird ohnehin respektiert.' }));
      var effectRow = el('div', { class: 'opt-choice' });
      [['off', 'Aus'], ['reduced', 'Reduziert'], ['full', 'Voll']].forEach(function (entry) {
        var active = (s.settings.effects || 'full') === entry[0];
        effectRow.appendChild(btn(entry[1], function () {
          s.settings.effects = entry[0];
          toast('🎚️ Effekte: ' + entry[1], 'gold');
          self.persist(s); self.openSettingsModal();
        }, { small: true, cls: active ? 'btn-gold' : '' }));
      });
      content.appendChild(effectRow);

      // Zuschauer-Modus bequem hier umschaltbar.
      content.appendChild(el('div', { class: 'section-label', text: 'Zuschauer-Modus' }));
      var watchOn = !!s.settings.watch, watchDetailed = !!s.settings.watchDetailed;
      content.appendChild(el('div', { class: 'opt-choice' }, [
        btn(watchOn ? '👁️ An' : '👁️ Aus', function () {
          s.settings.watch = !watchOn;
          toast(s.settings.watch ? '👁️ Zuschauer-Modus an' : '⏸ Zuschauer-Modus aus', s.settings.watch ? 'gold' : '');
          self.persist(s); self.openSettingsModal();
        }, { small: true, cls: watchOn ? 'btn-gold' : '' }),
        btn(watchDetailed ? '🎬 Einzelschritte: an' : '🎬 Einzelschritte: aus', function () {
          s.settings.watchDetailed = !watchDetailed;
          s.settings.watchCooldownUntil = s.tick;
          self.persist(s); self.openSettingsModal();
        }, { small: true, cls: watchDetailed ? 'btn-gold' : '' })
      ]));

      // Completion-Autopilot (Phase 46): Zielmodus, Fortschritt und Diagnose.
      var planner = window.GameCompletionPlanner;
      if (planner) {
        var completion = planner.ensure(s), completionStatus = planner.status(s);
        var cp = completionStatus.progress, focus = completionStatus.focus;
        content.appendChild(el('div', { class: 'section-label', text: 'Completion-Autopilot' }));
        content.appendChild(el('div', { class: 'stat-grid' }, [
          el('div', { class: 'stat-cell' }, [
            el('span', { class: 'stat-ico', text: '🏆' }),
            el('div', { class: 'stat-body' }, [
              el('div', { class: 'stat-k', text: 'Erfolge' }),
              el('div', { class: 'stat-v', text: cp.achievements.done + ' / ' + cp.achievements.total })
            ])
          ]),
          el('div', { class: 'stat-cell' }, [
            el('span', { class: 'stat-ico', text: '📖' }),
            el('div', { class: 'stat-body' }, [
              el('div', { class: 'stat-k', text: 'Bestiarium' }),
              el('div', { class: 'stat-v', text: cp.bestiary.done + ' / ' + cp.bestiary.total })
            ])
          ])
        ]));
        content.appendChild(el('div', { class: 'opt-choice' }, [
          btn(completion.enabled ? '🎯 100%-Run: an' : '🎯 100%-Run: aus', function () {
            completion.enabled = !completion.enabled;
            if (completion.enabled) s.settings.watch = true;
            toast(completion.enabled ? '🎯 Completion-Autopilot gestartet.' : '⏸ Completion-Autopilot gestoppt.', completion.enabled ? 'gold' : '');
            self.persist(s); self.openSettingsModal();
          }, { small: true, cls: completion.enabled ? 'btn-gold' : '' })
        ]));
        var targetRow = el('div', { class: 'opt-choice' });
        [['all', 'Alles'], ['achievements', 'Erfolge'], ['bestiary', 'Bestiarium']].forEach(function (entry) {
          targetRow.appendChild(btn(entry[1], function () {
            completion.target = entry[0];
            self.persist(s); self.openSettingsModal();
          }, { small: true, cls: completion.target === entry[0] ? 'btn-gold' : '' }));
        });
        content.appendChild(targetRow);
        content.appendChild(el('div', { class: 'opt-choice' }, [
          btn('⏩ Bis nächster Erfolg', function () { self.fastForwardCompletion('achievements'); }, { small: true }),
          btn('⏩ Bis nächste Form', function () { self.fastForwardCompletion('bestiary'); }, { small: true })
        ]));
        if (focus) {
          content.appendChild(el('p', { class: 'muted', text: 'Aktueller Plan: ' + (focus.kind === 'bestiary' ? 'Bestiarium · ' : 'Erfolg · ') + focus.title + (focus.reason ? ' — ' + focus.reason : '') }));
        }
        if (completionStatus.diagnostic) {
          content.appendChild(el('p', { class: 'notice bad', text: 'Blockade: ' + completionStatus.diagnostic }));
        }
      }

      // Spielstand-Verwaltung (Export/Import) — aus dem Herrscher-Modal hierher zentralisiert.
      content.appendChild(el('hr', { class: 'sep' }));
      content.appendChild(el('div', { class: 'section-label', text: 'Spielstand' }));
      content.appendChild(el('p', { class: 'muted', text: 'Automatisch gespeichert. Exportiere als Datei für Backup oder Gerätewechsel.' }));
      content.appendChild(el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, [
        btn('💾 Exportieren', function () {
          try {
            var blob = new Blob([GST.exportSave(s)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'tempest-spielstand.json';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast('💾 Spielstand als Datei exportiert.', 'gold');
          } catch (e) { toast('Export fehlgeschlagen.', 'bad'); }
        }, { small: true }),
        btn('📂 Importieren', function () {
          var input = document.createElement('input');
          input.type = 'file'; input.accept = 'application/json,.json';
          input.onchange = function () {
            var file = input.files && input.files[0]; if (!file) return;
            var reader = new FileReader();
            reader.onload = function () {
              var res = GST.importSave(String(reader.result));
              if (!res.ok) { toast('Import fehlgeschlagen: ' + res.reason, 'bad'); return; }
              toast('📂 Spielstand importiert – wird geladen …', 'gold');
              setTimeout(function () { window.location.reload(); }, 400);
            };
            reader.readAsText(file);
          };
          input.click();
        }, { small: true })
      ]));

      content.appendChild(el('hr', { class: 'sep' }));
      content.appendChild(btn('🗑 Spielstand zurücksetzen', function () {
        if (window.confirm('Wirklich den gesamten Fortschritt löschen?')) {
          if (window.__TEMPEST__ && window.__TEMPEST__.resetGame) window.__TEMPEST__.resetGame();
          else { GST.reset(); window.location.reload(); }
        }
      }, { cls: 'btn-danger', small: true }));

      openModal('Einstellungen', content, '⚙️', 'settings-modal');
    }
  });
})();
