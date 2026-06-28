/* ============================================================
   systems-specializations.js — Reichsdoktrinen, aktive Bezirke
   und Anführerschulen (Phase 50). DOM-frei; erweitert GameSystems.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var SYS = root.GameSystems, I = root.GameSystemsInternal;
  if (!SYS || !I) throw new Error('systems-specializations.js muss nach den Systemmodulen geladen werden');
  var GD = I.GD, round = I.round;

  var DOCTRINE_LOCK = 180;
  var DISTRICT_REBUILD = 45;
  var AUTO_INTERVAL = 8;

  var DOCTRINES = [
    {
      id: 'conquest', icon: '⚔️', name: 'Eroberung', short: 'Offensive Feldzüge und schnelle Gebietssicherung.',
      effects: { armee: 0.18, xp: 0.10, threatRuhe: -0.08 },
      preferredBuildings: ['arena', 'labyrinth', 'schmiede'], reward: 1.12
    },
    {
      id: 'research', icon: '📚', name: 'Forschung', short: 'Wissen, Magie und technischer Vorsprung.',
      effects: { wissen: 0.28, produktionMagie: 0.12, expedTempo: 0.08, armee: -0.05 },
      preferredBuildings: ['forschungsgilde', 'bibliothek', 'arkane_akademie'], reward: 1.08
    },
    {
      id: 'trade', icon: '⚖️', name: 'Handel', short: 'Gold, Material und wertvollere Aufträge.',
      effects: { produktionGold: 0.28, produktionMaterial: 0.18, drop: 0.08 },
      preferredBuildings: ['markt', 'handelshafen', 'mine'], reward: 1.22
    },
    {
      id: 'breeding', icon: '🧬', name: 'Monsterzucht', short: 'Mehr Gefolgschaft, Erfahrung und Evolution.',
      effects: { summonRabatt: 0.18, evoRabatt: 0.12, xp: 0.16, kapazitaet: 5, produktionNahrung: 0.10 },
      preferredBuildings: ['beschwoerungskreis', 'wohnbezirk', 'farm'], reward: 1.10
    },
    {
      id: 'labyrinth', icon: '🏰', name: 'Labyrinth', short: 'Verteidigung, Seelenertrag und kontrollierte Bedrohung.',
      effects: { verteidigung: 0.30, seelen: 0.16, threatRuhe: 0.25, heiltempo: 0.15 },
      preferredBuildings: ['labyrinth', 'seelentempel', 'wohnbezirk'], reward: 1.10
    }
  ];
  var DOCTRINE_BY = {};
  DOCTRINES.forEach(function (entry) { DOCTRINE_BY[entry.id] = entry; });

  var DISTRICTS = [
    { id: 'warcamp', icon: '🚩', name: 'Kriegslager', short: '+12 % Armee, +1 Bewegung.', effects: { armee: 0.12, bewegung: 1 } },
    { id: 'archive', icon: '📜', name: 'Großarchiv', short: '+18 % Wissen, +8 % Magieproduktion.', effects: { wissen: 0.18, produktionMagie: 0.08 } },
    { id: 'bazaar', icon: '🪙', name: 'Freier Basar', short: '+18 % Gold, +10 % Auftragslohn.', effects: { produktionGold: 0.18 }, reward: 1.10 },
    { id: 'hatchery', icon: '🥚', name: 'Brutgärten', short: '−10 % Beschwörung, +4 Kapazität.', effects: { summonRabatt: 0.10, kapazitaet: 4, produktionNahrung: 0.08 } },
    { id: 'bastion', icon: '🛡️', name: 'Innere Bastion', short: '+20 % Verteidigung, ruhigere Rivalen.', effects: { verteidigung: 0.20, threatRuhe: 0.12 } },
    { id: 'runeforge', icon: '⚒️', name: 'Runenviertel', short: '+14 % Material, bessere Beute.', effects: { produktionMaterial: 0.14, drop: 0.10 } }
  ];
  var DISTRICT_BY = {};
  DISTRICTS.forEach(function (entry) { DISTRICT_BY[entry.id] = entry; });

  var SCHOOLS = [
    { id: 'commander', icon: '🎖️', name: 'Kommandeur', short: 'Führung, Tempo und Sturmstoß.', statMod: { ang: 1.08, tmp: 1.10 }, armyBonus: 0.15, tactical: 'sturmstoss', action: 'wirbel' },
    { id: 'hunter', icon: '🏹', name: 'Jäger', short: 'Präzision, Analyse und Fernkampf.', statMod: { ang: 1.12, tmp: 1.12 }, armyBonus: 0.07, tactical: 'analysieren', action: 'schuss' },
    { id: 'mage', icon: '🔮', name: 'Magier', short: 'Arkane Macht und Feuerstoß.', statMod: { mag: 1.20, tmp: 1.05 }, armyBonus: 0.04, tactical: 'feuerlanze', action: 'feuer' },
    { id: 'defender', icon: '🛡️', name: 'Verteidiger', short: 'Lebenspunkte, Rüstung und Heilwoge.', statMod: { lp: 1.16, ver: 1.20 }, armyBonus: 0.11, tactical: 'lichtsegen', action: 'heilen' },
    { id: 'smith', icon: '⚒️', name: 'Schmiedemeister', short: 'Ausgewogene Runenkraft und Frostlanze.', statMod: { ang: 1.08, ver: 1.08, mag: 1.10 }, armyBonus: 0.06, tactical: 'frostsplitter', action: 'frost' }
  ];
  var SCHOOL_BY = {};
  SCHOOLS.forEach(function (entry) { SCHOOL_BY[entry.id] = entry; });

  function num(value) { value = Number(value); return isFinite(value) ? value : 0; }
  function ensure(state) {
    if (!state.specializations || typeof state.specializations !== 'object' || Array.isArray(state.specializations)) state.specializations = {};
    var spec = state.specializations;
    if (!DOCTRINE_BY[spec.doctrineId]) spec.doctrineId = null;
    if (spec.autoDoctrine !== 'adaptive' && !DOCTRINE_BY[spec.autoDoctrine]) spec.autoDoctrine = 'adaptive';
    spec.doctrineLockedUntil = Math.max(0, Math.floor(num(spec.doctrineLockedUntil)));
    spec.doctrineChanges = Math.max(0, Math.floor(num(spec.doctrineChanges)));
    spec.districtChanges = Math.max(0, Math.floor(num(spec.districtChanges)));
    spec.schoolsAssigned = Math.max(0, Math.floor(num(spec.schoolsAssigned)));
    if (typeof spec.lastDoctrineReason !== 'string') spec.lastDoctrineReason = '';
    if (!Array.isArray(spec.districts)) spec.districts = [];
    spec.districts = spec.districts.slice(0, 3);
    while (spec.districts.length < 3) spec.districts.push(null);
    spec.districts = spec.districts.map(function (id) { return DISTRICT_BY[id] ? id : null; });
    var seenDistricts = {};
    spec.districts = spec.districts.map(function (id) {
      if (!id || seenDistricts[id]) return null;
      seenDistricts[id] = true;
      return id;
    });
    if (spec.rebuild && (!DISTRICT_BY[spec.rebuild.districtId] || !isFinite(num(spec.rebuild.slot)) || !isFinite(num(spec.rebuild.readyTick)))) spec.rebuild = null;
    if (spec.rebuild) {
      spec.rebuild.slot = Math.max(0, Math.min(2, Math.floor(num(spec.rebuild.slot))));
      spec.rebuild.readyTick = Math.max(state.tick || 0, Math.floor(num(spec.rebuild.readyTick)));
    }
    (state.creatures || []).forEach(function (creature) {
      if (!creature.named || !SCHOOL_BY[creature.schoolId]) creature.schoolId = null;
    });
    return spec;
  }
  function addEffects(target, effects) {
    for (var key in (effects || {})) {
      if (key === 'produce') {
        target.produce = target.produce || {};
        for (var resource in effects.produce) target.produce[resource] = (target.produce[resource] || 0) + effects.produce[resource];
      } else target[key] = (target[key] || 0) + effects[key];
    }
  }
  function doctrine(state) { return DOCTRINE_BY[ensure(state).doctrineId] || null; }
  function districtSlots(state) { return 2 + ((state.herrscher && state.herrscher.stage >= 3) ? 1 : 0); }
  function activeDistricts(state) {
    var spec = ensure(state), slots = districtSlots(state);
    return spec.districts.slice(0, slots).map(function (id) { return DISTRICT_BY[id] || null; }).filter(Boolean);
  }
  function effects(state) {
    var out = {}, selected = doctrine(state);
    if (selected) addEffects(out, selected.effects);
    activeDistricts(state).forEach(function (district) { addEffects(out, district.effects); });
    return out;
  }
  function buildingCostMultiplier(state, buildingId) {
    var selected = doctrine(state);
    if (!selected) return 1;
    return selected.preferredBuildings.indexOf(buildingId) >= 0 ? 0.82 : 1.08;
  }
  function rewardMultiplier(state, kind) {
    var mult = 1, selected = doctrine(state);
    if (selected && kind === 'contract') mult *= selected.reward || 1;
    activeDistricts(state).forEach(function (district) { if (kind === 'contract') mult *= district.reward || 1; });
    return mult;
  }

  function doctrineChangeCost(state, id) {
    var spec = ensure(state);
    if (!spec.doctrineId || spec.doctrineId === id) return {};
    var scale = 1 + Math.max(0, state.herrscher.stage || 0) * 0.4;
    return { gold: round(320 * scale), wissen: round(140 * scale) };
  }
  function canSetDoctrine(state, id) {
    var spec = ensure(state);
    if (!DOCTRINE_BY[id]) return { ok: false, reason: 'Unbekannte Doktrin' };
    if (root.GameChronicle && !root.GameChronicle.isDoctrineAllowed(state, id)) return { ok: false, reason: 'Diese Challenge verbietet Handel' };
    if (spec.doctrineId === id) return { ok: false, reason: 'Doktrin bereits aktiv' };
    if ((state.tick || 0) < spec.doctrineLockedUntil) return { ok: false, reason: 'Neuausrichtung noch ' + (spec.doctrineLockedUntil - state.tick) + ' s gesperrt' };
    var cost = doctrineChangeCost(state, id);
    if (!SYS.canAfford(state, cost)) return { ok: false, reason: SYS.missingCost(state, cost).join(', '), cost: cost };
    return { ok: true, cost: cost };
  }
  function setDoctrine(state, id, reason) {
    var check = canSetDoctrine(state, id);
    if (!check.ok) return check;
    var spec = ensure(state), selected = DOCTRINE_BY[id];
    SYS.pay(state, check.cost);
    spec.doctrineId = id;
    spec.doctrineLockedUntil = (state.tick || 0) + DOCTRINE_LOCK;
    spec.lastDoctrineReason = reason || 'Manuelle Neuausrichtung';
    spec.doctrineChanges++;
    I.log(state, selected.icon + ' Reichsdoktrin: ' + selected.name + ' — ' + spec.lastDoctrineReason + '.', 'gold');
    return { ok: true, doctrine: selected, cost: check.cost };
  }
  function setAutoDoctrine(state, id) {
    var spec = ensure(state);
    if (root.GameChronicle && id !== 'adaptive' && !root.GameChronicle.isDoctrineAllowed(state, id)) id = 'adaptive';
    spec.autoDoctrine = id === 'adaptive' || DOCTRINE_BY[id] ? id : 'adaptive';
    return spec.autoDoctrine;
  }

  function districtCost(state, districtId) {
    var scale = 1 + Math.max(0, state.herrscher.stage || 0) * 0.35;
    return { gold: round(180 * scale), material: round(120 * scale) };
  }
  function canConfigureDistrict(state, slot, districtId) {
    var spec = ensure(state);
    slot = Math.floor(num(slot));
    if (!DISTRICT_BY[districtId]) return { ok: false, reason: 'Unbekannter Bezirk' };
    if (root.GameChronicle && !root.GameChronicle.isDistrictAllowed(state, districtId)) return { ok: false, reason: 'Diese Challenge verbietet den Basar' };
    if (slot < 0 || slot >= districtSlots(state)) return { ok: false, reason: 'Bezirksslot noch gesperrt' };
    if (spec.rebuild) return { ok: false, reason: 'Ein Bezirk wird bereits umgebaut' };
    if (spec.districts[slot] === districtId) return { ok: false, reason: 'Bezirk bereits aktiv' };
    if (spec.districts.some(function (id, index) { return index !== slot && id === districtId; })) return { ok: false, reason: 'Bezirk bereits in einem anderen Slot aktiv' };
    var cost = districtCost(state, districtId);
    if (!SYS.canAfford(state, cost)) return { ok: false, reason: SYS.missingCost(state, cost).join(', '), cost: cost };
    return { ok: true, cost: cost };
  }
  function configureDistrict(state, slot, districtId) {
    var check = canConfigureDistrict(state, slot, districtId);
    if (!check.ok) return check;
    var spec = ensure(state), district = DISTRICT_BY[districtId];
    SYS.pay(state, check.cost);
    spec.districts[slot] = null;
    spec.rebuild = { slot: slot, districtId: districtId, readyTick: (state.tick || 0) + DISTRICT_REBUILD };
    spec.districtChanges++;
    I.log(state, district.icon + ' Umbau zu „' + district.name + '“ begonnen (' + DISTRICT_REBUILD + ' s).', '');
    return { ok: true, district: district, readyTick: spec.rebuild.readyTick, cost: check.cost };
  }
  function clearDistrict(state, slot) {
    var spec = ensure(state);
    slot = Math.floor(num(slot));
    if (spec.rebuild) return { ok: false, reason: 'Ein Bezirk wird bereits umgebaut' };
    if (slot < 0 || slot >= districtSlots(state) || !spec.districts[slot]) return { ok: false, reason: 'Kein aktiver Bezirk' };
    var old = DISTRICT_BY[spec.districts[slot]];
    spec.districts[slot] = null;
    I.log(state, (old ? old.icon : '🏗️') + ' Bezirksslot ' + (slot + 1) + ' geräumt.', '');
    return { ok: true, district: old };
  }
  function step(state) {
    var spec = ensure(state), completed = null;
    if (spec.rebuild && (state.tick || 0) >= spec.rebuild.readyTick) {
      var rebuild = spec.rebuild, district = DISTRICT_BY[rebuild.districtId];
      if (rebuild.slot < districtSlots(state)) spec.districts[rebuild.slot] = rebuild.districtId;
      spec.rebuild = null;
      completed = district;
      I.log(state, district.icon + ' ' + district.name + ' ist jetzt aktiv.', 'good');
    }
    return { districtCompleted: completed };
  }

  function school(state, creatureOrId) {
    var creature = typeof creatureOrId === 'object' ? creatureOrId : SYS.findCreature(state, creatureOrId);
    return creature ? (SCHOOL_BY[creature.schoolId] || null) : null;
  }
  function schoolCost(state, creature, schoolId) {
    var scale = 1 + Math.max(0, (creature && creature.level || 1) - 1) * 0.025;
    if (creature && creature.schoolId && creature.schoolId !== schoolId) scale *= 1.8;
    return { gold: round(120 * scale), wissen: round(55 * scale) };
  }
  function canAssignSchool(state, creatureUid, schoolId) {
    var creature = SYS.findCreature(state, creatureUid);
    if (!creature || !creature.named) return { ok: false, reason: 'Nur benannte Eliten besuchen eine Schule' };
    if (!SCHOOL_BY[schoolId]) return { ok: false, reason: 'Unbekannte Schule' };
    if (creature.schoolId === schoolId) return { ok: false, reason: 'Schule bereits abgeschlossen' };
    if (SYS.creatureBusy(state, creature.uid)) return { ok: false, reason: 'Elite ist gerade unterwegs' };
    var cost = schoolCost(state, creature, schoolId);
    if (!SYS.canAfford(state, cost)) return { ok: false, reason: SYS.missingCost(state, cost).join(', '), cost: cost };
    return { ok: true, creature: creature, cost: cost };
  }
  function assignSchool(state, creatureUid, schoolId) {
    var check = canAssignSchool(state, creatureUid, schoolId);
    if (!check.ok) return check;
    var spec = ensure(state), selected = SCHOOL_BY[schoolId];
    SYS.pay(state, check.cost);
    check.creature.schoolId = schoolId;
    spec.schoolsAssigned++;
    I.log(state, selected.icon + ' ' + check.creature.name + ' wird ' + selected.name + '.', 'gold');
    return { ok: true, creature: check.creature, school: selected, cost: check.cost };
  }
  function applyCreatureStats(state, creature, stats) {
    var selected = school(state, creature);
    if (!selected) return stats;
    for (var key in selected.statMod) stats[key] = round((stats[key] || 0) * selected.statMod[key]);
    return stats;
  }
  function leaderArmyBonus(creature) {
    var selected = creature && SCHOOL_BY[creature.schoolId];
    return selected ? selected.armyBonus : 0;
  }
  function tacticalAbilityFor(creature) {
    var selected = creature && SCHOOL_BY[creature.schoolId];
    return selected ? selected.tactical : null;
  }
  function actionAbilityFor(schoolId) {
    var selected = SCHOOL_BY[schoolId];
    return selected ? selected.action : null;
  }

  var DOCTRINE_DISTRICTS = {
    conquest: ['warcamp', 'bastion', 'runeforge'],
    research: ['archive', 'runeforge', 'bazaar'],
    trade: ['bazaar', 'runeforge', 'archive'],
    breeding: ['hatchery', 'archive', 'warcamp'],
    labyrinth: ['bastion', 'runeforge', 'warcamp']
  };
  var DOCTRINE_SCHOOLS = {
    conquest: 'commander', research: 'mage', trade: 'smith', breeding: 'hunter', labyrinth: 'defender'
  };
  function desiredDoctrine(state) {
    var spec = ensure(state);
    if (spec.autoDoctrine !== 'adaptive') {
      if (!root.GameChronicle || root.GameChronicle.isDoctrineAllowed(state, spec.autoDoctrine)) return { id: spec.autoDoctrine, reason: 'festes Watchmode-Profil' };
    }
    if (state.completion && state.completion.enabled) {
      if ((state.seenSpecies || []).length < GD().creatures.length) return { id: 'breeding', reason: 'Completion: fehlende Bestiarium-Formen' };
      if ((state.claimedRegions || []).length < GD().regions.length) return { id: 'conquest', reason: 'Completion: offene Hauptkampagne' };
      if ((state.research || []).length < GD().research.length) return { id: 'research', reason: 'Completion: offene Forschung' };
      return { id: 'trade', reason: 'Completion: Ressourcen für Restziele' };
    }
    var profileId = state.contracts && state.contracts.autoProfile;
    var desired = {
      id: { aggressive: 'conquest', collector: 'breeding', safe: 'labyrinth', progress: 'research' }[profileId] || 'trade',
      reason: 'abgeleitet aus Auto-Profil ' + (profileId || 'ausgeglichen')
    };
    if (root.GameChronicle && !root.GameChronicle.isDoctrineAllowed(state, desired.id)) desired.id = 'research';
    return desired;
  }
  function cheapestPreferredBuilding(state, selected) {
    var candidates = selected.preferredBuildings.filter(function (id) {
      return SYS.buildingUnlocked(state, id) && SYS.canBuild(state, id);
    });
    candidates.sort(function (a, b) {
      var ac = SYS.buildingCost(state, a), bc = SYS.buildingCost(state, b);
      return Object.keys(ac).reduce(function (sum, key) { return sum + ac[key]; }, 0) -
        Object.keys(bc).reduce(function (sum, key) { return sum + bc[key]; }, 0);
    });
    return candidates[0] || null;
  }
  function autoStep(state) {
    var spec = ensure(state);
    if (!(state.settings && state.settings.watch) && !(state.completion && state.completion.enabled)) return null;
    var desired = desiredDoctrine(state);
    if (desired.id && spec.doctrineId !== desired.id && (state.tick || 0) >= spec.doctrineLockedUntil) {
      var changed = setDoctrine(state, desired.id, desired.reason);
      if (changed.ok) return { text: changed.doctrine.icon + ' Doktrin „' + changed.doctrine.name + '“ gewählt: ' + desired.reason + '.' };
    }
    var selected = doctrine(state);
    if (!selected || spec.rebuild || (state.tick || 0) % AUTO_INTERVAL !== 0) return null;
    var unschooled = (state.creatures || []).filter(function (creature) {
      return creature.named && !creature.schoolId && !SYS.creatureBusy(state, creature.uid);
    })[0];
    if (unschooled) {
      var schoolId = DOCTRINE_SCHOOLS[selected.id], trained = assignSchool(state, unschooled.uid, schoolId);
      if (trained.ok) return { text: trained.school.icon + ' ' + unschooled.name + ' besucht die ' + trained.school.name + '-Schule.' };
    }
    var wanted = (DOCTRINE_DISTRICTS[selected.id] || []).filter(function (id) {
      return !root.GameChronicle || root.GameChronicle.isDistrictAllowed(state, id);
    }), slots = districtSlots(state);
    for (var slot = 0; slot < slots; slot++) {
      var districtId = wanted[slot];
      if (districtId && spec.districts[slot] !== districtId) {
        var configured = configureDistrict(state, slot, districtId);
        if (configured.ok) return { text: configured.district.icon + ' Umbau zu ' + configured.district.name + ' gestartet.' };
      }
    }
    if (state.completion && state.completion.enabled) return null;
    if (selected.id === 'research') {
      var research = GD().research.filter(function (node) { return SYS.canResearch(state, node.id).ok; })[0];
      if (research && SYS.doResearch(state, research.id).ok) return { text: '📚 Doktrin: ' + research.name + ' erforscht.' };
    }
    if (selected.id === 'breeding' && SYS.usedCapacity(state) < SYS.capacity(state)) {
      var summon = SYS.summonableSpecies(state).filter(function (creature) { return SYS.canSummon(state, creature.id).ok; })[0];
      if (summon && SYS.summon(state, summon.id).ok) return { text: '🧬 Doktrin: ' + summon.name + ' beschworen.' };
    }
    var buildingId = cheapestPreferredBuilding(state, selected);
    if (buildingId) {
      var built = SYS.build(state, buildingId);
      if (built.ok) return { text: selected.icon + ' Doktrin: ' + GD().building(buildingId).name + ' ausgebaut.' };
    }
    return null;
  }

  var originalTick = SYS.tick;
  SYS.tick = function (state) {
    var result = originalTick(state);
    result.specializations = step(state);
    return result;
  };
  var originalOffline = SYS.offlineProgress;
  SYS.offlineProgress = function (state, seconds) {
    var result = originalOffline(state, seconds);
    result.specializations = step(state);
    return result;
  };
  var originalAuto = SYS.autoPlayStep;
  SYS.autoPlayStep = function (state) {
    if (state.settings && state.settings.watchDetailed && root.GameContracts && root.GameContracts.hasActiveCrisis(state)) return originalAuto(state);
    var specializationAction = autoStep(state);
    if (state.completion && state.completion.enabled) return originalAuto(state) || specializationAction;
    return specializationAction || originalAuto(state);
  };

  var API = {
    DOCTRINE_LOCK: DOCTRINE_LOCK,
    DISTRICT_REBUILD: DISTRICT_REBUILD,
    AUTO_INTERVAL: AUTO_INTERVAL,
    DOCTRINES: DOCTRINES,
    DISTRICTS: DISTRICTS,
    SCHOOLS: SCHOOLS,
    ensure: ensure,
    doctrine: doctrine,
    effects: effects,
    buildingCostMultiplier: buildingCostMultiplier,
    rewardMultiplier: rewardMultiplier,
    doctrineChangeCost: doctrineChangeCost,
    canSetDoctrine: canSetDoctrine,
    setDoctrine: setDoctrine,
    setAutoDoctrine: setAutoDoctrine,
    districtSlots: districtSlots,
    activeDistricts: activeDistricts,
    districtCost: districtCost,
    canConfigureDistrict: canConfigureDistrict,
    configureDistrict: configureDistrict,
    clearDistrict: clearDistrict,
    step: step,
    school: school,
    schoolCost: schoolCost,
    canAssignSchool: canAssignSchool,
    assignSchool: assignSchool,
    applyCreatureStats: applyCreatureStats,
    leaderArmyBonus: leaderArmyBonus,
    tacticalAbilityFor: tacticalAbilityFor,
    actionAbilityFor: actionAbilityFor,
    desiredDoctrine: desiredDoctrine,
    autoStep: autoStep
  };
  root.GameSpecializations = API;
  Object.assign(SYS, {
    DOCTRINES: DOCTRINES,
    SPECIAL_DISTRICTS: DISTRICTS,
    LEADER_SCHOOLS: SCHOOLS,
    ensureSpecializations: ensure,
    activeDoctrine: doctrine,
    specializationEffects: effects,
    doctrineChangeCost: doctrineChangeCost,
    canSetDoctrine: canSetDoctrine,
    setDoctrine: setDoctrine,
    setDoctrineAutoProfile: setAutoDoctrine,
    districtSlots: districtSlots,
    activeSpecialDistricts: activeDistricts,
    districtRebuildCost: districtCost,
    canConfigureDistrict: canConfigureDistrict,
    configureDistrict: configureDistrict,
    clearSpecialDistrict: clearDistrict,
    leaderSchool: school,
    leaderSchoolCost: schoolCost,
    canAssignLeaderSchool: canAssignSchool,
    assignLeaderSchool: assignSchool
  });
})();
