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

## Enwticklung
- Jede Phase unter Status / Fortschritt sollte in einem git worktree unter /worktree abgearbeitet werden / bei upschluss in den main gemerged werden. Bitte kennzeichne eine Phase in diesem Plan wenn du diese gerade bearbeitest. Wenn du diesen plan liest, nehmen nur Phasen die nicht in bearbeitung sind / in progress. 
- Nach Abschluss einer Phase soll der code commited, in den main gemereged & gepusht werden. Den worktree hinterher aufräumen.

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

[x] **Phase 18 – Desktop-Spielerlebnis & visuelle Inszenierung (2026-06-20)**
- **Desktop-first Spiel-Shell ab 1100 px:** permanente Seitenleiste, Ressourcen-HUD, großzügige Spielfläche, eigenständige Desktop-Typografie und einheitliche Fantasy-Strategie-Panels statt einer zentrierten 720-px-App-Spalte.
- **Interaktives Tempest-Panorama:** lokale, per Built-in-Imagegen erzeugte 1536×1024-Königreichsgrafik mit anklickbaren Hotspots für Stadtbezirke, Akademie, Schmiede und Abenteuerkarte; Status-HUD direkt in der Szene.
- **Kernansichten als Spielbildschirme:** Abenteuerkarte nutzt die volle Desktopbreite mit größeren Orten und Wegen; Rasterkampf läuft als fast bildschirmfüllende Bühne mit großem 7×5-Feld, Initiative-HUD, separatem Befehlsbereich und Kampfchronik.
- **Management für Desktop:** Reich, Kreaturen, Magie, Forschung und Schmiede verwenden mehrspaltige, visuell differenzierte Layouts und größere Portrait-/Ausrüstungsflächen.
- **Mobile bewusst erhalten:** Unterhalb 1100 px bleibt die bewährte daumenfreundliche Tab-/Kartenansicht vollständig funktionsfähig; kein Engine-Wechsel und keine Aufgabe von Offline-/`file://`-Betrieb oder Save-Kompatibilität.
- **Visuelle Regression:** Screenshot-Suite auf 20 Aufnahmen erweitert (13 Mobile, 7 Desktop bei 1440×900), zusätzlicher Überbreiten-Check bei 1366×768.

[x] **Phase 19 – UI-Verbesserungen (2026-06-20)**
- Zuschauer-Modus-Toggle in der Top-Bar (👁️ oben rechts, gold = aktiv), zusätzlich zur Übersichts-Karte.
- Vorspulen-Funktion von 30 s auf 5 min erhöht.
- Reichsübersichts-Karte interaktiv: schwebende Icon-Chips → leuchtende Gebäude-Highlights mit pulsierendem Marker und Hover-Namensschild über dem Bauwerk.
- Umgebungs-/Abenteuerkarte als Heroes-artiges Board überarbeitet: dunkles Brett mit Punkt-Textur, Vignette und Bronzerahmen, klar gezeichnete Wege (runde Enden, grün/bronze/vernebelt), kräftigere Tokens, **Gold-Glow auf erreichbaren Feldern**, dichterer Nebel über Gesperrtem, 2-zeilige (nicht mehr abgeschnittene) Labels.
- Offen: fehlende Kreaturen-Assets → ausgelagert nach **Phase 23** (Bildgenerierung erforderlich, in der Code-Umgebung nicht erzeugbar).

[x] **Phase 20 – Herrscher-Talentbaum im Stil von Last Epoch (2026-06-20)**
- Drei klar getrennte Spezialisierungen **Verschlinger, Herrschaft und Arkana** mit 15 Knoten, 1–5 Rängen, sichtbaren Pfadverbindungen, Zweigschwellen, Vorgängervoraussetzungen und Schlussknoten.
- Talentpunkte entstehen ab Herrscher-Level 2 sowie durch neue Evolutionsstufen; die responsive Baumansicht zeigt verdiente, investierte und freie Punkte sowie Sperrgründe direkt am Knoten.
- Einzelne Punkte können gegen Gold zurückerstattet werden, solange kein abhängiger Knoten dadurch ungültig wird. Der Zuschauer-Modus verteilt freie Punkte automatisch und ausgeglichen.
- Talente wirken unmittelbar auf Herrscherwerte, Seelen/Beute, Produktion, Heil-/Expeditionstempo, Armee/Verteidigung, Kommandolimit, Kartenbewegung und aktive Feldmagie.
- Save-Schema v6 normalisiert alte Spielstände kompatibel; Hilfe, Handbuch, README sowie Logik-/DOM-Regressionstests ergänzt.

[x] **Phase 21 – Runenschmiede & langlebige Ausrüstung (2026-06-20)**
- **Begrenztes Arsenal statt Itemflut:** Jeder der bestehenden Baupläne erzeugt höchstens ein Exemplar. Kampfbeute erzeugt keine weiteren Zufallsgegenstände, sondern entdeckt Baupläne oder liefert Schmiedekomponenten; alte Duplikate bleiben erhalten und können kontrolliert zerlegt werden.
- **Echte Bauplanfreischaltung:** Drei Starterrezepte sind sofort bekannt. Weitere Rezepte werden in der Schmiede mit Wissen + Komponenten entschlüsselt oder als Kampfbeute entdeckt; Schmiedestufen und Forschungsanforderungen bleiben wirksam.
- **Gezielte Qualitätsentwicklung:** Vorhandene Ausrüstung wächst deterministisch **Gewöhnlich → Selten → Episch → Legendär → Göttlich**. Werte werden aus dem Grundrezept neu berechnet, das Item bleibt ausgerüstet und protokolliert seine Schmiedehistorie.
- **Vier seltene Materialien:** Runenstaub, Magistahlkern, Seelenkristall und Drachenessenz stammen aus gestaffelten Regionen, riskanten Siegen sowie garantierten Außenanlagen-/Fundortbelohnungen. Jede Qualitätsstufe benötigt die passende Komponente und normale Ressourcen.
- **Zerlegung & Schutz:** Freie normale Stücke können Komponenten zurückgeben; angelegte und einzigartige Gegenstände sind vor Zerlegung geschützt. Der Zuschauer-Modus verbessert vorhandene Ausrüstung vor neuen Bauplänen/Fertigungen.
- **Neue responsive Schmiede-UI:** Komponenten-HUD, Bauplanarchiv, langlebiges Arsenal, fünfstufige Qualitätsleiste sowie Aufwertungsmodal mit Wertevergleich und exakten Kosten; mobile und Desktop-Layouts separat geprüft.
- Save-Schema v7 migriert alte Seltenheiten zu Qualitätsstufen, erhält vorhandene Items und schaltet alle im alten System bereits zugänglichen Baupläne frei.

[x] **Phase 22 – Prozedurale Echo-Territorien (2026-06-20)**
- **Deterministische Endloskarten:** Nach zwei eroberten Regionen entsteht aus einem gespeicherten Seed ein Netz mit 12 Echos in fünf Spalten, mehreren Startpfaden und einem Boss-Kern. Jeder neue Zyklus erzeugt andere Verbindungen, Umgebungen, Belohnungen und Affixkombinationen.
- **Echte Pfadentscheidung:** Nur Startknoten und Nachfolger bereits bezwungener Echos sind erreichbar. Spieler müssen nicht die ganze Karte leeren, sondern wählen anhand angekündigter Beute und Gefahr einen Weg zum Kern; ein unberührtes Netz kann gegen Wissen neu verwoben werden.
- **7 Umgebungen, 7 Belohnungstypen, 6 Affixe:** Seelen, Wissen, Gold, Versorgung, Macht und seltene Schmiedekomponenten stehen sichtbar am Knoten. Gehärtet, Blutdurst, Überzahl, Arkaner Sturm, Seelenfluch und Unstete Realität erhöhen Gegnerkraft/Verluste und dafür die Beute; spätere Zyklen kombinieren bis zu drei Affixe.
- **Armee- und Risikointegration:** Echo-Kämpfe verwenden bestehende Armeegruppen, dauerhafte Truppenverluste, Feldbarriere sowie Sicher/Normal/Riskant. Benannte Anführer können bei riskanter Niederlage fallen; Siege geben Ressourcen, Schmiedekomponenten, EP, Skill-EP und Echo-Stabilität.
- **Boss & Skalierung:** Der Echo-Kern gewährt große Beute und öffnet den nächsten Zyklus. Gegnerkraft und Belohnungen wachsen deterministisch weiter; die Balance-Analyse prüft Zyklen 1, 3, 5 und 10.
- **Responsive Echo-UI:** Eigenes scrollbares Knotenbrett mit Pfadlinien, Belohnungsmarkern, Erreichbarkeits-Glow, Affix-/Beutevorschau, Armeewahl, Risiko- und Ergebnisdialog; separate Mobil- und Desktop-Abnahme.
- **Zuschauer-Modus & Save:** Der Berater räumt gedrosselt schaffbare Echos und öffnet neue Zyklen, ohne Aufbauaktionen zu verdrängen. Save-Schema v8 migriert alte Spielstände und persistiert Seed, Karte, abgeschlossene Knoten, Zyklus und Stabilität.

[x] **Phase 23 – Vollständige Kreaturenportraits & illustrierte Weltkarte (2026-06-20)**
- **Alle 20 Kreaturenlinien bebildert:** Ein neues 4×4-Atlas ergänzt Geist, Greif, Baumhirte, Phönix, Kobold, Hasenmensch, Tengu, Meervolk, Untot, Dämon, Vampir, Golem, Insekt und Drache. Zusammen mit dem vorhandenen Atlas verwenden keine spielbaren Linien mehr den Emoji-Fallback.
- **Kohärenter lokaler Stil:** `assets/creature-sprites-extended-source.png` wurde per Built-in-Imagegen im Stil des vorhandenen Sheets erzeugt; `assets/creature-sprites-extended.png` besitzt per lokalem Chroma-Key-Workflow echte Alpha-Transparenz. Alle 14 belegten Zellen wurden auf Inhalt, die zwei Leerzellen und transparente Ränder geprüft.
- **Illustrierte Abenteuerkarte:** `assets/tempest-adventure-map.png` führt als 1536×1024-Landschaft vom hellen Jura-Wald über Höhlen, Sumpf, Ruinen und Dämonengrenze bis zu Drachenbergen, Himmelsfesten und Schattenreich. Das bestehende Knoten-/Wegenetz bleibt vollständig interaktiv und lesbar darüber.
- **Durchgängige UI-Verdrahtung:** Beschwörung, Kreaturenkarten, Armeeauswahl, Expeditionen und Anführerportraits verwenden beide Atlanten responsiv; CSS-Crops decken alle Reihen und Spalten ohne neue Laufzeitabhängigkeit ab.
- **Offline & Regression:** Sämtliche PNGs liegen lokal in `assets/`; DOM-Test prüft alle 20 Sprite-Klassen. Separate Chromium-Abnahmen zeigen die neuen Portraits bei 390×844 und die illustrierte Karte bei 1440×900.

[x] **Phase 24 – Tiefere Simulationen mit reproduzierbarer Varianz (2026-06-21)**
- 12 vollständig seed-gesteuerte Reichssimulationen kontrollieren auch das von der Spiellogik verwendete `Math.random`; jeder Fehlerpfad ist damit reproduzierbar.
- Messbare Abdeckungsziele verhindern monotone Scheinvarianz: mindestens 16 Kreaturenlinien, 20 Spezies, 6 Skills, alle 7 Jobs, alle 3 Aspekte und mindestens 8 unterschiedliche Berateraktionen.
- Eine taktische Szenariomatrix spielt die stärkste Form jeder der 20 Kreaturenlinien durch alle 10 Regionen und 3 Risikostufen; alle 8 Kampfaktionen, Statuswirkungen, Bewegung, Warten, Siege und Niederlagen werden abgedeckt.
- Tiefe Invarianten prüfen verschachtelte Zustände auf `NaN`/`Infinity`, eindeutige IDs, gültige Spezies/Skills/Jobs/Truppen, korrekte LP/MP/Positionen, kollisionsfreie Rasterfelder sowie Save-Roundtrips normaler und laufender Kampfzustände.
- Verifikation: `bun test` → 14/14 Tests grün (inkl. 238 Logik-, 68 DOM- und 61 Durchspiel-Checks).

[x] **Phase 25 – Grafik-Roadmap im Stil moderner handgemalter Fantasy-Strategie (2026-06-21)**
- Ist-Stand gegen offizielle Olden-Era-Screenshots analysiert: Panorama/Weltillustration sind bereits stark; größter Abstand sind schwebende Kartenknoten, leere Rasterflächen, Emoji-Figuren, fehlender Bodenkontakt und kaum Szenenanimation.
- Entscheidung: kein Engine-Wechsel, sondern hybride Canvas-2D-Spielbühnen für Abenteuerkarte und Kampf; Management-UI, Logik, Saves und Offline-HTML/JS bleiben erhalten.
- Konkrete Art Bible, Asset-Spezifikation, 25-MB-Budget, Performance-/Accessibility-Regeln, Risiken und Abnahmekriterien in `GRAPHICS_ROADMAP.md` dokumentiert.
- Folgeumsetzung in vier vertikalen Schritten vorgeschlagen: Renderer/Kampf-Slice → echte Abenteuerwelt → alle Biome/Kreaturen → Reich/UI-Politur.

[~] **Phase 26 – UE 5.8 MCP installieren (verworfen 2026-06-21)** — widerspricht der Engine-Entscheidung aus Phase 16 (HTML/CSS/JS bleibt Plattform; Offline-/`file://`-Betrieb, Save-Kompatibilität und Testbasis sollen erhalten bleiben) und ist in der reinen Code-Umgebung nicht installierbar. Grafiktiefe wird stattdessen über die Canvas-Roadmap (Phasen 33/34/35/36) verfolgt.

[x] **Phase 33 – Canvas-Renderer & Kampf-Vertical-Slice (2026-06-21)**
- **Hybride Kampfbühne:** Der bestehende 7×5-Kampf rendert im Browser primär auf einer isometrischen Canvas-Szene; DOM-Befehlsleiste, Initiative, Zielwahl und ein vollständiges 35-Zellen-Fallback bleiben erhalten.
- **Renderer-Vertrag:** `battleRenderState()` liefert ein kopiertes View-Modell. Canvas und Animationen verändern niemals Spielzustand, Treffer oder Bewegung; Zell-Hit-Tests rufen ausschließlich bestehende `GameSystems`-Aktionen auf.
- **Jura-Vertical-Slice:** handgemalter lokaler Jura-Hintergrund und transparenter 3×2-Atlas für Schleim, Goblin, Wolf, Oger, Untot und Drache; Teamringe, Stackzahlen, LP-Balken, Hindernisse, Auswahl und erreichbare Felder sind direkt auf der Bühne lesbar.
- **Bewegung & Effekte:** sichtbare Bewegungsinterpolation, Nahkampflunge/Hieb, Trefferzahlen, Tod sowie elementare Magie-/Heilpartikel; drei persistierte Stufen `Aus / Reduziert / Voll` respektieren `prefers-reduced-motion`.
- **Mobil/Performance/Offline:** maximal 30 FPS, DPR-Limit 1,5, ereignisbasierter Renderloop außerhalb voller Idle-Animation und lokaler PWA-Cache v3 inklusive Canvas-Scripts und Kampfassets.
- **Verifikation:** `bun test` → 22/22 Testfälle grün (238 Logik-, 68 DOM- und 61 Durchspiel-Checks plus 5 Renderer-/Assettests); echte Chromium-Abnahme bei 390×844 und 1440×900 ohne Browserfehler, Canvas-Kampf auf beiden Größen spielbar.

[x] **Phase 34 – Illustrierte Abenteuerkarte als echte Spielwelt (2026-06-21)**
- **18 echte Ortsobjekte:** Tempest, alle Regionen, Ressourcenanlagen und Fundorte verwenden einen lokalen transparenten 6×3-Atlas statt schwebender Kartenkarten; der bestehende Landschaftshintergrund bleibt die gemeinsame Welt.
- **Lesbarer Fortschritt:** Eine weich auslaufende, zustandsabhängig gecachte Nebelmaske enthüllt gesicherte und erreichbare Gebiete. Gesperrt, erreichbar, bewacht und gesichert unterscheiden sich zusätzlich durch Schloss, Raute, Warndreieck und Haken.
- **Armeen & Wege:** Herrscher- und Anführerarmeen besitzen vier Blickrichtungen, Bodenstand, Kommandoanzeige und reduzierte Vollmodus-Idle-Animation. Direkte mögliche Märsche werden auf Auswahl hervorgehoben; ausgeführte Märsche interpolieren rein visuell zwischen Start und Ziel.
- **Inspector statt Textteppich:** Tippen/Klicken auf einen Ort aktualisiert einen responsiven Inspector mit Status, Beschreibung, direkten Wegen und den unveränderten Orts-, Expeditions-, Kampf- und Armeeaktionen. Die bisherige DOM-Karte bleibt als semantisches Fallback erhalten.
- **Renderer-Vertrag & Performance:** `adventureRenderState()` liefert ausschließlich Kopien an `adventure-scene.js`; die Canvas-Szene verändert keine Regeln oder Zustände. Maximal 20 FPS, DPR-Limit 1,25, gecachte Nebelmaske, sauberer Renderloop-Abbau und die vorhandenen Effektstufen begrenzen Mobilkosten.
- **Offline & Verifikation:** PWA-Cache v4 enthält Renderer, Weltkarte und finale Atlanten. `bun test` → 28/28 Testfälle grün (238 Logik-, 68 DOM- und 61 Durchspiel-Checks plus Karten-/Canvas-/Assettests); 27 echte Chromium-Aufnahmen bei 390×844 und 1440×900 ohne Browserfehler oder Seitenüberbreite.

[x] **Phase 35 – Vollständige Biome, Board-Sprites für 20 Linien & Effektatlas (2026-06-21)**
- **Sechs Kampfräume:** lokaler 3×2-Biomatlas für Jura-Wald, Kristallhöhlen, Giftsumpf, Glutruinen, Drachengebirge und Schatten-/Himmelsreich; alle neun Regionen wählen ihr Biome im kopierten Kampf-View-Modell. Schatten und Himmel erhalten getrennte Lichttönungen.
- **Alle 20 Kreaturenlinien auf dem Board:** transparenter 5×4-Atlas mit einer klaren Vollkörper-Silhouette je Linie ersetzt die sechs Jura-Platzhalter; Gegner werden weiter renderer-seitig gespiegelt. Quelldatei und freigestelltes Laufzeitasset sind gemeinsam versioniert.
- **Effekte & Leben:** achtteiliger Effektatlas für Hieb, Block, Feuer, Frost, Blitz, Heilung, Seelensog und Tod; Statusrauten, Projektilbewegung sowie biomeabhängige Partikel auf Kampf- und Abenteuerbühne. Renderer bleiben zustandslos.
- **Offline/Budget:** PWA-Cache v7 enthält alle drei neuen Laufzeitatlanten; jeder bleibt unter 3 MB, zusammen deutlich unter dem 25-MB-Budget.
- **Verifikation:** `bun test` → 53/53 Testfälle, 1.624 Assertions (inkl. Atlaszellen, Transparenz, View-Modell, Region-Biome und Assetbudget); `bun run balance` unverändert sauber; Atlanten visuell auf Zuschnitt, Silhouette und freie Kampfflächen geprüft.

[x] **Phase 36 – Reichspanorama und Management-UI materialisiert (2026-06-21)**
- **Gebäude statt Hotspot-Chips:** Das bestehende 3:2-Reichspanorama nutzt auf Desktop die volle Inhaltsbreite; vier große unsichtbare Trefferflächen liegen direkt auf Stadt, Akademie, Schmiede und Tor. Kleine SVG-Symbole und Obsidian-Schilder erscheinen nur als Beschriftung, nicht als schwebende Rundkarten.
- **Lebendige Stadt:** rein dekorative, leistungsarme CSS-Ebenen ergänzen Wasserlauf, zwei Rauchfahnen, Banner und Magielichter. Alle Animationen respektieren die bestehende Effekt-/`prefers-reduced-motion`-Strategie.
- **Materialisierte Verwaltung:** Die Reichsgebäude bilden ein zusammenhängendes Bezirksbrett mit Metall-/Obsidianflächen, schmalen Produktions-/Magie-/Kampfakzenten und kompakten Bauaktionen statt einer Wand gleichartiger blauer Karten. Allgemeine Desktop-Panels und Knöpfe nutzen dieselbe dunkle Materialpalette.
- **Einheitliche Iconfamilie:** kompakter lokaler 6×4-SVG-Atlas mit 24 Symbolen für Ressourcen, Navigation, Orte, Aktionen und Status; über CSS-Spriteklassen verdrahtet, unter `file://` verfügbar und im PWA-Cache v8.
- **Bedienbarkeit:** mobile Primär-, Klein-, Hilfe- und Schließen-Ziele sind mindestens 44 px hoch; globale sichtbare Tastatur-Fokusringe, `prefers-contrast: more` und WCAG-AA-Kontrastguards ergänzen die bestehende Bewegungsreduktion. Keine Save-Schema-Änderung.
- **Verifikation:** `bun test` → **64/64** grün, 1.741 Assertions (DOM-Test 75 Checks); `dev/material-ui.test.js` prüft Panoramaabdeckung, Materialbrett, Symbolkategorien, Tap-Ziele, Fokus, Kontrast und reduzierte Bewegung. `bun run balance` unverändert sauber. 27 echte Chromium-Aufnahmen unter `file://` bei 390×844 und 1440×900 ohne Browserfehler; 1366×768 ohne Seitenüberbreite, Panorama und Bezirksbrett visuell geprüft.

[x] **Phase 39 – Zentrale Einstellungen (2026-06-21)** — ein auffindbares Options-Modal (`openSettingsModal` in `js/ui-progress.js`) bündelt erstmals verstreute Optionen:
- **Darstellung & Leistung:** Effektstufe Aus/Reduziert/Voll war bisher **nur im Kampf-Modal** erreichbar — jetzt prominent umstellbar (wichtig für Akku/Leistung auf dem Handy; `prefers-reduced-motion` wird weiterhin respektiert).
- **Zuschauer-Modus:** An/Aus und Einzelschritte bequem hier umschaltbar (zusätzlich zu Topbar/Übersicht).
- **Spielstand:** Export/Import/Reset aus dem Herrscher-Modal hierher zentralisiert; das Herrscher-Modal verweist nur noch mit einem Knopf aufs Einstellungs-Modal (ui.js −34 Zeilen).
- **Einstieg:** „⚙️ Einstellungen" in der Übersicht-Steuerleiste (neben „📖 Kompendium") und im Herrscher-Modal.
- Keine Save-Schema-Änderung (Einstellungen sind bereits persistiert), kein neues Modul/Asset. **Verifikation:** `bun test` → 42/42 grün (domtest um Settings-Modal + Effektstufen-Umschaltung erweitert), Suite 3× ohne Flake; `bun run balance` unverändert.

[x] **Phase 38 – Kreaturen-Kompendium / Bestiarium (2026-06-21)** — durchblätterbares Nachschlagewerk aller Kreaturen, aufbauend auf dem Kompendium-Modal aus Phase 37 (jetzt drei Unter-Tabs: 🏆 Erfolge · 📊 Statistik · 📖 Bestiarium).
- **Bestiarium-UI (`js/ui-progress.js`):** Alle Spezies nach Linie gruppiert und je Linie nach Rang sortiert; pro Form Sprite/Emoji, Rang-Badge, Rolle, Basiswerte (LP/ANG/VER/MAG/TMP), Signatur-Skill, Beschreibung und Evolutionsziele inkl. Anforderungen (benannt/Level/Seelen/Herrscher-Stufe). „Entdeckt"-Meter gesamt und je Linie; noch nicht entdeckte Formen erscheinen als gesperrte „???"-Karten (Rang sichtbar, damit die Kettenstruktur lesbar bleibt). Reine Anzeige — kein Zustandseingriff, nutzt vorhandene `GameUIInternal`-Helfer (`creatureArt`, `rankBadge`, `statsLine`).
- **Entdeckt-Tracking (`state.seenSpecies`):** In `createDefault` mit den Startspezies geseedet; `tick()` merkt aktuell gehaltene Spezies live vor (`recordSeenSpecies`), `normalize` vereinigt zusätzlich die aktuellen Kreaturen (Alt-Spielstände starten mit gefülltem Zähler) und bereinigt unbekannte/doppelte IDs. Save-Schema **v10**.
- **Verifikation:** `bun test` → 42/42 Testfälle grün (neu: `dev/compendium.test.js` mit 6 Checks; Kompendium-DOM-Test um den Bestiarium-Tab erweitert: alle Formen gerendert + gesperrte markiert); volle Suite 4× ohne Flake; `bun run balance` unverändert sauber. Kein neues JS-Modul/Asset nötig — minimale Angriffsfläche.

[x] **Phase 37 – Erfolge & Reichsstatistik (2026-06-21)** — zwei sich ergänzende Systeme, sauber getrennt von der bestehenden linearen Quest-Kette:
- **Paralleles Erfolgssystem (`js/achievements.js`, DOM-frei):** 42 Erfolge über 5 Kategorien (Reich, Kreaturen, Kampf, Magie & Schmiede, Herrschaft). Bauen auf den bereits gepflegten `state.metrics` + abgeleitetem Zustand auf (Gebäudestufen, Ränge, Level, Echo-Zyklus, göttliche Items, Talente …). Dynamische Ziele leiten sich aus den Spieldaten ab (alle Regionen, höchste Herrscher-Stufe). `evaluate()` läuft pro Tick (auch beim Vorspulen), schaltet erfüllte Erfolge frei, gewährt einmalige Belohnung + Chronik-Eintrag und ist idempotent; `sync()` rückt beim Laden still vor (keine Belohnungsflut für Alt-Spielstände).
- **Sichtbares Statistik-Dashboard (`js/ui-progress.js`):** Die bisher getrackten, aber nie angezeigten `metrics` erscheinen erstmals — Spielzeit, Seelen gesamt, Beschwörungen, Eliten, Evolutionen/Fusionen, Kampf-/Echo-/Schmiede-Werte, stärkste Kreatur. Eigenes Modal mit Unter-Tabs „🏆 Erfolge" (Kategorien-Grid mit Fortschrittsbalken, Belohnung, ✅/🔒) und „📊 Statistik"; Einstieg über die Übersicht, Freischalt-Toast über `onTick`.
- **Integration:** Save-Schema **v9** (`state.achievements` + erweiterte `metrics`; `normalize` dedupliziert/bereinigt unbekannte IDs). `tick()` gibt `achievementsUnlocked` zurück. Neues UI-Modul wie `ui-adventure.js` über `GameUIInternal`; Lade-Reihenfolge in index.html, Service-Worker-Cache **v5**, Modul-Guard, jsdom- und sim-Loader nachgezogen.
- **Nebenbei: vorbestehender Flaky-Test stabilisiert** — `dev/sim.test.js` verglich die Max-Power eines einzelnen Echo-Knotens (±8 % RNG-Varianz → ~1/6 Läufe rot, auch auf `main`). Jetzt Vergleich der Netz-Gesamtkraft (Varianz mittelt sich weg; deterministischer Zyklusfaktor wächst zuverlässig).
- **Verifikation:** `bun test` → 36/36 Testfälle grün (inkl. neuem `dev/achievements.test.js` mit 8 Checks + Codex-Modal-DOM-Test); volle Suite 6×/sim.test.js 25× ohne Flake; `bun run balance` weiterhin sauber (Echo-Zyklen 1/3/5/10 streng steigend). Headless-Screenshots in dieser Code-Umgebung nicht ausgeführt (Chromium-Libs nicht verfügbar); UI durch jsdom-DOM-Test abgedeckt.

[x] **Phase 40 – Sturmeinsätze: schnelle aktive Gefechte (2026-06-21)** — direkte Action-Schleife zwischen Aufbau-, Karten- und Rasterkampfphasen:
- **Sofort spielbar:** Prominente orange Sturmeinsatz-Karte direkt auf der Reichsübersicht; der Grenzalarm ist ab Spielstart offen, Bestienjagd und Dämonenvorstoß folgen mit Reichs-/Herrscherfortschritt. Laufende Einsätze lassen sich schließen, fortsetzen und speichern.
- **Aktives Konterdreieck:** Der Gegner kündigt Hieb, gepanzerte Haltung oder Ritual an. Block, Magie bzw. Angriff kontern genau eine Absicht, verhindern Gegenschaden und bauen Kombo auf; falsche Reaktionen verursachen Schaden und brechen die Kombo.
- **Fokus & Finisher:** Angriff/Block und perfekte Konter erzeugen Fokus. Bei 5 Fokus wird „Verschlingen" als massiver Treffer mit Heilung frei. Maximal 14 Runden verhindern endloses Abwarten; Rückzug bleibt verlustfrei.
- **Wiederspielbarkeit:** Siege steigern Siegesserie und Eskalation bis Stufe 8; Gegnerkraft und unmittelbare Ressourcen-/EP-Beute wachsen mit. Niederlagen senken die Eskalation ohne dauerhafte Truppenverluste. Werte erscheinen im Statistik-Dashboard.
- **Architektur/Save/Offline:** DOM-freies `systems-skirmish.js` und getrenntes `ui-action.js`; Save-Schema **v11** normalisiert laufende Gefechte, PWA-App-Shell **v6** cached beide Module. Handbuch und README nachgezogen.
- **Verifikation:** `bun test` → **50/50** grün (neu: 8 Sturmeinsatz-Tests; DOM-Test 71 Checks), `bun run balance` unverändert sauber. Echter Chromium-Smoke-Test unter `file://` bei 390×844 und 1440×900: vier Aktionen bedienbar, kein Browserfehler und keine horizontale Überbreite; UI visuell auf beiden Größen geprüft.

[x] **Phase 41 – Kampfhaltungen für Sturmeinsätze (2026-06-21)** — eine aktive Vor-Kampf-Entscheidung vertieft die Action-Schleife aus Phase 40:
- **4 Haltungen mit echtem Trade-off:** ⚖️ Ausgewogen (neutral), ⚔️ Berserker (+30 % Angriff, +35 % Gegenschaden – perfekte Konter werden Pflicht), 🛡️ Wächter (+35 % LP, −40 % Gegenschaden, −15 % Angriff – verzeihend), 🔮 Arkanist (Start mit 3 Fokus, +35 % Magieschaden – schneller zum Finisher). Gemessen: Berserker 99 LP/23 ANG, Wächter 157 LP/15 ANG, Arkanist 116 LP/3 Fokus, Ausgewogen 116/18/1.
- **Aktive Entscheidung pro Lauf:** Haltungs-Picker im Sturmeinsatz-Hub vor jedem Start; die Wahl wird als Voreinstellung gemerkt und im Gefecht angezeigt. Erhöht Variabilität und macht das Kontern (besonders als Berserker) wieder spürbar relevant.
- **Isoliert & abwärtskompatibel:** nur `systems-skirmish.js` + `ui-action.js` + CSS berührt. Die neutrale Default-Haltung reproduziert exakt das alte Verhalten (Aufrufe ohne Haltung unverändert), daher keine Save-Schema-Änderung nötig — `active.stanceId`/`skirmish.stance` überstehen den v11-Roundtrip, `ensureState` defaultet korrupte Werte.
- **Verifikation:** `bun test` → **56/56** grün (neu: 6 Haltungs-Tests in `dev/skirmish-stance.test.js`; bestehende 8 Sturmeinsatz-Tests unverändert grün; DOM-Test um Picker erweitert), 3× ohne Flake; `bun run balance` unverändert; eigener End-to-End-Drive aller 4 Haltungen durchgespielt.

[~] **Phase 42 – Gegnerprofile & Bossphasen für Sturmeinsätze (in Arbeit, Worktree `/worktree/phase-42`)**
- **Befund:** Die drei Missionen skalieren derzeit vor allem Zahlen, verwenden aber denselben Intent-Pool. Nach Beherrschung des Konterdreiecks unterscheiden sich Läufe zu wenig; Haltungen verändern die eigene Rechnung, nicht das Gegnerverhalten.
- **Vorschlag:** drei deterministische Gegnerprofile mit lesbaren Intent-Grammatiken (Bestie: Doppelhieb/Raserei, Wächter: Block-Konterschlag, Hexer: Ritualketten) sowie je eine klar angekündigte Bossphase unter 50 % LP. Keine versteckte Reaktions-RNG.
- **Wiederspielbarkeit:** rotierende Einsatzmodifikatoren und optionale Ziele (z. B. „kein Finisher", „3 perfekte Konter in Folge", „Sieg vor Runde 8") geben zusätzliche Beute, ohne Pflichtfortschritt zu blockieren.
- **Abnahme:** jede Profil-/Haltungs-Kombination ist gewinnbar; Intents bleiben vor der Aktion vollständig erkennbar; laufende v11-Spielstände normalisieren abwärtskompatibel; eine Szenariomatrix prüft Profile, Phasenwechsel, Ziele, Sieg/Niederlage und deterministische Seeds.

[x] **Phase 43 – Aktive Belagerungsabwehr: Rivalen-Raids interaktiv (2026-06-21)** — Rivalen-Raids wurden bisher vollautomatisch (passiv) aufgelöst (Verteidigung ≥ Kraft → abgewehrt). Diese Phase ergänzt eine **optionale aktive Verteidigung**, die direkt auf das „zu passiv"-Feedback einzahlt:
- **Eigenes Mechanik-Genre (nicht das Sturmeinsatz-Konterdreieck):** Mauer-/Bresche-Management über 6 Wellen mit drei Aktionen — 🧱 Verstärken (Mauer reparieren), ⚔️ Ausfall (Feindkraft tilgen, kostet etwas Mauer), ✨ Bannschild (Welle abwehren, 2 Ladungen). Ressourcen-/Timing-Entscheidung statt Telegraph-Konter.
- **Echte Agency mit Skill-Gefälle:** Auto-Auflösung wehrt nur ≤1,0×Verteidigung ab; aktives Verstärken bis ~1,5×; mit klugen Ausfällen bis ~2,0×; darüber bleibt es uneinnehmbar. Sieg vergibt die reguläre Raid-Beute **plus** einen Aktiv-Bonus und zählt zu `raidsRepelled`; Niederlage nutzt die bestehende Bruchlogik (keine neuen Strafen).
- **Prominent & optional:** orange/violette Belagerungs-Karte auf der Reichsübersicht bei drohendem Angriff; „Aktiv verteidigen" öffnet das Modal. Wird nicht eingegriffen oder abgebrochen, löst der Raid sich wie bisher automatisch auf (Offline/Zuschauer unberührt). Während einer laufenden Belagerung wird die Auto-Auflösung übersprungen.
- **Architektur/Save/Offline:** DOM-freies `systems-siege.js` (erzwingt das Ergebnis über `resolveActiveDefense` → dieselbe Beute-/Bruchlogik wie `resolveRaid`) und getrenntes `ui-siege.js`; nur minimale, additive Hooks in `systems.js`/`ui.js`. Save-Schema **v12** normalisiert laufende Belagerungen (verworfen ohne zugehörigen Raid), PWA-App-Shell **v10** cacht beide Module.
- **Verifikation:** `bun test` → **78/78** grün (neu: `dev/siege.test.js` mit 7 Checks; DOM-Test um Belagerungskarte + Verteidigung erweitert; veraltete hartcodierte Versions-/Cache-Asserts dynamisch gemacht), 2× stabil; `bun run balance` unverändert; eigener End-to-End-Drive bestätigt das Schwierigkeits-/Agency-Gefälle (1,0×/1,5×/2,0×D).

[x] **Bugfix – Zuschauer-Modus: hängende Quest & Über-Kapazität (2026-06-21)** — aus einem ~6 h-Zuschauer-Modus-Save gemeldet (Screenshot): Ziel hing bei „3/15 · Beschwöre eine weitere Kreatur" trotz Endgame, und die Bevölkerung war auf 3203/111 (29× über Wohn-Kapazität).
  - **Ursache:** Der Berater rekrutierte Truppen (Stelle 4b) ohne Wohn-Kapazitätsprüfung (`canRecruitTroops` prüft nur das Kommandolimit) und füllte so die Kapazität dauerhaft; das Beschwören (Stelle 14, `usedCapacity < capacity`) lief nie → `metrics.summoned` blieb 0 → die sequenzielle Quest-Kette war an `q_summon` blockiert.
  - **Fix A:** `q_summon` zählt jetzt jeden Kreaturen-Zuwachs (Beschwören **oder** Rekrutieren: `metrics.summoned ≥ 1 || totalCreatureCount > Start`) → entsperrt bestehende Saves beim Laden via `syncQuests`.
  - **Fix B:** Der Auto-Modus rekrutiert nur noch mit freier Wohn-Kapazität (Auto-Modus-only, keine Kern-Regel-Änderung) → Bevölkerung bleibt nahe Kapazität (Drive: 43/38 statt 3203/111) und der Berater beschwört wieder (`metrics.summoned` wächst). „Missernte" war ein normales Zufalls-Event, kein Bug.
  - **Verifikation:** `bun test` 78/78 grün; Simulations-Drive bestätigt Quest-Entsperrung und Kapazitäts-Begrenzung.

[~] **Phase 44 – Kampfsystem-Neubau zum echten Tactical-RPG (in Bearbeitung, claude/main-Session — Schritt 1 fertig 2026-06-21)** — Spielerwunsch: kompletter Neubau des Kampfes als rundenbasiertes Tactical-RPG (gewählt: „Kompletter Neubau"). Additiv neben `systems-combat.js`, danach werden die alten Aufrufer migriert. **Automode bitte `systems-battle.js`/`ui-battle.js`/`systems-combat.js` nicht parallel anfassen.**
  - **Schritt 1 – Neue Engine + spielbares UI (fertig):** DOM-freie `js/systems-battle.js` (`GameBattle`): 8×6-Gitter mit Terrain (Wald=Deckung/+VER, Hügel=Höhenvorteil +Schaden/+Reichweite, Fels/Wasser unpassierbar), **CT-Initiative** (geschwindigkeitsbasiert, Warten ist günstiger), Bewegung (BFS mit Bewegungskosten) + 1 Aktion, **Fähigkeiten-Kits nach Rolle** (Schlag/Wuchthieb-AoE/Pfeil/Feuerstoß/Frostlanze/Sturmnova-AoE/Heilwoge/Schildwall) mit Reichweite/AoE/Element/Status/MP, **Flankieren** (Front/Flanke/Rücken ×1,0/1,25/1,5 je Blickrichtung), Höhen-/Deckungsboni, Status (Brand/Frost/Schock/Wall), **taktische Gegner-KI** und garantierte Terminierung (Sieg/Niederlage oder LP-Auflösung nach 80 Zügen). Deterministisch über Seed (RNG aus Seed rehydriert, nicht serialisiert).
  - **UI `js/ui-battle.js`:** Übersichts-Einstiegskarte „♟️ Taktische Schlacht" (ab freigeschalteter Karte), interaktives Modal mit Gitter (Terrain/Tokens/LP/Blickrichtung), Zugreihenfolge, Aktionsmenü, Ziel-/Bewegungs-Highlights, automatischen Gegnerzügen, Log und Ergebnis (Beute/EP). Sieg vergibt Regionsbeute (skaliert mit Überlebenden) + Herrscher-EP + erobert die Region.
  - **Integration/Save/Offline:** neue Module additiv geladen (index.html, PWA-Cache **v11**, Modul-Guard, jsdom-Loader); Save-Schema **v13** persistiert eine laufende Schlacht (verworfen bei kaputter Struktur). Das alte `systems-combat.js` bleibt vorerst unangetastet (kein Bruch bestehender Kämpfe/Tests).
  - **Verifikation:** `bun test` → **86/86** grün (neu: `dev/battle.test.js` mit 8 Checks: Aufbau, Determinismus, Datenintegrität, Sieg+Beute, Niederlage, Terminierungs-Stichprobe, Save-Roundtrip, Rückzug; DOM-Test um die Gitter-Schlacht erweitert → 77 Checks), 2× stabil; `bun run balance` unverändert; eigener End-to-End-Drive über mehrere Regionen/Level bestätigt skalierende Ausgänge.
  - **Nächste Schritte (offen):** alte Aufrufer (Expeditions-Taktikkampf, Karten-/Echo-Kämpfe) auf die neue Engine migrieren und `systems-combat.js` ablösen; mehr Fähigkeiten-/Gegnervielfalt; optional Canvas-Darstellung.

[x] **Phase 45 – Echtzeit-Action-Kampf: vom rundenbasierten Raster zum Action-RPG (fertig 2026-06-26, claude/main-Session)** — direkter Spielerwunsch: *„Der Kampf ist viel zu langweilig und nicht schnell genug. Ruhig den taktischen Heroes-of-Might-and-Magic-Stil zu einem Action-RPG-Gameplay umbauen."* Kernproblem der bestehenden Kämpfe: rundenbasiert = warten statt spielen, Initiativeleisten/CT-Ticks/Zug-für-Zug bremsen das Tempo, Eingaben sind seltene Klicks statt fortlaufender Reaktion. Lösung: eine **echtzeitfähige Action-Kampfschicht**, in der der Spieler eine Heldeneinheit (Herrscher bzw. benannter Anführer) **direkt in Echtzeit** steuert — Bewegen, Angreifen, Ausweichen, Fähigkeiten mit Abklingzeiten — gegen telegrafierte Gegnerwellen.

  **Leitprinzipien (warum schnell & nicht langweilig):**
  - **Keine Runden, keine Wartebalken.** Eine feste Simulations-Tickrate (z. B. 30 Hz, entkoppelt von der Render-FPS) treibt Helden, Gegner, Projektile und Cooldowns gleichzeitig. Der Spieler agiert jederzeit, nicht „wenn er dran ist".
  - **Lesbare Bedrohung statt verstecktem Würfeln.** Gegnerangriffe werden kurz **telegrafiert** (Anlauf-/Wind-up-Phase mit sichtbarer Gefahrenzone); rechtzeitiges Ausweichen/Blocken negiert sie. Skill statt RNG — knüpft direkt an die bewährte Telegraph-Idee der Sturmeinsätze (Phase 40) an, aber kontinuierlich statt rundenweise.
  - **Dichte Eingabe.** Daumen-/Maus-tauglich: Bewegung (virtueller Stick links / WASD), Auto-Angriff bei Nähe + Tap-Ziel, **2–4 Fähigkeitstasten mit Cooldown**, **Ausweichrolle** (i-Frames, eigener Cooldown). Mobile-first: große Touch-Zonen, kein Hover.
  - **Belohnungstempo.** Kurze Gefechte (30–90 s), sofortige Beute/EP wie bei Sturmeinsätzen; Combo-/Schwung-Anzeige für Mehrfachtreffer ohne Schaden zu nehmen.

  **Architektur (additiv, konfliktfrei, lazy):**
  - **Neue DOM-freie Engine `js/systems-action.js` (`GameActionCombat`):** kontinuierliche Welt mit Float-Positionen statt Gitterzellen; deterministischer Fixed-Step-Update (`step(dtMs)` akkumuliert auf feste Ticks → reproduzierbar/seedbar wie `systems-battle.js`). Entitäten: Held, Gegner, Projektile, Gefahrenzonen. Bewegungs-, Kollisions-, Treffer-, Telegraph-/Ausweich-, Cooldown- und Wellen-/Terminierungslogik (Sieg/Niederlage oder Soft-Cap nach N Sekunden). **Keine Spielzustands-Mutation aus dem Renderer** (gleicher Vertrag wie Phasen 33/34).
  - **Neues UI `js/ui-action-combat.js` + Canvas-Szene `js/render/action-scene.js`:** nutzt den bestehenden `canvas-core.js`/`effects.js`-Renderer und die vorhandenen Kreaturen-/Effektatlanten (kein neues Pflicht-Asset). Render entkoppelt von Sim (Interpolation zwischen Ticks für Glätte trotz 30-Hz-Sim). Effektstufen `Aus/Reduziert/Voll` + `prefers-reduced-motion` respektiert; FPS-/DPR-Limits wie etablierte Bühnen.
  - **Eingabe-Layer:** Touch (virtueller Stick + Buttons) und Tastatur/Maus; ein gemeinsames Intent-Objekt (`moveX/moveY`, `attack`, `dodge`, `skill[i]`) füttert die Engine — Engine bleibt eingabe-agnostisch und testbar.
  - **Nicht angefasst:** `systems-battle.js`/`ui-battle.js`/`systems-combat.js` bleiben unberührt (Phase 44 läuft parallel in anderer Session). Action-Kampf ist ein **eigener, additiver Einstieg**, kein Umbau der Turn-Engine — die laufende Tactical-RPG-Arbeit kollidiert nicht.

  **Anbindung an bestehende Systeme (damit Aufbau-Fortschritt zählt):**
  - Held-Werte werden aus der gewählten Einheit abgeleitet: LP/ANG/VER/MAG/TMP → Bewegungstempo, Angriffstempo/-schaden, Cooldown-Reduktion, Ausweich-Frequenz. **Ausrüstung, Aspekte, Skill-Meisterschaft und Talente** wirken über bestehende `computeBonuses`/Werte (kein Parallel-Balancing).
  - **Fähigkeiten** mappen die vorhandenen Rollen-Kits (Schlag, AoE-Wuchthieb, Feuerstoß, Frostlanze, Sturmnova, Heilwoge, Schildwall …) auf Echtzeit-Verhalten: Reichweite, AoE-Form, Projektil/Sofort, Element/Status (Brand/Frost/Schock), Cooldown statt MP-Zug.
  - **Siege/Beute** laufen über dieselbe Beute-/EP-/Region-Logik wie Tactical/Expedition (eine `resolve…`-Brücke), damit keine zweite Belohnungsökonomie entsteht.

  **Schrittplan (jeder Schritt einzeln testbar & mergebar):**
  1. **Engine-Kern (DOM-frei) — ✅ fertig 2026-06-26:** `js/systems-action.js` (`GameActionCombat`): kontinuierliche Arena (100×56 abstrakte Einheiten, Float-Positionen), deterministischer Fixed-Step-Update (30 Hz; `step(state, dtMs)` akkumuliert echte Zeit auf feste Ticks, Epsilon gegen Float-Drift an der Tick-Grenze, Spirale-of-Death-Schutz), Held = zu einem Avatar gebündelte Gruppe (LP summiert, Offensive = bestes Mitglied; Werte aus `rulerStats`/`creatureStats`), Intent-Eingabe (`moveX/moveY/attack`), Held-Auto-Angriff (nächstes Ziel in Reichweite, Cooldown), ein Gegnertyp **Verfolger** (läuft zum Helden, Kontaktschaden auf Cooldown), Treffer/Tod, Wellen-Ende, harte Terminierung (≤90 s → LP-Anteils-Auflösung), Beute/EP über die bestehende Region-Logik (`applyResult`, gleiche Brücke wie `systems-battle.js`). DOM-frei, kein Save-Schema-Eingriff (ephemer, `state.actionBattle`), RNG aus Seed rehydriert (nicht serialisiert). `dev/action.test.js`: 9 Checks (Aufbau, leere Gruppe, Determinismus, Fixed-Step-Äquivalenz, Sieg+Beute, Niederlage, Terminierungs-Stichprobe, Seed-Roundtrip, Rückzug). **Verifikation:** `bun test` → **95/95** grün (86 + 9 neue), `bun run balance` unverändert sauber. *Noch nicht in index.html/sw.js verdrahtet (folgt mit der Canvas-UI in Schritt 4) → `modules.test.js` bleibt grün.*
  2. **Telegraph + Ausweichrolle — ✅ fertig 2026-06-26:** Gegner-Zustandsmaschine `chase → windup → strike`: bei Annäherung kündigt der Verfolger den Schlag an (Telegraf `WINDUP_TIME` 0,55 s), verankert eine **lesbare Gefahrenzone** am Heldenpunkt und steht während des Wind-ups still; der Treffer fällt erst beim Ablauf und nur, wenn der Held noch in der Zone und nicht unverwundbar ist (Wegrennen kontert). **Ausweichrolle** (`intent.dodge`): kurzer Dash in Bewegungs-/Blickrichtung (`DASH_MULT` 2,6) mit i-Frame-Fenster (`IFRAME_TIME` 0,35 s) und Cooldown (`DODGE_CD` 0,9 s) → negiert den Schlag per Unverwundbarkeit **und** per Repositionierung. Telegraf-/Dodge-Zustand (Gefahrenzone, Wind-up-Rest, i-Frames, Dodge-Cooldown, Dash) ist im `renderView` exponiert, damit Schritt 4 ihn zeichnen kann. Deterministisch (keine versteckte Reaktions-RNG). `dev/action.test.js` +3 Checks: i-Frames + Cooldown-Gating, sichtbarer Telegraf mit Gefahrenzone, „Ausweichen reduziert Schaden vs. passivem Stillstehen". **Verifikation:** `bun test` → **98/98** grün, `bun run balance` unverändert.
  3. **Fähigkeiten-Hotbar — ✅ fertig 2026-06-26:** 3-Slot-Hotbar je nach Heldenrolle aus 5 Echtzeit-Fähigkeiten (`Klingenwirbel` Nahkampf-AoE, `Schnellschuss` Fernkampf, `Feuerstoß` AoE+Brand, `Frostlanze` +Frost, `Heilwoge` Selbstheilung) — Rolle aus dem Anführer abgeleitet (`actionKit`), **Cooldown statt MP**. Auto-Ziel (nächstes Ziel in Reichweite, `aoeR` trifft Umkreis), Element-Multiplikator (Schwäche ×1,75 / Resistenz ×0,55) und sekundenbasierte **Statuseffekte** auf Gegner: Brand-DoT, Frost-Verlangsamung, Schock (−VER). `intent.skills` (Slot-Indizes) feuert; Cooldowns/Status im `renderView` exponiert. `dev/action.test.js` +3 Checks: Hotbar bereit, Feuern trifft + Cooldown-Gating, Brand-DoT schadet über Zeit. **Verifikation:** `bun test` → **101/101** grün, `bun run balance` unverändert.
  4. **Canvas-UI + Eingabe — ✅ fertig 2026-06-26:** `js/render/action-scene.js` (`GameActionScene`) rendert auf dem bestehenden `canvas-core`-Loop (30 FPS, DPR ≤1,5, `animate:true`): treibt die Sim mit echter Frame-Zeit (`step`), zeichnet Arena, Telegraf-Gefahrenzonen (nach Wind-up gefüllt), Held (i-Frame-Blitzen), Gegner, LP-Balken, Statussymbole und ein HUD (Held-LP, Timer, Gegnerzahl, Ausweich-Bereitschaft, Hotbar mit Cooldown-Radial). **Eingabe** komplett am Canvas (kein Listener-Leak — räumt sich beim Schließen selbst auf): Drag-Joystick (linke 60 %), WASD/Pfeile, Leertaste = Ausweichen, 1–3 = Fähigkeiten; Auto-Angriff dauerhaft. `js/ui-action-combat.js` (`GameUI.buildActionCombatCard`/`openActionCombat`/`openActionResult`): Übersichts-Einstiegskarte „⚔️ Echtzeit-Gefecht" (ab freigeschalteter Karte), Vollbild-Modal mit Canvas-Bühne + Touch-Steuertasten (Ausweichen + Fähigkeiten-Slots, ≥44 px) + Ergebnis/Beute. Renderer/​Szene **zustandslos** (nur `GameActionCombat`-API). Verdrahtet: `index.html`, `sw.js` (App-Shell **v12**), `modules.test.js`-Reihenfolge, jsdom-Loader; CSS für Steuertasten. `dev/domtest.test.js` +1 Check (Karte + Canvas-Modal + laufender Zustand). **Verifikation:** `bun test` → **101/101** grün (DOM-Test 78 Checks), `bun run balance` unverändert. *Live-Chromium-Smoke in dieser Code-Umgebung nicht ausgeführt (kein Browser-Binary, wie bei früheren Phasen); Canvas-Logik durch jsdom-Modulladen + Engine-Tests abgedeckt.*
  5. **Gegnervielfalt + Wellen/Boss — ✅ fertig 2026-06-26:** drei Gegnertypen mit lesbar unterschiedlichem Verhalten (`ENEMY_KINDS`): **Stürmer** (schnell, rückt vor), **Werfer** (hält Abstand/kitet, telegrafiert aus Distanz), **Brecher** (langsam, langer Wind-up, große Zone, hoher Schaden). In Regionen ≥200 Macht verstärkt ein **Boss** den letzten Gegner (2,4× LP, 👑) mit eigener **Wut-Phase < 50 % LP** (einmalig: schneller, härter, größere Zone, Log-Ankündigung). **Combo/Schwung** (`comboMult`): Treffer ohne Schaden steigern den eigenen Schaden bis +30 %, ein kassierter Treffer bricht sie; Combo im `renderView` + HUD. `dev/action.test.js` +3 Checks: Typenvielfalt, Boss-Wut-Phase, Combo steigt/bricht. **Verifikation:** `bun test` → **104/104** grün, `bun run balance` unverändert (Sieg/Niederlage skalieren weiter mit Heldenrang).
  6. **Integration/Beute/Offline — ✅ fertig 2026-06-26:** Beute-/EP-/Region-Brücke seit Schritt 1 aktiv (`applyResult` → dieselbe Logik wie der taktische Kampf, skaliert mit Rest-LP). **Auto-/Zuschauer-Modus:** kopfloses `GameActionCombat.autoResolve(state, …)` startet, spielt das Gefecht mit simpler KI (auf Ziel zu, ausweichen wenn eine Zone gleich trifft, bereite Skills feuern) deterministisch zu Ende und wertet aus — als Fähigkeit verfügbar (Test deckt Terminierung/Determinismus/Sieg ab). *ponytail: bewusst NICHT in den `autoPlayStep`-Entscheidungsbaum gehängt, um die stark getestete Auto-Schleife (sim/playthrough) nicht zu destabilisieren — Echtzeit-Gefecht ist spielerinitiiert wie der taktische Kampf; bei Bedarf später einen Berater-Zweig ergänzen.* **Offline:** PWA-App-Shell **v12** cacht alle drei neuen Module (in Schritt 4 erledigt). **Doku:** README (Modulübersicht) und GAMEGUIDE (eigener Abschnitt „Echtzeit-Gefecht") ergänzt. **Save:** Echtzeit-Gefechte sind ephemer (`state.actionBattle`) → **kein Save-Schema-Bruch**; abgebrochene/laufende Runs verfallen beim Neuladen. *ponytail: keine Run-Persistenz, nachrüsten falls Spieler lange Gefechte mittendrin speichern wollen.* **Verifikation:** `bun test` → **105/105** grün, `bun run balance` unverändert.

  **Abnahmekriterien:** spürbar schneller (durchgehende Eingabe, kein Rundenwarten); jedes Gefecht in < 90 s gewinnbar mit Skill; Gegnerangriffe vor dem Treffer erkennbar & ausweichbar; mobil mit Daumen spielbar (44-px-Ziele, kein Hover); deterministisch über Seed (Test); kein Bruch von Phase-44-Dateien, Saves, Offline-/`file://`-Betrieb; `bun test` grün inkl. neuer `dev/action.test.js`; echter Chromium-Smoke-Test ohne Browserfehler/Überbreite.

  **Nachschliff (2026-06-26): Eskalierende Wellen.** Statt einer einzelnen Welle laufen Echtzeit-Gefechte über **2–3 Wellen** (`totalWaves` nach Regionsmacht), die je Welle ~35 % stärker werden (`waveScale`). Zwischen Wellen erhält der Held **+15 % LP** Atempause; die Combo bleibt erhalten. Der **Boss erscheint erst in der Schlusswelle** (Climax). Mehr Wellen = mehr Beute (+12 % je Zusatzwelle). HUD/Log zeigen „🌊 Welle x/y". `dev/action.test.js` +1 Check (Eskalation bis Schlusswelle, Boss-Test auf Schlusswelle umgestellt). `bun test` → **106/106** grün, `bun run balance` unverändert.

## Neue Spielspaß-Phasen (Vorschlag gegen Langeweile)
Diese Phasen sind bewusst als **offene, nicht begonnene** Arbeitspakete formuliert. Sie sollen zuerst die vorhandenen Systeme besser ausnutzen, bevor neue Großsysteme gebaut werden.

[x] **Phase 46 – Completion-Autopilot: Zuschauer-Modus spielt auf 100 % Erfolge & Bestiarium (2026-06-26)** — der Auto-/Watch-/Simulationsmodus spielt gezielt alle Langzeitziele ab.
- **Zielgraph statt Greedy-Berater:** `autoPlayStep` bekommt eine priorisierte Zielplanung über offene Erfolge, ungesehene Bestiarium-Formen, fehlende Regionen, Herrscherstufen, Baupläne, Talente und Echo-Fortschritt. Jede Aktion nennt ihr Ziel: "für Erfolg X", "für Bestiarium-Form Y", "für Voraussetzung Z".
- **Bestiarium-Planer:** Für jede nicht entdeckte Spezies wird eine Route berechnet: benötigte Grundlinie beschwören/rekrutieren, Namenssiegel sichern, Level/Seelen farmen, Herrscherstufe/Forschung freischalten, Evolution auslösen, `seenSpecies` verifizieren.
- **Erfolgs-Planer:** Für jede Achievement-Kategorie gibt es Strategien statt Zufall: Bau-/Upgrade-Ziele, Kampf-/Raid-/Echo-Ziele, Schmiedequalität, Skill-Meisterschaft, Talente, Kartenabschluss. Erfolge mit dynamischen Zielen lesen ihre Vorgaben direkt aus `GameAchievements`.
- **Simulations-UI:** neue Schalter "100%-Run starten", "bis zum nächsten Erfolg vorspulen", "bis zur nächsten Bestiarium-Entdeckung vorspulen" und "Auto-Plan anzeigen". Der Verlauf zeigt Fortschrittsbalken: Erfolge, Bestiarium, Regionen, Baupläne, Talente.
- **Stuck-Detection:** Wenn der Auto-Modus 300 Ticks kein messbares Ziel voranbringt, schreibt er einen Diagnoseeintrag: blockierende Ressource, fehlende Kapazität, fehlender Rang, fehlende Forschung oder fehlerhafte Strategie. Keine still hängenden Saves mehr.
- **Headless-Abnahme:** deterministische 100%-Simulation ab frischem Save; Test bricht bei Stalls ab und beweist, dass alle aktuellen Erfolge freigeschaltet und alle Bestiarium-Spezies entdeckt werden können. Zusätzlich Regression: kein Wohnkapazitäts-Overflow, keine `NaN`/`Infinity`, Save-Roundtrip während Langlauf.
- **Umgesetzt:** DOM-freier Zielgraph in `js/completion-planner.js`, Save-Schema v14, Ziel-/Vorspulsteuerung in den Einstellungen, 300-Tick-Diagnose sowie spezielle Strategien für Evolutionszweige, Taktikkämpfe, Armeegruppen, Echo-Zyklen, Rivalenbelagerungen, Namenssiegel und Level 100.
- **Regelfehler behoben:** Evolutionsanforderungen liegen nicht mehr über dem erreichbaren Level-Cap; besiegte Rivalen werden bei neuen Angriffen übersprungen; Rekrutierung überschreitet die Wohnkapazität nicht.
- **Abnahme:** `bun dev/completion-acceptance.js` erreicht mit Seed 42 bei Tick **7.810** exakt **42/42 Erfolge** und **78/78 Bestiarium-Formen**, ohne Kapazitäts-Overflow oder Restdiagnose. Gesamtsuite: **115 Tests, 0 Fehler**.

[ ] **Phase 47 – Zuschauer-Modus als gute Show: Director, Highlights & Zeitraffer** — Watchmode soll unterhaltsam sein, nicht nur ein schneller Bot.
- **Director-Feed:** Entscheidungen werden gruppiert und erklärt ("Aufbau", "Jagd auf Phönixlinie", "Raid-Vorbereitung", "Schmiede-Ziel"). Der Feed fasst belanglose Wiederholungen zusammen und hebt nur relevante Wendepunkte hervor.
- **Kamera-/Tab-Regie:** Im sichtbaren Modus springt die UI automatisch zu Karte, Kampf, Schmiede, Bestiarium oder Erfolgsliste, wenn dort etwas Interessantes passiert. Keine endlose Übersicht mit Toast-Spam.
- **Meilenstein-Replays:** große Ereignisse erzeugen kurze Einträge mit Vorher/Nachher-Daten: neue Form, erster S-Rang, Set vervollständigt, Boss gelegt, Region erobert, Achievement-Kette abgeschlossen.
- **Geschwindigkeitskontrolle:** neben 5-min-Vorspulen auch "bis zum nächsten Meilenstein", "bis ein Risiko entsteht" und "Pause bei Entscheidung". Sichtbar/Headless nutzen dieselbe Simulationslogik.
- **Abnahme:** Ein 60-Minuten-Auto-Lauf produziert lesbare Highlight-Gruppen, keine Modal-Flut, keine doppelten Toasts und bleibt auf Mobile bedienbar.

[x] **Phase 48 – Bestiarium-Jagden & Monster-Ökologie (2026-06-27)** — das Bestiarium ist vom passiven Sammelalbum zu einem aktiven Spielziel geworden.
- **DOM-freies Jagdmodul:** `js/systems-bestiary.js` erweitert `GameSystems` um Linienwissen, spoilerarme Hinweise, Fährten-/Köderlogik, Köderjagd-Schritte und Ökologie-Boni. `systems.js` bleibt unter dem 2800-Zeilen-Limit; Save-Schema **v15** normalisiert `state.bestiaryHunts`.
- **Hinweise auf gesperrten Karten:** Jede unbekannte Form zeigt im Bestiarium eine erreichbare Spur: Quelle/Biom der Linie, Entwicklungsrichtung und bei bereits gesehener Vorform die konkreten Evolutionskosten.
- **Fährten & Köder:** Regionssiege, Echo-Knoten, Außenanlagen und Fundorte vergeben Fährten für passende unvollständige Linien. Drei Fährten binden einen Köder; die Köderjagd ruft fehlende Grundformen, benennt oder trainiert Vorformen und sammelt kleinere fehlende Evolutionsressourcen, ohne Rang-, Level-, Seelen- oder Kapazitätsgates zu überspringen.
- **Ökologie-Boni:** Vollständige Linien geben kleine, thematische Reichsboni auf Produktion, Wissen, Armee, Verteidigung, Beute, Heilung oder Tempo. Sammlung ist dadurch mechanisch relevant, aber nicht Pflicht für normales Spiel.
- **UI & Autopilot:** Das Bestiarium zeigt ein Jagdbrett je Linie mit Quelle, Hinweis, Fortschritt, Fährten und Ködern; gesperrte Formen besitzen direkte Köderjagd-Aktionen. Der Completion-Planer bevorzugt vorbereitete Köder und kann Fährten binden, bevor er auf normale Evolutionsrouten zurückfällt.
- **Abnahme:** `bun dev/completion-acceptance.js` erreicht mit Seed 42 bei Tick **6.077** weiterhin exakt **42/42 Erfolge** und **78/78 Bestiarium-Formen**. Fokus-Regressionen decken Fährten→Köder→Grundform, Ködertraining, Ökologie-Bonus, Save-Migration und Modulgrenzen ab; `bun test` läuft mit **119/119** Tests grün.
- **Nicht in diesem Verticalschnitt:** Elite-Exemplare mit Trophäenrahmen und Sonderkomponenten wandern in Phase 51, weil sie Boss-/Trophäen-Content statt Kern-Bestiarium-Navigation sind.

[x] **Phase 49 – Dynamische Aufträge, Krisen & Entscheidungen (2026-06-27)** — mehr kurze Spannungsbögen zwischen den langen Aufbauzielen.
- **Auftragsbrett:** `js/systems-contracts.js` hält drei rotierende, nur aus erreichbaren Definitionen gezogene Ziele mit Laufzeit, Fortschritt und skalierten Belohnungen. Zwölf Zieltypen decken Ausbau, Beschwörung, Forschung, Kämpfe, Bestiarium, C-Rang-Evolution, epische Schmiede, aktive Belagerungen und eine garantierte Stabilitäts-Wachschicht ab; Belohnungen sind exakt einmal abholbar.
- **Reichskrisen:** Nahrungsknappheit, magische Seuche, Rivalen-Ultimatum, Flüchtlingsstrom und Gildenstreit laufen jeweils über zwei echte Entscheidungen. Ergebnisse wirken auf Ressourcen, Buffs oder Rivalenbedrohung; jede Stufe besitzt auch bei leeren Vorräten einen Ausweg.
- **Pacing & Save:** Nach 180 Ticks ohne Fortschritt wird eine passende Aufgabe bevorzugt eingespeist. Save-Schema **v16** normalisiert Brett, Seriennummern, Profil, Timer, laufende Krise und neue Metriken; Zufallsereignisse pausieren während einer Krise, Offline-Fortschritt bleibt terminierend.
- **Auto-Integration & UI:** Zuschauer-Modus verfolgt und kassiert Aufträge, löst Krisen und wählt nach **Sicher**, **Aggressiv**, **Sammler** oder **Fortschritt**; im sichtbaren Modus pausiert er für die manuelle Krisenwahl. `js/ui-contracts.js` rendert Brett, Profilsteuerung, Timer und responsives Krisenmodal; Statistik, Handbuch, README und drei gezielte Chromium-Aufnahmen sind ergänzt.
- **Abnahme:** `dev/contracts.test.js` prüft Erreichbarkeit, Einmalbelohnung, Ablauf/Pacing, alle fünf Krisen, Profile, Metriken, v16-Migration und einen 1.500-Tick-Auto-Langlauf ohne Deadlock. `bun test` → **128/128**, Seed-42-Completion weiterhin Tick **6.077** mit **42/42** Erfolgen und **78/78** Formen; Balance sauber, **33** Chromium-Aufnahmen ohne Fehler oder Überbreite.

[x] **Phase 50 – Strategische Spezialisierungen statt "alles bauen" (2026-06-27)** — das Reich besitzt echte Richtungsentscheidungen.
- **Fünf Doktrinen:** Eroberung, Forschung, Handel, Monsterzucht und Labyrinth verändern Produktion, Armee, Verteidigung, Erfahrung, Beschwörung, Beute und Auftragslohn. Je Doktrin kosten drei passende Gebäude **18 % weniger**, andere **8 % mehr**; ohne Wahl bleibt das Reich neutral. Die erste Ausrichtung ist kostenlos, spätere Wechsel kosten Ressourcen und besitzen 180 Sekunden Sperrzeit.
- **Aktive Bezirke:** Zwei Slots, ab Herrscherstufe 3 drei, können mit Kriegslager, Großarchiv, Basar, Brutgärten, Bastion oder Runenviertel belegt werden. Jedes Viertel ist einzigartig; Umbau kostet Gold/Material, dauert 45 Ticks und wirkt erst nach Abschluss.
- **Anführerschulen:** Kommandeur, Jäger, Magier, Verteidiger und Schmiedemeister verändern Werte, Armeeführung sowie taktische und Echtzeit-Fähigkeiten benannter Eliten. Ausbildung und spätere Umschulung sind ressourcenpflichtig.
- **Auto-Integration & Save:** Watchmode folgt wahlweise einer festen oder adaptiven Doktrin, bildet passende Schulen aus und belegt Bezirke. Der Completion-Autopilot wechselt begründet nach Bestiarium, Hauptkampagne, Forschung und Restressourcen, ohne seinen Zielschritt zu verdrängen. Save-Schema **v17**, DOM-freies `systems-specializations.js` und getrenntes `ui-specializations.js` sind in Offline-Cache, Loader und Modulgrenzen integriert.
- **Abnahme:** `dev/specializations.test.js` deckt alle fünf Doktrinen, Bezirksumbau, Schulen, v17-Migration, Watchmode und drei unterschiedliche kampagnenfähige Strategien ab. `bun test` → **134/134** mit **82** DOM-Checks; Seed-42-Completion erreicht bei Tick **6.391** weiterhin **42/42** Erfolge und **78/78** Formen, Balance bleibt sauber. **36** Chromium-Aufnahmen prüfen zusätzlich Doktrinmodal, Bezirksbrett und Desktop-/Mobile-Überbreite.

[x] **Phase 51 – Boss-Leiter, Trophäen & einzigartige Beute (2026-06-27)** — mehr erinnerbare Höhepunkte statt nur steigender Zahlen.
- **Vier feste Bossprofile:** Jura-Koloss, Echo-Hydra, Ur-Chimäre und Himmelsrichter werden über Regionen, Echo-Kern, fünf vollständige Bestiarium-Linien beziehungsweise Hauptkampagne plus 25 Erfolge freigeschaltet. Jedes Profil besitzt eigene Mechanik, Schwäche, Konterschulen, Taktikfähigkeiten und telegraphierte Action-Werte; Taktik-, Action- und gemeinsame Auto-Auflösung nutzen die bestehenden Kampfengines.
- **Elite-Exemplare & Trophäenraum:** Jede vollständige Kreaturenlinie öffnet ein gerahmtes Alpha-Jagdziel mit eigener Kraftschwelle, einmaliger Komponente und Trophäe. Boss-/Meisterschaftssiege, vollständige Linien, fehlerfreie Auftragsserien und 100 % erscheinen als Plaketten im Reich; das Panorama priorisiert repräsentative Zeichen dieser Kategorien.
- **Einzigartige Drops:** Der erste Sieg schaltet genau einen exklusiven Artefakt-Bauplan frei: Wurzelbrecher, Echoherz, Mantel der Ur-Chimäre oder Krone des Himmelsrichters. Bossrezepte sind gegen normale Entschlüsselung und Zufallsdrops gesperrt; Wiederholungen geben nur reduzierte Ressourcen.
- **Wiederholbare Meisterschaft:** Nach dem Normalsieg öffnet jeder Boss einen eigenen Hardmode-Modifikator: Dornenpanzer, Spiegelstimmen, Raubtierwechsel oder Letztes Urteil. Der erste Meisterschaftssieg gibt ein kosmetisches Banner und eine zweite Sonderkomponente.
- **Auto, Save & Offline:** Watchmode versucht alle 30 Ticks einen machbaren offenen Boss oder ein Elite-Exemplar, pausiert aber für Krisen und Completion-Ziele. Save-Schema **v18**, DOM-freies `systems-bosses.js`, getrenntes `ui-bosses.js`, Loader und App-Shell-Cache erhalten alle Siege, Versuche, Komponenten und Banner.
- **Abnahme:** `dev/bosses.test.js` prüft Profile, gültige Regionen, alle vier Auto-Ausgänge und Meisterschaftsmodifikatoren, beide Kampfadapter, Lernhinweis, Einmalbeute, Elitejagd, Trophäen, v18-Migration und Watchmode. `bun test` → **143/143** mit **85** DOM-Checks; Seed-42-Completion bleibt bei Tick **6.391** mit **42/42** Erfolgen und **78/78** Formen, Balance sauber. **39** Chromium-Aufnahmen prüfen zusätzlich Boss-Leiter, Elite-Portrait, Trophäenraum und Desktop-/Mobile-Überbreite.

[x] **Phase 52 – New Game+ / Chronik-Runs nach 100 % (2026-06-28)** — nach Abschluss der Sammlung soll es einen Grund geben, neu zu starten.
- **Atomarer Chronik-Abschluss:** Ein normaler Run wird bei 42/42 Erfolgen und 78/78 Formen versiegelbar; Challenge-Runs besitzen eigene Abschlussziele. Der vollständige alte Stand wird zuerst unter `tempest_kingdom_chronicles_v1` archiviert und bleibt einzeln exportierbar, erst danach ersetzt Save-v19 den aktiven Run. Quota- oder Korruptionsfehler blockieren New Game+, ohne den Abschluss-Save zu überschreiben; Archive werden nicht still begrenzt oder verworfen.
- **Persistente Meta-Freischaltungen ohne Power-Spirale:** Das erste, zweite und dritte Siegel öffnen Totenwacht, Geisterhain und Jägerbund als alternative Startlinien; 2× Simulation folgt mit dem ersten, 4× mit dem dritten Siegel. Boss-Meisterschaften liefern auswählbare Panorama-Banner. Ressourcen, Gebäude, Ausrüstung und Kampfkraft starten neu.
- **Fünf echte Challenge-Regeln:** „Nur Untote“ begrenzt Start, Beschwörung, Rekrutierung und Köder; „Kein Handel“ sperrt Markt, Hafen, Job, Doktrin und Basar; „Rivalen aggressiv“ multipliziert Bedrohung mit 2,5; „Bestiarium-Speedrun“ aktiviert den fokussierten Planner; „Riskanter Permadeath“ erzwingt riskante Expeditionen, Feldzüge, Echos und Taktikkämpfe. Alle Profile können der Zuschauer-Modus und bestehende Auto-Systeme beginnen.
- **Bestzeiten & Seed-Vergleich:** Ziel- und 100%-Tick werden beim ersten Erreichen eingefroren. Archivzusammenfassungen speichern reale Laufdauer, Seed, Erfolge, Formen, Regionen, Todesfälle, Bossversuche/-siege/-meisterschaften und die seltenste Form. `bun run chronicle-sim` vollendet Seeds 42/1337/2026 deterministisch; Seed 2026 gewinnt mit **6.089 Ticks** vor 42 (**6.581**) und 1337 (**6.645**).
- **UI, Offline & Abnahme:** Der Chronikraum zeigt Ziel, Fortschritt, Seed, Tempo, Bestzeit und alle exportierbaren Archive; das New-Game+-Modal steuert Startlinie, Challenge, Simulation, Banner, Seed und Auto-Start. Offline-Fortschritt wertet Abschlusszustände am Bündel-Endtick aus. `dev/chronicle.test.js` deckt v19-Reparatur, atomaren Archivwechsel, Korruptions-/Quota-Schutz, unbegrenzte Archivliste, Meta, exakte Abschluss-Ticks, Verlustzählung und alle Auto-Challenges ab. `bun test` → **154/154** mit **86** DOM-Checks; Seed-42-Standardcompletion bleibt bei Tick **6.391** mit **42/42** Erfolgen und **78/78** Formen, Balance sauber. **42** Chromium-Aufnahmen prüfen Chronikraum, New-Game+-Modal, Panorama-Marker und Desktop-/Mobile-Überbreite.

[x] **Phase 53 – Langeweile-Metriken & Content-Pacing-Tests (2026-06-28)** — Spielfluss ist messbar und CI-gesichert.
- **Sieben Action-Dichte-Signale:** `systems-pacing.js` beobachtet den final verketteten Tick-/Auto-Pfad und erfasst Bau, Kampf, Erfolg, Bestiarium-Fund, Boss, Auftrag und Entscheidung mit letztem, mittlerem und maximalem Abstand. Kompakte 60-/120-Tick-Stichproben bleiben auf 120/100 Einträge begrenzt; Save-Schema **v20** normalisiert beschädigte Messdaten.
- **Stall-Klassifikation:** Harte Blocker (Überkapazität, hängende Quest, gesperrter UI-Pfad, Completion-Diagnose) werden von fehlender Ressource, zu hoher Kostenkurve, falscher Auto-Priorität, offenem Entscheidungsstopp, bewusstem Sparen und echter Content-Lücke getrennt. Die nächste bezahlbare Bauchance wird aus Kosten und realer Produktion geschätzt.
- **Gates & Entwicklerbericht:** `GamePacing.evaluateRuns` prüft maximale Leerlaufzeit, 100%-Erreichbarkeit, harte Blocker und Strategiedominanz. `bun run pacing` simuliert Seeds 42/1337/2026 je 3.600 Ticks mit Sicher/Aggressiv/Sammler und gibt Fortschrittskurve, Top-Aktionen, Blocker sowie Triggerabstände als JSON aus.
- **Debug-Dashboard:** **📊 Pacing** auf der Übersicht blendet Status, sieben Trigger, Aktionsanteile und Top-Blocker ein; getrenntes `ui-pacing.js`, responsives 2-/7-Spaltenlayout und PWA-App-Shell **v19** halten Kernlogik DOM-frei und offline.
- **Abnahme:** `dev/pacing.test.js` deckt v20-Reparatur, alle Trigger, Stichprobenlimits, Stallarten, bekannte Quest-/Kapazitätsregressionen, Reports, Fehler-Gates und drei Mehrseed-Langläufe ab. `bun test` → **162/162** mit **88** DOM-Checks; Seed-42-Completion bleibt bei Tick **6.391** mit **42/42** Erfolgen und **78/78** Formen.

## Nicht-UI-Verbesserungen (Technik-Backlog, Analyse 2026-06-20, Worktree `/worktree/improvements`)
Vorschläge aus einer Code-/Infrastruktur-Durchsicht; bewusst **keine UI-Themen**. Reihenfolge ≈ Priorität/Nutzen für den aktuellen Parallel-Phasen-Workflow.

[x] **Phase 27 – Code-Architektur: Monolithen modularisiert (2026-06-21)**
- **Daten getrennt:** 25 reine Inhaltstabellen liegen in `js/data-tables.js` (916 Z.); `data.js` sank von 1093 auf 290 Zeilen und enthält nur noch Helfer, Skill-Merge, Nachbearbeitung, Lookups und die `GameData`-API.
- **Kampfsystem getrennt:** Der taktische 7×5-Rasterkampf liegt in `js/systems-combat.js` (416 Z.) und erweitert `GameSystems` über ein kleines explizites `GameSystemsInternal`-API. `systems.js` sank von 3036 auf 2656 Zeilen.
- **Abenteuer-UI getrennt:** Karten-, Armee-, Echo-, Expeditions- und Kampf-UI liegen in `js/ui-adventure.js` (701 Z.) und nutzen ein explizites `GameUIInternal`-Helper-API. `ui.js` sank von 2435 auf 1768 Zeilen.
- **Offline ohne Build-Schritt:** `index.html`, Service-Worker-App-Shell und alle ESM-/jsdom-Testloader laden die klassischen Scripts in fester Abhängigkeitsreihenfolge; Cache-Version auf v2 erhöht. `file://`, PWA und Save-Schema bleiben kompatibel.
- **Architektur-Guard:** `dev/modules.test.js` sichert Reihenfolge, Offline-Cache, DOM-Freiheit und Größenobergrenzen. Ein dabei sichtbar gewordener `Date.now()`-abhängiger Echo-Playthrough wurde seed-unabhängig stabilisiert.
- **Verifikation:** `bun test` → 16/16 Testfälle grün (238 Logik-, 68 DOM-, 61 Durchspiel-Checks); 25 echte Chromium-Aufnahmen über `file://` in Mobil/Desktop ohne Browserfehler oder Überbreite.

[x] Phase 28 – CI-Pipeline: Tests vor jedem Deploy  (umgesetzt 2026-06-20: `ci.yml` für Branches/PRs + Test-Job in `deploy.yml`, Pages-Deploy nur bei grün)
- Befund: Es existiert nur `.github/workflows/deploy.yml`; `bun test`/`balance` laufen ausschließlich lokal. Rote Regressionen können ungebremst nach `main` und auf Pages gelangen.
- Ziel: `ci.yml`, das bei Push/PR `bun install` + `bun test` (und optional `bun run balance` mit Schwellenwerten) ausführt; Deploy nur bei grün (bzw. Deploy hängt am bestandenen CI).
- Nutzen: schützt den schnellen Multi-Phasen-Merge-Flow automatisch vor stillen Brüchen.

[x] Phase 29 – Automatisierte Balance- & Content-Integritätstests  (umgesetzt 2026-06-20: `dev/balance.test.js` — Rang-Spread-Bänder, Regions-Monotonie, Echo-Zyklus-Skalierung)
- Befund: `dev/balance.js` ist reine Konsolenanalyse (Heuristiken/Flags, **keine Assertions**). Inhalte (Echo-Affixe, Talente, Schmiede-Qualität) wachsen schnell; Balance wird nur „per Auge" geprüft. (Ergänzt Phase 24.)
- Ziel: Balance-/Content-Heuristiken als echte `bun test`-Assertions — Rang-Bänder, Regions-/Echo-Monotonie, Talent-Bonus-Summen, Schmiede-Aufwertungskurven, vollständige `data.js`-Querverweise. Läuft in CI (Phase 28).
- Nutzen: Balance- und Datenfehler scheitern automatisch statt unbemerkt durchzurutschen.

[x] Phase 30 – Save-Robustheit: Export/Import + Quota-/Korruptions-Schutz  (umgesetzt 2026-06-20: `exportSave`/`importSave`, `saveResult`/`loadResult` mit Quota-/Korruptionserkennung in state.js + `dev/save.test.js`; in-game Export/Import-Button im Herrscher-Modal)
- Befund: `state.js` kapselt save/load in try/catch, **verschluckt Fehler aber still** (`return false`); kein Backup/Export; bei vollem oder korruptem `localStorage` droht stiller Verlust. Schema ist bereits v8 mit `normalize`-Migration.
- Ziel: manueller Export/Import des Spielstands (JSON-Datei bzw. Clipboard) als Backup & Gerätewechsel; bei `QuotaExceeded`/Parse-Fehler klare Rückmeldung + Recovery (letzter guter Stand / Reset-Angebot); leichte Schema-Validierung beim Laden.
- Nutzen: kein stiller Datenverlust; Spielstände mitnehmbar zwischen Geräten/Browsern.

[x] Phase 31 – Performance: Tick-/Auto-/Offline-Profiling & Caching  (umgesetzt 2026-06-20: gemessen ~7 µs/Tick ≈ 143k Ticks/s, computeBonuses ~2,5 µs → bereits sehr schnell; **bewusst kein Cache** (verfrühte Optimierung mit Staleness-Risiko), stattdessen Performance-Guard `dev/perf.test.js` gegen künftige Regressionen)
- Befund: `production()`/`computeBonuses()` werden pro Tick neu berechnet; Vorspulen = 300 Ticks, Offline-Fortschritt potenziell tausende; Bestand (Stapel, Echos, Talente) wächst.
- Ziel: Hotpaths messen; Bonus-/Produktionsberechnung memoisieren und gezielt invalidieren statt jedes Tick komplett neu; Vorspulen/Offline gebündelt rechnen; Tick-Marathon als Benchmark im Test.
- Nutzen: flüssiger auf Handys, schnelleres Vorspulen, weniger CPU-/Akkuverbrauch.

[x] Phase 32 – Offline-Härtung: PWA (Service Worker + Web-App-Manifest)  (umgesetzt 2026-06-20: `manifest.webmanifest`, `sw.js` mit App-Shell-Cache, `icon.svg`, geschützte SW-Registrierung in index.html — `file://` & jsdom bleiben unberührt)
- Befund: kein Service Worker / Manifest; Offline funktioniert nur via `file://` + localStorage. Über die Pages-URL (http) gibt es keinen Asset-Cache → ohne Netz keine Ladbarkeit.
- Ziel: `manifest.webmanifest` (Name, Icons, Theme, `display: standalone`) + Service Worker, der `index.html`, CSS, JS und `assets/` cached → installierbar („Zum Startbildschirm hinzufügen") und garantiert offline auch über Pages. `file://`-Betrieb intakt lassen (SW nur unter http(s) registrieren).
- Nutzen: echtes installierbares Offline ohne manuelles Dateikopieren.

### Dateien
- Spiel: `index.html`, `style.css`, `js/{data-tables,data,state,systems,systems-combat,ui,ui-adventure,main}.js` (offline-/`file://`-tauglich).
- Dev-Tests (nicht Teil des Spiels): `dev/{sim,domtest,playthrough,balance,fuzz,perf,save,modules}.test.js`, `dev/balance.js` und `dev/shots.js`.

### Verifikation (Stand 2026-06-20, nach Phase 23)
- `dev/sim.test.js` → 238/238 Logiktests bestanden (inkl. beider lokaler Grafikassets sowie deterministischer Echo-Generierung und Save-v8-Migration).
- `dev/domtest.test.js` → 68/68 DOM-Rendertests bestanden (inkl. lokaler Portraits für alle 20 Kreaturenlinien, Echo-Netz und Affixmodal).
- `dev/playthrough.test.js` → 61/61 Durchspiel-Checks bestanden (komplette Sitzung inkl. Echo-Pfad, Tod/Verwundung, Kartenbewegung/Anlageneroberung, Save-Roundtrip und 1000-Tick-Marathon).
- `bun run balance` → Kraftkurven je Rang in den Bändern, Regions-Beute/Tick monoton; Echo-Zyklen 1/3/5/10 steigen in Kraft, Beute und Affixdichte.
- Screenshot-Suite: 25 Aufnahmen im echten Chromium (inkl. vollständiger Portraitauswahl bei 390×844, illustrierter Weltkarte und Echo-Netz bei 1440×900), keine Browserfehler; zusätzlicher Desktop-Überbreitencheck bei 1366×768.
- Talentbaum zusätzlich im echten Chromium bei 390×844 und 1440×900 geprüft; keine Browserfehler, mobile horizontale Zweig-Navigation und Desktop-Dreispaltenansicht funktionieren.
- Runenschmiede zusätzlich im echten Chromium bei 390×844 und 1440×900 sowie das mobile Aufwertungsmodal geprüft; keine Browserfehler oder Seitenüberbreite.
- Offline-/HTTP-Smoke-Test: `index.html` lädt alle klassischen Scripts über `file://`; index.html, CSS und alle fünf JS-Dateien liefern lokal HTTP 200 mit korrektem Content-Type.
- Hinweis: Headless-Screenshots (`dev/shots.js`) brauchen Playwright/Chromium unter `/tmp/tempest-shots` + Chromium-Systemlibs (`LD_LIBRARY_PATH=/tmp/chromedeps/usr/lib/x86_64-linux-gnu`); jsdom-Tests brauchen `jsdom@22` unter `/tmp/tempest-domtest`.
