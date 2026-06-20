/* ============================================================
   ui.js — Darstellung. Baut die gesamte Oberfläche per DOM-API
   (createElement / textContent) aus dem Spielzustand auf – KEIN
   zusammengesetztes HTML, daher robust gegen Formatierungsfehler.
   Bereitgestellt als window.GameUI.
   ============================================================ */
(function () {
  'use strict';
  var SYS, GD, GST;

  // ---------- DOM-Helfer ----------
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null) continue;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'disabled') { if (v) n.setAttribute('disabled', ''); }
        else if (k.indexOf('on') === 0 && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
        else n.setAttribute(k, v);
      }
    }
    append(n, children);
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in (attrs || {})) n.setAttribute(k, attrs[k]);
    return n;
  }
  function append(n, child) {
    if (child == null) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(n, c); }); return; }
    if (typeof child === 'string' || typeof child === 'number') n.appendChild(document.createTextNode('' + child));
    else n.appendChild(child);
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function $(id) { return document.getElementById(id); }

  // ---------- Formatierung ----------
  var RES = {};
  function fmt(n) {
    n = Math.floor(n);
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' Mrd';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + ' Mio';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return '' + n;
  }
  function rate(n) { var r = (n >= 0 ? '+' : ''); return r + n.toFixed(1); }
  function pct(x) { return Math.round(x * 100) + ' %'; }
  function resIcon(id) { return RES[id] ? RES[id].icon : ''; }
  function costText(cost) {
    var parts = [];
    for (var k in cost) parts.push(fmt(cost[k]) + ' ' + resIcon(k));
    return parts.join('  ');
  }
  function forgeCostText(cost) {
    cost = cost || {}; var parts = [];
    var resources = cost.resources || {};
    for (var r in resources) parts.push(fmt(resources[r]) + ' ' + resIcon(r));
    var materials = cost.materials || {};
    for (var id in materials) {
      var material = GD && GD.forgeMaterial ? GD.forgeMaterial(id) : null;
      parts.push(materials[id] + ' ' + (material ? material.icon : id));
    }
    return parts.join('  ');
  }

  // ---------- Komponenten ----------
  function btn(label, onClick, opts) {
    opts = opts || {};
    var inner = [el('span', { text: label })];
    if (opts.cost != null) inner.push(el('span', { class: 'btn-cost', text: opts.cost }));
    return el('button', {
      type: 'button',
      class: 'btn ' + (opts.cls || '') + (opts.small ? ' btn-small' : ''),
      disabled: !!opts.disabled,
      onclick: opts.disabled ? null : onClick
    }, inner);
  }
  function rankBadge(rank) { return el('span', { class: 'badge rank-' + rank, text: rank }); }
  var CREATURE_SPRITES = {
    Schleim: 'slime', Goblin: 'goblin', Wolf: 'wolf', Oger: 'ogre', Echse: 'lizard', Ork: 'orc',
    Geist: 'spirit', Greif: 'griffin', Baumhirte: 'treant', Phönix: 'phoenix',
    Kobold: 'kobold', Hasenmensch: 'rabbitfolk', Tengu: 'tengu', Meervolk: 'merfolk',
    Untot: 'undead', Dämon: 'demon', Vampir: 'vampire', Golem: 'golem', Insekt: 'insect', Drache: 'dragon'
  };
  var EXTENDED_SPRITES = { spirit: 1, griffin: 1, treant: 1, phoenix: 1, kobold: 1, rabbitfolk: 1, tengu: 1, merfolk: 1, undead: 1, demon: 1, vampire: 1, golem: 1, insect: 1, dragon: 1 };
  function creatureArt(sp, extraClass) {
    var sprite = sp && CREATURE_SPRITES[sp.line];
    if (!sprite) return el('div', { class: 'card-emoji ' + (extraClass || ''), text: sp ? sp.icon : '❔' });
    return el('div', { class: 'creature-art' + (EXTENDED_SPRITES[sprite] ? ' sprite-extended' : '') + ' sprite-' + sprite + ' ' + (extraClass || ''), role: 'img', 'aria-label': sp.name, title: sp.name });
  }
  function bar(frac, cls) {
    frac = Math.max(0, Math.min(1, frac));
    return el('div', { class: 'bar ' + (cls || '') }, el('span', { style: 'right:' + (100 - frac * 100) + '%' }));
  }
  var STAT_LABEL = { lp: 'LP', ang: 'ANG', ver: 'VER', mag: 'MAG', tmp: 'TMP' };
  function statsLine(stats) {
    var parts = [];
    ['lp', 'ang', 'ver', 'mag', 'tmp'].forEach(function (k) {
      if (stats[k]) parts.push(el('span', null, [STAT_LABEL[k] + ' ', el('b', { text: fmt(stats[k]) })]));
    });
    return el('div', { class: 'card-stats' }, parts);
  }

  // ---------- Modal ----------
  function openModal(title, contentNode, emoji, extraClass) {
    closeModal();
    var modal = el('div', { class: 'modal' + (extraClass ? ' ' + extraClass : '') }, [
      el('div', { class: 'modal-head' }, [
        emoji ? el('div', { class: 'card-emoji', text: emoji }) : null,
        el('h3', { text: title }),
        el('button', { class: 'modal-close', type: 'button', text: '✕', onclick: closeModal })
      ]),
      contentNode
    ]);
    var backdrop = el('div', { class: 'modal-backdrop', onclick: function (e) { if (e.target === backdrop) closeModal(); } }, modal);
    $('modal-root').appendChild(backdrop);
  }
  function closeModal() { var r = $('modal-root'); if (r) clear(r); }

  // ---------- Toast ----------
  function toast(text, kind) {
    var c = $('toast-container');
    if (!c) return;
    var t = el('div', { class: 'toast ' + (kind || ''), text: text });
    c.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }

  // ============================================================
  //  GameUI Objekt
  // ============================================================
  var UI = {
    state: null,
    persist: null,
    activeTab: 'uebersicht',

    start: function (state, persistFn) {
      SYS = window.GameSystems; GD = window.GameData; GST = window.GameState;
      GD.resources.forEach(function (r) { RES[r.id] = r; });
      this.state = state;
      this.persist = persistFn || function () {};
      this.renderTabbar();
      this.refresh();
      this.bindRuler();
    },

    bindRuler: function () {
      var self = this;
      var rm = $('ruler-mini');
      rm.onclick = function () { self.openRulerModal(); };
      var wt = $('watch-toggle');
      if (wt) wt.onclick = function () {
        var s = self.state;
        s.settings.watch = !s.settings.watch;
        toast(s.settings.watch ? '👁️ Zuschauer-Modus an' : '⏸ Zuschauer-Modus aus', s.settings.watch ? 'gold' : '');
        self.commit();
      };
    },

    // Nach jeder Aktion: neue Freischaltungen melden, speichern + neu zeichnen
    commit: function () { this.announceUnlocks(); this.persist(this.state); this.refresh(); },
    refresh: function () { this.updateTopbar(); this.render(); },

    // Neu freigeschaltete Bereiche/Features ankündigen (Toast + Chronik + Tabbar)
    announceUnlocks: function () {
      var fresh = SYS.collectNewUnlocks(this.state);
      if (!fresh.length) return false;
      var self = this;
      fresh.forEach(function (f) {
        if (f.kind === 'build') { toast('🏗️ ' + f.icon + ' ' + f.name + ' jetzt baubar!', ''); }
        else { SYS.log(self.state, '🔓 Freigeschaltet: ' + f.icon + ' ' + f.name + '.', 'gold'); toast('🔓 ' + f.icon + ' ' + f.name + ' freigeschaltet!', 'gold'); }
      });
      this.renderTabbar();
      return true;
    },

    // Tick aus main.js: Topbar immer, Info-Tabs live
    onTick: function (events) {
      var watch = !!(this.state.settings && this.state.settings.watch);
      // Zuschauer-Modus: ein Berater führt pro Tick eine sinnvolle Aktion aus
      var detailed = watch && !!this.state.settings.watchDetailed;
      if (watch && (!detailed || this.state.tick >= (this.state.settings.watchCooldownUntil || 0))) {
        var act = SYS.autoPlayStep(this.state);
        if (act && act.text) {
          this.state.settings.watchHistory.unshift({ tick: this.state.tick, text: act.text });
          this.state.settings.watchHistory = this.state.settings.watchHistory.slice(0, 8);
          if (detailed) {
            this.state.settings.watchCooldownUntil = this.state.tick + 3;
            this.showWatchAction(act);
          } else toast('🤖 ' + act.text, '');
        }
      }
      this.announceUnlocks();
      this.updateTopbar();
      if (watch || this.activeTab === 'uebersicht' || this.activeTab === 'karte') this.render();
      if (events && events.expeditionResults && events.expeditionResults.length) {
        events.expeditionResults.forEach(function (r) {
          var reg = GD.region(r.regionId);
          if (r.won) toast('🏆 ' + reg.name + ' erobert!', 'gold');
          else if (r.partial) toast('⚔️ Teilerfolg in ' + reg.name, '');
          else toast('💀 Niederlage in ' + reg.name, 'bad');
        });
        this.renderTabbar();
      }
      if (events && events.raidWarning) {
        var wrv = GD.rival(events.raidWarning.rivalId);
        toast('⚠️ ' + wrv.icon + ' ' + wrv.name + ' greift bald an!', 'bad');
        this.renderTabbar();
      }
      if (events && events.raidResult) {
        var rrv = GD.rival(events.raidResult.rivalId);
        toast(events.raidResult.repelled ? ('🛡️ Angriff von ' + rrv.name + ' abgewehrt!') : ('💥 ' + rrv.name + ' durchbrach die Verteidigung!'), events.raidResult.repelled ? 'good' : 'bad');
        this.renderTabbar();
        if (this.activeTab === 'karte') this.render();
      }
      if (events && events.event) {
        var ed = GD.event(events.event.id);
        if (events.event.auto) toast(ed.icon + ' ' + ed.title, 'gold');
        else if (!watch && this.state.activeEvent) this.openEventModal(events.event.id);  // Wahl-Event anbieten (im Auto-Modus übernimmt der Berater)
      }
      if (events && events.questsCompleted && events.questsCompleted.length) {
        events.questsCompleted.forEach(function (q) { toast('🎯 Ziel erfüllt: ' + q.title, 'gold'); });
      }
    },

    showWatchAction: function (act) {
      if (this.state.activeCombat && this.state.activeCombat.status === 'active') return;
      var content = el('div', { class: 'watch-dialog' }, [
        el('div', { class: 'watch-pulse', text: '🤖' }),
        el('p', { text: act.text }),
        el('div', { class: 'muted', style: 'font-size:12px', text: 'Der nächste Schritt folgt nach einer kurzen Pause.' })
      ]);
      openModal('Berater-Aktion', content, '👁️');
      var backdrop = $('modal-root').firstChild;
      if (backdrop) backdrop.setAttribute('data-watch-dialog', '1');
      setTimeout(function () {
        var current = $('modal-root').firstChild;
        if (current && current.getAttribute('data-watch-dialog') === '1') closeModal();
      }, 1600);
    },

    // ---------- Topbar ----------
    updateTopbar: function () {
      var s = this.state;
      var prod = SYS.production(s);
      var res = $('resources');
      clear(res);
      GD.resources.forEach(function (r) {
        var rt = (r.id === 'nahrung') ? prod.rates.nahrung : prod.rates[r.id];
        var chip = el('span', { class: 'chip ' + r.cls }, [
          el('span', { class: 'chip-ico', text: r.icon }),
          el('span', { class: 'chip-val', text: fmt(s.resources[r.id] || 0) }),
          el('span', { class: 'chip-rate', text: rate(rt || 0), style: (rt < 0 ? 'color:var(--bad)' : '') })
        ]);
        res.appendChild(chip);
      });
      var stage = GD.rulerStages[s.herrscher.stage];
      var rm = $('ruler-mini');
      clear(rm);
      append(rm, [
        el('span', { class: 'rm-emoji', text: stage.icon }),
        el('span', { class: 'rm-lvl', text: 'Lv ' + s.herrscher.level })
      ]);
      var wt = $('watch-toggle');
      if (wt) {
        var watching = !!(s.settings && s.settings.watch);
        if (!wt.textContent) wt.textContent = '👁️';
        wt.classList.toggle('on', watching);
        wt.title = watching ? 'Zuschauer-Modus läuft – tippen zum Stoppen' : 'Zuschauer-Modus starten';
      }
    },

    // ---------- Tabbar ----------
    tabs: [
      { id: 'uebersicht', icon: '📜', label: 'Übersicht' },
      { id: 'reich', icon: '🏰', label: 'Reich' },
      { id: 'kreaturen', icon: '🐉', label: 'Kreaturen' },
      { id: 'magie', icon: '🔮', label: 'Magie' },
      { id: 'schmiede', icon: '⚒️', label: 'Schmiede' },
      { id: 'karte', icon: '🗺️', label: 'Karte' }
    ],
    renderTabbar: function () {
      var self = this;
      var bar = $('tabbar');
      clear(bar);
      // Falls der aktive Tab (noch) gesperrt ist: auf Übersicht zurückfallen
      if (!SYS.tabUnlocked(this.state, this.activeTab)) this.activeTab = 'uebersicht';
      this.tabs.filter(function (t) { return SYS.tabUnlocked(self.state, t.id); }).forEach(function (t) {
        var b = el('button', {
          type: 'button',
          class: 'tab' + (self.activeTab === t.id ? ' active' : ''),
          onclick: function () { self.activeTab = t.id; self.renderTabbar(); self.render(); }
        }, [
          el('span', { class: 'tab-ico', text: t.icon }),
          el('span', { class: 'tab-label', text: t.label })
        ]);
        if (t.id === 'karte' && (self.state.expeditions.length || self.state.raid)) b.appendChild(el('span', { class: 'tab-dot' }));
        bar.appendChild(b);
      });
    },

    render: function () {
      var screen = $('screen');
      var sc = screen.scrollTop;
      clear(screen);
      var fn = this.views[this.activeTab];
      var view = fn ? fn.call(this) : el('div');
      view.className = (view.className ? view.className + ' ' : '') + 'game-view game-view-' + this.activeTab;
      screen.setAttribute('data-view', this.activeTab);
      $('app').setAttribute('data-view', this.activeTab);
      screen.appendChild(view);
      screen.scrollTop = sc;
    },

    title: function (t, sub, topic) {
      var self = this;
      return el('div', { class: 'view-title' }, [
        el('h2', { text: t }),
        sub ? el('span', { class: 'sub', text: sub }) : null,
        topic ? el('button', { type: 'button', class: 'info-btn', style: 'margin-left:auto', 'aria-label': 'Hilfe', onclick: function () { self.openHelpModal(topic); } }, [el('span', { text: 'ℹ️' })]) : null
      ]);
    },

    // Sektions-Überschrift mit optionalem ℹ️-Erklärknopf
    secLabel: function (text, topic) {
      var self = this;
      return el('div', { class: 'section-label' + (topic ? ' with-info' : '') }, [
        el('span', { text: text }),
        topic ? el('button', { type: 'button', class: 'info-btn', 'aria-label': 'Erklärung', onclick: function () { self.openHelpModal(topic); } }, [el('span', { text: 'ℹ️' })]) : null
      ]);
    },

    // Erklär-Modal zu einem Hilfe-Thema
    openHelpModal: function (topic) {
      var h = GD.help[topic];
      if (!h) return;
      var content = el('div', null, [
        el('p', { class: 'muted', text: h.text }),
        el('ul', { class: 'help-list' }, (h.steps || []).map(function (st) { return el('li', { text: st }); }))
      ]);
      openModal(h.title, content, h.icon);
    },

    // ============================================================
    //  Views
    // ============================================================
    views: {
      // ---- Übersicht ----
      uebersicht: function () {
        var s = this.state, self = this;
        var box = el('div');
        var stage = GD.rulerStages[s.herrscher.stage];
        var rp = SYS.rulerPower(s);
        var rxpNeed = SYS.rulerXpForLevel(s.herrscher.level);

        function sceneLink(tab, icon, label, hint, pos, size) {
          if (!SYS.tabUnlocked(s, tab)) return null;
          var style = 'left:' + pos[0] + '%;top:' + pos[1] + '%';
          if (size) style += ';--hs-w:' + size[0] + 'px;--hs-h:' + size[1] + 'px';
          return el('button', {
            type: 'button',
            class: 'scene-hotspot scene-hotspot-' + tab,
            style: style,
            'aria-label': label + ' – ' + hint,
            onclick: function () { self.activeTab = tab; self.renderTabbar(); self.render(); }
          }, [
            el('span', { class: 'scene-hotspot-copy' }, [el('b', { text: icon + ' ' + label }), el('small', { text: hint })])
          ]);
        }
        box.appendChild(el('section', { class: 'kingdom-scene', 'aria-label': 'Interaktive Ansicht des Königreichs Tempest' }, [
          el('div', { class: 'scene-shade' }),
          el('div', { class: 'scene-heading' }, [
            el('span', { class: 'scene-kicker', text: 'HAUPTSTADT DES JURA-BUNDES' }),
            el('h1', { text: s.reich }),
            el('p', { text: 'Dein Monsterreich wächst mit jeder Entscheidung.' })
          ]),
          sceneLink('reich', '🏰', 'Stadtbezirke', 'Bauen & ausbauen', [47, 34], [150, 120]),
          sceneLink('magie', '🔮', 'Arkane Akademie', 'Zauber & Forschung', [29, 41], [108, 92]),
          sceneLink('schmiede', '⚒️', 'Große Schmiede', 'Ausrüstung fertigen', [62, 32], [104, 88]),
          sceneLink('karte', '🗺️', 'Abenteuertor', 'Armeen befehligen', [19, 78], [120, 92]),
          el('div', { class: 'scene-status' }, [
            el('span', { text: '👑 ' + stage.name }),
            el('span', { text: '⚔ ' + fmt(rp) + ' Kampfkraft' }),
            el('span', { text: '🏳 ' + s.claimedRegions.length + ' Territorien' })
          ])
        ]));

        box.appendChild(el('div', { class: 'hero ruler-card' }, [
          el('div', { class: 'hero-top' }, [
            el('div', { class: 'hero-emoji', text: stage.icon }),
            el('div', { style: 'flex:1;min-width:0' }, [
              el('div', { class: 'hero-name', text: s.herrscher.name }),
              el('div', { class: 'hero-stage', text: stage.name + ' · Herrscher von ' + s.reich }),
              el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px', text: 'Level ' + s.herrscher.level + ' · Kampfkraft ' + fmt(rp) })
            ]),
            btn('⚙', function () { self.openRulerModal(); }, { small: true, cls: 'btn-ghost' })
          ]),
          el('div', { style: 'margin-top:10px' }, [
            bar(s.herrscher.level >= SYS.RULER_LEVELCAP ? 1 : s.herrscher.xp / rxpNeed, 'xp'),
            el('div', { class: 'bar-label', text: s.herrscher.level >= SYS.RULER_LEVELCAP ? 'Maximales Level' : ('EP ' + Math.floor(s.herrscher.xp) + ' / ' + rxpNeed) })
          ])
        ]));

        // Aktuelles Ziel (geführte Aufgabenkette)
        var aq = SYS.activeQuest(s);
        if (aq) {
          box.appendChild(el('div', { class: 'card quest-card' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: aq.icon }),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name' }, ['🎯 ' + aq.title, el('span', { class: 'pill', text: 'Ziel ' + (SYS.activeQuestIndex(s) + 1) + '/' + SYS.questCount() })]),
                el('div', { class: 'meta', text: aq.desc + (aq.progress ? ('  ·  ' + aq.progress(s)) : '') })
              ])
            ]),
            el('div', { class: 'card-stats' }, [el('span', null, ['Belohnung: ', el('b', { text: costText(aq.reward) })])])
          ]));
        } else {
          box.appendChild(el('div', { class: 'card quest-card' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: '🏆' }),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name', text: '🎯 Alle Ziele erfüllt!' }),
                el('div', { class: 'meta', text: 'Du hast das Reich gemeistert – herrsche weiter, wie es dir gefällt.' })
              ])
            ])
          ]));
        }

        // Offenes Ereignis (Wahl-Event)
        if (s.activeEvent) {
          var aev = GD.event(s.activeEvent);
          if (aev) box.appendChild(el('div', { class: 'card', style: 'border-color:var(--accent-2)' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: aev.icon }),
              el('div', { class: 'card-title' }, [el('div', { class: 'name', text: aev.title }), el('div', { class: 'meta', text: 'Ein Ereignis wartet auf deine Entscheidung.' })])
            ]),
            el('div', { class: 'card-actions' }, [btn('Entscheiden', function () { self.openEventModal(s.activeEvent); }, { small: true, cls: 'btn-gold' })])
          ]));
        }
        // Aktive temporäre Effekte
        var activeBuffs = (s.tempBuffs || []).filter(function (tb) { return tb.untilTick > s.tick; });
        if (activeBuffs.length) {
          var bp = el('div', { class: 'row wrap', style: 'gap:5px;margin-bottom:8px' });
          activeBuffs.forEach(function (tb) { bp.appendChild(el('span', { class: 'pill', text: '⏳ ' + (tb.label || 'Effekt') + ' (' + (tb.untilTick - s.tick) + 's)' })); });
          box.appendChild(bp);
        }

        // Zuschauer-/Auto-Modus
        var watchOn = !!(s.settings && s.settings.watch);
        var watchDetailed = !!(s.settings && s.settings.watchDetailed);
        var watchCard = el('div', { class: 'card watch-card' + (watchOn ? ' watch-on' : '') }, [
          el('div', { class: 'card-head' }, [
            el('div', { class: 'card-emoji', text: '👁️' }),
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name' }, ['Zuschauer-Modus', watchOn ? el('span', { class: 'pill tag-ok', text: '● aktiv' }) : null]),
              el('div', { class: 'meta', text: watchOn ? 'Dein Reich spielt sich gerade selbst – ein Berater handelt für dich.' : 'Lehn dich zurück und sieh deinem Reich beim Wachsen zu.' })
            ]),
            el('button', { type: 'button', class: 'info-btn', 'aria-label': 'Erklärung', onclick: function () { self.openHelpModal('watch'); } }, [el('span', { text: 'ℹ️' })])
          ]),
          el('div', { class: 'card-actions' }, [
            btn(watchOn ? '⏸ Stoppen' : '▶ Starten', function () {
              s.settings.watch = !watchOn;
              toast(s.settings.watch ? '👁️ Zuschauer-Modus an' : '⏸ Zuschauer-Modus aus', s.settings.watch ? 'gold' : '');
              self.commit();
            }, { small: true, cls: watchOn ? '' : 'btn-primary' }),
            btn(watchDetailed ? '🎬 Sichtbar: an' : '🎬 Sichtbar: aus', function () {
              s.settings.watchDetailed = !watchDetailed;
              s.settings.watchCooldownUntil = s.tick;
              toast(s.settings.watchDetailed ? '🎬 Sichtbare Einzelschritte aktiviert' : '⚡ Schneller Auto-Modus aktiviert', 'gold');
              self.commit();
            }, { small: true, cls: watchDetailed ? 'btn-gold' : '' }),
            btn('⏩ Vorspulen 5 min', function () { self.fastForward(300); }, { small: true })
          ]),
          watchDetailed ? el('div', { class: 'card-desc', text: 'Einzelschritte erscheinen als kurzer Dialog; der Berater pausiert jeweils 3 Sekunden.' }) : null
        ]);
        if ((s.settings.watchHistory || []).length) {
          var wh = el('div', { class: 'watch-history' });
          s.settings.watchHistory.slice(0, 4).forEach(function (entry) {
            wh.appendChild(el('div', { class: 'watch-history-row', text: 'T+' + entry.tick + ' · ' + entry.text }));
          });
          watchCard.appendChild(wh);
        }
        box.appendChild(watchCard);

        // Onboarding: nächste Freischaltungen als Ausblick
        var goalIds = ['tab_karte', 'tab_magie', 'tab_schmiede', 'affinitaet', 'fusion'].filter(function (id) { return !SYS.featureUnlocked(s, id); });
        if (goalIds.length) {
          box.appendChild(this.secLabel('Als Nächstes', 'start'));
          var gl = el('div', { class: 'grid' });
          goalIds.slice(0, 2).forEach(function (id) {
            var f = SYS.FEATURES[id];
            gl.appendChild(el('div', { class: 'card teaser' }, [
              el('div', { class: 'card-head' }, [
                el('div', { class: 'card-emoji', text: f.icon }),
                el('div', { class: 'card-title' }, [
                  el('div', { class: 'name' }, [f.name, el('span', { class: 'pill', text: '🔒' })]),
                  el('div', { class: 'meta', text: SYS.featureHint(id) })
                ])
              ])
            ]));
          });
          box.appendChild(gl);
        }

        // KPIs
        var army = s.creatures.filter(function (c) { return c.job === 'armee'; });
        var armyPower = SYS.expeditionPower(s, army.map(function (c) { return c.uid; }), false);
        var def = (s.buildings.labyrinth || 0) * 60;
        def = Math.round(def * (1 + SYS.computeBonuses(s).verteidigung));
        box.appendChild(el('div', { class: 'kpi-row' }, [
          el('div', { class: 'kpi' }, [el('div', { class: 'k', text: 'Kreaturen' }), el('div', { class: 'v', text: SYS.usedCapacity(s) + ' / ' + SYS.capacity(s) })]),
          el('div', { class: 'kpi' }, [el('div', { class: 'k', text: 'Armee-Kraft' }), el('div', { class: 'v', text: fmt(armyPower) })]),
          el('div', { class: 'kpi' }, [el('div', { class: 'k', text: 'Territorien' }), el('div', { class: 'v', text: s.claimedRegions.length + ' / ' + GD.regions.length })]),
          el('div', { class: 'kpi' }, [el('div', { class: 'k', text: 'Verteidigung' }), el('div', { class: 'v', text: fmt(def) })])
        ]));

        // Produktion
        var prod = SYS.production(s);
        if (prod.hunger) box.appendChild(el('div', { class: 'log-entry bad', text: '⚠️ Hungersnot! Baue Farmen oder reduziere Kreaturen – Produktion halbiert.' }));
        box.appendChild(el('div', { class: 'section-label', text: 'Produktion / Sek.' }));
        var pr = el('div', { class: 'card-stats', style: 'gap:6px 14px' });
        GD.resources.forEach(function (r) {
          var v = (r.id === 'nahrung') ? prod.rates.nahrung : prod.rates[r.id];
          pr.appendChild(el('span', null, [r.icon + ' ', el('b', { text: rate(v || 0), style: (v < 0 ? 'color:var(--bad)' : '') })]));
        });
        box.appendChild(pr);

        // Log
        box.appendChild(el('div', { class: 'section-label', text: 'Chronik' }));
        var logBox = el('div', { class: 'log' });
        var entries = s.log.slice(-7).reverse();
        if (!entries.length) logBox.appendChild(el('div', { class: 'empty-hint', text: 'Noch nichts geschehen.' }));
        entries.forEach(function (e) { logBox.appendChild(el('div', { class: 'log-entry ' + (e.kind || ''), text: e.text })); });
        box.appendChild(logBox);
        return box;
      },

      // ---- Reich (Gebäude) ----
      reich: function () {
        var s = this.state, self = this;
        var box = el('div');
        box.appendChild(this.title('Reich ' + s.reich, 'Baue und rüste deine Bezirke auf', 'reich'));
        box.appendChild(el('div', { class: 'empty-hint', style: 'text-align:left', text: 'Kapazität: ' + SYS.usedCapacity(s) + ' / ' + SYS.capacity(s) + ' Kreaturen. Höhere Stufen = mehr Produktion.' }));

        function buildCard(bd) {
          var lvl = s.buildings[bd.id] || 0;
          var cost = SYS.buildingCost(s, bd.id);
          var afford = SYS.canAfford(s, cost);
          var effs = [];
          if (bd.producePer) for (var r in bd.producePer) effs.push('+' + (bd.producePer[r]) + ' ' + resIcon(r) + '/Stufe');
          if (bd.capacityPer) effs.push('+' + bd.capacityPer + ' Kapazität/Stufe');
          if (bd.effect) { for (var ek in bd.effect) effs.push('+' + Math.round(bd.effect[ek] * 100) + ' % ' + bonusName(ek) + '/Stufe'); }
          if (bd.special === 'summon') effs.push('Beschwörung: höherer Rang & günstiger');
          if (bd.special === 'craft') effs.push('Schmieden & bessere Qualität');
          if (bd.special === 'fieldMagic') effs.push('Aktive Kampf- & Abenteuerzauber');
          if (bd.special === 'defense') effs.push('+' + bd.defensePer + ' Verteidigung/Stufe');
          return el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: bd.icon }),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name' }, [bd.name, el('span', { class: 'pill', text: 'Stufe ' + lvl })]),
                el('div', { class: 'meta', text: bd.cat })
              ])
            ]),
            el('div', { class: 'card-desc', text: bd.desc }),
            el('div', { class: 'card-stats' }, effs.map(function (t) { return el('span', { text: t }); })),
            el('div', { class: 'card-actions' }, [
              btn(lvl === 0 ? 'Bauen' : 'Aufrüsten', function () {
                var r = SYS.build(s, bd.id);
                if (!r.ok) toast((r.missing || ['Nicht genug Ressourcen']).join(', '), 'bad');
                self.commit();
              }, { cls: 'btn-primary', disabled: !afford, cost: costText(cost) })
            ])
          ]);
        }

        var grid = el('div', { class: 'grid', style: 'margin-top:10px' });
        GD.buildings.forEach(function (bd) { if (SYS.buildingUnlocked(s, bd.id)) grid.appendChild(buildCard(bd)); });
        box.appendChild(grid);

        // Ausblick: die nächsten gesperrten Gebäude
        var locked = GD.buildings.filter(function (bd) { return !SYS.buildingUnlocked(s, bd.id); }).slice(0, 2);
        if (locked.length) {
          box.appendChild(this.secLabel('Bald verfügbar'));
          var lg = el('div', { class: 'grid' });
          locked.forEach(function (bd) {
            lg.appendChild(el('div', { class: 'card teaser' }, [
              el('div', { class: 'card-head' }, [
                el('div', { class: 'card-emoji', text: bd.icon }),
                el('div', { class: 'card-title' }, [
                  el('div', { class: 'name' }, [bd.name, el('span', { class: 'pill', text: '🔒' })]),
                  el('div', { class: 'meta', text: SYS.buildingHint(bd.id) })
                ])
              ]),
              el('div', { class: 'card-desc', text: bd.desc })
            ]));
          });
          box.appendChild(lg);
        }
        return box;
      },

      // ---- Kreaturen ----
      kreaturen: function () {
        var s = this.state, self = this;
        var box = el('div');
        box.appendChild(this.title('Kreaturen', 'Beschwören · Benennen · Entwickeln', 'kreaturen'));
        box.appendChild(el('div', { class: 'name-seal' }, [
          el('div', { class: 'name-seal-icon', text: '🔤' }),
          el('div', { style: 'flex:1' }, [
            el('b', { text: 'Namenssiegel ' + SYS.namedCount(s) + ' / ' + SYS.nameCapacity(s) }),
            el('div', { class: 'muted', style: 'font-size:11px', text: 'Wahre Namen sind auf 40 % des Gefolges und absolut 20 Eliten begrenzt. Jeder weitere Name kostet deutlich mehr.' }),
            bar(SYS.namedCount(s) / Math.max(1, SYS.nameCapacity(s)))
          ])
        ]));

        // Beschwören
        box.appendChild(this.secLabel('Beschwörungskreis (Rufstufe ' + (SYS.maxSummonRankIndex(s) + 1) + ')', 'kreaturen'));
        var sgrid = el('div', { class: 'grid two' });
        SYS.summonableSpecies(s).forEach(function (sp) {
          var cost = SYS.summonCost(s, sp.id);
          var check = SYS.canSummon(s, sp.id);
          sgrid.appendChild(el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
              creatureArt(sp),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name' }, [sp.name, el('span', { class: 'pill', text: 'Basistrupp' })]),
                el('div', { class: 'meta', text: sp.role + ' · wird in der Herrscherarmee gestapelt' })
              ])
            ]),
            btn('Beschwören', function () {
              var r = SYS.summon(s, sp.id);
              if (!r.ok) toast(r.reason, 'bad');
              self.commit();
            }, { cls: 'btn-primary', small: true, disabled: !check.ok, cost: costText(cost) })
          ]));
        });
        // Ausblick: Grundformen des nächsten Rangs (gesperrt)
        SYS.summonTeasers(s).forEach(function (sp) {
          sgrid.appendChild(el('div', { class: 'card teaser' }, [
            el('div', { class: 'card-head' }, [
              creatureArt(sp),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name' }, [sp.name, el('span', { class: 'pill', text: 'neuer Basistrupp' })]),
                el('div', { class: 'meta', text: '🔒 Beschwörungskreis ausbauen' })
              ])
            ])
          ]));
        });
        box.appendChild(sgrid);

        // Fusion (Endgame)
        if (SYS.featureUnlocked(s, 'fusion')) {
          box.appendChild(this.secLabel('Chimära-Fusion', 'fusion'));
          box.appendChild(el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: '🧬' }),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name', text: 'Kreaturen verschmelzen' }),
                el('div', { class: 'meta', text: 'Verschmilz zwei benannte Eliten: eine wird dauerhaft verstärkt (+15 % Werte), die andere überträgt einen Skill.' })
              ])
            ]),
            el('div', { class: 'card-actions' }, [btn('Fusion starten', function () { self.openFusionModal(); }, { small: true, cls: 'btn-gold' })])
          ]));
        }

        // Bestehende Kreaturen
        box.appendChild(this.secLabel('Dein Gefolge (' + SYS.totalCreatureCount(s) + ' Einheiten in ' + s.creatures.length + ' Stapeln/Eliten)'));
        if (!s.creatures.length) box.appendChild(el('div', { class: 'empty-hint', text: 'Beschwöre deine erste Kreatur.' }));
        var list = el('div', { class: 'grid' });
        s.creatures.forEach(function (c) { list.appendChild(self.creatureCard(c)); });
        box.appendChild(list);
        return box;
      },

      // ---- Magie / Forschung ----
      magie: function () {
        var s = this.state, self = this;
        var box = el('div');
        box.appendChild(this.title('Magie & Forschung', 'Aktive Feldmagie · Reichsrituale · Ausbau', 'magie'));
        var b = SYS.computeBonuses(s);
        var sum = [];
        if (b.produktionAll) sum.push('Produktion +' + pct(b.produktionAll));
        if (b.produktionMagie) sum.push('Magie +' + pct(b.produktionMagie));
        if (b.armee) sum.push('Armee +' + pct(b.armee));
        if (b.verteidigung) sum.push('Verteidigung +' + pct(b.verteidigung));
        if (b.expedTempo) sum.push('Expedition −' + pct(b.expedTempo));
        if (b.kapazitaet) sum.push('Kapazität +' + Math.round(b.kapazitaet));
        if (b.summonRang) sum.push('Beschwörungsrang +' + b.summonRang);
        if (b.produce) { for (var pk in b.produce) sum.push('+' + b.produce[pk] + ' ' + resIcon(pk) + '/s'); }
        sum.push('Wissen +' + pct(b.wissen));
        box.appendChild(el('div', { class: 'magic-lanes' }, [
          el('div', { class: 'magic-lane active' }, [el('b', { text: '🪄 Feldmagie' }), el('span', { text: 'Kampf & Abenteuer' })]),
          el('div', { class: 'magic-lane ritual' }, [el('b', { text: '🔮 Reichsrituale' }), el('span', { text: 'dauerhafte Boni' })]),
          el('div', { class: 'magic-lane research' }, [el('b', { text: '📚 Forschung' }), el('span', { text: 'Freischaltungen' })])
        ]));
        box.appendChild(el('div', { class: 'empty-hint', style: 'text-align:left', text: 'Aktive Reichsritual-Boni: ' + sum.join(' · ') }));

        // Aktive Feldmagie: eigenes Gebäude und eigenes Zauberbuch.
        var academy = s.buildings.arkane_akademie || 0;
        box.appendChild(this.secLabel('Arkane Akademie · Stufe ' + academy, 'magie'));
        if (academy < 1) {
          var academyUnlocked = SYS.buildingUnlocked(s, 'arkane_akademie');
          box.appendChild(el('div', { class: 'card magic-academy' }, [
            el('div', { class: 'card-head' }, [el('div', { class: 'card-emoji', text: '🪄' }), el('div', { class: 'card-title' }, [
              el('div', { class: 'name', text: 'Aktive Magie freischalten' }),
              el('div', { class: 'meta', text: academyUnlocked ? 'Baue die Arkane Akademie im Reich-Tab.' : SYS.buildingHint('arkane_akademie') })
            ])])
          ]));
        } else {
          ['combat', 'adventure'].forEach(function (type) {
            box.appendChild(el('div', { class: 'sub-label', text: type === 'combat' ? '⚔️ Kampfzauber' : '🗺️ Abenteuerzauber' }));
            var fieldGrid = el('div', { class: 'grid' });
            GD.fieldMagic.filter(function (spell) { return spell.type === type; }).forEach(function (spell) {
              var learned = SYS.isFieldMagicLearned(s, spell.id), learnCheck = SYS.canLearnFieldMagic(s, spell.id);
              var action;
              if (!learned) action = btn('Lernen', function () {
                var r = SYS.learnFieldMagic(s, spell.id); if (!r.ok) toast(r.reason, 'bad'); else toast(spell.name + ' gelernt!', 'gold'); self.commit();
              }, { cls: 'btn-primary', small: true, disabled: !learnCheck.ok, cost: costText(spell.cost) });
              else if (type === 'combat') action = el('span', { class: 'pill tag-ok', text: '✓ Im Rasterkampf verfügbar' });
              else action = btn('Auf Armee wirken', function () { self.openAdventureMagicModal(spell); }, { cls: 'btn-gold', small: true, cost: costText(spell.castCost) });
              fieldGrid.appendChild(el('div', { class: 'card' + (spell.academy > academy ? ' teaser' : '') }, [
                el('div', { class: 'card-head' }, [el('div', { class: 'card-emoji', text: spell.icon }), el('div', { class: 'card-title' }, [
                  el('div', { class: 'name' }, [spell.name, el('span', { class: 'pill', text: spell.school }), el('span', { class: 'pill', text: 'Akademie ' + spell.academy })]),
                  el('div', { class: 'meta', text: spell.desc })
                ])]),
                type === 'adventure' && learned ? el('div', { class: 'meta', text: 'Abklingzeit: ' + (SYS.adventureMagicCooldown(s, spell.id) || 0) + ' s · regulär ' + spell.cooldown + ' s' }) : null,
                el('div', { class: 'card-actions' }, [action])
              ]));
            });
            box.appendChild(fieldGrid);
          });
        }

        // Affinität
        box.appendChild(this.secLabel('Affinität', 'magie'));
        if (s.affinity) {
          var aff = GD.affinity(s.affinity);
          box.appendChild(el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: aff.icon }),
              el('div', { class: 'card-title' }, [el('div', { class: 'name', text: aff.name }), el('div', { class: 'meta', text: aff.desc })])
            ])
          ]));
        } else {
          var ca = SYS.canChooseAffinity(s);
          box.appendChild(el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: '🌟' }),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name', text: 'Noch keine Affinität' }),
                el('div', { class: 'meta', text: ca.ok ? 'Wähle eine Element-Affinität für einen dauerhaften Bonus.' : ca.reason })
              ])
            ]),
            el('div', { class: 'card-actions' }, [btn('Affinität wählen', function () { self.openAffinityModal(); }, { small: true, cls: 'btn-gold', disabled: !ca.ok })])
          ]));
        }

        // ---- Forschungsbaum (schaltet Magie-Tiers, Ausrüstungs-Slots & Boni frei) ----
        box.appendChild(this.secLabel('Königreichsausbau & Forschung (Ritual-Tier ' + SYS.unlockedMagicTier(s) + ')', 'magie'));
        function researchCard(node) {
          var done = SYS.isResearched(s, node.id);
          var chk = SYS.canResearch(s, node.id);
          var action = done
            ? el('span', { class: 'pill tag-ok', text: '✓ Erforscht' })
            : btn('Erforschen', function () {
                var r = SYS.doResearch(s, node.id);
                if (!r.ok) toast(r.reason, 'bad'); else toast(node.name + ' erforscht!', 'gold');
                self.commit();
              }, { cls: 'btn-primary', small: true, disabled: !chk.ok, cost: costText(node.cost) });
          return el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: node.icon }),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name' }, [node.name, el('span', { class: 'pill', text: node.zweig })]),
                el('div', { class: 'meta', text: node.desc })
              ])
            ]),
            (!done && !chk.ok && chk.reason) ? el('div', { class: 'card-desc', style: 'color:var(--warn)', text: 'Voraussetzung: ' + chk.reason }) : null,
            el('div', { class: 'card-actions' }, [action])
          ]);
        }
        // Nur erforschte + direkt verfügbare Knoten zeigen (Baum enthüllt sich nach und nach)
        function researchVisible(node) {
          if (SYS.isResearched(s, node.id)) return true;
          var reqs = (node.req && node.req.research) || [];
          for (var i = 0; i < reqs.length; i++) { if (!SYS.isResearched(s, reqs[i])) return false; }
          return true;
        }
        ['Magie', 'Ausrüstung', 'Reich'].forEach(function (zweig) {
          var nodes = GD.research.filter(function (n) { return n.zweig === zweig && researchVisible(n); });
          if (!nodes.length) return;
          box.appendChild(el('div', { class: 'sub-label', text: zweig }));
          var rg = el('div', { class: 'grid' });
          nodes.forEach(function (n) { rg.appendChild(researchCard(n)); });
          box.appendChild(rg);
        });

        // ---- Reichsrituale (dauerhafte Boni; getrennt von aktiver Feldmagie) ----
        box.appendChild(this.secLabel('Reichsrituale · dauerhafte Boni', 'magie'));
        var maxTier = SYS.unlockedMagicTier(s);
        var byTier = {};
        GD.magic.forEach(function (m) { (byTier[m.tier] = byTier[m.tier] || []).push(m); });
        Object.keys(byTier).map(Number).sort(function (a, b) { return a - b; }).forEach(function (tier) {
          if (tier > maxTier + 1) return;                 // ferne Tiers ausblenden
          var teaser = tier > maxTier;                    // erster gesperrter Tier = Ausblick
          var label = (tier >= 11 ? 'Super-Tier' : 'Tier ' + tier) + (teaser ? ' · Ausblick 🔒' : '');
          box.appendChild(el('div', { class: 'section-label', text: label }));
          if (teaser) box.appendChild(el('div', { class: 'empty-hint', style: 'text-align:left', text: 'Erforsche den nächsten Ritual-Tier, um diese Reichswirkungen freizuschalten.' }));
          var grid = el('div', { class: 'grid' });
          byTier[tier].forEach(function (m) {
            if (teaser) {
              grid.appendChild(el('div', { class: 'card teaser' }, [
                el('div', { class: 'card-head' }, [
                  el('div', { class: 'card-emoji', text: m.icon }),
                  el('div', { class: 'card-title' }, [
                    el('div', { class: 'name' }, [m.name, el('span', { class: 'pill', text: m.schule })]),
                    el('div', { class: 'meta', text: m.desc })
                  ])
                ])
              ]));
              return;
            }
            var learned = SYS.isLearned(s, m.id);
            var check = SYS.canLearn(s, m.id);
            grid.appendChild(el('div', { class: 'card' }, [
              el('div', { class: 'card-head' }, [
                el('div', { class: 'card-emoji', text: m.icon }),
                el('div', { class: 'card-title' }, [
                  el('div', { class: 'name' }, [m.name, el('span', { class: 'pill', text: m.schule })]),
                  el('div', { class: 'meta', text: m.desc })
                ])
              ]),
              learned
                ? el('div', { class: 'row' }, el('span', { class: 'pill tag-ok', text: '✓ Erforscht' }))
                : btn('Ritual verankern', function () {
                    var r = SYS.learnMagic(s, m.id);
                    if (!r.ok) toast(r.reason, 'bad'); else toast(m.name + ' erforscht!', 'gold');
                    self.commit();
                  }, { cls: 'btn-primary', small: true, disabled: !check.ok, cost: costText(m.cost) })
            ]));
          });
          box.appendChild(grid);
        });
        return box;
      },

      // ---- Schmiede ----
      schmiede: function () {
        var s = this.state, self = this;
        var box = el('div');
        box.appendChild(this.title('Runenschmiede', 'Baupläne entschlüsseln · Ausrüstung dauerhaft veredeln', 'schmiede'));
        if ((s.buildings.schmiede || 0) < 1) {
          box.appendChild(el('div', { class: 'empty-hint', text: '⚒️ Baue zuerst die Schmiede im Reich-Tab.' }));
        } else {
          var materialShelf = el('div', { class: 'forge-materials', 'aria-label': 'Schmiedekomponenten' });
          GD.forgeMaterials.forEach(function (material) {
            materialShelf.appendChild(el('div', { class: 'forge-material ' + material.cls, title: material.desc + ' Fundort: ' + material.source }, [
              el('span', { class: 'forge-material-icon', text: material.icon }),
              el('span', null, [el('b', { text: fmt(SYS.forgeMaterialAmount(s, material.id)) }), el('small', { text: material.name })])
            ]));
          });
          box.appendChild(materialShelf);
          box.appendChild(el('p', { class: 'forge-lead', text: 'Jeder Bauplan erzeugt höchstens ein Stück. Schlachtfunde liefern Baupläne oder seltene Komponenten, mit denen dieses Stück bis Göttlich wächst.' }));

          var forgeLayout = el('div', { class: 'forge-layout' });
          var blueprints = el('section', { class: 'forge-panel blueprint-panel' });
          blueprints.appendChild(el('div', { class: 'forge-panel-head' }, [
            el('div', null, [el('b', { text: '📜 Bauplanarchiv' }), el('small', { text: (s.unlockedRecipes || []).length + '/' + GD.recipes.length + ' entschlüsselt' })]),
            el('span', { class: 'pill', text: 'Schmiede ' + s.buildings.schmiede })
          ]));
          var recipeList = el('div', { class: 'blueprint-list' });
          GD.recipes.forEach(function (rc) {
            var known = SYS.isRecipeUnlocked(s, rc.id), owned = SYS.itemForRecipe(s, rc.id);
            var craftCheck = SYS.canCraft(s, rc.id), unlockCheck = SYS.canUnlockRecipe(s, rc.id);
            var blueprintCost = SYS.recipeBlueprintCost(s, rc.id);
            var stateText = known ? (owned ? ('Im Arsenal · ' + GD.rarity(owned.rarity).name) : 'Bauplan bereit')
              : (unlockCheck.ok ? 'Entschlüsselbar' : (unlockCheck.reason || 'Gesperrt'));
            recipeList.appendChild(el('article', { class: 'blueprint-card ' + (known ? 'known' : 'locked') + (owned ? ' owned' : '') }, [
              el('div', { class: 'card-head' }, [
                el('div', { class: 'card-emoji', text: rc.icon }),
                el('div', { class: 'card-title' }, [
                  el('div', { class: 'name' }, [rc.name, el('span', { class: 'pill', text: slotName(rc.slot) })]),
                  el('div', { class: 'meta', text: rc.desc }),
                  el('div', { class: 'blueprint-state', text: stateText })
                ])
              ]),
              statsLine(rc.stats),
              known
                ? (owned
                  ? el('div', { class: 'blueprint-owned', text: '✓ Einmaliges Schmiedestück vorhanden' })
                  : btn('Einmalig schmieden', function () {
                      var result = SYS.craft(s, rc.id);
                      if (!result.ok) toast(result.reason, 'bad'); else toast('⚒️ ' + result.item.name + ' geschmiedet.', 'good');
                      self.commit();
                    }, { cls: 'btn-primary', small: true, disabled: !craftCheck.ok, cost: costText(rc.cost) }))
                : btn('Bauplan entschlüsseln', function () {
                    var result = SYS.unlockRecipe(s, rc.id, false);
                    if (!result.ok) toast(result.reason, 'bad'); else toast('📜 ' + rc.name + ' freigeschaltet!', 'gold');
                    self.commit();
                  }, { cls: 'btn-gold', small: true, disabled: !unlockCheck.ok, cost: forgeCostText(blueprintCost) })
            ]));
          });
          blueprints.appendChild(recipeList); forgeLayout.appendChild(blueprints);

          var arsenal = el('section', { class: 'forge-panel arsenal-panel' });
          arsenal.appendChild(el('div', { class: 'forge-panel-head' }, [
            el('div', null, [el('b', { text: '🔥 Langlebiges Arsenal' }), el('small', { text: s.inventory.length + ' begrenzte Schmiedestücke' })]),
            el('span', { class: 'pill', text: 'keine Zufallsduplikate' })
          ]));
          if (!s.inventory.length) arsenal.appendChild(el('div', { class: 'empty-hint', text: 'Noch kein Schmiedestück. Stelle einen bekannten Bauplan einmalig her.' }));
          var inv = el('div', { class: 'arsenal-list' });
          s.inventory.slice().sort(function (a, b) { return SYS.itemQuality(b) - SYS.itemQuality(a) || a.name.localeCompare(b.name); })
            .forEach(function (it) { inv.appendChild(self.itemCard(it)); });
          arsenal.appendChild(inv); forgeLayout.appendChild(arsenal);
          box.appendChild(forgeLayout);
        }

        // Diablo-artige Ausrüstungsübersicht: feste Körperpositionen und zwei Accessoires.
        box.appendChild(this.secLabel('Ausrüstungsplätze', 'schmiede'));
        function loadout(label, icon, equipment) {
          var slots = el('div', { class: 'loadout-grid' });
          GD.equipSlots.forEach(function (sl) {
            var unlocked = SYS.slotUnlocked(s, sl.id), item = equipment && equipment[sl.id] != null ? SYS.findItem(s, equipment[sl.id]) : null;
            slots.appendChild(el('button', {
              type: 'button', class: 'loadout-slot' + (!unlocked ? ' locked' : '') + (item ? ' filled' : ''),
              disabled: !unlocked,
              title: item ? item.name : sl.name,
              onclick: item ? function () { SYS.unequipItem(s, item.uid); toast(item.name + ' abgelegt.', ''); self.commit(); } : null
            }, [
              el('span', { class: 'loadout-icon', text: item ? item.icon : (unlocked ? sl.icon : '🔒') }),
              el('span', { class: 'loadout-name', text: item ? item.name : sl.name })
            ]));
          });
          return el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [el('div', { class: 'card-emoji', text: icon }), el('div', { class: 'card-title' }, [el('div', { class: 'name', text: label }), el('div', { class: 'meta', text: 'Nur Herrscher und benannte Elite können Ausrüstung tragen.' })])]),
            slots
          ]);
        }
        box.appendChild(loadout('Herrscher · ' + s.herrscher.name, GD.rulerStages[s.herrscher.stage].icon, s.herrscher.equipment));
        s.creatures.filter(function (c) { return c.named; }).forEach(function (c) {
          box.appendChild(loadout(c.name, GD.creature(c.speciesId).icon, c.equipment));
        });
        return box;
      },

      // ---- Karte / Expeditionen ----
      karte: function () {
        var s = this.state, self = this;
        var box = el('div');
        box.appendChild(this.title('Karte', 'Expeditionen, Beute, Territorium', 'karte'));

        // --- Heroes-artige strategische Karte mit steuerbaren Armeegruppen ---
        box.appendChild(this.secLabel('Strategische Armeen', 'armeen'));
        var refreshIn = Math.max(0, (s.nextMapRefreshTick || 30) - s.tick);
        box.appendChild(el('div', { class: 'map-day' }, [
          el('span', { text: '☀️ Kartentag ' + (s.mapDay || 1) }),
          el('span', { class: 'muted', text: 'Bewegung erneuert in ' + refreshIn + ' s' }),
          el('span', { class: 'pill', text: (s.armyGroups || []).length + '/' + SYS.maxArmyGroups(s) + ' Armeen' })
        ]));
        var world = el('div', { class: 'strategy-map', role: 'region', 'aria-label': 'Spielbare strategische Abenteuerkarte' });
        var paths = svgEl('svg', { class: 'map-routes', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
        GD.strategicNodes.forEach(function (node) {
          (node.links || []).forEach(function (targetId) {
            if (node.id > targetId) return;
            var target = SYS.strategicNode(targetId); if (!target) return;
            var routeClass = 'map-route' + (SYS.strategicNodeSecured(s, node.id) && SYS.strategicNodeSecured(s, target.id) ? ' secured' : '')
              + (SYS.strategicNodeUnlocked(s, node.id) && SYS.strategicNodeUnlocked(s, target.id) ? ' unlocked' : ' fogged');
            paths.appendChild(svgEl('line', { x1: node.x, y1: node.y, x2: target.x, y2: target.y, class: routeClass }));
          });
        });
        world.appendChild(paths);
        // Felder, die eine Armee mit Bewegungspunkten von ihrer Position aus erreichen kann
        var reachable = {};
        (s.armyGroups || []).forEach(function (g) {
          if ((g.movement || 0) <= 0) return;
          var posNode = SYS.strategicNode(g.position);
          ((posNode && posNode.links) || []).forEach(function (tid) {
            if (SYS.strategicNodeUnlocked(s, tid)) reachable[tid] = true;
          });
        });
        GD.strategicNodes.forEach(function (node) {
          var region = node.kind === 'region' ? GD.region(node.id) : null;
          var site = node.siteId ? GD.strategicSite(node.siteId) : null;
          var claimed = SYS.strategicNodeSecured(s, node.id);
          var unlocked = SYS.strategicNodeUnlocked(s, node.id);
          var markers = (s.armyGroups || []).filter(function (g) { return g.position === node.id; });
          var status = null;
          if (site && site.kind === 'resource' && SYS.mapSiteClaimed(s, site.id)) status = 'Stufe ' + (s.mapSiteLevels[site.id] || 1);
          else if (site && site.kind === 'discovery' && SYS.mapSiteExplored(s, site.id)) status = 'geborgen';
          else if (site && unlocked) status = 'Wache ' + fmt(site.guard);
          else if (!unlocked) status = 'Nebel';
          world.appendChild(el('div', {
            class: 'map-node map-node-' + (node.kind || 'region') + (claimed ? ' claimed' : '') + (!unlocked ? ' locked' : '') + (site && !claimed && unlocked ? ' discoverable' : '') + (reachable[node.id] ? ' reachable' : ''),
            style: 'left:' + node.x + '%;top:' + node.y + '%',
            title: SYS.strategicNodeName(node),
            onclick: site ? function () { self.openMapSiteModal(node); } : null
          }, [
            el('span', { class: 'map-node-icon', text: node.icon || (region && region.icon) || (site && site.icon) || '•' }),
            el('span', { class: 'map-node-name', text: node.name || (region && region.name) || (site && (site.short || site.name)) || node.id }),
            status ? el('span', { class: 'map-node-status', text: status }) : null,
            markers.length ? el('div', { class: 'map-markers' }, markers.map(function (g) {
              var leader = g.rulerLed ? s.herrscher : SYS.findCreature(s, g.leaderUid), sp = (!g.rulerLed && leader) ? GD.creature(leader.speciesId) : null;
              return el('button', { type: 'button', class: 'map-army-marker', title: g.name, onclick: function (e) { e.stopPropagation(); self.openArmyModal(g); } }, [
                el('span', { text: g.rulerLed ? GD.rulerStages[s.herrscher.stage].icon : (sp ? sp.icon : '🚩') }), el('small', { text: String(SYS.armyCommandUsed(g)) })
              ]);
            })) : null
          ]));
        });
        var viewport = el('div', { class: 'strategy-map-viewport' }, world);
        box.appendChild(viewport);
        var capturedSites = (s.claimedMapSites || []).map(function (id) {
          var site = GD.strategicSite(id), level = s.mapSiteLevels[id] || 1, parts = [];
          if (site && site.produce) for (var k in site.produce) parts.push('+' + (site.produce[k] * level).toFixed(1) + ' ' + resIcon(k) + '/s');
          return site ? el('span', { class: 'pill', text: site.icon + ' ' + site.short + ' ' + parts.join(' ') }) : null;
        });
        box.appendChild(el('div', { class: 'map-legend' }, [
          el('span', { text: '🏰 Territorium' }), el('span', { text: '🏗️ Ressourcenanlage' }), el('span', { text: '💎 Fundort' }),
          capturedSites.length ? capturedSites : el('span', { class: 'muted', text: 'Noch keine Außenanlage gesichert' })
        ]));
        box.appendChild(el('div', { class: 'card-actions' }, [
          btn('🚩 Neue Armee aufstellen', function () { self.openCreateArmyModal(); }, {
            small: true, cls: 'btn-gold',
            disabled: !SYS.eligibleArmyLeaders(s).length || (s.armyGroups || []).length >= SYS.maxArmyGroups(s)
          })
        ]));
        if (!(s.armyGroups || []).length) {
          box.appendChild(el('div', { class: 'empty-hint', text: 'Benenne eine Kreatur und stelle mit ihr eine Armee auf. Der Anführer erscheint als steuerbare Figur auf der Karte.' }));
        } else {
          var armyList = el('div', { class: 'grid army-list' });
          s.armyGroups.forEach(function (g) { armyList.appendChild(self.armyGroupCard(g)); });
          box.appendChild(armyList);
        }

        // --- Prozedurale Echo-Territorien (ab zwei eroberten Regionen) ---
        box.appendChild(this.secLabel('Echo-Territorien', 'karte'));
        if (!SYS.echoUnlocked(s)) {
          box.appendChild(el('div', { class: 'empty-hint echo-locked-hint', text: '🌀 Erobere zwei Territorien, damit der Große Weise instabile Nachhall-Welten lokalisieren kann. Fortschritt: ' + s.claimedRegions.length + '/' + SYS.ECHO_UNLOCK_REGIONS + '.' }));
        } else {
          var echoes = SYS.ensureEchoMap(s), echoDone = (echoes.completed || []).length;
          var echoHead = el('div', { class: 'echo-header' }, [
            el('div', null, [
              el('b', { text: '🌀 Zyklus ' + echoes.cycle }),
              el('span', { class: 'muted', text: ' · Stabilität ' + echoes.stability + ' · ' + echoDone + '/' + echoes.nodes.length + ' abgeschlossen' })
            ]),
            el('div', { class: 'card-actions' }, [
              SYS.echoBossCompleted(s) ? btn('Nächsten Zyklus öffnen', function () {
                var result = SYS.advanceEchoCycle(s); if (!result.ok) { toast(result.reason, 'bad'); return; }
                toast('🌀 Echo-Zyklus ' + result.cycle + ' geöffnet.', 'gold'); self.commit();
              }, { small: true, cls: 'btn-gold' }) : null,
              btn('Netz neu verweben', function () {
                var result = SYS.rerollEchoMap(s); if (!result.ok) { toast(result.reason, 'bad'); return; }
                toast('🌀 Ein neues Echo-Netz wurde erzeugt.', 'good'); self.commit();
              }, { small: true, disabled: !SYS.canRerollEchoMap(s).ok, cost: costText(SYS.echoRerollCost(s)) })
            ])
          ]);
          box.appendChild(echoHead);
          var echoMap = el('div', { class: 'echo-map', role: 'region', 'aria-label': 'Prozedurales Echo-Netz' });
          var echoRoutes = svgEl('svg', { class: 'echo-routes', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
          echoes.nodes.forEach(function (node) {
            node.parents.forEach(function (parentId) {
              var parent = SYS.echoNode(s, parentId); if (!parent) return;
              var secured = SYS.echoNodeCompleted(s, parent.id) && SYS.echoNodeCompleted(s, node.id);
              var open = SYS.echoNodeCompleted(s, parent.id) && !SYS.echoNodeCompleted(s, node.id);
              echoRoutes.appendChild(svgEl('line', { x1: parent.x, y1: parent.y, x2: node.x, y2: node.y, class: 'echo-route' + (secured ? ' secured' : (open ? ' open' : '')) }));
            });
          });
          echoMap.appendChild(echoRoutes);
          echoes.nodes.forEach(function (node) {
            var completed = SYS.echoNodeCompleted(s, node.id), available = SYS.echoNodeAvailable(s, node);
            var reward = GD.echoReward(node.rewardId), environment = GD.echoEnvironment(node.environmentId);
            echoMap.appendChild(el('button', {
              type: 'button',
              class: 'echo-node echo-tone-' + (environment ? environment.tone : 'violett') + (completed ? ' completed' : '') + (available ? ' available' : '') + (node.boss ? ' boss' : '') + (!completed && !available ? ' locked' : ''),
              style: 'left:' + node.x + '%;top:' + node.y + '%',
              title: node.name + ' · Gegnerkraft ' + fmt(node.power),
              onclick: function () { self.openEchoModal(node); }
            }, [
              el('span', { class: 'echo-node-icon', text: node.icon }),
              el('span', { class: 'echo-node-reward', text: reward ? reward.icon : '🎁' }),
              el('span', { class: 'echo-node-power', text: completed ? '✓' : fmt(node.power) })
            ]));
          });
          box.appendChild(el('div', { class: 'echo-map-viewport' }, echoMap));
          box.appendChild(el('div', { class: 'map-legend echo-legend' }, [
            el('span', { text: '✨ erreichbar' }), el('span', { text: '✓ bezwungen' }), el('span', { text: '👁️ Echo-Kern' }),
            el('span', { class: 'muted', text: 'Wähle deinen Pfad nach Beute und Affixen. Siege öffnen verbundene Echos.' })
          ]));
        }

        // --- Rivalen & Bedrohung (erst nach Expansion sichtbar) ---
        if (s.claimedRegions.length > 0 || s.raid) {
        box.appendChild(this.secLabel('Rivalen & Bedrohung', 'karte'));
        var def = SYS.defenseValue(s);
        var threatCard = el('div', { class: 'card' });
        if (s.raid) {
          var rv = GD.rival(s.raid.rivalId);
          var eta = Math.max(0, s.raid.atTick - s.tick);
          var safe = def >= s.raid.power;
          threatCard.appendChild(el('div', { class: 'card-head' }, [
            el('div', { class: 'card-emoji', text: rv.icon }),
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name' }, [rv.name, el('span', { class: 'pill', style: safe ? 'color:var(--good)' : 'color:var(--bad);border-color:#5e2740', text: safe ? '🛡️ haltbar' : '⚠️ Gefahr' })]),
              el('div', { class: 'meta', text: 'Angriff in ' + eta + ' s · Feindkraft ' + fmt(s.raid.power) + ' vs. Verteidigung ' + fmt(def) })
            ])
          ]));
          threatCard.appendChild(el('div', { class: 'card-desc', text: 'Stationiere mehr „Armee"-Einheiten oder baue das Labyrinth aus, um die Verteidigung zu erhöhen.' }));
        } else {
          var frac = Math.min(1, (s.threat || 0) / SYS.THREAT_RAID);
          threatCard.appendChild(el('div', { class: 'card-head' }, [
            el('div', { class: 'card-emoji', text: '🌐' }),
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name', text: 'Frieden – vorerst' }),
              el('div', { class: 'meta', text: 'Verteidigung ' + fmt(def) + ' (Labyrinth + stationierte Armee)' })
            ])
          ]));
          threatCard.appendChild(bar(frac));
          threatCard.appendChild(el('div', { class: 'bar-label', text: 'Bedrohung steigt … nächster Angriff bei ' + Math.floor(frac * 100) + '%' }));
        }
        box.appendChild(threatCard);

        // Rivalen-Liste (Gegenangriff)
        GD.rivals.forEach(function (rv) {
          var defeated = SYS.isRivalDefeated(s, rv.id);
          var prog = SYS.rivalProgress(s, rv.id);
          var cc = SYS.canCounterAttack(s, rv.id);
          var action;
          if (defeated) action = el('span', { class: 'pill tag-ok', text: '👑 besiegt' });
          else if (cc.ok) action = btn('Gegenangriff', function () { self.openCounterModal(rv); }, { small: true, cls: 'btn-primary' });
          else action = el('span', { class: 'pill', text: prog + '/' + SYS.RIVAL_COUNTER_REPELS + ' abgewehrt' });
          box.appendChild(el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: rv.icon }),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name' }, [rv.name]),
                el('div', { class: 'meta', text: rv.desc })
              ])
            ]),
            el('div', { class: 'card-actions' }, [action])
          ]));
        });
        }   // Ende „Rivalen & Bedrohung"

        if (s.expeditions.length) {
          box.appendChild(el('div', { class: 'section-label', text: 'Laufende Expeditionen' }));
          s.expeditions.forEach(function (exp) {
            var r = GD.region(exp.regionId);
            var remain = Math.max(0, exp.returnsAtTick - s.tick);
            var frac = 1 - remain / (exp.dauer || r.dauer);
            box.appendChild(el('div', { class: 'card' }, [
              el('div', { class: 'card-head' }, [
                el('div', { class: 'card-emoji', text: r.icon }),
                el('div', { class: 'card-title' }, [
                  el('div', { class: 'name' }, [r.name, el('span', { class: 'pill ' + (exp.power >= r.power ? 'tag-ok' : 'tag-busy'), text: 'Kraft ' + fmt(exp.power) + ' / ' + fmt(r.power) })]),
                  el('div', { class: 'meta', text: exp.creatureUids.length + ' Einheiten' + (exp.rulerJoined ? ' + Herrscher' : '') })
                ])
              ]),
              bar(frac),
              el('div', { class: 'bar-label', text: remain > 0 ? ('Rückkehr in ' + remain + ' s') : 'Kehrt zurück …' })
            ]));
          });
        }

        if (s.activeCombat) {
          var acRegion = GD.region(s.activeCombat.regionId);
          var acActive = s.activeCombat.status === 'active';
          box.appendChild(el('div', { class: 'card combat-resume' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: '⚔️' }),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name', text: (acActive ? 'Taktischer Kampf' : 'Kampfergebnis') + ' · ' + acRegion.name }),
                el('div', { class: 'meta', text: acActive ? ('Runde ' + s.activeCombat.round + ' · dein Zug') : (s.activeCombat.status === 'victory' ? 'Sieg' : 'Niederlage') })
              ])
            ]),
            btn(acActive ? 'Kampf fortsetzen' : 'Ergebnis ansehen', function () { self.openBattleModal(); }, { small: true, cls: 'btn-gold' })
          ]));
        }

        box.appendChild(this.secLabel('Regionen', 'karte'));
        var grid = el('div', { class: 'grid' });
        SYS.visibleRegions(s).forEach(function (r) {
          var unlocked = SYS.regionUnlocked(s, r.id);
          var claimed = s.claimedRegions.indexOf(r.id) >= 0;
          var rewards = [];
          for (var k in r.rewards) rewards.push(r.rewards[k] + ' ' + resIcon(k));
          var actions;
          if (!unlocked) actions = el('span', { class: 'pill', text: '🔒 Erst vorige Region erobern' });
          else actions = [
            btn(claimed ? 'Auto-Expedition' : 'Expedition starten', function () { self.openExpeditionModal(r); }, { cls: claimed ? '' : 'btn-primary', small: true }),
            btn('⚔️ Taktischer Kampf', function () { self.openBattleSetupModal(r); }, { cls: 'btn-gold', small: true, disabled: !!(s.activeCombat && s.activeCombat.status === 'active') })
          ];
          grid.appendChild(el('div', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: r.icon }),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name' }, [r.name, claimed ? el('span', { class: 'pill tag-ok', text: '✓ Erobert' }) : null]),
                el('div', { class: 'meta', text: 'Gegnerkraft ' + fmt(r.power) + ' · ' + r.dauer + ' s' })
              ])
            ]),
            el('div', { class: 'card-desc', text: r.desc }),
            el('div', { class: 'card-stats' }, [el('span', { text: '🎁 ' + rewards.join('  ') }), el('span', { text: '+Territorium: ' + claimBonusText(r) })]),
            el('div', { class: 'card-actions' }, actions)
          ]));
        });
        box.appendChild(grid);
        return box;
      }
    },

    // ---------- Karten-Bausteine ----------
    armyGroupCard: function (group) {
      var s = this.state, self = this;
      var leader = group.rulerLed ? s.herrscher : SYS.findCreature(s, group.leaderUid);
      var sp = (!group.rulerLed && leader) ? GD.creature(leader.speciesId) : null;
      var node = SYS.strategicNode(group.position), region = GD.region(group.position);
      var used = SYS.armyCommandUsed(group), cap = SYS.armyCommandCapacity(s, group);
      var troopTags = [];
      Object.keys(group.troops || {}).forEach(function (id) {
        var tsp = GD.creature(id), count = group.troops[id];
        if (tsp && count > 0) troopTags.push(el('span', { class: 'pill', text: tsp.icon + ' ' + count + '× ' + tsp.name }));
      });
      var neighbors = SYS.strategicNeighbors(group.position);
      function moveButton(target) {
        var chk = SYS.canMoveArmyGroup(s, group.id, target.id);
        return btn('➜ ' + SYS.strategicNodeName(target), function () {
          var r = SYS.moveArmyGroup(s, group.id, target.id);
          if (!r.ok) toast(r.reason, 'bad'); else toast('🗺️ ' + group.name + ' zieht weiter.', 'good');
          self.commit();
        }, { small: true, disabled: !chk.ok });
      }
      var actions = [
        btn('Truppen verwalten', function () { self.openArmyModal(group); }, { small: true, cls: 'btn-primary' })
      ];
      neighbors.forEach(function (target) { actions.push(moveButton(target)); });
      if (region) actions.push(btn(s.claimedRegions.indexOf(region.id) >= 0 ? '⚔️ Plündern' : '⚔️ Gebiet angreifen', function () { self.openArmyAttackModal(group); }, { small: true, cls: 'btn-gold', disabled: used <= 0 || (!group.rulerLed && leader && SYS.isWounded(s, leader)) }));
      return el('div', { class: 'card army-card' }, [
        el('div', { class: 'card-head' }, [
          group.rulerLed ? el('div', { class: 'card-emoji army-portrait', text: GD.rulerStages[s.herrscher.stage].icon }) : creatureArt(sp, 'army-portrait'),
          el('div', { class: 'card-title' }, [
            el('div', { class: 'name' }, [group.name, el('span', { class: 'badge named', text: group.rulerLed ? '👑 Main Character' : ('✦ ' + (leader ? leader.name : 'ohne Führung')) })]),
            el('div', { class: 'meta', text: (node && node.capital ? node.name : (region ? region.name : group.position)) + ' · Kraft ' + fmt(SYS.armyGroupPower(s, group)) + ' · Bewegung ' + group.movement + '/' + SYS.armyMovementMax(s, group) })
          ])
        ]),
        el('div', null, [bar(used / Math.max(1, cap)), el('div', { class: 'bar-label', text: 'Kommando ' + used + ' / ' + cap + ' · Führungsbonus +' + Math.round(SYS.armyLeaderBonus(s, group) * 100) + '%' })]),
        troopTags.length ? el('div', { class: 'row wrap', style: 'gap:5px' }, troopTags) : el('div', { class: 'muted', text: 'Noch keine Truppen rekrutiert.' }),
        el('div', { class: 'muted', style: 'font-size:11px', text: 'Direkte Wege: ' + neighbors.map(SYS.strategicNodeName).join(' · ') }),
        el('div', { class: 'card-actions' }, actions)
      ]);
    },

    creatureCard: function (c) {
      var s = this.state, self = this;
      var sp = GD.creature(c.speciesId);
      var stats = SYS.creatureStats(s, c);
      var power = SYS.creaturePower(s, c);
      var busy = SYS.creatureBusy(s, c.uid);
      var cap = SYS.creatureLevelCap(c);
      var evos = SYS.evolveOptions(s, c);

      var head = el('div', { class: 'card-head' }, [
        creatureArt(sp),
        el('div', { class: 'card-title' }, [
          el('div', { class: 'name' }, [
            c.named ? c.name : sp.name, c.named ? rankBadge(sp.rank) : el('span', { class: 'badge', text: SYS.stackCount(c) + '× Stapel' }),
            c.named ? el('span', { class: 'badge named', text: '✦ benannt' }) : null,
            (c.fusionLevel > 0) ? el('span', { class: 'badge named', text: '🧬 ×' + c.fusionLevel }) : null,
            (c.aspect && GD.aspect(c.aspect)) ? el('span', { class: 'pill', text: GD.aspect(c.aspect).icon + ' ' + GD.aspect(c.aspect).name }) : null,
            busy ? el('span', { class: 'pill tag-busy', text: 'unterwegs' }) : null,
            SYS.isWounded(s, c) ? el('span', { class: 'pill', style: 'color:var(--bad);border-color:#5e2740', text: '🩹 verwundet ' + SYS.woundRemaining(s, c) + 's' }) : null
          ]),
          el('div', { class: 'meta', text: c.named ? (sp.name + ' · Lv ' + c.level + '/' + cap + ' · Kraft ' + fmt(power)) : ('Basistrupp · Herrscherarmee · Gesamtkraft ' + fmt(power) + ' · keine Ränge/Ausrüstung') })
        ])
      ]);

      // Skills + Ausrüstung
      var tags = [];
      if (c.named) {
        (c.skills || []).forEach(function (id) {
          var sk = GD.skill(id), p = SYS.skillProgress(c, id);
          if (sk) tags.push(el('span', { class: 'pill', text: sk.icon + ' ' + sk.name + ' · St.' + p.level }));
        });
        GD.equipSlots.forEach(function (sl) {
          var uid = c.equipment[sl.id];
          if (uid != null) { var it = SYS.findItem(s, uid); if (it) tags.push(el('span', { class: 'pill ' + GD.rarity(it.rarity).cls, text: it.icon + ' ' + it.name })); }
        });
      } else {
        SYS.combatAbilitiesFor(s, c.uid).forEach(function (id) {
          var ab = GD.battleAbility(id); if (ab) tags.push(el('span', { class: 'pill', text: ab.icon + ' ' + ab.name + ' · Basis' }));
        });
      }

      // XP-Leiste
      var xpNeed = SYS.xpForLevel(c.level);
      var xpFrac = c.level >= cap ? 1 : c.xp / xpNeed;

      // Aktionen
      var actions = [];
      if (!c.named) {
        var nc = SYS.canName(s, c);
        actions.push(btn('Benennen', function () { self.openNameModal(c); }, { small: true, cls: 'btn-gold', disabled: !nc.ok, cost: costText(SYS.nameCost(s, c)) }));
      }
      if (evos.length) {
        var anyOk = evos.some(function (e) { return e.ok; });
        actions.push(btn('Entwickeln', function () { self.openEvolveModal(c); }, { small: true, cls: anyOk ? 'btn-primary' : '', disabled: false }));
      }
      if (c.named) {
        var scap = SYS.skillCapacity(c);
        actions.push(btn('Skills ' + SYS.skillSlotsUsed(c) + '/' + scap, function () { self.openSkillModal(c); }, { small: true }));
      }
      if (c.named && SYS.featureUnlocked(s, 'fusion') && (c.fusionLevel || 0) < SYS.FUSION_MAX) {
        actions.push(btn('🧬 Fusion', function () { self.openFusionModal(c); }, { small: true, cls: 'btn-gold' }));
      }
      // Job-Auswahl
      var sel = el('select', { class: 'btn btn-small', style: 'flex:1 1 auto;min-width:120px', disabled: busy, onchange: function (e) { SYS.assignJob(s, c.uid, e.target.value); self.commit(); } });
      SYS.JOBS.forEach(function (j) {
        var o = el('option', { value: j.id, text: j.icon + ' ' + j.name });
        if (c.job === j.id) o.setAttribute('selected', '');
        sel.appendChild(o);
      });
      actions.push(sel);

      return el('div', { class: 'card' }, [
        head,
        statsLine(stats),
        tags.length ? el('div', { class: 'row wrap', style: 'gap:5px' }, tags) : null,
        c.named ? el('div', null, [bar(xpFrac, 'xp'), el('div', { class: 'bar-label', text: c.level >= cap ? 'Max-Level' : ('EP ' + Math.floor(c.xp) + ' / ' + xpNeed) })]) : null,
        el('div', { class: 'card-actions' }, actions)
      ]);
    },

    itemCard: function (it) {
      var s = this.state, self = this;
      var holder = '';
      if (it.equippedBy === 'herrscher') holder = 'Herrscher';
      else if (it.equippedBy != null) { var c = SYS.findCreature(s, it.equippedBy); holder = c ? (c.named ? c.name : GD.creature(c.speciesId).name) : ''; }
      var quality = SYS.itemQuality(it), rar = GD.rarities[quality], temper = SYS.canTemperItem(s, it.uid), salvage = SYS.canSalvageItem(s, it.uid);
      var qualityTrack = el('div', { class: 'quality-track', 'aria-label': 'Qualität ' + rar.name });
      GD.rarities.forEach(function (rarity, idx) {
        qualityTrack.appendChild(el('span', { class: 'quality-step ' + rarity.cls + (idx <= quality ? ' reached' : ''), title: rarity.name, text: idx <= quality ? '◆' : '◇' }));
      });
      return el('div', { class: 'card forge-item forge-quality-' + quality }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-emoji', text: it.icon }),
          el('div', { class: 'card-title' }, [
            el('div', { class: 'name' }, [it.name, el('span', { class: 'badge ' + rar.cls, text: rar.name })]),
            el('div', { class: 'meta', text: slotName(it.slot) + (holder ? ' · angelegt: ' + holder : ' · frei') })
          ])
        ]),
        qualityTrack,
        statsLine(it.stats),
        el('div', { class: 'forge-item-history', text: (it.forgeHistory || []).length ? ((it.forgeHistory || []).length + '× in Tempest veredelt') : 'Noch nicht in Tempest veredelt' }),
        el('div', { class: 'card-actions' }, [
          btn('Ausrüsten', function () { self.openEquipModal(it); }, { small: true, cls: 'btn-primary' }),
          it.equippedBy != null ? btn('Ablegen', function () { SYS.unequipItem(s, it.uid); self.commit(); }, { small: true }) : null,
          quality < GD.rarities.length - 1 ? btn('🔥 Aufwerten', function () { self.openTemperModal(it.uid); }, {
            small: true, cls: temper.ok ? 'btn-gold' : '', cost: forgeCostText(temper.cost || SYS.temperCost(s, it.uid))
          }) : el('span', { class: 'pill forge-maxed', text: '✦ Göttlich vollendet' }),
          !it.equippedBy && salvage.ok ? btn('♻️ Zerlegen', function () {
            if (!window.confirm('„' + it.name + '“ wirklich zerlegen? Der Bauplan bleibt erhalten.')) return;
            var result = SYS.salvageItem(s, it.uid);
            if (!result.ok) toast(result.reason, 'bad'); else toast('♻️ Komponenten geborgen.', 'good');
            self.commit();
          }, { small: true }) : null
        ])
      ]);
    },

    // ============================================================
    //  Modals
    // ============================================================
    openTemperModal: function (itemUid) {
      var s = this.state, self = this, item = SYS.findItem(s, itemUid);
      if (!item) return;
      var quality = SYS.itemQuality(item), target = GD.rarities[quality + 1], check = SYS.canTemperItem(s, itemUid), cost = check.cost || SYS.temperCost(s, itemUid);
      if (!target || !cost) { toast('Göttliche Maximalqualität erreicht.', 'gold'); return; }
      var recipe = GD.recipe(item.recipeId), preview = {};
      if (recipe) for (var stat in recipe.stats) preview[stat] = Math.round(recipe.stats[stat] * target.mult);
      var content = el('div', { class: 'temper-modal-content' }, [
        el('div', { class: 'temper-hero' }, [
          el('div', { class: 'temper-item-icon', text: item.icon }),
          el('div', null, [
            el('h4', { text: item.name }),
            el('p', { text: GD.rarities[quality].name + '  →  ' + target.name })
          ])
        ]),
        el('div', { class: 'quality-comparison' }, [
          el('div', null, [el('small', { text: 'AKTUELL' }), statsLine(item.stats)]),
          el('div', { class: 'quality-arrow', text: '➜' }),
          el('div', null, [el('small', { text: 'NACH DEM AUFWERTEN' }), statsLine(preview)])
        ]),
        el('div', { class: 'temper-cost-box' }, [
          el('b', { text: 'Benötigte Schmiedehitze' }),
          el('span', { text: forgeCostText(cost) }),
          !check.ok ? el('small', { class: 'bad-text', text: check.reason }) : null
        ]),
        btn('🔥 Qualität auf ' + target.name + ' erhöhen', function () {
          var result = SYS.temperItem(s, itemUid);
          if (!result.ok) { toast(result.reason, 'bad'); return; }
          toast('🔥 ' + item.name + ' ist jetzt ' + result.rarity.name + '!', 'gold');
          closeModal(); self.commit();
        }, { cls: 'btn-gold', disabled: !check.ok, cost: forgeCostText(cost) })
      ]);
      openModal('Ausrüstung veredeln', content, '🔥', 'temper-modal');
    },

    openMapSiteModal: function (node) {
      var s = this.state, self = this;
      node = SYS.strategicNode(node && node.id ? node.id : node);
      var site = node && node.siteId ? GD.strategicSite(node.siteId) : null;
      if (!node || !site) return;
      var secured = SYS.strategicNodeSecured(s, node.id), unlocked = SYS.strategicNodeUnlocked(s, node.id);
      var level = (s.mapSiteLevels && s.mapSiteLevels[site.id]) || 0;
      function amounts(map, mult) {
        var parts = []; mult = mult || 1;
        for (var k in (map || {})) parts.push(((map[k] * mult) % 1 ? (map[k] * mult).toFixed(1) : (map[k] * mult)) + ' ' + resIcon(k));
        return parts.join('  ');
      }
      function forgeAmounts(map) {
        var parts = [];
        for (var id in (map || {})) { var material = GD.forgeMaterial(id); parts.push(map[id] + '× ' + (material ? material.icon : id)); }
        return parts.join('  ');
      }
      var content = el('div');
      content.appendChild(el('p', { class: 'muted', text: site.desc }));
      content.appendChild(el('div', { class: 'site-summary' }, [
        el('span', { class: 'pill', text: unlocked ? (secured ? '✓ Gesichert' : '⚔️ Erreichbar') : '🌫️ Im Nebel' }),
        el('span', { class: 'pill', text: 'Wache ' + fmt(site.guard) }),
        site.forgeReward ? el('span', { class: 'pill', text: '⚒️ ' + forgeAmounts(site.forgeReward) }) : null,
        site.kind === 'resource' ? el('span', { class: 'pill', text: '🏗️ Anlage' + (level ? ' Stufe ' + level + '/3' : '') }) : el('span', { class: 'pill', text: '💎 Einmaliger Fund' })
      ]));
      if (!unlocked) {
        var req = GD.region(node.requires);
        content.appendChild(el('div', { class: 'empty-hint', text: 'Sichere zuerst ' + (req ? req.name : 'das vorgelagerte Territorium') + '.' }));
      } else if (site.kind === 'resource' && secured) {
        content.appendChild(el('div', { class: 'resource-output', text: 'Produktion: ' + amounts(site.produce, level) + ' pro Sekunde' }));
        var upgrade = SYS.canUpgradeMapSite(s, site.id), cost = SYS.mapSiteUpgradeCost(s, site.id);
        content.appendChild(btn(level >= 3 ? 'Maximal ausgebaut' : 'Anlage ausbauen', function () {
          var r = SYS.upgradeMapSite(s, site.id); if (!r.ok) { toast(r.reason, 'bad'); return; }
          toast('🏗️ ' + site.name + ' erreicht Stufe ' + r.level + '.', 'good'); closeModal(); self.commit(); self.openMapSiteModal(node);
        }, { cls: 'btn-primary', disabled: !upgrade.ok, cost: level >= 3 ? '' : costText(cost || {}) }));
      } else if (site.kind === 'discovery' && secured) {
        content.appendChild(el('div', { class: 'empty-hint', text: 'Fund geborgen: ' + amounts(site.rewards) }));
      } else {
        if (site.kind === 'resource') content.appendChild(el('div', { class: 'resource-output', text: 'Nach Sicherung: +' + amounts(site.produce) + ' pro Sekunde und ausbaubar bis Stufe 3.' }));
        else content.appendChild(el('div', { class: 'resource-output', text: 'Möglicher Fund: ' + amounts(site.rewards) }));
        var armies = (s.armyGroups || []).filter(function (g) { return g.position === node.id; });
        if (!armies.length) content.appendChild(el('div', { class: 'empty-hint', text: 'Bewege eine Armee auf diesen Ort, um die Wache herauszufordern.' }));
        armies.forEach(function (group) {
          var check = SYS.canInteractMapSite(s, group.id, site.id);
          content.appendChild(btn(group.name + ' · Kraft ' + fmt(SYS.armyGroupPower(s, group)), function () {
            var r = SYS.interactMapSite(s, group.id, site.id); if (!r.ok) { toast(r.reason, 'bad'); return; }
            toast(site.kind === 'resource' ? ('🏗️ ' + site.name + ' gesichert.') : ('💎 ' + site.name + ' geborgen.'), 'gold');
            closeModal(); self.commit(); self.openMapSiteModal(node);
          }, { cls: check.ok ? 'btn-gold' : '', disabled: !check.ok, cost: check.ok ? 'Ort sichern' : check.reason }));
        });
      }
      openModal(site.name, content, site.icon);
    },

    openAdventureMagicModal: function (spell) {
      var s = this.state, self = this;
      spell = GD.fieldSpell(spell && spell.id ? spell.id : spell); if (!spell || spell.type !== 'adventure') return;
      var content = el('div', null, [
        el('p', { class: 'muted', text: spell.desc }),
        el('div', { class: 'site-summary' }, [
          el('span', { class: 'pill', text: spell.school }),
          el('span', { class: 'pill', text: 'Kosten ' + costText(spell.castCost) }),
          el('span', { class: 'pill', text: 'Abklingzeit ' + spell.cooldown + ' s' })
        ])
      ]);
      (s.armyGroups || []).forEach(function (group) {
        var check = SYS.canCastAdventureMagic(s, spell.id, group.id);
        content.appendChild(el('div', { class: 'card' }, [
          el('div', { class: 'card-head' }, [
            el('div', { class: 'card-emoji', text: group.rulerLed ? GD.rulerStages[s.herrscher.stage].icon : '🚩' }),
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name', text: group.name }),
              el('div', { class: 'meta', text: SYS.strategicNodeName(group.position) + ' · Bewegung ' + group.movement + '/' + SYS.armyMovementMax(s, group) + ((group.wardCharges || 0) ? ' · 🛡️ geschützt' : '') })
            ])
          ]),
          btn('Zauber wirken', function () {
            var r = SYS.castAdventureMagic(s, spell.id, group.id); if (!r.ok) { toast(r.reason, 'bad'); return; }
            toast(spell.icon + ' ' + spell.name + ' auf ' + group.name + ' gewirkt.', 'gold'); closeModal(); self.commit();
          }, { cls: 'btn-gold', small: true, disabled: !check.ok, cost: check.ok ? costText(spell.castCost) : check.reason })
        ]));
      });
      openModal(spell.name, content, spell.icon);
    },

    openCreateArmyModal: function () {
      var s = this.state, self = this, leaders = SYS.eligibleArmyLeaders(s);
      var content = el('div');
      if (!leaders.length) {
        content.appendChild(el('p', { class: 'muted', text: 'Kein benannter, freier Anführer verfügbar. Benenne eine Kreatur oder löse ihre bisherige Armee auf.' }));
        openModal('Neue Armee', content, '🚩'); return;
      }
      var select = el('select', { class: 'btn', style: 'width:100%' });
      leaders.forEach(function (c) {
        var sp = GD.creature(c.speciesId);
        select.appendChild(el('option', { value: String(c.uid), text: sp.icon + ' ' + c.name + ' · ' + sp.name + ' · Kommando ' + SYS.armyCommandCapacity(s, c) }));
      });
      var input = el('input', { type: 'text', maxlength: '28', placeholder: 'z. B. Goldzahns Erste Legion' });
      content.appendChild(el('p', { class: 'muted', text: 'Eine benannte Eliteeinheit wird zur sichtbaren Armeefigur. Aufstellung kostet 100 🪙 und 50 🍖.' }));
      content.appendChild(el('div', { class: 'field' }, [el('label', { text: 'Anführer' }), select]));
      content.appendChild(el('div', { class: 'field' }, [el('label', { text: 'Armeename' }), input]));
      content.appendChild(btn('Armee aufstellen', function () {
        var r = SYS.createArmyGroup(s, Number(select.value), input.value);
        if (!r.ok) { toast(r.reason, 'bad'); return; }
        toast('🚩 ' + r.group.name + ' steht bereit.', 'gold'); closeModal(); self.commit(); self.openArmyModal(r.group);
      }, { cls: 'btn-gold', cost: '100 🪙  50 🍖' }));
      openModal('Neue Armee aufstellen', content, '🚩');
    },

    openArmyModal: function (group) {
      var s = this.state, self = this;
      group = SYS.findArmyGroup(s, group && group.id != null ? group.id : group);
      if (!group) return;
      var leader = group.rulerLed ? s.herrscher : SYS.findCreature(s, group.leaderUid);
      var sp = (!group.rulerLed && leader) ? GD.creature(leader.speciesId) : null;
      var content = el('div');
      content.appendChild(el('div', { class: 'army-summary' }, [
        group.rulerLed ? el('div', { class: 'card-emoji', text: GD.rulerStages[s.herrscher.stage].icon }) : creatureArt(sp),
        el('div', { style: 'flex:1' }, [
          el('b', { text: group.name }),
          el('div', { class: 'muted', text: (group.rulerLed ? 'Herrscher / Main Character' : (leader ? leader.name : 'Ohne Anführer')) + ' · Kraft ' + fmt(SYS.armyGroupPower(s, group)) }),
          el('div', { class: 'muted', text: 'Kommando ' + SYS.armyCommandUsed(group) + '/' + SYS.armyCommandCapacity(s, group) + ' · max. ' + SYS.MAX_TROOP_TYPES + ' Truppentypen' })
        ])
      ]));
      content.appendChild(el('p', { class: 'muted', text: group.rulerLed ? 'Neue Beschwörungen landen automatisch hier und werden nach Art gestapelt. Benenne eine Einheit, um sie als Elite mit eigener Armee abzuspalten.' : 'Rekrutiere Kontingente direkt in diese Armee. Gleiche Linie wie der Anführer erhält +25 % Synergie.' }));
      var list = el('div', { class: 'opt-list' });
      SYS.recruitableTroops(s).forEach(function (tsp) {
        var count = group.troops[tsp.id] || 0;
        var c10 = SYS.troopRecruitCost(s, tsp.id, 10), ch10 = SYS.canRecruitTroops(s, group.id, tsp.id, 10);
        var c50 = SYS.troopRecruitCost(s, tsp.id, 50), ch50 = SYS.canRecruitTroops(s, group.id, tsp.id, 50);
        var synergy = !group.rulerLed && sp && tsp.line === sp.line;
        list.appendChild(el('div', { class: 'card troop-card' }, [
          el('div', { class: 'card-head' }, [
            creatureArt(tsp, 'compact'),
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name' }, [tsp.name, el('span', { class: 'pill', text: count + ' Basistruppen' }), synergy ? el('span', { class: 'pill tag-ok', text: '+25 % Synergie' }) : null]),
              el('div', { class: 'meta', text: 'Kommando ' + SYS.troopCommandCost(tsp.id) + '/Einheit · Grundkraft ' + tsp.power + ' · keine Ränge/Ausrüstung' })
            ])
          ]),
          el('div', { class: 'card-actions' }, [
            btn('+10', function () {
              var r = SYS.recruitTroops(s, group.id, tsp.id, 10); if (!r.ok) toast(r.reason, 'bad'); else toast('10× ' + tsp.name + ' rekrutiert.', 'good');
              closeModal(); self.commit(); self.openArmyModal(group);
            }, { small: true, cls: 'btn-primary', disabled: !ch10.ok, cost: costText(c10) }),
            btn('+50', function () {
              var r = SYS.recruitTroops(s, group.id, tsp.id, 50); if (!r.ok) toast(r.reason, 'bad'); else toast('50× ' + tsp.name + ' rekrutiert.', 'good');
              closeModal(); self.commit(); self.openArmyModal(group);
            }, { small: true, cls: 'btn-gold', disabled: !ch50.ok, cost: costText(c50) }),
            count > 0 ? btn('−10 entlassen', function () { SYS.dismissTroops(s, group.id, tsp.id, 10); closeModal(); self.commit(); self.openArmyModal(group); }, { small: true }) : null
          ])
        ]));
      });
      content.appendChild(list);
      if (!group.rulerLed) content.appendChild(el('hr', { class: 'sep' }));
      if (!group.rulerLed) content.appendChild(btn('Armee auflösen', function () {
        if (!window.confirm('Armee wirklich auflösen? Die Truppenkontingente kehren zur Herrscherarmee zurück.')) return;
        SYS.disbandArmyGroup(s, group.id); closeModal(); self.commit();
      }, { small: true, cls: 'btn-danger' }));
      openModal('Armee verwalten', content, '🚩');
    },

    openArmyAttackModal: function (group) {
      var s = this.state, self = this;
      group = SYS.findArmyGroup(s, group.id); if (!group) return;
      var region = GD.region(group.position), content = el('div');
      content.appendChild(el('p', { class: 'muted', text: group.name + ' greift ' + region.name + ' an. Armeekraft ' + fmt(SYS.armyGroupPower(s, group)) + ' gegen Gebietskraft ' + fmt(region.power) + '. Truppenverluste bleiben dauerhaft.' }));
      ['sicher', 'normal', 'riskant'].forEach(function (id) {
        var rk = SYS.RISK[id];
        content.appendChild(btn(rk.icon + ' ' + rk.name, function () {
          var r = SYS.attackWithArmyGroup(s, group.id, id);
          if (!r.ok) { toast(r.reason, 'bad'); return; }
          closeModal(); self.commit();
          var result = el('div', { class: 'battle-result ' + (r.won ? 'win' : 'loss') }, [
            el('div', { class: 'battle-result-icon', text: r.won ? '🏆' : '💥' }),
            el('h3', { text: r.won ? 'Gebiet erobert' : (r.partial ? 'Teilerfolg' : 'Niederlage') }),
            el('p', { text: 'Kraft ' + fmt(r.power) + '/' + fmt(r.regionPower) + ' · ' + r.totalLosses + ' Truppen verloren.' }),
            r.leaderDead ? el('p', { style: 'color:var(--bad)', text: 'Der benannte Anführer ist gefallen. Die Armee existiert nicht mehr.' }) : null
          ]);
          openModal('Feldzugsergebnis', result, r.won ? '🏆' : '⚰️');
        }, { cls: id === 'riskant' ? 'btn-danger' : (id === 'normal' ? 'btn-primary' : ''), cost: '×' + rk.reward + ' Beute' }));
      });
      content.appendChild(el('p', { class: 'muted', style: 'font-size:12px', text: 'Riskant erhöht Beute und Verluste. Bei Niederlage stirbt auch der benannte Anführer; Ausrüstung wird geborgen.' }));
      openModal('Angriff: ' + region.name, content, region.icon);
    },

    openEchoModal: function (node) {
      var s = this.state, self = this;
      node = SYS.echoNode(s, node && node.id ? node.id : node); if (!node) return;
      var environment = GD.echoEnvironment(node.environmentId), reward = GD.echoReward(node.rewardId);
      var completed = SYS.echoNodeCompleted(s, node.id), available = SYS.echoNodeAvailable(s, node);
      var rewardParts = [];
      if (node.reward && node.reward.resources && Object.keys(node.reward.resources).length) rewardParts.push(costText(node.reward.resources));
      if (node.reward && node.reward.forgeMaterials && Object.keys(node.reward.forgeMaterials).length) rewardParts.push(forgeCostText({ materials: node.reward.forgeMaterials }));
      var content = el('div', { class: 'echo-modal-content' }, [
        el('div', { class: 'echo-modal-hero echo-tone-' + (environment ? environment.tone : 'violett') }, [
          el('div', { class: 'echo-modal-icon', text: node.icon }),
          el('div', null, [
            el('h4', { text: environment ? environment.name : node.name }),
            el('p', { text: environment ? environment.desc : 'Ein instabiler Nachhall der Welt.' })
          ])
        ]),
        el('div', { class: 'site-summary' }, [
          el('span', { class: 'pill', text: completed ? '✓ Abgeschlossen' : (available ? '✨ Erreichbar' : '🔒 Pfad gesperrt') }),
          el('span', { class: 'pill', text: '⚔️ Gegnerkraft ' + fmt(node.power) }),
          el('span', { class: 'pill', text: (reward ? reward.icon + ' ' + reward.name : '🎁 Beute') }),
          node.boss ? el('span', { class: 'pill tag-busy', text: '👁️ Zyklus-Kern' }) : null
        ]),
        el('div', { class: 'echo-reward-preview' }, [
          el('b', { text: 'Angekündigte Beute' }),
          el('span', { text: rewardParts.join('  ·  ') || 'Keine Beute' }),
          reward ? el('small', { class: 'muted', text: reward.desc }) : null
        ]),
        el('div', { class: 'section-label', text: 'Aktive Gegneraffixe' }),
        el('div', { class: 'echo-affix-list' }, (node.affixIds || []).map(function (id) {
          var affix = GD.echoAffix(id);
          return el('div', { class: 'echo-affix' }, [
            el('span', { class: 'echo-affix-icon', text: affix ? affix.icon : '⚠️' }),
            el('span', null, [el('b', { text: affix ? affix.name : id }), el('small', { text: affix ? affix.desc : '' })])
          ]);
        }))
      ]);
      if (completed) {
        content.appendChild(el('div', { class: 'empty-hint', text: node.boss ? 'Der Kern ist gebrochen. Öffne auf der Karte den nächsten Zyklus.' : 'Dieses Echo wurde bereits bezwungen; wähle einen verbundenen Nachhall.' }));
      } else if (!available) {
        content.appendChild(el('div', { class: 'empty-hint', text: 'Bezwinge zuerst mindestens eines der verbundenen Echos auf der linken Seite.' }));
      } else {
        content.appendChild(el('div', { class: 'section-label', text: 'Armee und Risiko wählen' }));
        (s.armyGroups || []).forEach(function (group) {
          var check = SYS.canChallengeEcho(s, group.id, node.id), groupPower = SYS.armyGroupPower(s, group);
          content.appendChild(el('div', { class: 'card echo-army-choice' }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: group.rulerLed ? GD.rulerStages[s.herrscher.stage].icon : '🚩' }),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name', text: group.name }),
                el('div', { class: 'meta', text: 'Kraft ' + fmt(groupPower) + '/' + fmt(node.power) + ' · ' + SYS.armyCommandUsed(group) + ' Kommando' })
              ])
            ]),
            el('div', { class: 'card-actions' }, ['sicher', 'normal', 'riskant'].map(function (riskId) {
              var risk = SYS.RISK[riskId];
              return btn(risk.icon + ' ' + risk.name, function () {
                var result = SYS.challengeEcho(s, group.id, node.id, riskId);
                if (!result.ok) { toast(result.reason, 'bad'); return; }
                closeModal(); self.commit();
                var gains = costText(result.gains || {}), forge = forgeCostText({ materials: result.forgeGains || {} });
                openModal('Echo-Ergebnis', el('div', { class: 'battle-result ' + (result.won ? 'win' : 'loss') }, [
                  el('div', { class: 'battle-result-icon', text: result.won ? (node.boss ? '👁️' : '🏆') : '💥' }),
                  el('h3', { text: result.won ? 'Echo bezwungen' : (result.partial ? 'Knapp gescheitert' : 'Niederlage') }),
                  el('p', { text: 'Kraft ' + fmt(result.power) + '/' + fmt(result.nodePower) + ' · ' + result.totalLosses + ' Truppen verloren.' }),
                  result.won ? el('p', { text: 'Beute: ' + ([gains, forge].filter(Boolean).join('  ·  ') || '—') }) : null,
                  result.leaderDead ? el('p', { style: 'color:var(--bad)', text: 'Der benannte Anführer ist gefallen; seine Ausrüstung wurde geborgen.' }) : null
                ]), result.won ? '🏆' : '⚰️');
              }, { small: true, cls: riskId === 'riskant' ? 'btn-danger' : (riskId === 'normal' ? 'btn-primary' : ''), disabled: !check.ok, cost: check.ok ? ('×' + risk.reward + ' Beute') : check.reason });
            }))
          ]));
        });
      }
      openModal(node.name, content, node.icon, 'echo-modal');
    },

    openNameModal: function (c) {
      var s = this.state, self = this;
      var sp = GD.creature(c.speciesId);
      var input = el('input', { type: 'text', maxlength: '24', placeholder: 'Leer lassen = passender Zufallsname' });
      var chosen = { id: GD.aspects[0].id };
      var aspectBox = el('div', { class: 'opt-list' });
      function renderAspects() {
        clear(aspectBox);
        GD.aspects.forEach(function (a) {
          var seld = chosen.id === a.id;
          var sk = GD.skill(a.skill);
          var card = el('div', {
            class: 'card', style: 'cursor:pointer' + (seld ? ';border-color:var(--accent-2);box-shadow:0 0 0 1px var(--accent-2)' : ''),
            onclick: function () { chosen.id = a.id; renderAspects(); }
          }, [
            el('div', { class: 'card-head' }, [
              el('div', { class: 'card-emoji', text: a.icon }),
              el('div', { class: 'card-title' }, [
                el('div', { class: 'name' }, [a.name, seld ? el('span', { class: 'badge named', text: '✓ gewählt' }) : null,
                  sk ? el('span', { class: 'pill', text: sk.icon + ' ' + sk.name }) : null]),
                el('div', { class: 'meta', text: a.desc })
              ])
            ])
          ]);
          aspectBox.appendChild(card);
        });
      }
      renderAspects();
      var content = el('div', null, [
        el('p', { class: 'muted', text: 'Eine Einheit wird aus dem Stapel zur Einzel-Elite. Sie erhält Rang, Ausrüstung, Meisterschaft und einen Aspekt; bei leerem Feld vergibt das Spiel einen Namen. Die erste Benennung gründet automatisch eine neue Armee. Namenssiegel: ' + SYS.namedCount(s) + '/' + SYS.nameCapacity(s) + ' (max. 20). Kosten: ' + costText(SYS.nameCost(s, c)) }),
        el('div', { class: 'field' }, [el('label', { text: 'Name' }), input]),
        el('label', { class: 'field-label', text: 'Aspekt wählen' }),
        aspectBox,
        btn('Benennen', function () {
          var r = SYS.nameCreature(s, c.uid, input.value, chosen.id);
          if (!r.ok) { toast(r.reason, 'bad'); return; }
          toast('✨ „' + r.creature.name + '" benannt!', 'gold');
          closeModal(); self.commit();
        }, { cls: 'btn-gold' })
      ]);
      openModal('Namensgebung', content, sp.icon);
      setTimeout(function () { try { input.focus(); input.select(); } catch (e) {} }, 50);
    },

    openSkillModal: function (c) {
      var s = this.state, self = this;
      var sp = GD.creature(c.speciesId);
      var avail = SYS.availableSkills(s, c);
      var cap = SYS.skillCapacity(c);
      var list = el('div', { class: 'opt-list' });
      list.appendChild(el('p', { class: 'muted', text: 'Erlangte Fähigkeiten werden im Kampf stärker. Auf Meisterschaftsstufe 3 kann eine Folgefähigkeit erwachen, die keinen zusätzlichen Slot belegt. Skill-Slots: ' + SYS.skillSlotsUsed(c) + ' / ' + cap + '.' }));
      list.appendChild(el('div', { class: 'section-label', text: 'Erlangte Fähigkeiten' }));
      (c.skills || []).forEach(function (id) {
        var sk = GD.skill(id); if (!sk) return;
        var p = SYS.skillProgress(c, id), need = SYS.skillXpForLevel(p.level), max = p.level >= (sk.maxLevel || 5);
        var follow = sk.next && GD.skill(sk.next) ? (' · Folge: ' + GD.skill(sk.next).name + ' auf Stufe 3') : '';
        list.appendChild(el('div', { class: 'card skill-card' }, [
          el('div', { class: 'card-head' }, [
            el('div', { class: 'card-emoji', text: sk.icon }),
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name' }, [sk.name, el('span', { class: 'pill', text: 'Stufe ' + p.level + '/' + (sk.maxLevel || 5) })]),
              el('div', { class: 'meta', text: sk.desc + follow })
            ])
          ]),
          bar(max ? 1 : p.xp / need, 'xp'),
          el('div', { class: 'bar-label', text: max ? 'Gemeistert' : ('Meisterschaft ' + p.xp + ' / ' + need) }),
          btn(max ? 'Gemeistert' : 'Trainieren', function () {
            var r = SYS.trainSkill(s, c.uid, id);
            if (!r.ok) { toast(r.reason, 'bad'); return; }
            toast('📈 ' + sk.name + ' auf Stufe ' + r.level, 'gold'); closeModal(); self.commit(); self.openSkillModal(c);
          }, { small: true, cls: 'btn-gold', disabled: max || !SYS.canAfford(s, SYS.skillTrainingCost(c, id)), cost: max ? '' : costText(SYS.skillTrainingCost(c, id)) })
        ]));
      });
      list.appendChild(el('div', { class: 'section-label', text: 'Neue Fähigkeit lernen' }));
      if (!avail.length) list.appendChild(el('p', { class: 'muted', text: 'Keine weiteren lernbaren Skills verfügbar.' }));
      avail.forEach(function (id) {
        var sk = GD.skill(id);
        var chk = SYS.canLearnSkill(s, c.uid, id);
        list.appendChild(el('div', { class: 'card' }, [
          el('div', { class: 'card-head' }, [
            el('div', { class: 'card-emoji', text: sk.icon }),
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name' }, [sk.name, el('span', { class: 'pill', text: '+' + Math.round(sk.kampf * 100) + '% Kampf' })]),
              el('div', { class: 'meta', text: sk.desc })
            ])
          ]),
          btn('Lernen', function () {
            var r = SYS.learnSkill(s, c.uid, id);
            if (!r.ok) { toast(r.reason, 'bad'); return; }
            toast('📖 ' + sk.name + ' erlernt!', 'good');
            closeModal(); self.commit();
          }, { cls: 'btn-primary', disabled: !chk.ok, cost: costText(SYS.learnSkillCost(c)) })
        ]));
      });
      openModal('Skills: ' + (c.named ? c.name : sp.name), list, '📖');
    },

    openEvolveModal: function (c) {
      var s = this.state, self = this;
      var sp = GD.creature(c.speciesId);
      var opts = SYS.evolveOptions(s, c);
      var list = el('div', { class: 'opt-list' });
      opts.forEach(function (o) {
        var t = o.target;
        var reqText = o.ok ? 'Bereit' : ('Fehlt: ' + o.missing.join(', '));
        list.appendChild(el('div', { class: 'card' }, [
          el('div', { class: 'card-head' }, [
            el('div', { class: 'card-emoji', text: t.icon }),
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name' }, [t.name, rankBadge(t.rank)]),
              el('div', { class: 'meta', text: t.desc })
            ])
          ]),
          el('div', { class: o.ok ? 'card-desc' : 'card-desc', style: o.ok ? 'color:var(--good)' : 'color:var(--warn)', text: reqText }),
          btn('Entwickeln zu ' + t.name, function () {
            var r = SYS.evolve(s, c.uid, o.to);
            if (!r.ok) { toast(r.reason, 'bad'); return; }
            toast('🧬 Evolution zu ' + t.name + '!', 'gold');
            closeModal(); self.commit();
          }, { cls: 'btn-primary', disabled: !o.ok })
        ]));
      });
      openModal('Evolution: ' + (c.named ? c.name : sp.name), list, sp.icon);
    },

    openEquipModal: function (it) {
      var s = this.state, self = this;
      var list = el('div', { class: 'opt-list' });
      function holderRow(label, emoji, key, eqObj) {
        var cur = eqObj[it.slot];
        var curName = '';
        if (cur != null) { var ci = SYS.findItem(s, cur); curName = ci ? ci.name : ''; }
        return el('div', { class: 'card' }, [
          el('div', { class: 'card-head' }, [
            el('div', { class: 'card-emoji', text: emoji }),
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name', text: label }),
              el('div', { class: 'meta', text: curName ? ('aktuell: ' + curName) : (slotName(it.slot) + '-Slot frei') })
            ])
          ]),
          btn('Hierhin ausrüsten', function () {
            var er = SYS.equipItem(s, it.uid, key);
            if (!er.ok) { toast(er.reason || 'Kann nicht ausgerüstet werden.', 'bad'); return; }
            toast(it.name + ' ausgerüstet.', 'good');
            closeModal(); self.commit();
          }, { small: true, cls: 'btn-primary' })
        ]);
      }
      list.appendChild(holderRow('Herrscher (' + s.herrscher.name + ')', GD.rulerStages[s.herrscher.stage].icon, 'herrscher', s.herrscher.equipment));
      s.creatures.filter(function (c) { return c.named; }).forEach(function (c) {
        var sp = GD.creature(c.speciesId);
        list.appendChild(holderRow(c.name, sp.icon, c.uid, c.equipment));
      });
      openModal('Ausrüsten: ' + it.name, list, it.icon);
    },

    openExpeditionModal: function (region) {
      var s = this.state, self = this;
      var available = SYS.armyAvailable(s);
      var selected = {};
      var rulerJoin = { v: false };
      var content = el('div');
      content.appendChild(el('p', { class: 'muted', text: region.desc + ' · Gegnerkraft ' + fmt(region.power) + '. Wähle deine Streitmacht (nur Einheiten mit Aufgabe „Armee").' }));

      var preview = el('div', { class: 'empty-hint', style: 'text-align:left' });
      function recompute() {
        var uids = Object.keys(selected).filter(function (k) { return selected[k]; }).map(Number);
        var power = SYS.expeditionPower(s, uids, rulerJoin.v);
        clear(preview);
        var chance = power >= region.power ? 'Sieg sehr wahrscheinlich' : (power >= region.power * 0.6 ? 'Riskant – Teilerfolg möglich' : 'Niederlage droht');
        append(preview, [el('b', { text: 'Deine Kraft: ' + fmt(power) + ' / ' + fmt(region.power) }), document.createTextNode(' — ' + chance)]);
      }

      // Herrscher
      var rulerToggle = el('label', { class: 'card', style: 'flex-direction:row;align-items:center;gap:10px;cursor:pointer' }, [
        el('input', { type: 'checkbox', onchange: function (e) { rulerJoin.v = e.target.checked; recompute(); } }),
        el('div', { class: 'card-emoji', text: GD.rulerStages[s.herrscher.stage].icon }),
        el('div', { class: 'card-title' }, [el('div', { class: 'name', text: 'Herrscher (' + s.herrscher.name + ')' }), el('div', { class: 'meta', text: 'Kraft ' + fmt(SYS.rulerPower(s)) })])
      ]);
      content.appendChild(el('div', { class: 'section-label', text: 'Anführer' }));
      content.appendChild(rulerToggle);

      content.appendChild(el('div', { class: 'section-label', text: 'Armee (' + available.length + ' verfügbar)' }));
      if (!available.length) content.appendChild(el('div', { class: 'empty-hint', text: 'Weise Kreaturen im Kreaturen-Tab die Aufgabe „⚔️ Armee" zu.' }));
      var listWrap = el('div', { class: 'opt-list' });
      available.forEach(function (c) {
        var sp = GD.creature(c.speciesId);
        var row = el('label', { class: 'card', style: 'flex-direction:row;align-items:center;gap:10px;cursor:pointer' }, [
          el('input', { type: 'checkbox', onchange: function (e) { selected[c.uid] = e.target.checked; recompute(); } }),
          creatureArt(sp, 'compact'),
          el('div', { class: 'card-title' }, [
            el('div', { class: 'name' }, [c.named ? c.name : sp.name, c.named ? rankBadge(sp.rank) : el('span', { class: 'pill', text: SYS.stackCount(c) + '× Basistrupp' })]),
            el('div', { class: 'meta', text: (c.named ? 'Lv ' + c.level + ' · ' : '') + 'Kraft ' + fmt(SYS.creaturePower(s, c)) })
          ])
        ]);
        listWrap.appendChild(row);
      });
      content.appendChild(listWrap);
      // Risiko-Auswahl
      var risk = { v: 'normal' };
      content.appendChild(el('div', { class: 'section-label', text: 'Risiko' }));
      var riskRow = el('div', { class: 'row wrap', style: 'gap:6px' });
      function renderRisk() {
        clear(riskRow);
        ['sicher', 'normal', 'riskant'].forEach(function (id) {
          var rk = SYS.RISK[id];
          var seld = risk.v === id;
          riskRow.appendChild(el('button', {
            type: 'button', class: 'btn btn-small' + (seld ? ' btn-primary' : ''), style: 'flex:1 1 30%',
            onclick: function () { risk.v = id; renderRisk(); }
          }, [el('span', { text: rk.icon + ' ' + rk.name }),
              el('span', { class: 'btn-cost', text: '×' + rk.reward + ' Beute' })]));
        });
      }
      renderRisk();
      content.appendChild(riskRow);
      content.appendChild(el('div', { class: 'muted', style: 'font-size:12px', text: 'Sicher/Normal: Bei Niederlage halbierte Werte bis zur Heilung. Riskant: ×1,4 Beute & Drop, aber eingesetzte Kreaturen sterben bei Niederlage endgültig; Ausrüstung wird geborgen.' }));

      content.appendChild(el('div', { class: 'section-label', text: 'Einschätzung' }));
      content.appendChild(preview);
      content.appendChild(el('div', { style: 'height:8px' }));
      content.appendChild(btn('Expedition starten (' + region.dauer + ' s)', function () {
        var uids = Object.keys(selected).filter(function (k) { return selected[k]; }).map(Number);
        var r = SYS.startExpedition(s, region.id, uids, rulerJoin.v, risk.v);
        if (!r.ok) { toast(r.reason, 'bad'); return; }
        toast('🚩 Expedition gestartet!', '');
        closeModal(); self.renderTabbar(); self.commit();
      }, { cls: 'btn-primary' }));

      recompute();
      openModal('Expedition: ' + region.name, content, region.icon);
    },

    // ---------- Taktischer Kampf: Gruppenauswahl ----------
    openBattleSetupModal: function (region) {
      var s = this.state, self = this;
      var available = s.creatures.filter(function (c) { return !SYS.creatureBusy(s, c.uid) && !SYS.isWounded(s, c); });
      var selected = {}, rulerJoin = { v: true }, risk = { v: 'normal' };
      var content = el('div');
      content.appendChild(el('p', { class: 'muted', text: 'Stelle bis zu vier Einheitenstapel zusammen. Auf dem 7×5-Feld zählen Bewegung, Reichweite, Hindernisse, Initiative, Warten, Verteidigen und einmalige Gegenangriffe.' }));
      var countInfo = el('div', { class: 'empty-hint', style: 'text-align:left' });
      function partyCount() { return Object.keys(selected).filter(function (k) { return selected[k]; }).length + (rulerJoin.v ? 1 : 0); }
      function updateCount() { countInfo.textContent = 'Gruppe: ' + partyCount() + '/4 · Gegner-Element ' + region.element + ' · Schwäche vermutlich ' + ({ feuer:'Wasser', wasser:'Wind', wind:'Erde', erde:'Feuer', licht:'Dunkel', dunkel:'Licht', geist:'Dunkel' }[region.element] || 'unbekannt'); }
      content.appendChild(el('div', { class: 'section-label', text: 'Gruppe' }));
      var rulerToggle = el('label', { class: 'card battle-select' }, [
        el('input', { type: 'checkbox', checked: '', onchange: function (e) { rulerJoin.v = e.target.checked; if (partyCount() > 4) { rulerJoin.v = true; e.target.checked = true; } updateCount(); } }),
        el('span', { class: 'card-emoji', text: GD.rulerStages[s.herrscher.stage].icon }),
        el('span', null, [el('b', { text: s.herrscher.name }), el('span', { class: 'muted', text: ' · Kraft ' + fmt(SYS.rulerPower(s)) })])
      ]);
      content.appendChild(rulerToggle);
      var fighters = el('div', { class: 'opt-list' });
      available.forEach(function (c) {
        var sp = GD.creature(c.speciesId);
        fighters.appendChild(el('label', { class: 'card battle-select' }, [
          el('input', { type: 'checkbox', onchange: function (e) {
            selected[c.uid] = e.target.checked;
            if (partyCount() > 4) { selected[c.uid] = false; e.target.checked = false; toast('Maximal vier Kämpfer.', 'bad'); }
            updateCount();
          } }),
          creatureArt(sp, 'compact'),
          el('span', null, [el('b', { text: c.named ? c.name : (SYS.stackCount(c) + '× ' + sp.name) }), el('span', { class: 'muted', text: (c.named ? ' · Lv ' + c.level : ' · Basistrupp') + ' · Kraft ' + fmt(SYS.creaturePower(s, c)) })])
        ]));
      });
      content.appendChild(fighters);
      content.appendChild(countInfo); updateCount();
      content.appendChild(el('div', { class: 'section-label', text: 'Einsatzrisiko' }));
      var riskRow = el('div', { class: 'card-actions' }), riskInfo = el('div', { class: 'empty-hint', style: 'text-align:left' });
      function renderBattleRisk() {
        clear(riskRow);
        ['sicher', 'normal', 'riskant'].forEach(function (id) {
          var rk = SYS.RISK[id];
          riskRow.appendChild(btn(rk.icon + ' ' + rk.name, function () { risk.v = id; renderBattleRisk(); }, { small: true, cls: risk.v === id ? (id === 'riskant' ? 'btn-danger' : 'btn-primary') : '' }));
        });
        var chosen = SYS.RISK[risk.v];
        riskInfo.textContent = chosen.icon + ' ' + chosen.name + ': ×' + chosen.reward + ' Beute · ' + (risk.v === 'riskant' ? 'Tod bei Niederlage' : 'Verwundung bei Niederlage');
      }
      content.appendChild(riskRow);
      content.appendChild(riskInfo); renderBattleRisk();
      content.appendChild(el('p', { class: 'muted', style: 'font-size:12px', text: 'Riskant: Bei einer Niederlage kehren die eingesetzten Kreaturen nicht zurück. Der Herrscher kann nicht dauerhaft sterben.' }));
      content.appendChild(btn('Kampf beginnen', function () {
        var uids = Object.keys(selected).filter(function (k) { return selected[k]; }).map(Number);
        var r = SYS.startCombat(s, region.id, uids, rulerJoin.v, risk.v);
        if (!r.ok) { toast(r.reason, 'bad'); return; }
        closeModal(); self.commit(); self.openBattleModal();
      }, { cls: 'btn-gold' }));
      openModal('Taktischer Kampf · ' + region.name, content, '⚔️');
    },

    // ---------- Taktischer Kampf: eigentliche Kampfbühne ----------
    openBattleModal: function () {
      var s = this.state, self = this, cbt = s.activeCombat;
      if (!cbt) return;
      SYS.ensureCombatGrid(s);
      var region = GD.region(cbt.regionId), content = el('div', { class: 'battle-stage' });
      function unitCard(a, enemy) {
        var statuses = (a.statuses || []).map(function (st) { return ({ brand:'🔥 Brand', frost:'❄️ Frost', schock:'⚡ Schock' }[st.id] || st.id) + ' ' + st.turns; });
        return el('div', { class: 'battle-unit' + (a.dead ? ' dead' : '') + (enemy ? ' enemy' : '') }, [
          el('div', { class: 'battle-unit-head' }, [el('span', { text: a.icon }), el('b', { text: a.name }), (a.stack || 1) > 1 ? el('span', { class: 'pill', text: a.stack + '×' }) : null, enemy && a.analyzed ? el('span', { class: 'pill', text: 'schwach: ' + a.weakness }) : null]),
          bar(a.hp / Math.max(1, a.maxHp)),
          el('div', { class: 'bar-label', text: 'LP ' + a.hp + ' / ' + a.maxHp + (enemy ? ' · Absicht: ' + (a.intent === 'arkane_salbe' ? '🔮 Elementarangriff' : '⚔️ Hieb') : ' · MP ' + a.mp + '/' + a.maxMp) }),
          statuses.length ? el('div', { class: 'battle-status', text: statuses.join(' · ') }) : null
        ]);
      }
      var battleHeader = el('div', { class: 'battle-hud' });
      battleHeader.appendChild(el('div', { class: 'battle-round', text: 'RUNDE ' + cbt.round + ' · ' + SYS.RISK[cbt.risk].icon + ' ' + SYS.RISK[cbt.risk].name }));
      var current = cbt.status === 'active' ? SYS.battleCurrentActor(cbt) : null;
      battleHeader.appendChild(el('div', { class: 'battle-initiative' }, (cbt.turnOrder || []).map(function (token, i) {
        var a = token.charAt(0) === 'p' ? cbt.party[Number(token.slice(1))] : cbt.enemies[Number(token.slice(1))];
        return a && !a.dead ? el('span', { class: 'battle-init-token ' + a.side + (i === cbt.turnCursor ? ' current' : '') + (i < cbt.turnCursor ? ' done' : ''), title: a.name, text: a.icon }) : null;
      })));
      content.appendChild(battleHeader);
      var reachable = {};
      if (current && current.side === 'party') SYS.battleReachableCells(cbt, current).forEach(function (cell) { reachable[cell.x + ',' + cell.y] = true; });
      var board = el('div', { class: 'battle-board element-' + region.element, role: 'grid', 'aria-label': 'Taktisches Kampffeld 7 mal 5' });
      function actorAt(x, y) {
        return cbt.party.concat(cbt.enemies).filter(function (a) { return !a.dead && a.pos && a.pos.x === x && a.pos.y === y; })[0] || null;
      }
      for (var by = 0; by < SYS.BATTLE_H; by++) {
        for (var bx = 0; bx < SYS.BATTLE_W; bx++) {
          (function (x, y) {
            var key = x + ',' + y, actorOnCell = actorAt(x, y), obstacle = (cbt.obstacles || []).indexOf(key) >= 0;
            board.appendChild(el('button', {
              type: 'button', role: 'gridcell',
              class: 'battle-cell' + (obstacle ? ' obstacle' : '') + (reachable[key] && !actorOnCell ? ' reachable' : '') + (actorOnCell ? ' occupied ' + actorOnCell.side : '') + (actorOnCell === current ? ' current' : ''),
              disabled: obstacle || !reachable[key] || !!actorOnCell,
              title: obstacle ? 'Hindernis' : (actorOnCell ? actorOnCell.name : (reachable[key] ? 'Hierhin bewegen' : 'Feld ' + (x + 1) + '/' + (y + 1))),
              onclick: reachable[key] && !actorOnCell ? function () {
                var r = SYS.battleMove(s, x, y); if (!r.ok) { toast(r.reason, 'bad'); return; }
                self.persist(s); self.openBattleModal();
              } : null
            }, actorOnCell ? [
              el('span', { class: 'battle-piece', text: actorOnCell.icon }),
              (actorOnCell.stack || 1) > 1 ? el('span', { class: 'battle-stack-count', text: actorOnCell.stack }) : null,
              el('span', { class: 'battle-cell-hp', text: Math.max(0, Math.ceil(actorOnCell.hp / Math.max(1, actorOnCell.maxHp) * 100)) + '%' })
            ] : (obstacle ? el('span', { text: '🪨' }) : null)));
          })(bx, by);
        }
      }
      var fieldColumn = el('div', { class: 'battle-field-column' }, board);
      var commandPanel = el('aside', { class: 'battle-command-panel' });
      var rosterGrid = el('div', { class: 'battle-rosters' });
      var enemyGrid = el('div', { class: 'battle-grid enemies' }); cbt.enemies.forEach(function (a) { enemyGrid.appendChild(unitCard(a, true)); }); rosterGrid.appendChild(enemyGrid);
      var partyGrid = el('div', { class: 'battle-grid party' }); cbt.party.forEach(function (a) { partyGrid.appendChild(unitCard(a, false)); }); rosterGrid.appendChild(partyGrid);
      commandPanel.appendChild(rosterGrid);

      if (cbt.status === 'active') {
        var actor = current;
        commandPanel.appendChild(el('div', { class: 'section-label', text: actor.icon + ' ' + actor.name + ' ist am Zug' }));
        var enemySel = el('select', { class: 'btn battle-target' });
        cbt.enemies.forEach(function (e, i) { if (!e.dead) enemySel.appendChild(el('option', { value: String(i), text: 'Ziel: ' + e.name + ' · ' + e.hp + ' LP' })); });
        var allySel = el('select', { class: 'btn battle-target' });
        cbt.party.forEach(function (a, i) { if (!a.dead) allySel.appendChild(el('option', { value: String(i), text: 'Heilziel: ' + a.name + ' · ' + a.hp + '/' + a.maxHp + ' LP' })); });
        commandPanel.appendChild(enemySel); commandPanel.appendChild(allySel);
        var actions = el('div', { class: 'battle-actions' });
        actor.abilities.forEach(function (id) {
          var ab = GD.battleAbility(id);
          actions.appendChild(btn(ab.icon + ' ' + ab.name, function () {
            var target = ab.kind === 'heal' ? Number(allySel.value) : Number(enemySel.value);
            var r = SYS.battleAction(s, id, target);
            if (!r.ok) { toast(r.reason, 'bad'); return; }
            self.persist(s); self.openBattleModal();
          }, { small: true, cls: id === 'angriff' ? 'btn-primary' : '', disabled: actor.mp < ab.cost, cost: ab.cost ? ab.cost + ' MP' : '' }));
        });
        actions.appendChild(btn('⏳ Warten', function () {
          var r = SYS.battleWait(s); if (!r.ok) { toast(r.reason, 'bad'); return; }
          self.persist(s); self.openBattleModal();
        }, { small: true, disabled: !!actor.waited, cost: 'später handeln' }));
        commandPanel.appendChild(actions);
        commandPanel.appendChild(btn('🏳️ Rückzug', function () { SYS.fleeCombat(s); self.persist(s); self.openBattleModal(); }, { small: true, cls: 'btn-danger' }));
      } else {
        var result = cbt.result || {};
        commandPanel.appendChild(el('div', { class: 'battle-result ' + (result.won ? 'win' : 'loss') }, [
          el('div', { class: 'battle-result-icon', text: result.won ? '🏆' : '☠️' }),
          el('h3', { text: result.won ? 'Sieg' : (result.fled ? 'Rückzug' : 'Niederlage') }),
          result.won ? el('p', { text: 'Beute: ' + costText(result.gains || {}) + (result.drop ? ' · Fund: ' + result.drop.name : '') }) : el('p', { text: result.dead ? (result.dead + ' Einheit(en) endgültig gefallen.') : (result.wounded + ' Einheit(en) verwundet.') })
        ]));
        commandPanel.appendChild(btn('Ergebnis bestätigen', function () { SYS.closeCombat(s); closeModal(); self.commit(); }, { cls: 'btn-gold' }));
      }
      fieldColumn.appendChild(el('div', { class: 'battle-log' }, cbt.log.slice().reverse().map(function (line) { return el('div', { text: line }); })));
      content.appendChild(el('div', { class: 'battle-arena-layout' }, [fieldColumn, commandPanel]));
      openModal('Kampf · ' + region.name, content, '⚔️', 'battle-modal');
    },

    openCounterModal: function (rv) {
      var s = this.state, self = this;
      var enemy = SYS.rivalLairPower(s, rv.id);
      var available = s.creatures.filter(function (c) { return !SYS.creatureBusy(s, c.uid) && !SYS.isWounded(s, c); });
      var selected = {};
      var content = el('div');
      content.appendChild(el('p', { class: 'muted', text: rv.desc + ' Feindkraft in seinem Hort: ' + fmt(enemy) + '. Der Herrscher führt den Gegenangriff an. Sieg besiegt ' + rv.name + ' endgültig (dauerhafter Reichsbonus).' }));
      var preview = el('div', { class: 'empty-hint', style: 'text-align:left' });
      function recompute() {
        var uids = Object.keys(selected).filter(function (k) { return selected[k]; }).map(Number);
        var power = 0;
        uids.forEach(function (uid) { var c = SYS.findCreature(s, uid); if (c) power += SYS.creaturePower(s, c); });
        power += SYS.rulerPower(s);
        power = Math.round(power * (1 + (SYS.computeBonuses(s).armee || 0)));
        clear(preview);
        append(preview, [el('b', { text: 'Deine Kraft: ' + fmt(power) + ' / ' + fmt(enemy) }), document.createTextNode(power >= enemy ? ' — Sieg wahrscheinlich' : ' — noch zu schwach')]);
      }
      content.appendChild(el('div', { class: 'section-label', text: 'Armee (Herrscher kämpft automatisch mit)' }));
      var listWrap = el('div', { class: 'opt-list' });
      available.forEach(function (c) {
        var sp = GD.creature(c.speciesId);
        listWrap.appendChild(el('label', { class: 'card', style: 'flex-direction:row;align-items:center;gap:10px;cursor:pointer' }, [
          el('input', { type: 'checkbox', onchange: function (e) { selected[c.uid] = e.target.checked; recompute(); } }),
          creatureArt(sp, 'compact'),
          el('div', { class: 'card-title' }, [
            el('div', { class: 'name' }, [c.named ? c.name : sp.name, c.named ? rankBadge(sp.rank) : el('span', { class: 'pill', text: SYS.stackCount(c) + '× Basistrupp' })]),
            el('div', { class: 'meta', text: (c.named ? 'Lv ' + c.level + ' · ' : '') + 'Kraft ' + fmt(SYS.creaturePower(s, c)) })
          ])
        ]));
      });
      content.appendChild(listWrap);
      content.appendChild(el('div', { class: 'section-label', text: 'Einschätzung' }));
      content.appendChild(preview);
      content.appendChild(el('div', { style: 'height:8px' }));
      content.appendChild(btn('Gegenangriff starten', function () {
        var uids = Object.keys(selected).filter(function (k) { return selected[k]; }).map(Number);
        var r = SYS.counterAttackRival(s, rv.id, uids);
        if (!r.ok) { toast(r.reason, 'bad'); return; }
        toast(r.won ? ('👑 ' + rv.name + ' besiegt!') : ('⚔️ Gegenangriff gescheitert.'), r.won ? 'gold' : 'bad');
        closeModal(); self.commit();
      }, { cls: 'btn-primary' }));
      recompute();
      openModal('Gegenangriff: ' + rv.name, content, rv.icon);
    },

    openEventModal: function (eventId) {
      var s = this.state, self = this;
      var ev = GD.event(eventId || s.activeEvent);
      if (!ev || !ev.choices) return;
      var content = el('div', null, [el('p', { class: 'muted', text: ev.desc })]);
      var list = el('div', { class: 'opt-list' });
      ev.choices.forEach(function (ch, idx) {
        list.appendChild(el('div', { class: 'card' }, [
          el('div', { class: 'card-head' }, [
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name', text: ch.label }),
              el('div', { class: 'meta', text: ch.desc || '' })
            ])
          ]),
          btn('Wählen', function () {
            var r = SYS.resolveEvent(s, idx);
            if (!r.ok) { toast(r.reason, 'bad'); return; }
            toast(ev.icon + ' ' + ch.label, 'good');
            closeModal(); self.commit();
          }, { small: true, cls: 'btn-primary' })
        ]));
      });
      content.appendChild(list);
      openModal(ev.icon + ' ' + ev.title, content, ev.icon);
    },

    openAffinityModal: function () {
      var s = this.state, self = this;
      var content = el('div', null, [el('p', { class: 'muted', text: 'Wähle eine Affinität – sie verstärkt Zauber ihrer Schule um 25 % und gibt einen dauerhaften Reichsbonus. Die Wahl ist endgültig.' })]);
      var list = el('div', { class: 'opt-list' });
      GD.affinities.forEach(function (a) {
        list.appendChild(el('div', { class: 'card' }, [
          el('div', { class: 'card-head' }, [
            el('div', { class: 'card-emoji', text: a.icon }),
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name', text: a.name }),
              el('div', { class: 'meta', text: a.desc })
            ])
          ]),
          btn('Wählen', function () {
            var r = SYS.chooseAffinity(s, a.id);
            if (!r.ok) { toast(r.reason, 'bad'); return; }
            toast(a.icon + ' ' + a.name + ' gewählt!', 'gold');
            closeModal(); self.commit();
          }, { small: true, cls: 'btn-gold' })
        ]));
      });
      content.appendChild(list);
      openModal('Affinität wählen', content, '🌟');
    },

    openTalentModal: function () {
      var s = this.state, self = this;
      var earned = SYS.talentPointsEarned(s), spent = SYS.talentPointsSpent(s), available = SYS.talentPointsAvailable(s);
      var content = el('div', { class: 'talent-screen' });
      content.appendChild(el('div', { class: 'talent-summary' }, [
        el('div', null, [el('strong', { text: available }), el('span', { text: ' freie Punkte' })]),
        el('div', null, [el('strong', { text: spent }), el('span', { text: ' investiert' })]),
        el('div', null, [el('strong', { text: earned }), el('span', { text: ' verdient' })]),
        el('button', { type: 'button', class: 'info-btn', 'aria-label': 'Talentbaum erklären', onclick: function () { self.openHelpModal('talente'); } }, [el('span', { text: 'ℹ️' })])
      ]));
      content.appendChild(el('p', { class: 'muted talent-intro', text: 'Ab Level 2 ein Punkt pro Herrscher-Level sowie zwei Punkte je neuer Evolutionsstufe. Investiere von oben nach unten; Schlussknoten verlangen 15 Punkte im Zweig.' }));

      var viewport = el('div', { class: 'talent-tree-viewport' });
      var tree = el('div', { class: 'talent-tree' });
      GD.talentBranches.forEach(function (branch) {
        var branchSpent = SYS.talentPointsSpent(s, branch.id);
        var lane = el('section', { class: 'talent-branch', style: '--talent-color:' + branch.color, 'data-branch': branch.id });
        lane.appendChild(el('header', { class: 'talent-branch-head' }, [
          el('div', { class: 'talent-branch-icon', text: branch.icon }),
          el('div', null, [el('h4', { text: branch.name }), el('p', { text: branch.desc })]),
          el('span', { class: 'pill', text: branchSpent + ' P' })
        ]));
        GD.talents.filter(function (talent) { return talent.branch === branch.id; })
          .sort(function (a, b) { return a.row - b.row; })
          .forEach(function (talent) {
            var rank = SYS.talentRank(s, talent.id), alloc = SYS.canAllocateTalent(s, talent.id), req = SYS.talentReqStatus(s, talent);
            var refund = SYS.canRefundTalent(s, talent.id);
            var maxed = rank >= talent.maxRank;
            var status = maxed ? 'Gemeistert' : (alloc.ok ? 'Bereit' : (req.ok ? (available ? 'Gesperrt' : 'Keine freien Punkte') : req.missing.join(' · ')));
            if (rank > 0 && !refund.ok) status += ' · Rückgabe: ' + refund.reason;
            var node = el('article', {
              class: 'talent-node ' + (rank ? 'allocated ' : '') + (maxed ? 'maxed ' : '') + (alloc.ok ? 'available ' : 'locked ') + (talent.maxRank === 1 ? 'capstone' : ''),
              'data-talent': talent.id
            }, [
              el('div', { class: 'talent-node-top' }, [
                el('div', { class: 'talent-node-icon', text: talent.icon }),
                el('div', { class: 'talent-node-copy' }, [
                  el('b', { text: talent.name }),
                  el('small', { text: talent.desc })
                ]),
                el('span', { class: 'talent-rank', text: rank + '/' + talent.maxRank })
              ]),
              el('div', { class: 'talent-node-foot' }, [
                el('span', { class: 'talent-status', text: status }),
                rank > 0 ? btn('−', function () {
                  var result = SYS.refundTalent(s, talent.id);
                  if (!result.ok) { toast(result.reason, 'bad'); return; }
                  toast('↩️ Punkt zurückerstattet · ' + costText(result.cost), '');
                  self.commit(); self.openTalentModal();
                }, { small: true, disabled: !refund.ok, cost: refund.cost ? costText(refund.cost) : '' }) : null,
                btn('+', function () {
                  var result = SYS.allocateTalent(s, talent.id);
                  if (!result.ok) { toast(result.reason, 'bad'); return; }
                  toast(talent.icon + ' ' + talent.name + ' ' + result.rank + '/' + talent.maxRank, result.rank === talent.maxRank ? 'gold' : 'good');
                  self.commit(); self.openTalentModal();
                }, { small: true, cls: alloc.ok ? 'btn-gold' : '', disabled: !alloc.ok })
              ])
            ]);
            lane.appendChild(node);
          });
        tree.appendChild(lane);
      });
      viewport.appendChild(tree); content.appendChild(viewport);
      openModal('Herrscher-Talentbaum', content, '🌟', 'talent-modal');
    },

    openRulerModal: function () {
      var s = this.state, self = this;
      var stage = GD.rulerStages[s.herrscher.stage];
      var stats = SYS.rulerStats(s);
      var content = el('div');

      content.appendChild(el('div', { class: 'stat-grid' }, ['lp', 'ang', 'ver', 'mag', 'tmp'].map(function (k) {
        return el('div', { class: 'stat-box' }, [el('div', { class: 'v', text: fmt(stats[k]) }), el('div', { class: 'k', text: STAT_LABEL[k] })]);
      }).concat([el('div', { class: 'stat-box' }, [el('div', { class: 'v', text: fmt(SYS.rulerPower(s)) }), el('div', { class: 'k', text: 'Kraft' })])])));

      // Namen
      var nameIn = el('input', { type: 'text', maxlength: '24', value: s.herrscher.name });
      var reichIn = el('input', { type: 'text', maxlength: '24', value: s.reich });
      content.appendChild(el('div', { class: 'field' }, [el('label', { text: 'Name des Herrschers' }), nameIn]));
      content.appendChild(el('div', { class: 'field' }, [el('label', { text: 'Name des Reichs' }), reichIn]));
      content.appendChild(btn('Namen speichern', function () {
        if (nameIn.value.trim()) s.herrscher.name = nameIn.value.trim().slice(0, 24);
        if (reichIn.value.trim()) s.reich = reichIn.value.trim().slice(0, 24);
        toast('Gespeichert.', 'good'); closeModal(); self.commit();
      }, { small: true }));

      // Seelen opfern (Erntefest light)
      content.appendChild(el('div', { class: 'section-label', text: 'Seelen opfern (Herrscher-EP)' }));
      content.appendChild(el('p', { class: 'muted', text: 'Wandle Seelen in Erfahrung um (1 Seele = 2 EP). Aktuell: ' + fmt(s.resources.seelen) + ' 👻' }));
      function sac(amount) {
        return btn('Opfere ' + (amount === Infinity ? 'alle' : amount), function () {
          var n = amount === Infinity ? Math.floor(s.resources.seelen) : amount;
          var r = SYS.sacrificeSouls(s, n);
          if (!r.ok) toast(r.reason, 'bad'); else toast('🩸 +' + r.xp + ' Herrscher-EP', 'gold');
          closeModal(); self.openRulerModal();
        }, { small: true, cls: 'btn-gold', disabled: s.resources.seelen < (amount === Infinity ? 1 : amount) });
      }
      content.appendChild(el('div', { class: 'card-actions' }, [sac(50), sac(200), sac(Infinity)]));

      // Fähigkeiten des Main Characters: dieselbe Meisterschaft wie bei Benannten.
      content.appendChild(el('div', { class: 'section-label', text: 'Erlangte Fähigkeiten' }));
      var rulerSkills = el('div', { class: 'opt-list' });
      (s.herrscher.skills || []).forEach(function (id) {
        var sk = GD.skill(id); if (!sk) return;
        var p = SYS.skillProgress(s.herrscher, id), max = p.level >= (sk.maxLevel || 5), need = SYS.skillXpForLevel(p.level);
        rulerSkills.appendChild(el('div', { class: 'card skill-card' }, [
          el('div', { class: 'card-head' }, [
            el('div', { class: 'card-emoji', text: sk.icon }),
            el('div', { class: 'card-title' }, [
              el('div', { class: 'name' }, [sk.name, el('span', { class: 'pill', text: 'Stufe ' + p.level + '/' + (sk.maxLevel || 5) })]),
              el('div', { class: 'meta', text: sk.desc + (sk.next && GD.skill(sk.next) ? ' · Folge auf Stufe 3: ' + GD.skill(sk.next).name : '') })
            ])
          ]),
          bar(max ? 1 : p.xp / need, 'xp'),
          el('div', { class: 'bar-label', text: max ? 'Gemeistert' : (p.xp + ' / ' + need + ' Meisterschaft') }),
          btn(max ? 'Gemeistert' : 'Trainieren', function () {
            var tr = SYS.trainSkill(s, 'herrscher', id);
            if (!tr.ok) { toast(tr.reason, 'bad'); return; }
            toast('📈 ' + sk.name + ' auf Stufe ' + tr.level, 'gold'); closeModal(); self.commit(); self.openRulerModal();
          }, { small: true, cls: 'btn-gold', disabled: max || !SYS.canAfford(s, SYS.skillTrainingCost(s.herrscher, id)), cost: max ? '' : costText(SYS.skillTrainingCost(s.herrscher, id)) })
        ]));
      });
      content.appendChild(rulerSkills);

      // Passiver Last-Epoch-artiger Talentbaum.
      var talentAvailable = SYS.talentPointsAvailable(s), talentSpent = SYS.talentPointsSpent(s);
      content.appendChild(el('div', { class: 'section-label', text: 'Herrscher-Talente' }));
      content.appendChild(el('div', { class: 'card ruler-talent-card' }, [
        el('div', { class: 'card-head' }, [
          el('div', { class: 'card-emoji', text: '🌟' }),
          el('div', { class: 'card-title' }, [
            el('div', { class: 'name', text: talentAvailable + ' freie Talentpunkte' }),
            el('div', { class: 'meta', text: talentSpent + ' investiert · Verschlinger, Herrschaft und Arkana' })
          ])
        ]),
        btn('Talentbaum öffnen', function () { self.openTalentModal(); }, { cls: talentAvailable ? 'btn-gold' : '', small: true })
      ]));

      // Stufen-Übersicht
      content.appendChild(el('div', { class: 'section-label', text: 'Evolutionsstufen' }));
      var stages = el('div', { class: 'opt-list' });
      GD.rulerStages.forEach(function (st, i) {
        var done = i <= s.herrscher.stage;
        var reqT = 'Lv ' + st.reqLevel + (st.reqSeelen ? ' · ' + st.reqSeelen + ' Seelen gesamt' : '');
        stages.appendChild(el('div', { class: 'row', style: 'gap:8px;padding:6px 9px;border:1px solid var(--line);border-radius:9px;background:' + (i === s.herrscher.stage ? 'var(--panel-3)' : 'var(--bg-2)') }, [
          el('span', { style: 'font-size:18px', text: st.icon }),
          el('div', { style: 'flex:1' }, [el('div', { text: st.name + (done ? ' ✓' : '') }), el('div', { class: 'muted', style: 'font-size:11px', text: reqT })])
        ]));
      });
      content.appendChild(stages);

      // Spielstand-Sicherung (Export/Import) — Phase 30
      content.appendChild(el('hr', { class: 'sep' }));
      content.appendChild(this.secLabel('Spielstand-Sicherung'));
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

      // Reset
      content.appendChild(el('hr', { class: 'sep' }));
      content.appendChild(btn('🗑 Spielstand zurücksetzen', function () {
        if (window.confirm('Wirklich den gesamten Fortschritt löschen?')) {
          if (window.__TEMPEST__ && window.__TEMPEST__.resetGame) window.__TEMPEST__.resetGame();
          else { GST.reset(); window.location.reload(); }
        }
      }, { cls: 'btn-danger', small: true }));

      openModal(s.herrscher.name, content, stage.icon);
    },

    // ---------- Chimära-Fusion ----------
    openFusionModal: function (preBase) {
      var s = this.state, self = this;
      if (!SYS.featureUnlocked(s, 'fusion')) { toast('Fusion ist noch nicht freigeschaltet.', 'bad'); return; }
      function nameOf(c) { return (c.named ? c.name : GD.creature(c.speciesId).name) + ' · Lv ' + c.level + ((c.fusionLevel || 0) ? ' 🧬×' + c.fusionLevel : ''); }
      function bases() { return s.creatures.filter(function (c) { return c.named && !SYS.creatureBusy(s, c.uid) && (c.fusionLevel || 0) < SYS.FUSION_MAX; }); }
      function cats(baseUid) { return s.creatures.filter(function (c) { return c.named && c.uid !== baseUid && !SYS.creatureBusy(s, c.uid); }); }

      if (!bases().length || s.creatures.filter(function (c) { return c.named; }).length < 2) {
        var msg = el('div', null, [el('p', { class: 'muted', text: 'Du brauchst zwei freie benannte Kreaturen. Unbenannte Stapel können nicht fusioniert werden; Armee-Anführer müssen vorher von ihrer Führung entbunden werden.' })]);
        openModal('Chimära-Fusion', msg, '🧬');
        return;
      }

      var content = el('div');
      content.appendChild(el('p', { class: 'muted', text: 'Verschmilz zwei benannte Eliten: die Basis bleibt und wird +15 % stärker, der Katalysator wird geopfert und vererbt ggf. einen Skill. Die Wahl ist endgültig.' }));
      var baseSel = el('select', { class: 'btn', style: 'width:100%' });
      var catSel = el('select', { class: 'btn', style: 'width:100%' });
      var preview = el('div', { class: 'empty-hint', style: 'text-align:left' });

      function fillBase() {
        clear(baseSel);
        bases().forEach(function (c) { var o = el('option', { value: String(c.uid), text: nameOf(c) }); if (preBase && c.uid === preBase.uid) o.setAttribute('selected', ''); baseSel.appendChild(o); });
      }
      function fillCat() {
        clear(catSel);
        cats(Number(baseSel.value)).forEach(function (c) { catSel.appendChild(el('option', { value: String(c.uid), text: nameOf(c) })); });
      }
      function recompute() {
        clear(preview);
        var bu = Number(baseSel.value), cu = Number(catSel.value);
        var base = SYS.findCreature(s, bu);
        if (!base) { append(preview, 'Keine geeignete Basis.'); return; }
        var chk = SYS.canFuse(s, bu, cu);
        append(preview, [
          el('div', null, [el('b', { text: 'Kosten: ' }), document.createTextNode(costText(SYS.fusionCost(base)))]),
          el('div', { class: 'muted', text: 'Fusion ' + (base.fusionLevel || 0) + ' → ' + ((base.fusionLevel || 0) + 1) + ' / ' + SYS.FUSION_MAX }),
          el('div', { style: chk.ok ? 'color:var(--good)' : 'color:var(--warn)', text: chk.ok ? '✓ Bereit zur Fusion.' : ('Nicht möglich: ' + chk.reason) })
        ]);
      }
      baseSel.addEventListener('change', function () { fillCat(); recompute(); });
      catSel.addEventListener('change', recompute);
      fillBase(); fillCat();

      content.appendChild(el('div', { class: 'field' }, [el('label', { text: 'Basis (bleibt & erstarkt)' }), baseSel]));
      content.appendChild(el('div', { class: 'field' }, [el('label', { text: 'Katalysator (wird geopfert)' }), catSel]));
      content.appendChild(el('div', { class: 'section-label', text: 'Einschätzung' }));
      content.appendChild(preview);
      content.appendChild(el('div', { style: 'height:8px' }));
      content.appendChild(btn('Fusionieren', function () {
        var r = SYS.fuse(s, Number(baseSel.value), Number(catSel.value));
        if (!r.ok) { toast(r.reason, 'bad'); return; }
        toast('🧬 Fusion gelungen!' + (r.learnedSkill && GD.skill(r.learnedSkill) ? (' Skill „' + GD.skill(r.learnedSkill).name + '" vererbt.') : ''), 'gold');
        closeModal(); self.commit();
      }, { cls: 'btn-gold' }));
      recompute();
      openModal('Chimära-Fusion', content, '🧬');
    },

    // ---------- Zuschauer-Modus: Spielzeit vorspulen ----------
    fastForward: function (seconds) {
      var s = this.state;
      var n = Math.max(1, Math.min(600, seconds | 0));
      for (var i = 0; i < n; i++) {
        SYS.tick(s);
        if (s.settings && s.settings.watch) SYS.autoPlayStep(s);
        // Blockierende Wahl-Events im Vorlauf automatisch (sicher) auflösen
        if (s.activeEvent) { var aev = GD.event(s.activeEvent); if (aev && aev.choices) SYS.resolveEvent(s, aev.choices.length - 1); else s.activeEvent = null; }
      }
      toast('⏩ ' + (n >= 60 ? (Math.round(n / 60) + ' min') : (n + ' s')) + ' vorgespult.', 'gold');
      this.commit();
    }
  };

  // ---------- kleine Helfer ----------
  var BONUS_NAME = {
    produktionAll: 'Produktion', produktionMagie: 'Magie', armee: 'Armee', verteidigung: 'Verteidigung',
    wissen: 'Wissen', seelen: 'Seelen', xp: 'Erfahrung', drop: 'Beute-Chance', kapazitaet: 'Kapazität',
    expedTempo: 'Expeditionstempo', heiltempo: 'Heilung', threatRuhe: 'Ruhe', beuteRang: 'Beutegüte',
    evoRabatt: 'Evolutionsrabatt', summonRabatt: 'Beschwörungsrabatt', bauRabatt: 'Baurabatt', summonRang: 'Beschwörungsrang'
  };
  function bonusName(k) { return BONUS_NAME[k] || k; }
  function slotName(id) { var s = window.GameData.equipSlots.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  function claimBonusText(r) {
    var parts = [];
    for (var k in r.claimBonus) parts.push('+' + r.claimBonus[k] + ' ' + (RES[k] ? RES[k].icon : k));
    return parts.join(' ');
  }

  window.GameUI = UI;
})();
