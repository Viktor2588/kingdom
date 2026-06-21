/* ============================================================
   ui-adventure.js — Karten-, Armee-, Echo-, Expeditions- und Kampf-UI.
   Erweitert GameUI nach ui.js; klassisches Script ohne Build.
   ============================================================ */
(function () {
  'use strict';
  var UI = window.GameUI, H = window.GameUIInternal;
  if (!UI || !H) throw new Error('ui-adventure.js muss nach ui.js geladen werden');
  var SYS = window.GameSystems, GD = window.GameData, RES = H.RES;
  var el = H.el, svgEl = H.svgEl, append = H.append, clear = H.clear, $ = H.$;
  var fmt = H.fmt, rate = H.rate, pct = H.pct, resIcon = H.resIcon;
  var costText = H.costText, forgeCostText = H.forgeCostText;
  var btn = H.btn, rankBadge = H.rankBadge, creatureArt = H.creatureArt, bar = H.bar, statsLine = H.statsLine;
  var openModal = H.openModal, closeModal = H.closeModal, toast = H.toast;
  var bonusName = H.bonusName, slotName = H.slotName, claimBonusText = H.claimBonusText;

  Object.assign(UI, {
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


  });
})();
