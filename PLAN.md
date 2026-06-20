# Plan: Königreich-Builder „Tempest" (Browser, mobil)

## Arbeitsweise
- Dieser Plan ist die **verbindliche Referenz** für das Projekt. Alle künftigen Änderungen am Konzept werden in **dieser Datei** (`PLAN.md` im Projektverzeichnis) nachgezogen.
- Umsetzung erfolgt **autonom (Automode)**: Phase 1 (spielbarer Kern) wird durchgebaut, im Browser/auf Handy-Größe getestet; Rückmeldung bei echten Entscheidungen oder am Phasenende.
- Fortschritt steht unten unter **Status / Fortschritt**.

## Kontext
Ein Spiel, das Elemente & Systeme aus **Tensura** (*That Time I Got Reincarnated as a Slime*) ein **Königreich-Builder im stil von Heroes of might & Magic** mit umfangreichem **Ausrüstungssystem**, **Magiesystem**, vielen verschiedenen **Ausbau-Systemen**, **unterschiedlich starken Kreaturen** und **Kreaturen-Upgrade-Systemen**.

Bestätigt: **Browser (HTML/JS)**, **auf dem Handy spielbar**. Ausdrückliche Auflage: **keine HTML-Formatierungsfehler**. UI-Sprache **Deutsch**; Spielgefühl **Aufbau & Management** mit automatisch ausgewerteten Kämpfen.

## Technische Entscheidungen
- **Stack:** reines HTML + CSS + JavaScript, **kein Build-Schritt, keine externen Bibliotheken/CDNs** → läuft offline direkt aus der Datei.
- **Portabilität / Handy:** **eigenständige Seite** ohne ES-Module (klassische `<script>`-Tags, relative Pfade → auch über `file://` lauffähig). Datei aufs Handy kopieren und im Browser öffnen → läuft offline; Spielstand via `localStorage`. Alternativ am PC `python3 -m http.server` und am Handy über die lokale IP öffnen.
- **Mobile-first / responsiv:** Flexbox/Grid, **untere Tab-Leiste** (daumenfreundlich), große Tap-Ziele, `viewport`-Meta, keine Hover-only-Interaktionen, Skalierung Handy→Desktop über wenige Media-Queries.
- **Gegen HTML-Formatierungsfehler (Auflage):** `index.html` bleibt **minimal**; die datengetriebene UI wird **per JS aus Daten gerendert** (Template-Funktionen, sichere DOM-Erzeugung, `textContent`) → keine großen handgeschriebenen HTML-Blöcke. Validierung + echter Browser-Test, falls möglich Screenshots in Handy-/Desktop-Größe.
- **Speichern:** Auto-Save + manuell über `localStorage` (versioniertes Schema, Reset-Funktion).

## Architektur / Dateien (offline-fähig, klassische Scripts, Namensraum `Game`)
- `index.html` – Grundgerüst, Ressourcenleiste oben, Tab-Container, untere Navigation.
- `style.css` – Mobile-first Theme (dunkles Fantasy-Design).
- `js/state.js` – zentraler Spielzustand + Speichern/Laden.
- `js/data.js` – **datengetriebene Inhalte**: Gebäude, Kreaturen, Evolutionsketten, Skills/Magie, Items/Rezepte, Forschung, Regionen.
- `js/systems.js` – Logik: Ressourcen-Tick, Bauen, Beschwören, Namensgebung/Evolution/Leveln, Magie, Schmieden/Verzaubern, Kampf/Expedition, Forschung, Expansion.
- `js/ui.js` – Render-Funktionen je Tab + Events.
- `js/main.js` – Spiel-Loop (Tick), Init, Verdrahtung.

## Spielsysteme (Tensura × Heroes-artige Strategie)
**Rolle:** wiedergeborener Schleim-Herrscher im Tensura-Universum, der aus einer kleinen Monstersiedlung ein mächtiges Reich aufbaut. Die strategische Karte und Armeegruppen orientieren sich spielmechanisch an klassischen Heroes-of-Might-and-Magic-Systemen.

**Ressourcen (Tick-basiert):** Magie (Magicules), Gold, Nahrung, Materialien (inkl. Magistahl), **Seelen** (aus Kämpfen – für Evolution/Erwachen), Forschung/Weisheit.

**1. Königreich & Ausbau – „mehrere Systeme":** Gebäude/Bezirke (Magieturm, Schmiede, Mine, Farm/Jagd, Markt, Forschungsgilde, Beschwörungskreis, Wohnbezirk, Labyrinth, Tempel) bauen + aufrüsten; Territorium/Karte erkunden & beanspruchen; Forschung (Großer Weiser) schaltet frei; Diplomatie/Eroberung gegen Rivalen-Dämonenlords; Bevölkerung/Rassen siedeln sich an.

**2. Kreaturen – „unterschiedlich starke":** Ränge **E→D→C→B→A→S→SS (Katastrophe)** + Level (1–100), Werte (LP, ANG, VER, MAG, TMP, EP). Archetypen beider Welten (Slime, Goblin-, Direwolf-, Oger/Kijin-, Echsen-/Drachenmensch-, Ork-, Skelett/Lich-, Zombie/Todesritter-, Imp/Dämon-, Vampir-, Golem-, Insekten-, Drachen-Linie). Einsatz: Armee, Arbeit, Forschung, Expedition.

**3. Kreaturen-Upgrade – Marquee-Feature:** **Namensgebung** (Magie → Evolution + Werteschub + ggf. Skill + Loyalität); **Evolutionsketten** (Level/Seelen/benannt → nächste Form); **Leveln** (XP → Rassen-Cap, optional Klassen-Level); **Erwachen/Erntefest** (Seelen-Pool → Massenevolution); **Skill-Erwerb** (Intrinsisch → Verbreitet → Extra → Einzigartig → Ultimativ).

**4. Magiesystem:** **Zauber-Tiers 1–10 + Super-Tier**, freigeschaltet über Forschung + Caster-Level; **Skill-Kategorien** (Einzigartig/Ultimativ), Herrscher-Signatur-Skill **Großer Weiser/Verschlinger** (Analyse/Forschung); Schulen/Elemente (Feuer, Wasser, Erde, Wind, Licht, Dunkel/Tod, Raum/Zeit, Geist), Geister-/Elementar-Pakte. Wirkung in Kampf, als Buffs und als Reichseffekte.

**5. Ausrüstungssystem – „umfangreich":** Schmieden (Magistahl, Rezepte via Forschung); Seltenheiten Gewöhnlich → Selten → Episch → Legendär → Göttlich/Artefakt; Slots (Waffe, Rüstung Kopf/Körper/Hände/Füße, 2× Accessoire, Kern/Geist); Verzaubern/Aufwerten (+1/+2, Reroll); einzigartige/benannte Items; ausrüstbar auf Herrscher & Kommandeure.

**6. Konflikt (auto-ausgewertet):** Expeditionen/Raids (Werte-Kampf → Beute, Seelen, Material, XP); Labyrinth-Verteidigung; Kriege gegen Rivalen-Lords.

**7. Herrscher-Progression:** Level + Evolutionsstufen (Slime → Dämonen-Slime → Dämonenlord → Wahrer Dämonenlord …) → reichsweite Boni, schaltet Magie-Tiers & Ultimative Skills frei; Light-Story/Meilensteine.

## Lieferumfang in Phasen
- **Phase 1 – Spielbarer Kern:** mobile-first UI mit Tabs + Ressourcenleiste; Ressourcen-Tick; ~6–8 Gebäude; ~12 Kreaturen-Archetypen mit Beschwören & Job-Zuweisung; **Namensgebung + Evolution + Leveln**; **Expeditionen** (Auto-Kampf) mit Beute/Seelen/XP; **Basis-Magie**; **Basis-Schmiede** (craften + ausrüsten); Herrscher-Level; Speichern/Laden + Reset; deutsche Flavor-Texte.
- **Phase 2 – Tiefe:** volle Magie-Tiers 1–10 + Super-Tier & Skill-Baum; volles Ausrüstungssystem (Seltenheiten, Verzaubern, Slots, Sets, benannte Items); Forschungsbaum.
- **Phase 3 – Expansion & Endgame:** Territorium-/Weltkarte, Labyrinth-Verteidigung, Rivalen-Dämonenlords/Diplomatie, Erntefest-Massenevolution, Herrscher-Erwachen + Ultimative Skills.
- **Phase 4 – Feinschliff:** Balancing, mehr Inhalte, Ton/Animationen, Tutorial.

## Verifikation
- **Lokal starten:** `python3 -m http.server 8000` im Projektordner → `http://localhost:8000` (PC) bzw. `http://<PC-IP>:8000` (Handy im selben WLAN); zusätzlich direktes Öffnen der `index.html` (offline/`file://`).
- **HTML/Layout-Check:** Validierung (`tidy`/`html-validate`, falls vorhanden); falls Headless-Browser verfügbar, Screenshots in Handygröße (z. B. 390×844) und Desktop.
- **Smoke-Test:** Gebäude bauen → Kreatur beschwören → benennen/entwickeln/leveln → Expedition → Ausrüstung craften/ausrüsten → speichern, neu laden (Stand bleibt) → Reset.

## Status / Fortschritt
- [x] **Phase 1 – Spielbarer Kern (fertig, 2026-06-18)** — Ressourcen-Tick, 9 Gebäude, 13 beschwörbare Kreaturen-Grundformen in ~40 Evolutionsstufen, Namensgebung + Evolution + Leveln, 9 Magie/Forschungen, Schmiede + Ausrüstung/Verzaubern (3 Slots, 5 Seltenheiten), Expeditionen mit Auto-Kampf + Territorium, Herrscher-Level/-Stufen + Seelen opfern, Offline-Fortschritt, Speichern/Laden + Reset.
- [x] Phase 2 – Tiefe (Magie-Tiers 1–10 + Super-Tier, volle Ausrüstung 7 Slots/Sets, Forschungsbaum)
- [x] Phase 3 – Expansion & Endgame (Weltkarte, Labyrinth-Verteidigung, Rivalen-Dämonenlords, Erntefest-Massenevolution, Ultimative Skills)
- [x] Phase 4 – Feinschliff (Balancing, mehr Inhalte, Ton/Animationen, Tutorial)
- [x] **Phase 5 – Neue Inhalte (2026-06-19)** — 4 neue Kreaturenlinien (Geist/Fee, Greif/Harpyie, Baumhirte/Pflanze, Phönix → 16 neue Stufen, jetzt 61 Formen/16 Linien); 4 neue Skills; 3 Endgame-Regionen (Schattenreich 8k, Himmelsfeste 18k, Götterthron 40k); 4 neue Gebäude (Handelshafen, Bibliothek, Arena, Seelentempel) mit neuer prozentualer Gebäude-Bonus-Mechanik; 2 neue Item-Sets (Geistergewand, Glutregalia) + 8 neue Rezepte inkl. Unikat „Flamme der Wiedergeburt"; 5 neue Forschungsknoten.
- [x] **Balancing Phase 5 (2026-06-19)** — neues Material gegen bestehende Rang-Bänder geprüft (`dev/balance.js`): Sonnenphönix (S) auf Drachen-Niveau getrimmt, Weltenesche (B, Verteidigung) entschärft, Beute/Tick-Knick bei „Vergessene Ruinen" geglättet → Kraftkurven je Rang innerhalb der Bänder, Regions-Beute/Tick streng monoton.
- [x] **Phase 6 – Erlebnis & Wiederspielbarkeit (2026-06-19)** — drei neue Systeme für Tiefe/Variabilität:
  - **A) Verzweigte Evolutionen + Skill-Slots:** Aspekte (Wüterich/Bollwerk/Arkanist) bei der Namensgebung prägen Werte+Skill; wählbare Skill-Slots (Kapazität nach Rang, 6 lernbare Skills); 5 echte Verzweigungsformen (Goblin-Schamane, Mondwolf, Sumpfschamane, Seelenwächter, Runengolem) als 2. Evolutionspfad.
  - **B) Rivalen & Bedrohung:** 3 Rivalen-Dämonenlords, wachsende Threat, geplante Raids mit Vorwarnung; Verteidigung = Labyrinth + stationierte Armee + Verteidigungsbonus (macht `defensePer` wirksam); Durchbruch kostet Ressourcen + verwundet (moderat, kein Dauerverlust); nach 3 Abwehren Gegenangriff → endgültiger Sieg + dauerhafter Reichsbonus.
  - **C) Events, Risiko & Affinitäten:** 7 Zufalls-Events (auto + Wahl-Events, temporäre Buffs/Debuffs); Expeditions-Risiko (sicher/normal/riskant) mit Verwundung bei riskanter Niederlage (heilt mit der Zeit); 8 Element-Affinitäten (einmalige Wahl ab Herrscher-Stufe 2, +25 % Schul-Zauber + dauerhafter Bonus).
  - Speicher-kompatibel (alle Felder in createDefault + normalize), mobile-UI integriert (Aspekt-/Skill-/Event-/Affinitäts-/Gegenangriffs-Modal, Risiko-Auswahl, Bedrohungs-Panel im Karte-Tab).
- [x] **Phase 7 – Onboarding, Magie-Tiefe, Fusion & Zuschauer-Modus (2026-06-19)** — sieben offene Wünsche umgesetzt:
  - **Zuschauer-/Auto-Modus:** Das Reich spielt sich selbst (`autoPlayStep`): baut, beschwört, benennt, entwickelt, weist Jobs zu, erforscht, lernt Magie, schmiedet, startet Expeditionen, kontert Rivalen, wählt Affinität, fusioniert, opfert Seelen – eine sinnvolle Aktion je Tick mit Toast. Steuerung in der Übersicht (▶ Starten / ⏸ Stoppen) + **⏩ Vorspulen 30 s** (`fastForward`).
  - **Magie-Tiers numerisch sortiert & gegated:** Sortierung jetzt 1,2,…,10,Super (Bug `Object.keys().sort()` behoben). Es werden nur freigeschaltete Tiers gezeigt + der nächste Tier als gedämpfter „Ausblick"; ferne Tiers ausgeblendet.
  - **Forschungsbaum-UI nachgerüstet (war nie verdrahtet!):** Magie-Tab rendert jetzt den Forschungsbaum (Magie/Ausrüstung/Reich), enthüllt sich progressiv (erforscht + Frontier). Damit sind höhere Magie-Tiers & Ausrüstungs-Slots erstmals im Spiel erreichbar. Latent-Bug gefixt: `state.research` wurde in `createDefault` nie initialisiert → `doResearch` crashte.
  - **Einzigartigere Zauber:** Statt monotoner %-Stapel haben Zauber jetzt eigene Wirkungen über neue Effektarten: `expedTempo` (kürzere Expeditionen), `heiltempo` (schnellere Heilung), `kapazitaet` (+Plätze), `threatRuhe` (langsamere Rivalen), `beuteRang` (bessere Beute), `evoRabatt` (günstigere Evolution) und `produce` (Direktproduktion/Tick). Alle in `computeBonuses` (via `addEffect`) verdrahtet.
  - **Progressive Sichtbarkeit (gegen Überforderung):** Tabs erscheinen erst bei Bedarf — Magie nach Forschungsgilde, Schmiede nach Bau der Schmiede, Karte nach erster Namensgebung. Neufreischaltungen werden angekündigt (Toast + Chronik). Übersicht zeigt „Als Nächstes"-Ziele.
  - **Schrittweises Freischalten von Inhalten:** Gebäude erscheinen nach Fortschritt (+2 Teaser „Bald verfügbar"); Regionen zeigen nur Verfügbare + die nächste als Ausblick; Beschwörung zeigt den nächsten Rang als Ausblick.
  - **Erklärungen:** Hilfe-Datenbank (`GameData.help`) + ℹ️-Knöpfe in Titeln/Sektionen → Erklär-Modals für alle Systeme (Start, Reich, Kreaturen, Magie, Schmiede, Karte, Fusion, Zuschauer-Modus).
  - **Chimära-Fusion (Endgame):** Ab Herrscher-Stufe „Dämonenlord" zwei Kreaturen verschmelzen → Basis +15 % Werte je Fusion (bis 5×), erbt einen Skill des Katalysators; Katalysator wird geopfert (Ausrüstung zurück ins Inventar). Eigenes Fusions-Modal.
[x] **Phase 8 – Sichtbarer Automodus & Konsequenzen (2026-06-19)**
  - Optionaler Modus **„🎬 Sichtbar"**: Berater-Aktionen erscheinen einzeln in kurzen Dialogen, pausieren 3 Sekunden und bleiben in einem Aktivitätsverlauf sichtbar; schneller Auto-Modus und Vorspulen bleiben erhalten.
  - Risiko vollständig umgesetzt: 🛟 Sicher ×0,8, ⚖️ Normal ×1,0, 🔥 Riskant ×1,4 Beute/Drop. Sicher/Normal verwunden bei Niederlage (halbe Werte, zeitbasierte Heilung, nicht einsatzfähig); bei riskanter Niederlage sterben eingesetzte Kreaturen endgültig, angelegte Ausrüstung wird geborgen.

[x] **Phase 9 – Benannte Elite, Loadouts & Skill-Meisterschaft (2026-06-19)**
  - Namenssiegel begrenzen Benannte auf höchstens 40 % des Gefolges und zusätzlich über Herrscherfortschritt/Magieturm/Seelentempel; Kosten eskalieren mit jedem vergebenen Namen in Magie und Seelen. Dadurch bleibt Namensgebung eine knappe strategische Entscheidung.
  - Nur benannte Kreaturen und der Main Character können Ausrüstung tragen. Diablo-artige Loadout-Ansicht mit 8 festen Positionen (Waffe, Kopf, Körper, Hände, Füße, 2× Accessoire, Kern/Geist), Forschungsgating und bestehenden Item-Sets/Equipment-Mix.
  - Fähigkeiten von Benannten und Herrscher besitzen Meisterschaftsstufen 1–5, gewinnen XP aus Kämpfen, sind gezielt trainierbar und werden pro Stufe stärker. Auf Stufe 3 werden aus 16 Basisfähigkeiten eigene Folgefähigkeiten freigeschaltet; vollständige Fähigkeitensichten in Kreaturen- und Herrscher-Dialogen.

[x] **Phase 10 – Taktisches Kampfsystem (2026-06-19)**
  - Zusätzlich zu Auto-Expeditionen ein persistierbarer, rundenbasierter Kampf für Gruppen bis 4: individuelle Züge, LP/MP, Zielwahl, Angriff, Verteidigung, Heilung, Analyse und Seelensog.
  - Elementschwächen/-resistenzen, gegnerische Absichten sowie Brand, Frost und Schock; gelernte Magieschulen und Kreaturenlinien bestimmen verfügbare Aktionen.
  - Sieg vergibt Territorium, Beute, XP und Skill-Meisterschaft; Niederlagen nutzen dieselben Risiko-/Tod-/Verwundungsregeln wie Expeditionen. Mobile Kampfbühne und Wiederaufnahme nach Speichern/Laden integriert.
  
[x] **Phase 11 – Tempest-Fokus & Heroes-artige Armeegruppen (2026-06-19)**
  - **Reset-Bug behoben:** Der `beforeunload`-Auto-Save schrieb den gerade gelöschten Spielstand beim Neuladen zurück. Ein atomarer Reset-Modus stoppt jetzt Spiel-/Save-Loop, sperrt alle Exit-Saves, entfernt den Stand und lädt erst danach neu. Regressionstest simuliert `beforeunload` nach Reset.
  - **Tensura-Fokus:** Titel, Metadaten, Intro, Handbuch und Projektbeschreibung vollständig auf „Tempest – Königreich der Monster" und das Tensura-Universum umgestellt; Overlord-/Nazarick-Inhalte entfernt. Neuer Save-Key `tempest_kingdom_save_v2` mit automatischer, getesteter Migration alter v1-Spielstände.
  - **Spielbare strategische Weltkarte:** 10 verbundene Kartenfelder von Tempest bis zum Götterthron; Armeegruppen erscheinen als steuerbare Figuren, bewegen sich mit erneuerbaren Bewegungspunkten nur zwischen Nachbarfeldern und müssen blockierende Regionen erobern.
  - **Benannte Anführer & Massentruppen:** Jede Gruppe benötigt genau eine benannte Kreatur als Elite/Anführer. Direkte Rekrutierung in 10er-/50er-Kontingenten, bis zu 4 mischbare Truppentypen; Beispiele „Hobgoblin + 100 Goblins" und „Oger + 20 Goblins + 100 Schleime + 50 Orks" passen in die berechneten Limits.
  - **Balance:** Kommandolimit skaliert mit Anführer-Rang/-Level, Herrscherstufe und Arena; Truppenkosten skalieren nach Rang. Anführer-Rang, Skill-Meisterschaft und Fusion geben Führungsbonus, gleiche Kreaturenlinie zusätzlich +25 % Synergie. Armeeslots wachsen durch Herrscherstufen und Arena.
  - **Feldzüge:** Kartenangriffe mit Sicher/Normal/Riskant, Regionsbeute, Anführer-EP/Skill-XP und permanenten Truppenverlusten. Niederlagen verwunden den Anführer; bei riskanter Niederlage stirbt er endgültig, seine Ausrüstung wird geborgen und die Gruppe aufgelöst. Auto-/Zuschauer-Modus kann Gruppen aufstellen, rekrutieren, bewegen und erobern.
  
[x] **Phase 12 – Herrscherarmee, Truppenstapel & echte Elite (2026-06-20)**
- Maximal 20 benannte Kreaturen (zusätzlich zum prozentualen Namenssiegel-Limit).
- Persistente Herrscher-/Main-Character-Armee ab Spielstart; alle Startkreaturen hängen an ihr.
- Die erste Namensgebung stellt automatisch eine zweite Armee unter der neuen Elite auf.
- Beschworene und rekrutierte unbenannte Einheiten werden nach Art und Armee gestapelt; Kapazität, Nahrung, Produktion und Kampfkraft rechnen die Stapelgröße korrekt.
- Nur Benannte besitzen sichtbare Ränge, Level/Evolution, Ausrüstung, Aspekte, erweiterte Skill-Slots und Meisterschaft. Leere Namenseingaben erzeugen passende, eindeutige Zufallsnamen.
- Unbenannte Basistruppen besitzen nur 1–2 taktische Basisfähigkeiten und keine Ausrüstung/Skill-Meisterschaft.
- Chimära-Fusion akzeptiert ausschließlich zwei benannte Eliten.
- Save-Schema v3 normalisiert alte Einzelkreaturen zu Stapeln und ergänzt die Herrscherarmee, ohne den bestehenden Save-Key zu brechen.

[x] **Phase 13 – Echte Abenteuerkarte & Außenanlagen (2026-06-20)**
- Frei gezeichnete, horizontal erkundbare 2D-Landschaft statt linearer Knotenleiste: 18 Orte mit SVG-Wegen, Terrain-Layern, Nebel, sichtbaren Armee-Markern und mobilem Scroll-Viewport.
- Echtes Wegenetz mit Verzweigungen und Wegfindung; Armeen bewegen sich nur zwischen direkt verbundenen Orten. Ungesicherte Territorien/Fundorte blockieren den Durchmarsch.
- 6 bewachte Ressourcenanlagen (Manaquelle, Jagdlager, Magistahlmine, Handelsposten, Archiv, Seelenbrunnen) produzieren nach Eroberung und sind bis Stufe 3 ausbaubar.
- 2 optionale Entdeckungsorte (Drachennest, Schatzhort) liefern einmalige Beute und bleiben als erkundet markiert.
- Eigene Fundort-Modals, Kartenlegende, Produktionsübersicht, Auto-Modus-Wegfindung und Save-Schema v4 mit Kartenfortschritt.

[x] **Phase 14 – Heroes-artiger taktischer Rasterkampf (2026-06-20)**
- Persistentes 7×5-Schlachtfeld mit sichtbaren Einheitenstapeln, Positionen, Hindernissen und regionsabhängiger Kampfatmosphäre.
- Bewegungsreichweite und belegte/blockierte Felder; Einheiten können manuell ziehen oder beim Angriff automatisch auf ihr Ziel vorrücken.
- Initiativeleiste für beide Seiten, Aktion „Warten", Verteidigung, Nah-/Fernkampfreichweite und einmalige Gegenwehr je Einheit/Runde.
- Gegner bewegen sich zielgerichtet, suchen das nächste Ziel und greifen erst in Reichweite an; Magier kämpfen auf Distanz.
- Elementschwächen, Resistenzen, MP, Heilung, Analyse, Seelensog und Brand/Frost/Schock bleiben vollständig integriert.
- Mobile Raster-UI mit erreichbaren Feldern, Lebensanzeigen, Stapelzahlen, Zugmarkierung und Save-kompatibler Nachnormalisierung laufender alter Kämpfe.

[x] **Phase 15 – Erkennbare Monster-Assets & mehr Weltinhalt (2026-06-20)**
- Neues, per Built-in-Imagegen erzeugtes und lokal transparent gestelltes 1536×1024-Sprite-Sheet (`assets/creature-sprites.png`) für klar erkennbare Schleime, Goblins, Wölfe, Oger, Echsenmenschen und Orks.
- Karten, Beschwörung, Armeen, Expeditionen und Gruppenauswahl verwenden die kohärenten Portrait-Ausschnitte; alle anderen Linien behalten einen Emoji-Fallback.
- 4 neue Völker mit 12 Evolutionsformen: Kobolde, Hasenmenschen, Tengu und Meervolk.
- 4 neue Welt-/Völkerereignisse: Rat der Dryaden, Zwergenkarawane, Geisterfest und Gesandte der Bestienvölker.
- Chroma-Key-Quellasset und reproduzierbares lokales Entfernungsskript liegen im Projekt; finale PNG besitzt Alpha und funktioniert offline.

[x] **Phase 16 – Engine-Entscheidung (2026-06-20, Evaluierung)**
- **Ren’Py verworfen:** auf Visual Novels optimiert, für Builder-, Armee-, Karten- und Rasterkampfsysteme ungeeignet; ein Wechsel würde Offline-Webbetrieb, Save-Kompatibilität und Testbasis unnötig aufgeben.
- **Entscheidung:** HTML/CSS/JS bleibt die Spielplattform. Grafik wird zunächst durch lokale Raster-Assets, SVG/CSS-Karten und Animationen verbessert.
- **Spätere Option:** Wenn die Darstellung nach den Systemüberarbeitungen weiter limitiert, Phaser oder PixiJS als reine Canvas/WebGL-Rendering-Schicht evaluieren – nicht als sofortiger Komplettumbau.

[x] **Phase 17 – Getrennte Feldmagie, Reichsrituale & Forschung (2026-06-20)**
- Neue **Arkane Akademie** als eigenes Gebäude für aktive Magie; unabhängig vom Magieturm (Magicule-Produktion) und von der Forschungsgilde.
- Eigenes Feldmagie-Zauberbuch mit 5 Kampfzaubern (Feuer, Frost, Sturm, Heilung, Seelensog) und 3 Abenteuerzaubern.
- Kampfzauber schalten gezielt Aktionen im 7×5-Rasterkampf frei; Reichsrituale gewähren weiterhin ausschließlich dauerhafte Wirtschafts-/Reichseffekte.
- Abenteuerzauber wirken auf konkrete Armeegruppen: **Windmarsch** stellt Bewegung wieder her, **Feldbarriere** halbiert die nächsten Kartenkampfverluste, **Tor nach Tempest** teleportiert zur Hauptstadt.
- Lernkosten, Akademiestufen, Wirkkosten und Abklingzeiten; Auto-Modus kann Akademiezauber lernen und sinnvoll einsetzen.
- Magie-UI in drei klar sichtbare Ebenen getrennt: Feldmagie, Reichsrituale und Königreichsausbau/Forschung.
- Save-Schema v5 ergänzt gelerntes Feldzauberbuch, Abklingzeiten und Armee-Barrieren kompatibel.

Phase 18 todo
- Ich finde die gesamte optik der app ehere wie eine html seite und nicht wie ein spiel. Wie können wir das graphisch aufwerten ? Vielleicht macht es Sinn die Mobile kompatibilität erstmal zu droppen und ein richtig geiles Desktop game experience zu schaffen ?

 
### Dateien
- Spiel: `index.html`, `style.css`, `js/{data,state,systems,ui,main}.js` (offline-/`file://`-tauglich).
- Dev-Tests (nicht Teil des Spiels): `dev/sim.js` (Logik, `node dev/sim.js`), `dev/domtest.js` (DOM via jsdom).

### Verifikation (Stand 2026-06-20, nach Phase 17)
- `node dev/sim.js` → 201/201 Logiktests bestanden (inkl. Herrscherarmee, Abenteuerkarte, Rasterkampf, Assets/Inhalte, getrennte Feldmagie, Cooldowns und Save-Migration).
- `node dev/domtest.js` → 57/57 DOM-Rendertests bestanden (alle Views/Modals inkl. 2D-Abenteuerkarte, Rasterkampf, Assets sowie getrennte Magie-UI/Abenteuerzauber).
- `node dev/playthrough.js` → 57/57 Durchspiel-Checks bestanden (komplette Sitzung, Tod/Verwundung, Kartenbewegung/Anlageneroberung, Save-Roundtrip und 1000-Tick-Marathon).
- `node dev/balance.js` → Kraftkurven je Rang in den Bändern, Regions-Beute/Tick monoton.
- `node dev/shots.js` → 12 frische Screenshots im echten Chromium (Handy-Viewport 390×844), keine Browserfehler; darunter taktische Kampfbühne und sichtbarer Auto-Dialog.
- Offline-/HTTP-Smoke-Test: `index.html` lädt alle klassischen Scripts über `file://`; index.html, CSS und alle fünf JS-Dateien liefern lokal HTTP 200 mit korrektem Content-Type.
- Hinweis: Headless-Screenshots (`dev/shots.js`) brauchen Playwright/Chromium unter `/tmp/tempest-shots` + Chromium-Systemlibs (`LD_LIBRARY_PATH=/tmp/chromedeps/usr/lib/x86_64-linux-gnu`); jsdom-Tests brauchen `jsdom@22` unter `/tmp/tempest-domtest`.
