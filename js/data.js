/* ============================================================
   data.js — Statische Spielinhalte (datengetrieben, DOM-frei).
   Definiert: Ränge, Ressourcen, Gebäude, Kreaturen + Evolutions-
   ketten, Skills, Magie/Forschung, Rezepte, Regionen, Herrscher-
   Stufen. Wird im Browser als window.GameData und unter Node als
   globalThis.GameData bereitgestellt (für headless Tests).
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;

  // ---------- Ränge & Grundwerte ----------
  var RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS'];
  var RANK_POWER = { E: 1, D: 1.7, C: 2.9, B: 5.0, A: 8.5, S: 14, SS: 24 };
  var RANK_LEVELCAP = { E: 20, D: 30, C: 40, B: 55, A: 70, S: 85, SS: 100 };
  var BASE = { lp: 24, ang: 7, ver: 5, mag: 5, tmp: 6 };

  function rankIndex(r) { return RANKS.indexOf(r); }

  function baseStatsFor(sp) {
    var rp = RANK_POWER[sp.rank] || 1;
    var m = sp.statMod || {};
    return {
      lp:  Math.round(BASE.lp  * rp * (m.lp  || 1)),
      ang: Math.round(BASE.ang * rp * (m.ang || 1)),
      ver: Math.round(BASE.ver * rp * (m.ver || 1)),
      mag: Math.round(BASE.mag * rp * (m.mag || 1)),
      tmp: Math.round(BASE.tmp * rp * (m.tmp || 1))
    };
  }

  // Kampfkraft aus Werten + Level (+ optionalem Multiplikator).
  function combatPower(stats, level, kampfMult) {
    var lv = level || 1;
    var lf = 1 + 0.06 * (lv - 1);
    var p = (stats.ang * 1.1) + (stats.ver * 0.8) + (stats.mag * 1.0) +
            (stats.tmp * 0.6) + (stats.lp * 0.12);
    return Math.round(p * lf * (kampfMult || 1));
  }

  // ---------- Ressourcen ----------
  var resources = root.GameDataTables.resources;

  // ---------- Gebäude ----------
  // producePer: Produktion pro Stufe/Tick. capacityPer: Kreaturen-Kapazität pro Stufe.
  // special: 'summon' | 'craft' | 'defense'. defensePer: Verteidigungswert pro Stufe.
  var buildings = root.GameDataTables.buildings;

  // ---------- Skills (Signaturfähigkeiten von Kreaturen) ----------
  var skills = {
    verschlinger:  { name: 'Verschlinger',     icon: '🌀', kampf: 0.10, desc: 'Analysiert und übernimmt – stärkt im Kampf.' },
    raubtier:      { name: 'Raubtierinstinkt', icon: '🐾', kampf: 0.12, desc: 'Geschärfte Sinne und Killerinstinkt.' },
    tyrann:        { name: 'Tyrann',           icon: '👑', kampf: 0.16, desc: 'Herrschaftsaura, die Verbündete antreibt.' },
    stahlhaut:     { name: 'Stahlhaut',        icon: '🛡️', kampf: 0.10, desc: 'Panzerung hart wie Magistahl.' },
    magieader:     { name: 'Magieader',        icon: '✨', kampf: 0.12, desc: 'Tiefe magische Reserven.' },
    untoter_wille: { name: 'Untoter Wille',    icon: '💀', kampf: 0.12, desc: 'Kennt weder Furcht noch Erschöpfung.' },
    drachenwut:    { name: 'Drachenwut',       icon: '🐉', kampf: 0.20, desc: 'Verheerende Urgewalt der Drachen.' },
    feenzauber:    { name: 'Feenzauber',       icon: '🧚', kampf: 0.14, desc: 'Uralte Geistermagie der Feenwesen.' },
    windschneide:  { name: 'Windschneide',     icon: '🌬️', kampf: 0.14, desc: 'Klingen aus verdichtetem Sturmwind.' },
    lebensbaum:    { name: 'Lebensbaum',       icon: '🌳', kampf: 0.10, desc: 'Regeneriert und nährt das Reich.' },
    wiedergeburt:  { name: 'Wiedergeburt',     icon: '🔥', kampf: 0.18, desc: 'Steigt stärker aus der eigenen Asche.' },
    // Wählbare Skills (in freie Skill-Slots lernbar)
    jaeger:        { name: 'Jäger',            icon: '🏹', kampf: 0.08, common: true, desc: 'Geübter Spurenleser und Schütze.' },
    berserker:     { name: 'Berserker',        icon: '🪓', kampf: 0.14, common: true, desc: 'Kämpft in blinder Raserei.' },
    eiserne_haut:  { name: 'Eiserne Haut',     icon: '🛡️', kampf: 0.09, common: true, desc: 'Abgehärtete, zähe Haut.' },
    kriegstanz:    { name: 'Kriegstanz',       icon: '⚔️', kampf: 0.11, common: true, desc: 'Tödliche Bewegungskunst.' },
    arkane_resonanz:{ name: 'Arkane Resonanz', icon: '🔯', kampf: 0.10, common: true, desc: 'Verstärkt eigene Magie.' },
    blutdurst:     { name: 'Blutdurst',        icon: '🩸', kampf: 0.12, common: true, desc: 'Wird im Kampf immer gieriger.' }
  };

  // Skill-Meisterschaft: Jede Fähigkeit kann bis Stufe 5 wachsen. Auf Stufe 3
  // entsteht bei ausgewählten Fähigkeiten eine stärkere Folgefähigkeit.
  var skillEvolution = {
    verschlinger: 'beelzebub', raubtier: 'koenigliche_jagd', tyrann: 'dominanz',
    stahlhaut: 'adamantkoerper', magieader: 'arkaner_nexus', untoter_wille: 'ewiger_wille',
    drachenwut: 'drachennova', feenzauber: 'geisterkoenigin', windschneide: 'sturmklinge',
    lebensbaum: 'weltenwurzel', wiedergeburt: 'ewige_flamme', jaeger: 'schattenjaeger',
    berserker: 'kriegsrausch', eiserne_haut: 'unbeugsam', kriegstanz: 'klingensymphonie',
    arkane_resonanz: 'manasturm', blutdurst: 'blutmond'
  };
  var evolvedSkills = {
    beelzebub:          { name: 'Beelzebub-Sog', icon: '🌌', kampf: 0.24, desc: 'Die vollendete Verschlingung raubt Kraft und Essenz.' },
    koenigliche_jagd:   { name: 'Königliche Jagd', icon: '🐺', kampf: 0.23, desc: 'Kein markiertes Ziel entkommt.' },
    dominanz:           { name: 'Absolute Dominanz', icon: '♛', kampf: 0.28, desc: 'Ein Befehl, dem selbst Legenden gehorchen.' },
    adamantkoerper:     { name: 'Adamantkörper', icon: '💠', kampf: 0.22, desc: 'Ein Leib jenseits von Stahl.' },
    arkaner_nexus:      { name: 'Arkaner Nexus', icon: '🪬', kampf: 0.24, desc: 'Magieströme kreisen ohne Verlust.' },
    ewiger_wille:       { name: 'Ewiger Wille', icon: '🕯️', kampf: 0.23, desc: 'Der Geist überdauert jede Zerstörung.' },
    drachennova:        { name: 'Drachennova', icon: '🌋', kampf: 0.34, desc: 'Uralte Drachenkraft bricht explosionsartig hervor.' },
    geisterkoenigin:    { name: 'Geisterkönigin', icon: '🧚', kampf: 0.25, desc: 'Die Geisterwelt selbst antwortet.' },
    sturmklinge:        { name: 'Sturmklinge', icon: '🌪️', kampf: 0.25, desc: 'Jeder Hieb trägt einen Orkan.' },
    weltenwurzel:       { name: 'Weltenwurzel', icon: '🌲', kampf: 0.22, desc: 'Lebenskraft aus den Wurzeln der Welt.' },
    ewige_flamme:       { name: 'Ewige Flamme', icon: '☀️', kampf: 0.30, desc: 'Eine Flamme, die weder erlischt noch vergisst.' },
    schattenjaeger:     { name: 'Schattenjäger', icon: '🎯', kampf: 0.18, desc: 'Schwachstellen werden erbarmungslos genutzt.' },
    kriegsrausch:       { name: 'Kriegsrausch', icon: '💢', kampf: 0.25, desc: 'Schmerz wird zu Angriffskraft.' },
    unbeugsam:          { name: 'Unbeugsam', icon: '🏰', kampf: 0.19, desc: 'Standhalten, wenn andere längst fallen.' },
    klingensymphonie:   { name: 'Klingensymphonie', icon: '🗡️', kampf: 0.22, desc: 'Eine lückenlose Folge tödlicher Hiebe.' },
    manasturm:          { name: 'Manasturm', icon: '🌀', kampf: 0.22, desc: 'Resonanz wird zur arkanen Kettenreaktion.' },
    blutmond:           { name: 'Blutmond', icon: '🌑', kampf: 0.23, desc: 'Jeder Treffer nährt den nächsten.' }
  };
  Object.keys(evolvedSkills).forEach(function (id) { evolvedSkills[id].followup = true; skills[id] = evolvedSkills[id]; });
  Object.keys(skills).forEach(function (id) {
    skills[id].maxLevel = 5;
    if (skillEvolution[id]) skills[id].next = skillEvolution[id];
  });

  // Aktionen des taktischen, rundenbasierten Kampfsystems.
  var battleAbilities = {
    angriff:      { name: 'Angriff', icon: '⚔️', element: 'physisch', power: 1.0, cost: 0, kind: 'damage', stat: 'ang', desc: 'Verlässlicher physischer Treffer.' },
    feuerlanze:   { name: 'Feuerlanze', icon: '🔥', element: 'feuer', power: 1.25, cost: 8, kind: 'damage', stat: 'mag', status: 'brand', chance: 0.35, desc: 'Kann das Ziel in Brand setzen.' },
    frostsplitter:{ name: 'Frostsplitter', icon: '❄️', element: 'wasser', power: 1.15, cost: 7, kind: 'damage', stat: 'mag', status: 'frost', chance: 0.35, desc: 'Frost senkt den Angriff.' },
    sturmstoss:   { name: 'Sturmstoß', icon: '⚡', element: 'wind', power: 1.1, cost: 7, kind: 'damage', stat: 'mag', status: 'schock', chance: 0.25, desc: 'Schock kann einen Zug verhindern.' },
    seelensog:    { name: 'Seelensog', icon: '🌑', element: 'dunkel', power: 1.2, cost: 9, kind: 'drain', stat: 'mag', desc: 'Heilt den Anwender um einen Teil des Schadens.' },
    lichtsegen:   { name: 'Lichtsegen', icon: '✨', element: 'licht', power: 1.15, cost: 10, kind: 'heal', stat: 'mag', desc: 'Heilt einen Verbündeten.' },
    analysieren:  { name: 'Analysieren', icon: '🔍', element: 'geist', power: 0, cost: 3, kind: 'analyze', desc: 'Deckt Schwächen und Resistenzen auf.' },
    verteidigen:  { name: 'Verteidigen', icon: '🛡️', element: 'physisch', power: 0, cost: 0, kind: 'guard', desc: 'Halbiert Schaden bis zum nächsten Zug.' }
  };

  // Aktive Magie ist bewusst von den dauerhaften Reichsritualen (`magic`)
  // getrennt. Kampfzauber schalten Rasterkampf-Aktionen frei;
  // Abenteuerzauber werden auf strategische Armeegruppen gewirkt.
  var fieldMagic = root.GameDataTables.fieldMagic;

  // ---------- Aspekte (Build-Prägung bei der Namensgebung) ----------
  // statMod multipliziert auf die Basiswerte; skill = gewährter Signatur-Skill.
  var aspects = root.GameDataTables.aspects;

  // ---------- Kreaturen (13 Linien) ----------
  // summon: Beschwörungskosten (nur Grundformen). evolvesTo: [{to, req}].
  // req-Felder: named (bool), level, seelen, material, herrscherStufe (Stufenindex), gebaeude.
  var creatures = root.GameDataTables.creatures;

  // ---------- Magie & Zauber (lernbar; Tiers 1–10 + Super-Tier) ----------
  // Jeder Zauber hat eine eigene Wirkung – statt monotoner %-Stapel gibt es
  // u. a. Tempo-, Heilungs-, Kapazitäts-, Beute- und Direkt-Produktions-Effekte.
  // effect-Schlüssel:
  //   produktionAll, produktionMagie, wissen   – Anteils-Boni auf Produktion
  //   armee, verteidigung                       – Anteils-Boni auf Kampf/Verteidigung
  //   seelen, xp, drop                          – Anteils-Boni auf Beute/Erfahrung
  //   summonRang (int), summonRabatt, kapazitaet(int) – Beschwörung
  //   bauRabatt, evoRabatt                      – Bau-/Evolutionskosten −Anteil
  //   expedTempo                                – Expeditionsdauer −Anteil
  //   heiltempo                                 – Heildauer Verwundeter −Anteil
  //   threatRuhe                                – Bedrohungsanstieg −Anteil
  //   beuteRang (int)                           – verschiebt Beute-Seltenheit nach oben
  //   produce { res: n }                        – +n Ressource pro Tick (direkt)
  // Kosten & Tier-Voraussetzung (req.magicTier) werden unten automatisch gesetzt.
  var magic = root.GameDataTables.magic;

  // ---------- Ausrüstung: Seltenheiten & Rezepte ----------
  var rarities = root.GameDataTables.rarities;

  // Seltene Komponenten ersetzen die endlose Zufallsbeute. Sie werden in
  // Kämpfen gefunden und erhöhen gezielt die Qualität bestehender Ausrüstung.
  var forgeMaterials = root.GameDataTables.forgeMaterials;

  // slot = Gegenstandsart (passt in gleichnamige Slot-Position bzw. denselben Typ).
  // set = Set-Zugehörigkeit. req.research = forschungsgebunden. unique/fixedRarity = Unikat.
  var recipes = root.GameDataTables.recipes;

  // Slot-Positionen (type = Gegenstandsart; base = von Anfang an offen, sonst per Forschung).
  var equipSlots = root.GameDataTables.equipSlots;

  // ---------- Regionen (Expeditionen / Territorium) ----------
  var regions = root.GameDataTables.regions;

  // Strategische Abenteuerkarte. x/y sind Prozentkoordinaten auf einer frei
  // gezeichneten Landschaft; links bilden ein echtes 2D-Wegenetz.
  var strategicNodes = root.GameDataTables.strategicNodes;

  // Eroberbare Ressourcenanlagen produzieren dauerhaft und sind bis Stufe 3
  // ausbaubar. Entdeckungen geben einmalige Beute.
  var strategicSites = root.GameDataTables.strategicSites;

  // ---------- Prozedurale Echo-Territorien ----------
  // Die konkrete Karte entsteht deterministisch in systems.js. Diese Pools
  // definieren Umgebung, angekündigte Belohnung und stapelbare Gefahren.
  var echoEnvironments = root.GameDataTables.echoEnvironments;
  var echoRewards = root.GameDataTables.echoRewards;
  var echoAffixes = root.GameDataTables.echoAffixes;

  // ---------- Rivalen-Dämonenlords (Bedrohungssystem) ----------
  // basePower wächst je abgewehrtem Angriff (growth^Fortschritt). reward = Abwehr-Beute.
  // defeatBonus = dauerhafter Reichsbonus nach endgültigem Sieg (Gegenangriff).
  var rivals = root.GameDataTables.rivals;

  // ---------- Zufalls-Events ----------
  // auto:true → Effekt sofort. Sonst choices[] (Spielerwahl im Modal).
  // effect: { res:{}, cost:{}, buff:{effect:{},dauer,label}, threat:Zahl, summon:'speciesId' }
  var events = root.GameDataTables.events;

  // ---------- Affinitäten (einmalige Ausrichtung am Meilenstein) ----------
  // On-Affinität: Zauber dieser Schule +25 % wirksam + dauerhafter Reichsbonus.
  var affinities = root.GameDataTables.affinities;

  // ---------- Herrscher-Evolutionsstufen ----------
  var rulerStages = root.GameDataTables.rulerStages;

  // ---------- Passiver Herrscher-Talentbaum ----------
  // Last-Epoch-artig: Knoten besitzen mehrere Ränge, Pfad-Voraussetzungen und
  // Schwellen an bereits investierten Punkten im jeweiligen Zweig. `effect`
  // gilt pro investiertem Rang und wird zentral über computeBonuses verrechnet.
  var talentBranches = root.GameDataTables.talentBranches;
  var talents = root.GameDataTables.talents;

  // ---------- Forschungsbaum ----------
  // unlocks: magicTier (max freigeschalteter Zauber-Tier), slots [Positions-IDs], effect {…Bonus}.
  var research = root.GameDataTables.research;

  // ---------- Item-Sets ----------
  var sets = root.GameDataTables.sets;

  // ---------- Hilfe / Erklärungen der Spielsysteme ----------
  // Wird über ℹ️-Knöpfe als Modal angezeigt. steps = kurze Stichpunkte.
  var help = root.GameDataTables.help;

  // ---------- Nachbearbeitung: Basiswerte & Lookups ----------
  var byId = {};
  creatures.forEach(function (sp) {
    sp.base = baseStatsFor(sp);
    var evolutionLevel = (sp.evolvesTo || []).reduce(function (max, evolution) {
      return Math.max(max, Number(evolution.req && evolution.req.level) || 0);
    }, 0);
    // Eine Evolutionsanforderung darf nie oberhalb des erreichbaren Levels
    // ihrer Ausgangsform liegen. Einzelne C-Rang-Linien benötigen bewusst
    // Level 46–50 und erweitern deshalb ihren normalen Rang-Cap.
    sp.levelCap = Math.max(RANK_LEVELCAP[sp.rank] || 40, evolutionLevel);
    sp.power = combatPower(sp.base, 1, 1);
    byId[sp.id] = sp;
  });
  // Magie: Kosten & Tier-Voraussetzung automatisch ableiten
  function costForTier(t) {
    var c = { wissen: Math.round(18 * Math.pow(1.9, t - 1)), magie: Math.round(30 * Math.pow(1.85, t - 1)) };
    if (t >= 5) c.seelen = Math.round(10 * Math.pow(1.6, t - 5));
    return c;
  }
  magic.forEach(function (m) {
    if (!m.cost) m.cost = costForTier(m.tier);
    if (!m.req) m.req = {};
    if (m.tier >= 2 && m.req.magicTier == null) m.req.magicTier = m.tier;
    if (m.tier >= 11 && m.req.herrscherStufe == null) m.req.herrscherStufe = 4;
  });
  var regionElements = ['erde', 'dunkel', 'wasser', 'geist', 'feuer', 'wind', 'dunkel', 'licht', 'geist'];
  regions.forEach(function (r, i) { if (!r.element) r.element = regionElements[i % regionElements.length]; });
  var buildingsById = {}; buildings.forEach(function (b) { buildingsById[b.id] = b; });
  var magicById = {};     magic.forEach(function (m) { magicById[m.id] = m; });
  var fieldMagicById = {}; fieldMagic.forEach(function (m) { fieldMagicById[m.id] = m; });
  var recipesById = {};   recipes.forEach(function (r) { recipesById[r.id] = r; });
  var regionsById = {};   regions.forEach(function (r) { regionsById[r.id] = r; });
  var rarityById = {};    rarities.forEach(function (r) { rarityById[r.id] = r; });
  var forgeMaterialsById = {}; forgeMaterials.forEach(function (m) { forgeMaterialsById[m.id] = m; });
  var researchById = {};  research.forEach(function (r) { researchById[r.id] = r; });
  var talentsById = {};   talents.forEach(function (t) { talentsById[t.id] = t; });
  var setsById = {};      sets.forEach(function (x) { setsById[x.id] = x; });
  var aspectsById = {};   aspects.forEach(function (a) { aspectsById[a.id] = a; });
  var rivalsById = {};    rivals.forEach(function (r) { rivalsById[r.id] = r; });
  var eventsById = {};    events.forEach(function (e) { eventsById[e.id] = e; });
  var affinitiesById = {}; affinities.forEach(function (a) { affinitiesById[a.id] = a; });
  var strategicSitesById = {}; strategicSites.forEach(function (s) { strategicSitesById[s.id] = s; });
  var echoEnvironmentsById = {}; echoEnvironments.forEach(function (x) { echoEnvironmentsById[x.id] = x; });
  var echoRewardsById = {}; echoRewards.forEach(function (x) { echoRewardsById[x.id] = x; });
  var echoAffixesById = {}; echoAffixes.forEach(function (x) { echoAffixesById[x.id] = x; });
  var slotResearch = {};  research.forEach(function (r) { if (r.unlocks && r.unlocks.slots) r.unlocks.slots.forEach(function (sl) { slotResearch[sl] = r.id; }); });

  root.GameData = {
    RANKS: RANKS, RANK_POWER: RANK_POWER, RANK_LEVELCAP: RANK_LEVELCAP, BASE: BASE,
    rankIndex: rankIndex, baseStatsFor: baseStatsFor, combatPower: combatPower,
    resources: resources, buildings: buildings, creatures: creatures, skills: skills, aspects: aspects,
    battleAbilities: battleAbilities, fieldMagic: fieldMagic,
    magic: magic, rarities: rarities, forgeMaterials: forgeMaterials, recipes: recipes, equipSlots: equipSlots,
    regions: regions, rulerStages: rulerStages, research: research, talentBranches: talentBranches, talents: talents, sets: sets, slotResearch: slotResearch, rivals: rivals,
    events: events, affinities: affinities, help: help,
    strategicNodes: strategicNodes, strategicSites: strategicSites,
    echoEnvironments: echoEnvironments, echoRewards: echoRewards, echoAffixes: echoAffixes,
    creature: function (id) { return byId[id]; },
    building: function (id) { return buildingsById[id]; },
    spell: function (id) { return magicById[id]; },
    fieldSpell: function (id) { return fieldMagicById[id]; },
    recipe: function (id) { return recipesById[id]; },
    region: function (id) { return regionsById[id]; },
    rarity: function (id) { return rarityById[id]; },
    forgeMaterial: function (id) { return forgeMaterialsById[id]; },
    skill: function (id) { return skills[id]; },
    battleAbility: function (id) { return battleAbilities[id]; },
    aspect: function (id) { return aspectsById[id]; },
    rival: function (id) { return rivalsById[id]; },
    event: function (id) { return eventsById[id]; },
    affinity: function (id) { return affinitiesById[id]; },
    strategicSite: function (id) { return strategicSitesById[id]; },
    echoEnvironment: function (id) { return echoEnvironmentsById[id]; },
    echoReward: function (id) { return echoRewardsById[id]; },
    echoAffix: function (id) { return echoAffixesById[id]; },
    researchNode: function (id) { return researchById[id]; },
    talent: function (id) { return talentsById[id]; },
    set: function (id) { return setsById[id]; }
  };
})();
