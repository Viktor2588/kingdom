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
  var resources = [
    { id: 'magie',    name: 'Magie',    icon: '🔮', cls: 'is-magie',    desc: 'Magicules – die Lebensenergie der Monster.' },
    { id: 'gold',     name: 'Gold',     icon: '🪙', cls: 'is-gold',     desc: 'Währung für Bau und Handel.' },
    { id: 'nahrung',  name: 'Nahrung',  icon: '🍖', cls: 'is-nahrung',  desc: 'Versorgt deine Kreaturen jede Runde.' },
    { id: 'material', name: 'Material', icon: '⛓️', cls: 'is-material', desc: 'Magistahl & Baustoffe für Bauten und Schmiede.' },
    { id: 'seelen',   name: 'Seelen',   icon: '👻', cls: 'is-seelen',   desc: 'Aus Kämpfen – treiben Evolution & Erwachen an.' },
    { id: 'wissen',   name: 'Wissen',   icon: '📚', cls: 'is-wissen',   desc: 'Forschung – schaltet Magie und Rezepte frei.' }
  ];

  // ---------- Gebäude ----------
  // producePer: Produktion pro Stufe/Tick. capacityPer: Kreaturen-Kapazität pro Stufe.
  // special: 'summon' | 'craft' | 'defense'. defensePer: Verteidigungswert pro Stufe.
  var buildings = [
    { id: 'magieturm', name: 'Magieturm', icon: '🔮', cat: 'Produktion',
      desc: 'Sammelt Magicules aus der Umgebung.',
      cost: { gold: 50, material: 20 }, growth: 1.6, producePer: { magie: 2 } },
    { id: 'mine', name: 'Magistahl-Mine', icon: '⛏️', cat: 'Produktion',
      desc: 'Fördert Material und Magistahl.',
      cost: { gold: 60, material: 10 }, growth: 1.6, producePer: { material: 1.5 } },
    { id: 'farm', name: 'Farm & Jagdgründe', icon: '🌾', cat: 'Produktion',
      desc: 'Erzeugt Nahrung für deine Kreaturen.',
      cost: { gold: 40, material: 15 }, growth: 1.55, producePer: { nahrung: 3 } },
    { id: 'markt', name: 'Großer Markt', icon: '🏪', cat: 'Produktion',
      desc: 'Handel bringt stetiges Gold.',
      cost: { gold: 80, material: 30 }, growth: 1.6, producePer: { gold: 2.5 } },
    { id: 'forschungsgilde', name: 'Forschungsgilde', icon: '📚', cat: 'Wissen',
      desc: 'Gelehrte erzeugen Wissen für die Forschung.',
      cost: { gold: 120, material: 60 }, growth: 1.7, producePer: { wissen: 1 } },
    { id: 'wohnbezirk', name: 'Wohnbezirk', icon: '🏘️', cat: 'Reich',
      desc: 'Erhöht die Kapazität für Kreaturen.',
      cost: { gold: 70, material: 40 }, growth: 1.55, capacityPer: 3 },
    { id: 'beschwoerungskreis', name: 'Beschwörungskreis', icon: '✨', cat: 'Reich',
      desc: 'Höhere Stufen rufen stärkere Kreaturen und senken die Kosten.',
      cost: { magie: 80, material: 40 }, growth: 1.8, special: 'summon' },
    { id: 'arkane_akademie', name: 'Arkane Akademie', icon: '🪄', cat: 'Magie',
      desc: 'Lehrt aktive Kampf- und Abenteuerzauber – getrennt von Reichsritualen.',
      cost: { gold: 140, material: 70, wissen: 50 }, growth: 1.75, special: 'fieldMagic' },
    { id: 'schmiede', name: 'Schmiede', icon: '⚒️', cat: 'Reich',
      desc: 'Erlaubt das Schmieden von Ausrüstung; höhere Stufen = bessere Qualität.',
      cost: { gold: 150, material: 80 }, growth: 1.75, special: 'craft' },
    { id: 'labyrinth', name: 'Labyrinth', icon: '🌀', cat: 'Verteidigung',
      desc: 'Verteidigt dein Reich und erntet passiv Seelen.',
      cost: { magie: 200, material: 120, gold: 200 }, growth: 1.9, special: 'defense',
      producePer: { seelen: 0.4 }, defensePer: 60 },
    { id: 'handelshafen', name: 'Handelshafen', icon: '⚓', cat: 'Produktion',
      desc: 'Fernhandel über die See bringt reichlich Gold.',
      cost: { gold: 200, material: 120 }, growth: 1.65, producePer: { gold: 5 } },
    { id: 'bibliothek', name: 'Große Bibliothek', icon: '📖', cat: 'Wissen',
      desc: 'Sammelt Wissen und steigert die Forschung (+5 % je Stufe).',
      cost: { gold: 140, material: 70 }, growth: 1.65, producePer: { wissen: 2 }, effect: { wissen: 0.05 } },
    { id: 'arena', name: 'Kampfarena', icon: '🏟️', cat: 'Reich',
      desc: 'Trainiert deine Streitmacht – +5 % Armee-Kampfkraft je Stufe.',
      cost: { gold: 180, material: 90 }, growth: 1.7, effect: { armee: 0.05 } },
    { id: 'seelentempel', name: 'Seelentempel', icon: '⛩️', cat: 'Reich',
      desc: 'Erntet passiv Seelen und steigert deren Ausbeute (+5 % je Stufe).',
      cost: { magie: 160, material: 80, gold: 120 }, growth: 1.8, producePer: { seelen: 0.5 }, effect: { seelen: 0.05 } }
  ];

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
  var fieldMagic = [
    { id: 'kampf_feuerlanze', name: 'Feuerlanze', icon: '🔥', school: 'Feuer', type: 'combat', academy: 1, ability: 'feuerlanze',
      cost: { wissen: 35, magie: 60 }, desc: 'Aktiver Fernzauber; kann Brand verursachen.' },
    { id: 'kampf_frostsplitter', name: 'Frostsplitter', icon: '❄️', school: 'Wasser', type: 'combat', academy: 1, ability: 'frostsplitter',
      cost: { wissen: 40, magie: 65 }, desc: 'Aktiver Fernzauber; Frost senkt gegnerischen Angriff.' },
    { id: 'kampf_sturmstoss', name: 'Sturmstoß', icon: '⚡', school: 'Wind', type: 'combat', academy: 2, ability: 'sturmstoss',
      cost: { wissen: 110, magie: 150 }, desc: 'Elektrischer Fernzauber mit Chance auf Schock.' },
    { id: 'kampf_lichtsegen', name: 'Lichtsegen', icon: '✨', school: 'Licht', type: 'combat', academy: 2, ability: 'lichtsegen',
      cost: { wissen: 140, magie: 180 }, desc: 'Heilt einen verbündeten Stapel auf dem Schlachtfeld.' },
    { id: 'kampf_seelensog', name: 'Seelensog', icon: '🌑', school: 'Dunkel', type: 'combat', academy: 3, ability: 'seelensog',
      cost: { wissen: 320, magie: 360, seelen: 35 }, desc: 'Entzieht Leben und heilt den Zaubernden.' },
    { id: 'abenteuer_windmarsch', name: 'Windmarsch', icon: '🌬️', school: 'Wind', type: 'adventure', academy: 1,
      cost: { wissen: 55, magie: 90 }, castCost: { magie: 75 }, cooldown: 30, effect: 'movement', desc: 'Stellt die Bewegungspunkte einer Armee vollständig wieder her.' },
    { id: 'abenteuer_feldbarriere', name: 'Feldbarriere', icon: '🛡️', school: 'Erde', type: 'adventure', academy: 2,
      cost: { wissen: 160, magie: 220 }, castCost: { magie: 140, seelen: 5 }, cooldown: 45, effect: 'ward', desc: 'Halbiert die Truppenverluste im nächsten Kartenkampf.' },
    { id: 'abenteuer_heimkehr', name: 'Tor nach Tempest', icon: '🌀', school: 'Raum/Zeit', type: 'adventure', academy: 3,
      cost: { wissen: 380, magie: 500, seelen: 25 }, castCost: { magie: 280 }, cooldown: 75, effect: 'return', desc: 'Versetzt eine Armee sofort zur Hauptstadt; ihre Bewegung endet.' }
  ];

  // ---------- Aspekte (Build-Prägung bei der Namensgebung) ----------
  // statMod multipliziert auf die Basiswerte; skill = gewährter Signatur-Skill.
  var aspects = [
    { id: 'wuterich', name: 'Wüterich', icon: '⚔️', schule: 'Offensiv', skill: 'raubtier',
      statMod: { ang: 1.15, tmp: 1.10 }, desc: 'Offensiv – mehr Angriff & Tempo.' },
    { id: 'bollwerk', name: 'Bollwerk', icon: '🛡️', schule: 'Defensiv', skill: 'stahlhaut',
      statMod: { ver: 1.20, lp: 1.15 }, desc: 'Defensiv – mehr Verteidigung & Leben.' },
    { id: 'arkanist', name: 'Arkanist', icon: '🔮', schule: 'Arkan', skill: 'magieader',
      statMod: { mag: 1.20, tmp: 1.05 }, desc: 'Arkan – deutlich mehr Magie.' }
  ];

  // ---------- Kreaturen (13 Linien) ----------
  // summon: Beschwörungskosten (nur Grundformen). evolvesTo: [{to, req}].
  // req-Felder: named (bool), level, seelen, material, herrscherStufe (Stufenindex), gebaeude.
  var creatures = [
    // Schleim-Linie
    { id: 'schleim', name: 'Schleim', icon: '🟦', rank: 'E', line: 'Schleim', role: 'Magie',
      summon: { magie: 30 }, statMod: { mag: 1.3, lp: 1.2, ang: 0.7 }, skill: 'verschlinger',
      desc: 'Formloser Anfang – mit großem Potenzial.',
      evolvesTo: [{ to: 'magieschleim', req: { named: true } }] },
    { id: 'magieschleim', name: 'Magie-Schleim', icon: '🔵', rank: 'D', line: 'Schleim', role: 'Magie',
      statMod: { mag: 1.5, lp: 1.2, ang: 0.7 },
      desc: 'Ein Schleim voller Magicules.',
      evolvesTo: [{ to: 'hochschleim', req: { level: 18, seelen: 30 } }] },
    { id: 'hochschleim', name: 'Hoch-Schleim', icon: '🟣', rank: 'C', line: 'Schleim', role: 'Magie',
      statMod: { mag: 1.6, lp: 1.3 },
      desc: 'Ein hochentwickelter, denkender Schleim.',
      evolvesTo: [{ to: 'tyrannenschleim', req: { level: 30, seelen: 120, herrscherStufe: 2 } }] },
    { id: 'tyrannenschleim', name: 'Tyrannen-Schleim', icon: '🌌', rank: 'B', line: 'Schleim', role: 'Magie',
      statMod: { mag: 1.7, lp: 1.4, ang: 1.1 }, skill: 'tyrann',
      desc: 'Ein Schleimfürst mit verheerender Magie.', evolvesTo: [] },

    // Goblin-Linie
    { id: 'goblin', name: 'Goblin', icon: '👺', rank: 'E', line: 'Goblin', role: 'Kampf',
      summon: { magie: 24 }, statMod: { ang: 1.0 },
      desc: 'Schwacher, aber zahlreicher Krieger.',
      evolvesTo: [{ to: 'hobgoblin', req: { named: true } }] },
    { id: 'hobgoblin', name: 'Hobgoblin', icon: '👹', rank: 'D', line: 'Goblin', role: 'Kampf',
      statMod: { ang: 1.1, ver: 1.1, lp: 1.1 }, skill: 'raubtier',
      desc: 'Ein benannter Goblin – größer und diszipliniert.',
      evolvesTo: [{ to: 'goblin_lord', req: { level: 20, seelen: 40 } },
                  { to: 'goblin_schamane', req: { level: 20, seelen: 40 } }] },
    { id: 'goblin_lord', name: 'Goblin-Lord', icon: '🛡️', rank: 'C', line: 'Goblin', role: 'Kampf',
      statMod: { ang: 1.2, ver: 1.2, lp: 1.2 },
      desc: 'Anführer einer Goblin-Streitmacht.',
      evolvesTo: [{ to: 'goblin_koenig', req: { level: 32, seelen: 140, herrscherStufe: 2 } }] },
    { id: 'goblin_koenig', name: 'Goblin-König', icon: '👑', rank: 'B', line: 'Goblin', role: 'Kampf',
      statMod: { ang: 1.3, ver: 1.3, lp: 1.3 }, skill: 'tyrann',
      desc: 'Herrscher über ein ganzes Goblin-Volk.', evolvesTo: [] },

    // Wolf-Linie
    { id: 'schreckenswolf', name: 'Schreckenswolf', icon: '🐺', rank: 'D', line: 'Wolf', role: 'Kampf',
      summon: { magie: 55 }, statMod: { tmp: 1.5, ang: 1.2, ver: 0.8, mag: 0.5 },
      desc: 'Schneller Rudeljäger.',
      evolvesTo: [{ to: 'sturmwolf', req: { named: true } },
                  { to: 'mondwolf', req: { named: true } }] },
    { id: 'sturmwolf', name: 'Sturmwolf', icon: '🌩️', rank: 'C', line: 'Wolf', role: 'Kampf',
      statMod: { tmp: 1.6, ang: 1.3, ver: 0.9, mag: 0.6 }, skill: 'raubtier',
      desc: 'Reitet auf dem Wind, schnell wie ein Blitz.',
      evolvesTo: [{ to: 'sternwolf', req: { level: 30, seelen: 120 } }] },
    { id: 'sternwolf', name: 'Sternwolf', icon: '✴️', rank: 'B', line: 'Wolf', role: 'Kampf',
      statMod: { tmp: 1.8, ang: 1.4, mag: 0.8 },
      desc: 'Ein legendärer Wolf mit Sternenglanz.', evolvesTo: [] },

    // Oger / Kijin-Linie
    { id: 'oger', name: 'Oger', icon: '👿', rank: 'C', line: 'Oger', role: 'Kampf',
      summon: { magie: 120, seelen: 10 }, statMod: { ang: 1.4, lp: 1.3, ver: 1.1, mag: 0.5 },
      desc: 'Roher, mächtiger Nahkämpfer.',
      evolvesTo: [{ to: 'kijin', req: { named: true } }] },
    { id: 'kijin', name: 'Kijin', icon: '🥷', rank: 'B', line: 'Oger', role: 'Kampf',
      statMod: { ang: 1.4, ver: 1.2, mag: 1.0, tmp: 1.1 }, skill: 'tyrann',
      desc: 'Ein erwachter Oger-Krieger mit Verstand und Magie.',
      evolvesTo: [{ to: 'oni', req: { level: 45, seelen: 260, herrscherStufe: 3 } }] },
    { id: 'oni', name: 'Oni', icon: '👹', rank: 'A', line: 'Oger', role: 'Kampf',
      statMod: { ang: 1.6, ver: 1.3, mag: 1.1, tmp: 1.2 },
      desc: 'Ein dämonischer Oni von erschütternder Stärke.', evolvesTo: [] },

    // Echsenmensch / Drachenmensch-Linie
    { id: 'echsenmensch', name: 'Echsenmensch', icon: '🦎', rank: 'D', line: 'Echse', role: 'Kampf',
      summon: { magie: 60 }, statMod: { ver: 1.3, lp: 1.2 },
      desc: 'Zäher Sumpfkrieger.',
      evolvesTo: [{ to: 'drachenmensch', req: { named: true } },
                  { to: 'sumpfschamane', req: { named: true } }] },
    { id: 'drachenmensch', name: 'Drachenmensch', icon: '🐲', rank: 'C', line: 'Echse', role: 'Kampf',
      statMod: { ver: 1.3, ang: 1.2, mag: 1.1, lp: 1.2 }, skill: 'stahlhaut',
      desc: 'Trägt das Blut der Drachen in sich.',
      evolvesTo: [{ to: 'drachenfuerst', req: { level: 34, seelen: 160 } }] },
    { id: 'drachenfuerst', name: 'Drachenfürst', icon: '🐉', rank: 'B', line: 'Echse', role: 'Kampf',
      statMod: { ver: 1.4, ang: 1.3, mag: 1.2, lp: 1.3 },
      desc: 'Ein Fürst der Drachenmenschen.', evolvesTo: [] },

    // Ork-Linie
    { id: 'ork', name: 'Ork', icon: '🐗', rank: 'D', line: 'Ork', role: 'Kampf',
      summon: { magie: 50 }, statMod: { lp: 1.4, ang: 1.1, mag: 0.6 },
      desc: 'Unermüdlicher, hungriger Krieger.',
      evolvesTo: [{ to: 'ork_lord', req: { level: 22, seelen: 50 } }] },
    { id: 'ork_lord', name: 'Ork-Lord', icon: '🪓', rank: 'C', line: 'Ork', role: 'Kampf',
      statMod: { lp: 1.5, ang: 1.3 }, skill: 'tyrann',
      desc: 'Führt eine gefräßige Horde an.',
      evolvesTo: [{ to: 'ork_katastrophe', req: { level: 48, seelen: 300, herrscherStufe: 3 } }] },
    { id: 'ork_katastrophe', name: 'Ork-Katastrophe', icon: '☄️', rank: 'A', line: 'Ork', role: 'Kampf',
      statMod: { lp: 1.7, ang: 1.5 },
      desc: 'Eine wandelnde Katastrophe, die alles verschlingt.', evolvesTo: [] },

    // Skelett / Lich-Linie (Untote)
    { id: 'skelett', name: 'Skelett', icon: '💀', rank: 'E', line: 'Untot', role: 'Magie',
      summon: { magie: 26 }, statMod: { ang: 0.9, mag: 0.9, lp: 0.8 },
      desc: 'Wiederbelebte Knochen.',
      evolvesTo: [{ to: 'knochenmagier', req: { named: true } }] },
    { id: 'knochenmagier', name: 'Knochenmagier', icon: '🧙', rank: 'D', line: 'Untot', role: 'Magie',
      statMod: { mag: 1.6, lp: 0.8 },
      desc: 'Ein Skelett, das die Totenmagie erlernt hat.',
      evolvesTo: [{ to: 'elder_lich', req: { level: 24, seelen: 60 } }] },
    { id: 'elder_lich', name: 'Elder Lich', icon: '☠️', rank: 'C', line: 'Untot', role: 'Magie',
      statMod: { mag: 1.9, lp: 0.9 }, skill: 'magieader',
      desc: 'Ein uralter, mächtiger Totenbeschwörer.',
      evolvesTo: [{ to: 'untotenfuerst', req: { level: 50, seelen: 340, herrscherStufe: 3 } }] },
    { id: 'untotenfuerst', name: 'Untoten-Fürst', icon: '👑', rank: 'A', line: 'Untot', role: 'Magie',
      statMod: { mag: 2.1, lp: 1.0, ang: 1.0 }, skill: 'untoter_wille',
      desc: 'Ein uralter Fürst der Untoten – Schrecken der Lebenden.', evolvesTo: [] },

    // Zombie / Todesritter-Linie
    { id: 'zombie', name: 'Zombie', icon: '🧟', rank: 'E', line: 'Untot', role: 'Kampf',
      summon: { magie: 22 }, statMod: { lp: 1.4, ang: 0.9, mag: 0.3, tmp: 0.4 },
      desc: 'Langsam, aber zäh und billig.',
      evolvesTo: [{ to: 'ghul', req: { named: true } }] },
    { id: 'ghul', name: 'Ghul', icon: '🧟‍♂️', rank: 'D', line: 'Untot', role: 'Kampf',
      statMod: { lp: 1.4, ang: 1.1, tmp: 0.6 },
      desc: 'Ein schnellerer, hungriger Untoter.',
      evolvesTo: [{ to: 'todesritter', req: { level: 26, seelen: 70 } }] },
    { id: 'todesritter', name: 'Todesritter', icon: '🗡️', rank: 'C', line: 'Untot', role: 'Kampf',
      statMod: { ang: 1.4, ver: 1.4, lp: 1.2 }, skill: 'untoter_wille',
      desc: 'Ein gefallener Ritter in untoter Rüstung.',
      evolvesTo: [{ to: 'todespaladin', req: { level: 38, seelen: 180 } },
                  { to: 'seelenwaechter', req: { level: 38, seelen: 180 } }] },
    { id: 'todespaladin', name: 'Todespaladin', icon: '⚜️', rank: 'B', line: 'Untot', role: 'Kampf',
      statMod: { ang: 1.5, ver: 1.5, lp: 1.3, mag: 1.1 },
      desc: 'Ein Champion der Untoten-Armee.', evolvesTo: [] },

    // Imp / Dämon-Linie
    { id: 'imp', name: 'Imp', icon: '😈', rank: 'D', line: 'Dämon', role: 'Magie',
      summon: { magie: 65, seelen: 5 }, statMod: { mag: 1.4, tmp: 1.2, lp: 0.8 },
      desc: 'Ein kleiner, tückischer Dämon.',
      evolvesTo: [{ to: 'daemon', req: { named: true, level: 20 } }] },
    { id: 'daemon', name: 'Dämon', icon: '👿', rank: 'B', line: 'Dämon', role: 'Magie',
      statMod: { mag: 1.4, ang: 1.2, tmp: 1.1 }, skill: 'magieader',
      desc: 'Ein vollwertiger Dämon mit gefährlicher Magie.',
      evolvesTo: [{ to: 'erzdaemon', req: { level: 52, seelen: 360 } }] },
    { id: 'erzdaemon', name: 'Erzdämon', icon: '🦇', rank: 'A', line: 'Dämon', role: 'Magie',
      statMod: { mag: 1.6, ang: 1.3, tmp: 1.2 },
      desc: 'Ein Hochadliger der Dämonenwelt.',
      evolvesTo: [{ to: 'daemonenfuerst', req: { level: 66, seelen: 900, herrscherStufe: 4 } }] },
    { id: 'daemonenfuerst', name: 'Dämonenfürst', icon: '🔱', rank: 'S', line: 'Dämon', role: 'Magie',
      statMod: { mag: 1.8, ang: 1.5, tmp: 1.3 }, skill: 'tyrann',
      desc: 'Einer der furchterregendsten Dämonen überhaupt.', evolvesTo: [] },

    // Vampir-Linie
    { id: 'vampir', name: 'Vampir', icon: '🧛', rank: 'C', line: 'Vampir', role: 'Kampf',
      summon: { magie: 140, seelen: 20 }, statMod: { mag: 1.3, ang: 1.2, tmp: 1.2 },
      desc: 'Eleganter Blutsauger mit dunkler Magie.',
      evolvesTo: [{ to: 'echter_vampir', req: { named: true } }] },
    { id: 'echter_vampir', name: 'Echter Vampir', icon: '🦇', rank: 'B', line: 'Vampir', role: 'Kampf',
      statMod: { mag: 1.4, ang: 1.3, tmp: 1.3 }, skill: 'magieader',
      desc: 'Ein wahrer Adliger der Nacht.',
      evolvesTo: [{ to: 'blutfuerstin', req: { level: 50, seelen: 340, herrscherStufe: 3 } }] },
    { id: 'blutfuerstin', name: 'Blutfürstin', icon: '🩸', rank: 'A', line: 'Vampir', role: 'Kampf',
      statMod: { mag: 1.6, ang: 1.4, tmp: 1.4 },
      desc: 'Eine uralte Vampirfürstin von tödlicher Schönheit.', evolvesTo: [] },

    // Golem-Linie
    { id: 'lehmgolem', name: 'Lehmgolem', icon: '🗿', rank: 'D', line: 'Golem', role: 'Verteidigung',
      summon: { magie: 48, material: 20 }, statMod: { lp: 1.6, ver: 1.6, ang: 1.0, mag: 0.2, tmp: 0.3 },
      desc: 'Eine wandelnde Festung aus Lehm.',
      evolvesTo: [{ to: 'eisengolem', req: { level: 18, material: 60 } }] },
    { id: 'eisengolem', name: 'Eisengolem', icon: '🛡️', rank: 'C', line: 'Golem', role: 'Verteidigung',
      statMod: { lp: 1.7, ver: 1.8, ang: 1.1, mag: 0.3, tmp: 0.3 }, skill: 'stahlhaut',
      desc: 'Ein Koloss aus gehärtetem Eisen.',
      evolvesTo: [{ to: 'magistahlgolem', req: { level: 34, material: 200, seelen: 80 } },
                  { to: 'runengolem', req: { level: 34, material: 200, seelen: 80 } }] },
    { id: 'magistahlgolem', name: 'Magistahl-Golem', icon: '🤖', rank: 'B', line: 'Golem', role: 'Verteidigung',
      statMod: { lp: 1.9, ver: 2.0, ang: 1.3, mag: 0.6 },
      desc: 'Ein unzerstörbarer Wächter aus Magistahl.', evolvesTo: [] },

    // Insekten-Linie
    { id: 'ruestungskaefer', name: 'Rüstungskäfer', icon: '🪲', rank: 'D', line: 'Insekt', role: 'Verteidigung',
      summon: { magie: 46 }, statMod: { ver: 1.5, lp: 1.2, mag: 0.4 },
      desc: 'Ein gepanzertes Rieseninsekt.',
      evolvesTo: [{ to: 'insektoid_krieger', req: { named: true } }] },
    { id: 'insektoid_krieger', name: 'Insektoid-Krieger', icon: '🦗', rank: 'C', line: 'Insekt', role: 'Kampf',
      statMod: { ver: 1.4, ang: 1.3, tmp: 1.1 }, skill: 'stahlhaut',
      desc: 'Ein diszipliniertes Insekten-Soldatenwesen.',
      evolvesTo: [{ to: 'insektenkoenigin', req: { level: 50, seelen: 340, herrscherStufe: 3 } }] },
    { id: 'insektenkoenigin', name: 'Insektenkönigin', icon: '👑', rank: 'A', line: 'Insekt', role: 'Kampf',
      statMod: { ver: 1.6, ang: 1.4, mag: 1.2, lp: 1.4 },
      desc: 'Mutter eines ganzen Schwarms.', evolvesTo: [] },

    // Drachen-Linie (Endgame)
    { id: 'drakeling', name: 'Drakeling', icon: '🐊', rank: 'B', line: 'Drache', role: 'Kampf',
      summon: { magie: 600, seelen: 60 }, statMod: { lp: 1.5, ang: 1.4, ver: 1.3, mag: 1.4, tmp: 1.2 },
      desc: 'Ein junger Drache mit gewaltigem Potenzial.',
      evolvesTo: [{ to: 'drache', req: { level: 45, seelen: 300 } }] },
    { id: 'drache', name: 'Drache', icon: '🐉', rank: 'A', line: 'Drache', role: 'Kampf',
      statMod: { lp: 1.6, ang: 1.5, ver: 1.4, mag: 1.5, tmp: 1.3 }, skill: 'drachenwut',
      desc: 'Ein ausgewachsener Drache – Naturgewalt.',
      evolvesTo: [{ to: 'sturmdrache', req: { level: 65, seelen: 800, herrscherStufe: 4 } }] },
    { id: 'sturmdrache', name: 'Sturmdrache', icon: '🌪️', rank: 'S', line: 'Drache', role: 'Kampf',
      statMod: { lp: 1.7, ang: 1.6, ver: 1.5, mag: 1.7, tmp: 1.5 },
      desc: 'Ein Sturmherr, der den Himmel beherrscht.',
      evolvesTo: [{ to: 'katastrophendrache', req: { level: 85, seelen: 2500, herrscherStufe: 5 } }] },
    { id: 'katastrophendrache', name: 'Katastrophendrache', icon: '🌋', rank: 'SS', line: 'Drache', role: 'Kampf',
      statMod: { lp: 1.9, ang: 1.8, ver: 1.6, mag: 1.9, tmp: 1.6 }, skill: 'drachenwut',
      desc: 'Ein wahrer Drache von Weltuntergangs-Klasse.', evolvesTo: [] },

    // Fee / Geist-Linie (Magie)
    { id: 'fee', name: 'Fee', icon: '🧚', rank: 'E', line: 'Geist', role: 'Magie',
      summon: { magie: 28 }, statMod: { mag: 1.4, tmp: 1.1, lp: 0.7, ang: 0.6 },
      desc: 'Ein flüchtiger Funke reiner Magicules.',
      evolvesTo: [{ to: 'elementargeist', req: { named: true } }] },
    { id: 'elementargeist', name: 'Elementargeist', icon: '🌟', rank: 'D', line: 'Geist', role: 'Magie',
      statMod: { mag: 1.5, tmp: 1.2, lp: 0.8 },
      desc: 'Ein Geist, der ein Element verkörpert.',
      evolvesTo: [{ to: 'hochgeist', req: { level: 30, seelen: 120 } }] },
    { id: 'hochgeist', name: 'Hochgeist', icon: '💫', rank: 'C', line: 'Geist', role: 'Magie',
      statMod: { mag: 1.7, tmp: 1.3, lp: 0.9 }, skill: 'magieader',
      desc: 'Ein mächtiger, uralter Naturgeist.',
      evolvesTo: [{ to: 'geisterkoenigin', req: { level: 46, seelen: 280, herrscherStufe: 3 } }] },
    { id: 'geisterkoenigin', name: 'Geisterkönigin', icon: '👑', rank: 'B', line: 'Geist', role: 'Magie',
      statMod: { mag: 1.9, tmp: 1.4, lp: 1.1 }, skill: 'feenzauber',
      desc: 'Titanin der Feenwelt, Gebieterin der Geister.', evolvesTo: [] },

    // Harpyie / Greif-Linie (Wind, Kampf)
    { id: 'harpyie', name: 'Harpyie', icon: '🪶', rank: 'D', line: 'Greif', role: 'Kampf',
      summon: { magie: 52 }, statMod: { tmp: 1.5, ang: 1.2, ver: 0.7, mag: 0.6 },
      desc: 'Geflügelte Jägerin der Lüfte.',
      evolvesTo: [{ to: 'sturmklaue', req: { named: true } }] },
    { id: 'sturmklaue', name: 'Sturmklaue', icon: '🌬️', rank: 'C', line: 'Greif', role: 'Kampf',
      statMod: { tmp: 1.6, ang: 1.3, ver: 0.8 }, skill: 'raubtier',
      desc: 'Reißt im Sturzflug aus dem Wind heraus an.',
      evolvesTo: [{ to: 'greif', req: { level: 34, seelen: 160 } }] },
    { id: 'greif', name: 'Greif', icon: '🦅', rank: 'B', line: 'Greif', role: 'Kampf',
      statMod: { tmp: 1.7, ang: 1.4, ver: 1.0, mag: 0.7 }, skill: 'windschneide',
      desc: 'Edles Mischwesen aus Adler und Löwe.',
      evolvesTo: [{ to: 'donnervogel', req: { level: 50, seelen: 340, herrscherStufe: 3 } }] },
    { id: 'donnervogel', name: 'Donnervogel', icon: '⚡', rank: 'A', line: 'Greif', role: 'Kampf',
      statMod: { tmp: 1.9, ang: 1.5, mag: 1.0, ver: 1.0 },
      desc: 'Ein Gewittersturm in Vogelgestalt.', evolvesTo: [] },

    // Baumhirte / Pflanzen-Linie (Erde, Verteidigung)
    { id: 'sproessling', name: 'Sprössling', icon: '🌱', rank: 'E', line: 'Baumhirte', role: 'Verteidigung',
      summon: { magie: 34, material: 10 }, statMod: { lp: 1.4, ver: 1.3, ang: 0.6, mag: 0.5 },
      desc: 'Ein erwachtes, junges Pflanzenwesen.',
      evolvesTo: [{ to: 'baumhirte', req: { named: true } }] },
    { id: 'baumhirte', name: 'Baumhirte', icon: '🌿', rank: 'D', line: 'Baumhirte', role: 'Verteidigung',
      statMod: { lp: 1.6, ver: 1.5, ang: 0.8, mag: 0.6 }, skill: 'lebensbaum',
      desc: 'Ein wandelnder Hüter des Waldes.',
      evolvesTo: [{ to: 'alter_ent', req: { level: 28, material: 120 } }] },
    { id: 'alter_ent', name: 'Alter Ent', icon: '🌳', rank: 'C', line: 'Baumhirte', role: 'Verteidigung',
      statMod: { lp: 1.9, ver: 1.7, mag: 0.8, ang: 1.0 }, skill: 'stahlhaut',
      desc: 'Ein uralter Baumriese voller Lebenskraft.',
      evolvesTo: [{ to: 'weltenesche', req: { level: 48, seelen: 300, herrscherStufe: 3 } }] },
    { id: 'weltenesche', name: 'Weltenesche', icon: '🪵', rank: 'B', line: 'Baumhirte', role: 'Verteidigung',
      statMod: { lp: 2.1, ver: 1.9, mag: 1.0, ang: 1.0 }, skill: 'lebensbaum',
      desc: 'Ein Weltenbaum, dessen Wurzeln das Reich tragen.', evolvesTo: [] },

    // Phönix-Linie (Feuer, Endgame)
    { id: 'glutvogel', name: 'Glutvogel', icon: '🐣', rank: 'B', line: 'Phönix', role: 'Kampf',
      summon: { magie: 550, seelen: 50 }, statMod: { mag: 1.5, tmp: 1.4, ang: 1.3, lp: 1.2 },
      desc: 'Ein junger Feuervogel voller Glut.',
      evolvesTo: [{ to: 'phoenix', req: { level: 45, seelen: 300 } }] },
    { id: 'phoenix', name: 'Phönix', icon: '🔥', rank: 'A', line: 'Phönix', role: 'Kampf',
      statMod: { mag: 1.6, tmp: 1.5, ang: 1.4, lp: 1.3 }, skill: 'wiedergeburt',
      desc: 'Ein Phönix, der aus seiner eigenen Asche aufersteht.',
      evolvesTo: [{ to: 'sonnenphoenix', req: { level: 65, seelen: 800, herrscherStufe: 4 } }] },
    { id: 'sonnenphoenix', name: 'Sonnenphönix', icon: '☀️', rank: 'S', line: 'Phönix', role: 'Kampf',
      statMod: { mag: 1.7, tmp: 1.6, ang: 1.4, lp: 1.4 }, skill: 'wiedergeburt',
      desc: 'Ein Phönix, dessen Glut der Sonne gleicht.',
      evolvesTo: [{ to: 'ewiger_phoenix', req: { level: 85, seelen: 2500, herrscherStufe: 5 } }] },
    { id: 'ewiger_phoenix', name: 'Ewiger Phönix', icon: '🌅', rank: 'SS', line: 'Phönix', role: 'Kampf',
      statMod: { mag: 2.0, tmp: 1.8, ang: 1.6, lp: 1.5 }, skill: 'wiedergeburt',
      desc: 'Ein unsterblicher Phönix von Katastrophen-Klasse.', evolvesTo: [] },

    // Weitere Völker des Jura-Waldes und der angrenzenden Reiche
    { id: 'kobold', name: 'Kobold', icon: '🐕', rank: 'E', line: 'Kobold', role: 'Kampf',
      summon: { magie: 28 }, statMod: { tmp: 1.25, ang: 0.9, lp: 0.9 },
      desc: 'Ein wachsamer hundeartiger Waldläufer.', evolvesTo: [{ to: 'kobold_jaeger', req: { named: true } }] },
    { id: 'kobold_jaeger', name: 'Kobold-Jäger', icon: '🏹', rank: 'D', line: 'Kobold', role: 'Kampf',
      statMod: { tmp: 1.45, ang: 1.15, ver: 0.85 }, skill: 'jaeger',
      desc: 'Ein schneller Späher, der jede Fährte liest.', evolvesTo: [{ to: 'kobold_hauptmann', req: { level: 28, seelen: 110 } }] },
    { id: 'kobold_hauptmann', name: 'Kobold-Hauptmann', icon: '🎖️', rank: 'C', line: 'Kobold', role: 'Kampf',
      statMod: { tmp: 1.4, ang: 1.3, ver: 1.1 }, skill: 'kriegstanz',
      desc: 'Ein disziplinierter Hauptmann der Waldwache.', evolvesTo: [] },

    { id: 'hasenmensch', name: 'Hasenmensch', icon: '🐇', rank: 'E', line: 'Hasenmensch', role: 'Kampf',
      summon: { magie: 32 }, statMod: { tmp: 1.5, ang: 0.85, lp: 0.85 },
      desc: 'Ein flinker Bewohner der östlichen Ebenen.', evolvesTo: [{ to: 'mondhase', req: { named: true } }] },
    { id: 'mondhase', name: 'Mondhase', icon: '🌙', rank: 'D', line: 'Hasenmensch', role: 'Magie',
      statMod: { tmp: 1.6, mag: 1.2, ver: 0.8 }, skill: 'jaeger',
      desc: 'Webt Mondlicht in rasche Illusionsschritte.', evolvesTo: [{ to: 'bestienritter', req: { level: 29, seelen: 120 } }] },
    { id: 'bestienritter', name: 'Bestienritter', icon: '🐰', rank: 'C', line: 'Hasenmensch', role: 'Kampf',
      statMod: { tmp: 1.65, ang: 1.25, ver: 1.0 }, skill: 'kriegstanz',
      desc: 'Eine blitzschnelle Elite der Bestienvölker.', evolvesTo: [] },

    { id: 'tengu', name: 'Tengu', icon: '👺', rank: 'C', line: 'Tengu', role: 'Magie',
      summon: { magie: 115, seelen: 8 }, statMod: { tmp: 1.45, mag: 1.25, ang: 1.0 },
      desc: 'Ein stolzer Berggeist, der auf Windströmen reist.', evolvesTo: [{ to: 'windtengu', req: { named: true } }] },
    { id: 'windtengu', name: 'Wind-Tengu', icon: '🪭', rank: 'B', line: 'Tengu', role: 'Magie',
      statMod: { tmp: 1.65, mag: 1.45, ang: 1.1 }, skill: 'windschneide',
      desc: 'Seine Fächerhiebe schneiden selbst durch Stahl.', evolvesTo: [{ to: 'tengu_aeltester', req: { level: 50, seelen: 330, herrscherStufe: 3 } }] },
    { id: 'tengu_aeltester', name: 'Tengu-Ältester', icon: '🌪️', rank: 'A', line: 'Tengu', role: 'Magie',
      statMod: { tmp: 1.7, mag: 1.6, ang: 1.15 }, skill: 'magieader',
      desc: 'Ein uralter Meister der Himmels- und Windmagie.', evolvesTo: [] },

    { id: 'meerling', name: 'Meerling', icon: '🧜', rank: 'D', line: 'Meervolk', role: 'Verteidigung',
      summon: { magie: 64 }, statMod: { lp: 1.2, ver: 1.25, mag: 1.0 },
      desc: 'Ein amphibischer Wächter aus den Küstenreichen.', evolvesTo: [{ to: 'meerkrieger', req: { named: true } }] },
    { id: 'meerkrieger', name: 'Meervolk-Krieger', icon: '🔱', rank: 'C', line: 'Meervolk', role: 'Verteidigung',
      statMod: { lp: 1.35, ver: 1.4, mag: 1.1 }, skill: 'stahlhaut',
      desc: 'Beherrscht Schildwall und Gezeitenmagie.', evolvesTo: [{ to: 'meerfuerst', req: { level: 38, seelen: 190 } }] },
    { id: 'meerfuerst', name: 'Fürst der Gezeiten', icon: '🌊', rank: 'B', line: 'Meervolk', role: 'Magie',
      statMod: { lp: 1.4, ver: 1.35, mag: 1.6 }, skill: 'arkane_resonanz',
      desc: 'Ein Befehlshaber, dem die Gezeiten gehorchen.', evolvesTo: [] },

    // --- Verzweigungsformen (alternative Evolutionspfade) ---
    { id: 'goblin_schamane', name: 'Goblin-Schamane', icon: '🔮', rank: 'C', line: 'Goblin', role: 'Magie',
      statMod: { mag: 1.6, lp: 1.1, ang: 0.8 }, skill: 'magieader',
      desc: 'Ein Goblin, der die Geistermagie meistert.',
      evolvesTo: [{ to: 'goblin_koenig', req: { level: 32, seelen: 140, herrscherStufe: 2 } }] },
    { id: 'mondwolf', name: 'Mondwolf', icon: '🌙', rank: 'C', line: 'Wolf', role: 'Magie',
      statMod: { mag: 1.4, tmp: 1.3, ver: 0.8, ang: 0.9 }, skill: 'magieader',
      desc: 'Ein Wolf, der das Mondlicht zu Magie webt.',
      evolvesTo: [{ to: 'sternwolf', req: { level: 30, seelen: 120 } }] },
    { id: 'sumpfschamane', name: 'Sumpfschamane', icon: '🐍', rank: 'C', line: 'Echse', role: 'Magie',
      statMod: { mag: 1.5, ver: 1.1, lp: 1.1 }, skill: 'magieader',
      desc: 'Ein Echsenmensch, der die Sumpfgeister beschwört.',
      evolvesTo: [{ to: 'drachenfuerst', req: { level: 34, seelen: 160 } }] },
    { id: 'seelenwaechter', name: 'Seelenwächter', icon: '🕯️', rank: 'B', line: 'Untot', role: 'Verteidigung',
      statMod: { ver: 1.5, mag: 1.3, lp: 1.3, ang: 1.0 }, skill: 'untoter_wille',
      desc: 'Ein untoter Hüter, der Seelen und Festung bewahrt.', evolvesTo: [] },
    { id: 'runengolem', name: 'Runengolem', icon: '🪬', rank: 'B', line: 'Golem', role: 'Magie',
      statMod: { mag: 1.6, ver: 1.5, lp: 1.5, ang: 1.0 }, skill: 'magieader',
      desc: 'Ein Golem, in dessen Runen arkane Macht pulsiert.', evolvesTo: [] }
  ];

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
  var magic = [
    // Tier 1 (ohne Forschung verfügbar) – einfache Einstiegszauber
    { id: 'magiestrom',  name: 'Magiestrom',  icon: '🌊', tier: 1, schule: 'Wasser', desc: '+15 % Magieproduktion – ein steter Magicule-Strom.', effect: { produktionMagie: 0.15 } },
    { id: 'feuerlanze',  name: 'Feuerlanze',  icon: '🔥', tier: 1, schule: 'Feuer',  desc: 'Brennende Lanzen: +12 % Armee-Kampfkraft.', effect: { armee: 0.12 } },
    { id: 'wasserwall',  name: 'Wasserwall',  icon: '💧', tier: 1, schule: 'Wasser', desc: 'Eine Wand aus Wasser: +12 % Verteidigung.', effect: { verteidigung: 0.12 } },
    // Tier 2 – erste Spezial-Effekte
    { id: 'windschritt', name: 'Windschritt', icon: '🌬️', tier: 2, schule: 'Wind',  desc: 'Deine Truppen ziehen schneller: −15 % Expeditionsdauer.', effect: { expedTempo: 0.15 } },
    { id: 'erdbarriere', name: 'Erdwall-Barriere', icon: '🪨', tier: 2, schule: 'Erde', desc: 'Steinwälle: +20 % Verteidigung.', effect: { verteidigung: 0.20 } },
    { id: 'flammensturm', name: 'Flammensturm', icon: '🔥', tier: 2, schule: 'Feuer', desc: 'Ein Feuersturm fegt voran: +18 % Armee-Kampfkraft.', effect: { armee: 0.18 } },
    // Tier 3
    { id: 'todesstrahl', name: 'Todesstrahl', icon: '☠️', tier: 3, schule: 'Tod',    desc: 'Versengt Feinde: +22 % Armee und +10 % Seelen.', effect: { armee: 0.22, seelen: 0.10 } },
    { id: 'zeitbeschleunigung', name: 'Zeitbeschleunigung', icon: '⏳', tier: 3, schule: 'Raum/Zeit', desc: 'Die Zeit fließt schneller: +15 % auf alle Produktion.', effect: { produktionAll: 0.15 } },
    { id: 'ruf_der_ahnen', name: 'Ruf der Ahnen', icon: '📜', tier: 3, schule: 'Geist', desc: 'Ruft Mächtigeres herbei: Beschwörung +1 Rang.', effect: { summonRang: 1 } },
    // Tier 4
    { id: 'heillicht',   name: 'Heilendes Licht', icon: '🕊️', tier: 4, schule: 'Licht', desc: 'Verwundete genesen doppelt so schnell.', effect: { heiltempo: 0.5 } },
    { id: 'arkane_effizienz', name: 'Arkane Effizienz', icon: '✨', tier: 4, schule: 'Geist', desc: 'Beschwörung −20 % und Evolution −20 % günstiger.', effect: { summonRabatt: 0.20, evoRabatt: 0.20 } },
    { id: 'eiszone',     name: 'Eisige Zone',  icon: '❄️', tier: 4, schule: 'Wasser', desc: '+22 % Verteidigung; Rivalen rüsten 30 % langsamer.', effect: { verteidigung: 0.22, threatRuhe: 0.30 } },
    // Tier 5
    { id: 'meteor',      name: 'Meteor',       icon: '☄️', tier: 5, schule: 'Feuer', desc: 'Ein Einschlag aus dem Himmel: +30 % Armee-Kampfkraft.', effect: { armee: 0.30 } },
    { id: 'transmutation', name: 'Transmutation', icon: '⚗️', tier: 5, schule: 'Erde', desc: 'Wandelt Magie in Materie: +6 Material/Sek.', effect: { produce: { material: 6 } } },
    { id: 'erfahrungsquell', name: 'Erfahrungsquell', icon: '🌟', tier: 5, schule: 'Geist', desc: 'Lehrreiche Feldzüge: +30 % Erfahrung aus Expeditionen.', effect: { xp: 0.30 } },
    // Tier 6
    { id: 'gravitation', name: 'Gravitation',  icon: '🌀', tier: 6, schule: 'Raum/Zeit', desc: 'Zermalmende Schwerkraft: +35 % Armee-Kampfkraft.', effect: { armee: 0.35 } },
    { id: 'baumeister',  name: 'Baumeister-Ritual', icon: '🏗️', tier: 6, schule: 'Erde', desc: 'Geister errichten Bauten: −20 % Baukosten.', effect: { bauRabatt: 0.20 } },
    { id: 'glueckszauber', name: 'Glückszauber', icon: '🍀', tier: 6, schule: 'Geist', desc: '+40 % Beute-Chance und bessere Beute-Qualität.', effect: { drop: 0.40, beuteRang: 1 } },
    // Tier 7
    { id: 'daemonenpakt', name: 'Dämonenpakt', icon: '😈', tier: 7, schule: 'Tod', desc: 'Ein finsterer Pakt: +45 % Armee-Kampfkraft.', effect: { armee: 0.45 } },
    { id: 'magiefluss',  name: 'Magiefluss',   icon: '🌊', tier: 7, schule: 'Wasser', desc: 'Ein reißender Strom roher Magie: +14 Magie/Sek.', effect: { produce: { magie: 14 } } },
    { id: 'seelenbrunnen', name: 'Seelenbrunnen', icon: '🕳️', tier: 7, schule: 'Tod', desc: 'Ein Brunnen quillt stetig Seelen: +1,5 Seelen/Sek.', effect: { produce: { seelen: 1.5 } } },
    // Tier 8
    { id: 'weltenbrand', name: 'Weltenbrand',  icon: '🔥', tier: 8, schule: 'Feuer', desc: 'Die Welt steht in Flammen: +55 % Armee-Kampfkraft.', effect: { armee: 0.55 } },
    { id: 'wohlstand',   name: 'Wohlstand',    icon: '💰', tier: 8, schule: 'Erde', desc: 'Blühender Handel: +22 Gold/Sek.', effect: { produce: { gold: 22 } } },
    { id: 'hoeherer_ruf', name: 'Höherer Ruf', icon: '📯', tier: 8, schule: 'Geist', desc: 'Beschwörung +1 Rang und +4 Kreaturen-Kapazität.', effect: { summonRang: 1, kapazitaet: 4 } },
    // Tier 9
    { id: 'urgewalt',    name: 'Urgewalt',     icon: '⚡', tier: 9, schule: 'Wind', desc: 'Entfesselter Sturm: +55 % Armee und −20 % Expeditionsdauer.', effect: { armee: 0.55, expedTempo: 0.20 } },
    { id: 'erleuchtung', name: 'Erleuchtung',  icon: '🔆', tier: 9, schule: 'Licht', desc: 'Allwissen erwacht: +100 % Wissensproduktion.', effect: { wissen: 1.0 } },
    { id: 'zeitriss',    name: 'Zeitriss',     icon: '⏳', tier: 9, schule: 'Raum/Zeit', desc: 'Ein Riss in der Zeit: +35 % Produktion und −20 % Expeditionsdauer.', effect: { produktionAll: 0.35, expedTempo: 0.20 } },
    // Tier 10
    { id: 'vernichtung', name: 'Vernichtung',  icon: '💥', tier: 10, schule: 'Tod', desc: 'Reine Auslöschung: +90 % Armee-Kampfkraft.', effect: { armee: 0.90 } },
    { id: 'goettliche_gunst', name: 'Göttliche Gunst', icon: '😇', tier: 10, schule: 'Licht', desc: 'Segen von oben: +50 % auf alle Produktion.', effect: { produktionAll: 0.50 } },
    { id: 'seelensturm', name: 'Seelensturm',  icon: '🌪️', tier: 10, schule: 'Tod', desc: 'Ein Sturm aus Seelen: +100 % Seelen und bessere Beute.', effect: { seelen: 1.0, beuteRang: 1 } },
    // Super-Tier
    { id: 'zeitstopp',   name: 'Zeitstopp',    icon: '⌛', tier: 11, schule: 'Super', desc: 'Die Zeit steht still: +100 % Produktion und −40 % Expeditionsdauer.', effect: { produktionAll: 1.0, expedTempo: 0.40 } },
    { id: 'urknall',     name: 'Urknall',      icon: '🌌', tier: 11, schule: 'Super', desc: 'Schöpfung und Zerstörung: +150 % Armee-Kampfkraft.', effect: { armee: 1.5 } },
    { id: 'weltbaum',    name: 'Weltenbaum',   icon: '🌳', tier: 11, schule: 'Super', desc: '+60 % Produktion, +60 % Magie und +12 Kapazität.', effect: { produktionAll: 0.60, produktionMagie: 0.60, kapazitaet: 12 } },
    { id: 'seelenapokalypse', name: 'Seelen-Apokalypse', icon: '☠️', tier: 11, schule: 'Super', desc: 'Das Ende aller Dinge: +200 % Seelen und +100 % Erfahrung.', effect: { seelen: 2.0, xp: 1.0 } }
  ];

  // ---------- Ausrüstung: Seltenheiten & Rezepte ----------
  var rarities = [
    { id: 'gewoehnlich', name: 'Gewöhnlich', cls: 'rar-gewoehnlich', mult: 1.0,  weight: 60 },
    { id: 'selten',      name: 'Selten',     cls: 'rar-selten',      mult: 1.3,  weight: 26 },
    { id: 'episch',      name: 'Episch',     cls: 'rar-episch',      mult: 1.7,  weight: 10 },
    { id: 'legendaer',   name: 'Legendär',   cls: 'rar-legendaer',   mult: 2.3,  weight: 3.5 },
    { id: 'goettlich',   name: 'Göttlich',   cls: 'rar-goettlich',   mult: 3.2,  weight: 0.5 }
  ];

  // slot = Gegenstandsart (passt in gleichnamige Slot-Position bzw. denselben Typ).
  // set = Set-Zugehörigkeit. req.research = forschungsgebunden. unique/fixedRarity = Unikat.
  var recipes = [
    // Magistahl-Garnitur (früh)
    { id: 'magistahlklinge', name: 'Magistahl-Klinge', icon: '🗡️', slot: 'waffe', schmiede: 1, set: 'set_magistahl',
      cost: { material: 40, magie: 20 }, stats: { ang: 12 }, desc: 'Solide Klinge aus Magistahl.' },
    { id: 'magistahlpanzer', name: 'Magistahl-Panzer', icon: '🛡️', slot: 'ruestung', schmiede: 1, set: 'set_magistahl',
      cost: { material: 50, magie: 15 }, stats: { ver: 12, lp: 30 }, desc: 'Zuverlässige Rüstung.' },
    { id: 'magistahlhelm', name: 'Magistahl-Helm', icon: '⛑️', slot: 'kopf', schmiede: 1, set: 'set_magistahl', req: { research: 'r_ruestkammer' },
      cost: { material: 35, magie: 15 }, stats: { ver: 8, lp: 20 }, desc: 'Schützt Kopf und Verstand.' },
    { id: 'magistahlhandschuhe', name: 'Magistahl-Handschuhe', icon: '🧤', slot: 'haende', schmiede: 1, set: 'set_magistahl', req: { research: 'r_handwerk' },
      cost: { material: 30, magie: 10 }, stats: { ang: 6, ver: 4 }, desc: 'Fester Griff, harter Schlag.' },
    { id: 'magistahlstiefel', name: 'Magistahl-Stiefel', icon: '🥾', slot: 'fuesse', schmiede: 1, set: 'set_magistahl', req: { research: 'r_handwerk' },
      cost: { material: 30, magie: 10 }, stats: { ver: 6, tmp: 6 }, desc: 'Standfest und flink.' },
    // Accessoires & Kern
    { id: 'magieamulett', name: 'Magie-Amulett', icon: '📿', slot: 'accessoire', schmiede: 1,
      cost: { material: 20, magie: 40 }, stats: { mag: 14 }, desc: 'Verstärkt magische Kräfte.' },
    { id: 'magiering', name: 'Magie-Ring', icon: '💍', slot: 'accessoire', schmiede: 2, req: { research: 'r_juwelier' },
      cost: { material: 40, magie: 60 }, stats: { mag: 18, tmp: 6 }, desc: 'Fein gearbeiteter Ring.' },
    { id: 'geisterkern', name: 'Geisterkern', icon: '🔆', slot: 'kern', schmiede: 2, req: { research: 'r_seelenschmiede' },
      cost: { material: 60, magie: 80, seelen: 20 }, stats: { mag: 20, lp: 30 }, desc: 'Ein gebundener Elementargeist.' },
    { id: 'bestienklaue', name: 'Bestienklaue', icon: '🐾', slot: 'waffe', schmiede: 2,
      cost: { material: 80, magie: 50, seelen: 10 }, stats: { ang: 24, tmp: 8 }, desc: 'Aus den Klauen erlegter Bestien.' },
    // Drachenhort (spät)
    { id: 'seelenfresserklinge', name: 'Seelenfresser-Klinge', icon: '⚔️', slot: 'waffe', schmiede: 3, set: 'set_drache',
      cost: { material: 140, magie: 160, seelen: 60 }, stats: { ang: 48, mag: 20 }, desc: 'Eine Klinge, die nach Seelen dürstet.' },
    { id: 'drachenschuppenpanzer', name: 'Drachenschuppen-Panzer', icon: '🐲', slot: 'ruestung', schmiede: 3, set: 'set_drache',
      cost: { material: 160, magie: 120, seelen: 30 }, stats: { ver: 30, lp: 80 }, desc: 'Nahezu undurchdringlich.' },
    { id: 'drachenhelm', name: 'Drachenhelm', icon: '🐉', slot: 'kopf', schmiede: 3, set: 'set_drache', req: { research: 'r_handwerk' },
      cost: { material: 120, magie: 90, seelen: 20 }, stats: { ver: 18, lp: 40, mag: 10 }, desc: 'Krone aus Drachenschuppen.' },
    // Unikate (forschungsgebunden, feste Seltenheit)
    { id: 'klinge_des_untergangs', name: 'Klinge des Untergangs', icon: '🗡️', slot: 'waffe', schmiede: 3, unique: true, fixedRarity: 'legendaer', req: { research: 'r_meisterschmied' },
      cost: { material: 300, magie: 300, seelen: 120 }, stats: { ang: 80, mag: 40 }, desc: 'Eine Waffe von düsterer Berühmtheit.' },
    { id: 'krone_des_daemonenlords', name: 'Krone des Dämonenlords', icon: '👑', slot: 'kopf', schmiede: 3, unique: true, fixedRarity: 'goettlich', req: { research: 'r_artefakte' },
      cost: { material: 500, magie: 600, seelen: 300 }, stats: { mag: 60, lp: 120, ver: 40 }, desc: 'Insignie wahrer Herrschaft.' },
    { id: 'stab_der_weisheit', name: 'Stab der Weisheit', icon: '🪄', slot: 'waffe', schmiede: 3, unique: true, fixedRarity: 'goettlich', req: { research: 'r_artefakte' },
      cost: { material: 400, magie: 800, seelen: 250 }, stats: { mag: 120 }, desc: 'Konzentrierte arkane Allmacht.' },
    // Windklinge (schnelle Waffe, kein Set)
    { id: 'windklinge', name: 'Windklinge', icon: '🌪️', slot: 'waffe', schmiede: 2,
      cost: { material: 70, magie: 40 }, stats: { ang: 20, tmp: 12 }, desc: 'Leicht wie der Wind, schnell wie ein Hieb.' },
    // Geistergewand-Set (Magie)
    { id: 'feenstab', name: 'Feenstab', icon: '🪄', slot: 'waffe', schmiede: 2, set: 'set_geist',
      cost: { material: 50, magie: 80 }, stats: { mag: 22 }, desc: 'Ein Stab, durchwoben von Geistermagie.' },
    { id: 'geistermantel', name: 'Geistermantel', icon: '👘', slot: 'ruestung', schmiede: 2, set: 'set_geist',
      cost: { material: 60, magie: 70 }, stats: { ver: 14, mag: 14 }, desc: 'Stoff aus gebundenem Geisterlicht.' },
    { id: 'geisterschleier', name: 'Geisterschleier', icon: '🌫️', slot: 'accessoire', schmiede: 2, set: 'set_geist',
      cost: { material: 30, magie: 90 }, stats: { mag: 16, tmp: 10 }, desc: 'Verhüllt den Träger in Geisternebel.' },
    // Glutregalia-Set (Phönix, spät)
    { id: 'glutfeder_klinge', name: 'Glutfeder-Klinge', icon: '🗡️', slot: 'waffe', schmiede: 3, set: 'set_phoenix',
      cost: { material: 150, magie: 170, seelen: 60 }, stats: { ang: 46, mag: 28 }, desc: 'Geschmiedet aus glühenden Phönixfedern.' },
    { id: 'phoenixmantel', name: 'Phönixmantel', icon: '🧥', slot: 'ruestung', schmiede: 3, set: 'set_phoenix',
      cost: { material: 170, magie: 140, seelen: 40 }, stats: { ver: 28, lp: 90, mag: 20 }, desc: 'Lodert sanft und heilt seinen Träger.' },
    { id: 'glutkrone', name: 'Glutkrone', icon: '👑', slot: 'kopf', schmiede: 3, set: 'set_phoenix', req: { research: 'r_handwerk' },
      cost: { material: 130, magie: 110, seelen: 30 }, stats: { mag: 30, lp: 50 }, desc: 'Eine Krone aus ewiger Flamme.' },
    // Unikat (Phönixschmiede)
    { id: 'flamme_der_wiedergeburt', name: 'Flamme der Wiedergeburt', icon: '🔥', slot: 'kern', schmiede: 3, unique: true, fixedRarity: 'goettlich', req: { research: 'r_phoenixschmiede' },
      cost: { material: 400, magie: 700, seelen: 300 }, stats: { mag: 90, lp: 120, tmp: 40 }, desc: 'Ein gebundener Phönixfunke – Tod ist nur ein neuer Anfang.' }
  ];

  // Slot-Positionen (type = Gegenstandsart; base = von Anfang an offen, sonst per Forschung).
  var equipSlots = [
    { id: 'waffe',       name: 'Waffe',        icon: '🗡️', type: 'waffe',      base: true },
    { id: 'kopf',        name: 'Kopf',         icon: '⛑️', type: 'kopf',       base: false },
    { id: 'ruestung',    name: 'Körper',       icon: '🛡️', type: 'ruestung',   base: true },
    { id: 'haende',      name: 'Hände',        icon: '🧤', type: 'haende',     base: false },
    { id: 'fuesse',      name: 'Füße',         icon: '🥾', type: 'fuesse',     base: false },
    { id: 'accessoire',  name: 'Accessoire',   icon: '📿', type: 'accessoire', base: true },
    { id: 'accessoire2', name: 'Accessoire II', icon: '💍', type: 'accessoire', base: false },
    { id: 'kern',        name: 'Kern/Geist',   icon: '🔆', type: 'kern',       base: false }
  ];

  // ---------- Regionen (Expeditionen / Territorium) ----------
  var regions = [
    { id: 'wald', name: 'Wald von Jura', icon: '🌲', power: 40, dauer: 8,
      rewards: { seelen: 6, material: 30, gold: 20 }, xp: 30, dropChance: 0.20,
      claimBonus: { nahrung: 1, material: 0.5 }, desc: 'Dichter Urwald voller Bestien.' },
    { id: 'hoehlen', name: 'Tiefe Höhlen', icon: '🕳️', power: 120, dauer: 12,
      rewards: { seelen: 14, material: 60, magie: 30 }, xp: 60, dropChance: 0.30,
      claimBonus: { material: 1.5 }, desc: 'Dunkle Stollen mit Magistahl-Adern.' },
    { id: 'sumpf', name: 'Giftsumpf', icon: '🐊', power: 300, dauer: 16,
      rewards: { seelen: 30, gold: 120, material: 60 }, xp: 110, dropChance: 0.35,
      claimBonus: { gold: 2 }, desc: 'Heimat von Echsen und Orks.' },
    { id: 'ruinen', name: 'Vergessene Ruinen', icon: '🏚️', power: 700, dauer: 20,
      rewards: { seelen: 80, wissen: 70, magie: 150 }, xp: 200, dropChance: 0.45,
      claimBonus: { wissen: 1, magie: 1 }, desc: 'Untote bewachen altes Wissen.' },
    { id: 'grenze', name: 'Dämonengrenze', icon: '🔥', power: 1600, dauer: 30,
      rewards: { seelen: 160, gold: 300, magie: 200 }, xp: 380, dropChance: 0.50,
      claimBonus: { magie: 2, gold: 2 }, desc: 'Die Schwelle zur Dämonenwelt.' },
    { id: 'gebirge', name: 'Drachengebirge', icon: '🏔️', power: 3600, dauer: 40,
      rewards: { seelen: 380, material: 400, magie: 300 }, xp: 700, dropChance: 0.60,
      claimBonus: { material: 3, magie: 2 }, desc: 'Horst uralter Drachen.' },
    { id: 'schattenreich', name: 'Schattenreich', icon: '🌑', power: 8000, dauer: 50,
      rewards: { seelen: 800, magie: 600, gold: 600 }, xp: 1300, dropChance: 0.65,
      claimBonus: { seelen: 1, magie: 3 }, desc: 'Ein Reich ewiger Finsternis voller Untoter.' },
    { id: 'himmelsfeste', name: 'Schwebende Himmelsfeste', icon: '🏯', power: 18000, dauer: 60,
      rewards: { seelen: 1600, wissen: 400, material: 800, magie: 900 }, xp: 2400, dropChance: 0.70,
      claimBonus: { wissen: 3, magie: 3 }, desc: 'Eine uralte Festung über den Wolken.' },
    { id: 'goetterthron', name: 'Thron der Götter', icon: '🌠', power: 40000, dauer: 75,
      rewards: { seelen: 3600, gold: 1500, magie: 1500, material: 1200 }, xp: 4500, dropChance: 0.80,
      claimBonus: { magie: 4, gold: 4, material: 3 }, desc: 'Die letzte Schwelle – Sitz vergessener Götter.' }
  ];

  // Strategische Abenteuerkarte. x/y sind Prozentkoordinaten auf einer frei
  // gezeichneten Landschaft; links bilden ein echtes 2D-Wegenetz.
  var strategicNodes = [
    { id: 'hauptstadt', name: 'Tempest', icon: '🏰', x: 7, y: 50, kind: 'capital', capital: true, links: ['wald', 'site_manaquelle'] },
    { id: 'wald', x: 20, y: 48, kind: 'region', links: ['hauptstadt', 'hoehlen', 'site_manaquelle', 'site_jagdlager'] },
    { id: 'site_manaquelle', x: 17, y: 20, kind: 'resource', siteId: 'manaquelle', links: ['hauptstadt', 'wald'], requires: 'wald' },
    { id: 'site_jagdlager', x: 32, y: 31, kind: 'resource', siteId: 'jagdlager', links: ['wald', 'sumpf'], requires: 'wald' },
    { id: 'hoehlen', x: 31, y: 72, kind: 'region', links: ['wald', 'sumpf', 'site_mine'] },
    { id: 'site_mine', x: 40, y: 89, kind: 'resource', siteId: 'magistahlmine', links: ['hoehlen'], requires: 'hoehlen' },
    { id: 'sumpf', x: 44, y: 65, kind: 'region', links: ['hoehlen', 'ruinen', 'site_jagdlager', 'site_handel'] },
    { id: 'site_handel', x: 51, y: 86, kind: 'resource', siteId: 'handelsposten', links: ['sumpf', 'ruinen'], requires: 'sumpf' },
    { id: 'ruinen', x: 56, y: 57, kind: 'region', links: ['sumpf', 'grenze', 'site_handel', 'site_archiv'] },
    { id: 'site_archiv', x: 62, y: 79, kind: 'resource', siteId: 'altes_archiv', links: ['ruinen', 'grenze'], requires: 'ruinen' },
    { id: 'grenze', x: 66, y: 47, kind: 'region', links: ['ruinen', 'gebirge', 'site_archiv'] },
    { id: 'gebirge', x: 75, y: 22, kind: 'region', links: ['grenze', 'schattenreich', 'site_drachennest'] },
    { id: 'site_drachennest', x: 86, y: 8, kind: 'discovery', siteId: 'drachennest', links: ['gebirge', 'himmelsfeste'], requires: 'gebirge' },
    { id: 'schattenreich', x: 80, y: 53, kind: 'region', links: ['gebirge', 'himmelsfeste', 'site_seelenbrunnen', 'site_schatzhort'] },
    { id: 'site_seelenbrunnen', x: 73, y: 83, kind: 'resource', siteId: 'seelenbrunnen', links: ['schattenreich'], requires: 'schattenreich' },
    { id: 'site_schatzhort', x: 91, y: 76, kind: 'discovery', siteId: 'schatzhort', links: ['schattenreich', 'goetterthron'], requires: 'schattenreich' },
    { id: 'himmelsfeste', x: 91, y: 32, kind: 'region', links: ['schattenreich', 'goetterthron', 'site_drachennest'] },
    { id: 'goetterthron', x: 96, y: 53, kind: 'region', links: ['himmelsfeste', 'site_schatzhort'] }
  ];

  // Eroberbare Ressourcenanlagen produzieren dauerhaft und sind bis Stufe 3
  // ausbaubar. Entdeckungen geben einmalige Beute.
  var strategicSites = [
    { id: 'manaquelle', name: 'Wilde Manaquelle', short: 'Manaquelle', icon: '🔮', kind: 'resource', guard: 55,
      produce: { magie: 1.5 }, upgradeCost: { gold: 120, material: 60 }, desc: 'Ein Magicule-Strom, der in Runenbecken gebändigt werden kann.' },
    { id: 'jagdlager', name: 'Jura-Jagdlager', short: 'Jagdlager', icon: '🏕️', kind: 'resource', guard: 80,
      produce: { nahrung: 3 }, upgradeCost: { gold: 100, material: 50 }, desc: 'Jäger und Sammler versorgen Tempests Marschkolonnen.' },
    { id: 'magistahlmine', name: 'Verlassene Magistahlmine', short: 'Magistahlmine', icon: '⛏️', kind: 'resource', guard: 150,
      produce: { material: 2 }, upgradeCost: { gold: 180, material: 80 }, desc: 'Alte Stollen führen zu ergiebigen Magistahladern.' },
    { id: 'handelsposten', name: 'Freier Handelsposten', short: 'Handelsposten', icon: '🏪', kind: 'resource', guard: 330,
      produce: { gold: 3 }, upgradeCost: { gold: 240, material: 100 }, desc: 'Eine Karawanenstation an den Wegen zwischen Sumpf und Ruinen.' },
    { id: 'altes_archiv', name: 'Archiv der Vergessenen', short: 'Altes Archiv', icon: '📜', kind: 'resource', guard: 760,
      produce: { wissen: 1.5 }, upgradeCost: { gold: 320, material: 160 }, desc: 'Versiegelte Tafeln bergen das Wissen eines untergegangenen Reiches.' },
    { id: 'seelenbrunnen', name: 'Brunnen der Echos', short: 'Seelenbrunnen', icon: '🕳️', kind: 'resource', guard: 9000,
      produce: { seelen: 0.5 }, upgradeCost: { gold: 900, material: 500, magie: 700 }, desc: 'Seelenfragmente sammeln sich in einer bodenlosen schwarzen Quelle.' },
    { id: 'drachennest', name: 'Verlassenes Drachennest', short: 'Drachennest', icon: '🥚', kind: 'discovery', guard: 4200,
      rewards: { seelen: 450, material: 600, magie: 300 }, desc: 'Zwischen riesigen Schalenresten liegt ein unberührter Drachenhort.' },
    { id: 'schatzhort', name: 'Hort des Schattenkönigs', short: 'Schatzhort', icon: '💎', kind: 'discovery', guard: 11000,
      rewards: { gold: 1400, magie: 900, seelen: 700 }, desc: 'Ein verborgener Hort hinter den Mauern des Schattenreichs.' }
  ];

  // ---------- Rivalen-Dämonenlords (Bedrohungssystem) ----------
  // basePower wächst je abgewehrtem Angriff (growth^Fortschritt). reward = Abwehr-Beute.
  // defeatBonus = dauerhafter Reichsbonus nach endgültigem Sieg (Gegenangriff).
  var rivals = [
    { id: 'clayron', name: 'Clayron der Lehmlord', icon: '🗿', basePower: 450, growth: 1.16,
      reward: { seelen: 60, material: 140 }, defeatBonus: { verteidigung: 0.12 },
      desc: 'Ein aufstrebender Dämonenlord aus dem Ödland.' },
    { id: 'glacira', name: 'Frosthexe Glacira', icon: '❄️', basePower: 2400, growth: 1.18,
      reward: { seelen: 220, magie: 220 }, defeatBonus: { produktionAll: 0.08 },
      desc: 'Eine eiskalte Hexenkönigin der Nordwüste.' },
    { id: 'vorgrael', name: 'Vorgrael der Verschlinger', icon: '🐙', basePower: 12000, growth: 1.2,
      reward: { seelen: 900, gold: 700, material: 500 }, defeatBonus: { armee: 0.15 },
      desc: 'Ein abgrundtiefer Hunger in Gestalt eines Lords.' }
  ];

  // ---------- Zufalls-Events ----------
  // auto:true → Effekt sofort. Sonst choices[] (Spielerwahl im Modal).
  // effect: { res:{}, cost:{}, buff:{effect:{},dauer,label}, threat:Zahl, summon:'speciesId' }
  var events = [
    { id: 'fund', icon: '💰', title: 'Verborgener Hort', weight: 10, auto: true,
      desc: 'Deine Späher finden einen vergrabenen Schatz.', effect: { res: { gold: 300, material: 120 } } },
    { id: 'magiesturm', icon: '🌌', title: 'Magiesturm', weight: 8, auto: true,
      desc: 'Ein Sturm aus Magicules durchzieht das Land.', effect: { buff: { effect: { produktionMagie: 0.5 }, dauer: 120, label: 'Magiesturm' } } },
    { id: 'missernte', icon: '🥀', title: 'Missernte', weight: 6, auto: true,
      desc: 'Eine Missernte drückt die Produktion.', effect: { buff: { effect: { produktionAll: -0.2 }, dauer: 80, label: 'Missernte' } } },
    { id: 'wanderer', icon: '🧙', title: 'Reisender Weiser', weight: 7, auto: true,
      desc: 'Ein Weiser teilt sein Wissen mit dir.', effect: { res: { wissen: 200 } } },
    { id: 'gabe', icon: '✨', title: 'Gabe eines Geistes', weight: 5, auto: true,
      desc: 'Ein Naturgeist gesellt sich zu deinem Reich.', effect: { summon: 'fee' } },
    { id: 'haendler', icon: '🧳', title: 'Fahrender Händler', weight: 8,
      desc: 'Ein Händler bietet dir einen Tausch an.', choices: [
        { label: 'Material kaufen', desc: '−200 Gold → +150 Material', effect: { cost: { gold: 200 }, res: { material: 150 } } },
        { label: 'Gold kaufen', desc: '−150 Material → +200 Gold', effect: { cost: { material: 150 }, res: { gold: 200 } } },
        { label: 'Ablehnen', desc: 'Nichts tun', effect: {} }
      ] },
    { id: 'monsterflut', icon: '🐗', title: 'Monsterflut', weight: 6,
      desc: 'Eine Monsterhorde zieht durchs Land.', choices: [
        { label: 'Jagen', desc: '+120 Seelen, aber Bedrohung steigt', effect: { res: { seelen: 120 }, threat: 30 } },
        { label: 'Verschanzen', desc: 'Sicher: +30 % Verteidigung (90 s)', effect: { buff: { effect: { verteidigung: 0.3 }, dauer: 90, label: 'Verschanzt' } } }
      ] },
    { id: 'dryadenrat', icon: '🌿', title: 'Rat der Dryaden', weight: 5, auto: true,
      desc: 'Die Hüterinnen des Jura-Waldes bestätigen Tempests Schutzversprechen.', effect: { res: { wissen: 160, magie: 120 } } },
    { id: 'zwergenkarawane', icon: '⚒️', title: 'Zwergenkarawane', weight: 7,
      desc: 'Handwerker aus dem Zwergenreich bieten Magistahl und Bauwissen an.', choices: [
        { label: 'Magistahl kaufen', desc: '−250 Gold → +220 Material', effect: { cost: { gold: 250 }, res: { material: 220 } } },
        { label: 'Baupläne tauschen', desc: '−120 Material → +180 Wissen', effect: { cost: { material: 120 }, res: { wissen: 180 } } }
      ] },
    { id: 'geisterfest', icon: '🧚', title: 'Fest der Elementargeister', weight: 5, auto: true,
      desc: 'Kleine Geister tanzen über Tempest und verdichten die Magicules.', effect: { buff: { effect: { produktionMagie: 0.35, wissen: 0.2 }, dauer: 100, label: 'Geisterfest' } } },
    { id: 'bestiengesandte', icon: '🐾', title: 'Gesandte der Bestienvölker', weight: 5,
      desc: 'Eine Delegation sucht Handel und ein gemeinsames Manöver.', choices: [
        { label: 'Handelsbund', desc: '+300 Gold, +15 Bedrohung', effect: { res: { gold: 300 }, threat: 15 } },
        { label: 'Gemeinsames Training', desc: '+25 % Armee für 90 s', effect: { buff: { effect: { armee: 0.25 }, dauer: 90, label: 'Bestienmanöver' } } }
      ] }
  ];

  // ---------- Affinitäten (einmalige Ausrichtung am Meilenstein) ----------
  // On-Affinität: Zauber dieser Schule +25 % wirksam + dauerhafter Reichsbonus.
  var affinities = [
    { id: 'feuer',    school: 'Feuer',     name: 'Feuer-Affinität',     icon: '🔥', bonus: { armee: 0.15 },          desc: 'Feuerzauber +25 %, dazu +15 % Armee-Kampfkraft.' },
    { id: 'wasser',   school: 'Wasser',    name: 'Wasser-Affinität',    icon: '💧', bonus: { produktionAll: 0.10 },  desc: 'Wasserzauber +25 %, dazu +10 % Produktion.' },
    { id: 'erde',     school: 'Erde',      name: 'Erd-Affinität',       icon: '🪨', bonus: { verteidigung: 0.20 },   desc: 'Erdzauber +25 %, dazu +20 % Verteidigung.' },
    { id: 'wind',     school: 'Wind',      name: 'Wind-Affinität',      icon: '🌬️', bonus: { produktionAll: 0.10 },  desc: 'Windzauber +25 %, dazu +10 % Produktion.' },
    { id: 'tod',      school: 'Tod',       name: 'Todes-Affinität',     icon: '☠️', bonus: { seelen: 0.30 },         desc: 'Todeszauber +25 %, dazu +30 % Seelen.' },
    { id: 'licht',    school: 'Licht',     name: 'Licht-Affinität',     icon: '🔆', bonus: { wissen: 0.5 },          desc: 'Lichtzauber +25 %, dazu +50 % Wissen.' },
    { id: 'geist',    school: 'Geist',     name: 'Geist-Affinität',     icon: '🔮', bonus: { produktionMagie: 0.30 },desc: 'Geistzauber +25 %, dazu +30 % Magie.' },
    { id: 'raumzeit', school: 'Raum/Zeit', name: 'Raum/Zeit-Affinität', icon: '⏳', bonus: { produktionAll: 0.12 },  desc: 'Raum/Zeit-Zauber +25 %, dazu +12 % Produktion.' }
  ];

  // ---------- Herrscher-Evolutionsstufen ----------
  var rulerStages = [
    { name: 'Schleim',             icon: '🟦', reqLevel: 1,  bonus: {} },
    { name: 'Magie-Schleim',       icon: '🔵', reqLevel: 5,  bonus: { produktionAll: 0.05 } },
    { name: 'Dämonen-Schleim',     icon: '🟣', reqLevel: 12, reqSeelen: 200,  bonus: { produktionAll: 0.10, armee: 0.10 } },
    { name: 'Dämonenlord',         icon: '😈', reqLevel: 22, reqSeelen: 600,  bonus: { produktionAll: 0.15, armee: 0.20, summonRang: 1 } },
    { name: 'Wahrer Dämonenlord',  icon: '👹', reqLevel: 35, reqSeelen: 2000, bonus: { produktionAll: 0.25, armee: 0.35, summonRang: 2 } },
    { name: 'Katastrophe',         icon: '🌌', reqLevel: 50, reqSeelen: 6000, bonus: { produktionAll: 0.40, armee: 0.60, summonRang: 3 } }
  ];

  // ---------- Forschungsbaum ----------
  // unlocks: magicTier (max freigeschalteter Zauber-Tier), slots [Positions-IDs], effect {…Bonus}.
  var research = [
    // Magie-Zweig
    { id: 'r_arkane_grundlagen', name: 'Arkane Grundlagen', icon: '📘', zweig: 'Magie', desc: 'Schaltet Zauber bis Tier 3 frei.',
      cost: { wissen: 80 }, req: {}, unlocks: { magicTier: 3 } },
    { id: 'r_hoehere_magie', name: 'Höhere Magie', icon: '📗', zweig: 'Magie', desc: 'Schaltet Zauber bis Tier 5 frei.',
      cost: { wissen: 300, magie: 200 }, req: { research: ['r_arkane_grundlagen'] }, unlocks: { magicTier: 5 } },
    { id: 'r_meistermagie', name: 'Meistermagie', icon: '📕', zweig: 'Magie', desc: 'Schaltet Zauber bis Tier 7 frei.',
      cost: { wissen: 1200, magie: 800 }, req: { research: ['r_hoehere_magie'], herrscherStufe: 2 }, unlocks: { magicTier: 7 } },
    { id: 'r_grossmeister', name: 'Großmeister-Arkana', icon: '📓', zweig: 'Magie', desc: 'Schaltet Zauber bis Tier 9 frei.',
      cost: { wissen: 4000, magie: 3000, seelen: 100 }, req: { research: ['r_meistermagie'], herrscherStufe: 3 }, unlocks: { magicTier: 9 } },
    { id: 'r_verbotene_kuenste', name: 'Verbotene Künste', icon: '📛', zweig: 'Magie', desc: 'Schaltet Zauber bis Tier 10 frei.',
      cost: { wissen: 9000, magie: 6000, seelen: 250 }, req: { research: ['r_grossmeister'] }, unlocks: { magicTier: 10 } },
    { id: 'r_ueberspitzen', name: 'Überspitzen-Magie', icon: '🌌', zweig: 'Magie', desc: 'Schaltet Super-Tier-Magie frei.',
      cost: { wissen: 20000, magie: 15000, seelen: 600 }, req: { research: ['r_verbotene_kuenste'], herrscherStufe: 4 }, unlocks: { magicTier: 11 } },
    // Ausrüstungs-Zweig
    { id: 'r_ruestkammer', name: 'Rüstkammer', icon: '⛑️', zweig: 'Ausrüstung', desc: 'Schaltet Kopf-Slot & Helme frei.',
      cost: { wissen: 120, material: 80 }, req: {}, unlocks: { slots: ['kopf'] } },
    { id: 'r_handwerk', name: 'Feines Handwerk', icon: '🧤', zweig: 'Ausrüstung', desc: 'Schaltet Hände- & Füße-Slots frei.',
      cost: { wissen: 400, material: 200 }, req: { research: ['r_ruestkammer'] }, unlocks: { slots: ['haende', 'fuesse'] } },
    { id: 'r_juwelier', name: 'Juwelierskunst', icon: '💍', zweig: 'Ausrüstung', desc: 'Schaltet einen 2. Accessoire-Slot frei.',
      cost: { wissen: 350, magie: 150 }, req: { research: ['r_ruestkammer'] }, unlocks: { slots: ['accessoire2'] } },
    { id: 'r_seelenschmiede', name: 'Seelenschmiede', icon: '🔆', zweig: 'Ausrüstung', desc: 'Schaltet Kern/Geist-Slot frei.',
      cost: { wissen: 1500, magie: 600, seelen: 80 }, req: { research: ['r_handwerk'], herrscherStufe: 2 }, unlocks: { slots: ['kern'] } },
    { id: 'r_meisterschmied', name: 'Meisterschmied', icon: '⚒️', zweig: 'Ausrüstung', desc: 'Schaltet das Unikat „Klinge des Untergangs" frei.',
      cost: { wissen: 5000, material: 1500, seelen: 150 }, req: { research: ['r_seelenschmiede'], herrscherStufe: 3 }, unlocks: {} },
    { id: 'r_artefakte', name: 'Verlorene Artefakte', icon: '🏺', zweig: 'Ausrüstung', desc: 'Schaltet göttliche Unikate frei.',
      cost: { wissen: 12000, magie: 8000, seelen: 400 }, req: { research: ['r_meisterschmied'], herrscherStufe: 4 }, unlocks: {} },
    // Reich/Ökonomie-Zweig
    { id: 'r_effiziente_bauten', name: 'Effiziente Bauten', icon: '🏗️', zweig: 'Reich', desc: '−15 % Baukosten.',
      cost: { wissen: 150 }, req: {}, unlocks: { effect: { bauRabatt: 0.15 } } },
    { id: 'r_seelenkunde', name: 'Seelenkunde', icon: '👁️', zweig: 'Reich', desc: '+25 % Seelen aus Kämpfen.',
      cost: { wissen: 250 }, req: {}, unlocks: { effect: { seelen: 0.25 } } },
    { id: 'r_kriegslehre', name: 'Kriegslehre', icon: '⚔️', zweig: 'Reich', desc: '+15 % Armee-Kampfkraft.',
      cost: { wissen: 300 }, req: {}, unlocks: { effect: { armee: 0.15 } } },
    { id: 'r_arkane_oekonomie', name: 'Arkane Ökonomie', icon: '⚖️', zweig: 'Reich', desc: '+10 % auf alle Produktion.',
      cost: { wissen: 600, magie: 300 }, req: { research: ['r_effiziente_bauten'] }, unlocks: { effect: { produktionAll: 0.10 } } },
    { id: 'r_weiser_geist', name: 'Weiser Geist', icon: '🧠', zweig: 'Reich', desc: '+50 % Wissensproduktion.',
      cost: { wissen: 500 }, req: {}, unlocks: { effect: { wissen: 0.5 } } },
    { id: 'r_naturkunde', name: 'Naturkunde', icon: '🌿', zweig: 'Reich', desc: '+8 % auf alle Produktion.',
      cost: { wissen: 700, magie: 200 }, req: { research: ['r_arkane_oekonomie'] }, unlocks: { effect: { produktionAll: 0.08 } } },
    { id: 'r_kriegskunst', name: 'Höhere Kriegskunst', icon: '🎖️', zweig: 'Reich', desc: '+25 % Armee-Kampfkraft.',
      cost: { wissen: 1500, magie: 400 }, req: { research: ['r_kriegslehre'], herrscherStufe: 2 }, unlocks: { effect: { armee: 0.25 } } },
    { id: 'r_seelenmeisterschaft', name: 'Seelenmeisterschaft', icon: '🔮', zweig: 'Reich', desc: '+40 % Seelen aus Kämpfen.',
      cost: { wissen: 1800, seelen: 60 }, req: { research: ['r_seelenkunde'], herrscherStufe: 2 }, unlocks: { effect: { seelen: 0.4 } } },
    { id: 'r_phoenixschmiede', name: 'Phönixschmiede', icon: '🔥', zweig: 'Ausrüstung', desc: 'Schaltet das Unikat „Flamme der Wiedergeburt" frei.',
      cost: { wissen: 14000, magie: 9000, seelen: 500 }, req: { research: ['r_artefakte'], herrscherStufe: 4 }, unlocks: {} }
  ];

  // ---------- Item-Sets ----------
  var sets = [
    { id: 'set_magistahl', name: 'Magistahl-Garnitur', desc: 'Aufeinander abgestimmte Magistahl-Ausrüstung.',
      bonus: { 2: { kampf: 0.08 }, 3: { kampf: 0.14, stats: { ver: 15 } }, 5: { kampf: 0.25, stats: { ver: 30, lp: 60 } } } },
    { id: 'set_drache', name: 'Drachenhort', desc: 'Ausrüstung aus den Überresten echter Drachen.',
      bonus: { 2: { kampf: 0.15, stats: { ang: 20 } }, 3: { kampf: 0.30, stats: { ang: 50, mag: 25 } } } },
    { id: 'set_geist', name: 'Geistergewand', desc: 'Mit Geistermagie durchwobene Ausrüstung.',
      bonus: { 2: { kampf: 0.10, stats: { mag: 20 } }, 3: { kampf: 0.22, stats: { mag: 45, tmp: 20 } } } },
    { id: 'set_phoenix', name: 'Glutregalia', desc: 'Glühende Ausrüstung aus Phönixfedern.',
      bonus: { 2: { kampf: 0.16, stats: { mag: 28 } }, 3: { kampf: 0.32, stats: { mag: 60, lp: 90 } } } }
  ];

  // ---------- Hilfe / Erklärungen der Spielsysteme ----------
  // Wird über ℹ️-Knöpfe als Modal angezeigt. steps = kurze Stichpunkte.
  var help = {
    start: { icon: '📜', title: 'Willkommen, Herrscher',
      text: 'Du erwachst als Monster in einer fremden Welt und baust aus einer kleinen Siedlung ein mächtiges Reich auf.',
      steps: [
        'Baue im Reich-Tab Produktionsgebäude (🔮 Magie, 🌾 Nahrung, 🪙 Gold, ⛏️ Material).',
        'Beschwöre Kreaturen und weise ihnen über die Aufgabe einen Job zu – arbeitende Kreaturen erhöhen die Produktion.',
        'Benenne eine Kreatur (✨), um ihre Kräfte zu wecken und Evolutionen freizuschalten.',
        'Neue Systeme schalten sich nach und nach frei – du musst dich nie um alles gleichzeitig kümmern.'
      ] },
    reich: { icon: '🏰', title: 'Reich & Gebäude',
      text: 'Gebäude sind das Herz deines Reichs. Höhere Stufen kosten mehr, geben aber dauerhaft mehr Ertrag.',
      steps: [
        'Produktion (🔮🌾🪙⛏️📚) liefert jede Sekunde Ressourcen.',
        'Wohnbezirk erhöht die Kreaturen-Kapazität, der Beschwörungskreis Rang & Rabatt.',
        'Manche Gebäude geben prozentuale Boni (z. B. Arena: +Armee, Bibliothek: +Wissen).',
        'Gesperrte Gebäude zeigen ihre Freischalt-Bedingung – sie erscheinen, sobald du sie erfüllst.'
      ] },
    kreaturen: { icon: '🐉', title: 'Kreaturen, Namen & Evolution',
      text: 'Unbenannte Kreaturen bilden einfache Artenstapel; erst ein wahrer Name macht eine Einheit zur individuell ausbaubaren Elite.',
      steps: [
        'Beschworene Basistruppen landen automatisch in der Herrscherarmee und werden mit derselben Art gestapelt.',
        'Unbenannte besitzen nur 1–2 Basisfähigkeiten – keine Ränge, Ausrüstung, Evolution oder Skill-Meisterschaft.',
        'Benennen (✨) löst eine Einheit aus dem Stapel, gibt +12 % Werte und prägt einen Aspekt. Maximal 40 % des Gefolges und absolut 20 Einheiten können benannt sein.',
        'Ein leeres Namensfeld erzeugt einen Zufallsnamen. Benannte meistern Skills bis Stufe 5 und wecken Folgefähigkeiten.'
      ] },
    magie: { icon: '🔮', title: 'Magie & Forschung',
      text: 'Magie ist in aktive Feldzauber der Arkanen Akademie, dauerhafte Reichsrituale und den Forschungsbaum getrennt.',
      steps: [
        'Die Arkane Akademie lehrt Kampfzauber für das Raster und Abenteuerzauber für konkrete Armeen.',
        'Reichsrituale geben dauerhafte Effekte; höhere Ritual-Tiers werden über Forschung sichtbar.',
        'Der Forschungsbaum schaltet Ritual-Tiers, Ausrüstungsplätze und Reichsausbau frei.',
        'Eine Affinität (ab Herrscher-Stufe 2) verstärkt Zauber ihrer Schule um 25 %.'
      ] },
    schmiede: { icon: '⚒️', title: 'Schmiede & Ausrüstung',
      text: 'In der Schmiede fertigst du Ausrüstung. Seltenheit (Gewöhnlich→Göttlich) bestimmt die Stärke.',
      steps: [
        'Höhere Schmiede-Stufen erlauben bessere Rezepte und seltenere Ergebnisse.',
        'Nur der Herrscher und benannte Elite tragen Ausrüstung; feste Positionen bilden einen Diablo-artigen Loadout.',
        'Set-Teile derselben Garnitur geben zusätzliche Boni.',
        'Forschung im Ausrüstungs-Zweig schaltet weitere Slots (Kopf, Hände, Kern …) frei.'
      ] },
    karte: { icon: '🗺️', title: 'Karte, Expeditionen & Rivalen',
      text: 'Schicke deine Armee auf Expeditionen: Auto-Kämpfe bringen Seelen, Material, Erfahrung und Beute – und sichern Territorium.',
      steps: [
        'Nur Kreaturen mit Job ⚔️ Armee ziehen in den Kampf; ist deine Kraft ≥ Gegnerkraft, gewinnst du.',
        'Sicher/Normal verwunden bei Niederlage. Riskant gibt ×1,4 Beute & Drop, aber eingesetzte Kreaturen sterben bei Niederlage.',
        'Taktische Kämpfe laufen auf einem 7×5-Raster mit Bewegung, Hindernissen, Initiative, Warten, Reichweite und Gegenwehr.',
        'Auf der Abenteuerkarte liegen bewachte Außenanlagen und Fundorte. Eroberte Anlagen produzieren und sind bis Stufe 3 ausbaubar.',
        'Regionen schalten sich der Reihe nach frei – die nächste wird als Ausblick gezeigt.',
        'Erobertes Territorium weckt Rivalen-Dämonenlords: Verteidigung = Labyrinth + stationierte Armee.'
      ] },
    armeen: { icon: '🚩', title: 'Armeegruppen & Weltkarte',
      text: 'Der Main Character führt von Beginn an die Herrscherarmee; benannte Elite kann weitere Armeen über die Karte führen.',
      steps: [
        'Alle Start- und neuen Basistruppen hängen an der Herrscherarmee und werden nach Art gestapelt.',
        'Die erste Namensgebung stellt automatisch eine zweite Armee auf. Weitere Gruppen brauchen je eine freie benannte Kreatur.',
        'Rang, Level, Herrscherstufe und Arena erhöhen das Kommandolimit. Bis zu vier Truppentypen dürfen gemischt werden.',
        'Truppen derselben Kreaturenlinie wie der Anführer erhalten +25 % Synergie; Skill-Meisterschaft stärkt den Führungsbonus.',
        'Bewegungspunkte erneuern sich alle 30 Sekunden. Gruppen folgen dem verzweigten Wegenetz; ungesicherte Orte blockieren den Durchmarsch.',
        'Kartenkämpfe verursachen dauerhafte Truppenverluste; riskante Niederlagen können auch den Anführer kosten.'
      ] },
    fusion: { icon: '🧬', title: 'Chimära-Fusion',
      text: 'Im Endgame verschmelzen ausschließlich zwei benannte Eliten: eine bleibt und wird dauerhaft stärker, die andere geht als Katalysator auf.',
      steps: [
        'Wähle eine benannte Basis und einen ebenfalls benannten Katalysator; unbenannte Stapel sind ausgeschlossen.',
        'Die Basis erhält je Fusion +15 % Werte (bis zu 5×) und kann einen Skill des Katalysators erben.',
        'Kostet Seelen & Magie – ein lohnender Sink für überzählige Kreaturen.',
        'Freigeschaltet ab Herrscher-Stufe „Dämonenlord".'
      ] },
    watch: { icon: '👁️', title: 'Zuschauer-Modus',
      text: 'Lehne dich zurück: Im Zuschauer-Modus spielt sich dein Reich von selbst – ein Berater trifft sinnvolle Entscheidungen.',
      steps: [
        'Der Auto-Modus baut, beschwört, benennt, entwickelt, erforscht und schickt Expeditionen los.',
        'Mit „Sichtbar“ zeigt er jede Aktion in einem Dialog und pausiert kurz; die letzten Schritte bleiben im Aktivitätsprotokoll.',
        'Du kannst jederzeit eingreifen oder den Modus wieder ausschalten.',
        'Mit ⏩ Vorspulen springst du mehrere Sekunden Spielzeit auf einmal.',
        'Ideal, um neue Systeme in Aktion zu sehen oder das Spiel laufen zu lassen.'
      ] }
  };

  // ---------- Nachbearbeitung: Basiswerte & Lookups ----------
  var byId = {};
  creatures.forEach(function (sp) {
    sp.base = baseStatsFor(sp);
    sp.levelCap = RANK_LEVELCAP[sp.rank] || 40;
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
  var researchById = {};  research.forEach(function (r) { researchById[r.id] = r; });
  var setsById = {};      sets.forEach(function (x) { setsById[x.id] = x; });
  var aspectsById = {};   aspects.forEach(function (a) { aspectsById[a.id] = a; });
  var rivalsById = {};    rivals.forEach(function (r) { rivalsById[r.id] = r; });
  var eventsById = {};    events.forEach(function (e) { eventsById[e.id] = e; });
  var affinitiesById = {}; affinities.forEach(function (a) { affinitiesById[a.id] = a; });
  var strategicSitesById = {}; strategicSites.forEach(function (s) { strategicSitesById[s.id] = s; });
  var slotResearch = {};  research.forEach(function (r) { if (r.unlocks && r.unlocks.slots) r.unlocks.slots.forEach(function (sl) { slotResearch[sl] = r.id; }); });

  root.GameData = {
    RANKS: RANKS, RANK_POWER: RANK_POWER, RANK_LEVELCAP: RANK_LEVELCAP, BASE: BASE,
    rankIndex: rankIndex, baseStatsFor: baseStatsFor, combatPower: combatPower,
    resources: resources, buildings: buildings, creatures: creatures, skills: skills, aspects: aspects,
    battleAbilities: battleAbilities, fieldMagic: fieldMagic,
    magic: magic, rarities: rarities, recipes: recipes, equipSlots: equipSlots,
    regions: regions, rulerStages: rulerStages, research: research, sets: sets, slotResearch: slotResearch, rivals: rivals,
    events: events, affinities: affinities, help: help,
    strategicNodes: strategicNodes, strategicSites: strategicSites,
    creature: function (id) { return byId[id]; },
    building: function (id) { return buildingsById[id]; },
    spell: function (id) { return magicById[id]; },
    fieldSpell: function (id) { return fieldMagicById[id]; },
    recipe: function (id) { return recipesById[id]; },
    region: function (id) { return regionsById[id]; },
    rarity: function (id) { return rarityById[id]; },
    skill: function (id) { return skills[id]; },
    battleAbility: function (id) { return battleAbilities[id]; },
    aspect: function (id) { return aspectsById[id]; },
    rival: function (id) { return rivalsById[id]; },
    event: function (id) { return eventsById[id]; },
    affinity: function (id) { return affinitiesById[id]; },
    strategicSite: function (id) { return strategicSitesById[id]; },
    researchNode: function (id) { return researchById[id]; },
    set: function (id) { return setsById[id]; }
  };
})();
