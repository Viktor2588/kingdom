# Grafik-Roadmap: Tempest × handgemalte Fantasy-Strategie

Stand: 2026-06-21
Status: Ergebnis von Phase 25 (Konzept, keine Engine-Migration)

## Entscheidung

Tempest behält HTML/CSS/JavaScript und erhält eine **hybride 2D-Rendering-Schicht**:

- DOM bleibt für Navigation, Management, Modals, Tooltips und Barrierefreiheit.
- `<canvas>` rendert nur die beiden bildintensiven Spielbühnen: Abenteuerkarte und Rasterkampf.
- Spielzustand, Save-Schema und `GameSystems` bleiben die einzige Wahrheit; Renderer lesen Zustand und senden vorhandene Aktionen zurück.
- Alle Assets bleiben lokal. Kein CDN, kein Build-Schritt und keine sofortige UE-/WebGL-Migration.

Das Ziel ist nicht, die 3D-Produktion eines kommerziellen Spiels zu kopieren. Das Ziel ist dieselbe **visuelle Hierarchie und Lesbarkeit** mit vorgerenderten 2D-Assets: Welt zuerst, Figuren zweitens, UI als Rahmen statt als dominierende Fläche.

## Referenzanalyse

Primärquelle: [offizielle Steam-Seite und Screenshots von Heroes of Might and Magic: Olden Era](https://store.steampowered.com/app/3105440/Heroes_of_Might_and_Magic_Olden_Era/).

Die Referenz funktioniert visuell durch sechs wiederkehrende Mittel:

1. **Begehbare Welt statt Diagramm:** Wege, Flüsse, Berge und Engpässe bilden die Navigation. Ziele stehen als Bauwerk oder Objekt in der Landschaft, nicht als Karten-UI.
2. **Dreiviertel-/isometrische Perspektive:** Landschaft, Gebäude und Einheiten teilen Blickwinkel, Licht und Bodenkontakt.
3. **Klar getrennte Biome:** Jede Region besitzt eigene Bodenfarben, Vegetation, Silhouetten, Partikel und Lichtstimmung.
4. **Lesbare Einheiten:** Vollkörper-Silhouetten sind auch ohne Text unterscheidbar; Teamfarbe und Bodenring reichen als Statusmarkierung.
5. **Materialisierte UI:** Metall, Stein, Pergament und ornamentale Rahmen wirken wie Teil der Welt. Die UI ist kompakt und lässt der Szene den meisten Platz.
6. **Gezielte Bewegung:** Idle-Loops, Fahnen, Rauch, Wasser, Projektile, Trefferblitze und Kamerareaktion erzeugen Leben; nicht jedes Element animiert gleichzeitig.

## Ist-Stand und größter Abstand

| Bereich | Bereits stark | Hauptproblem | Ziel |
|---|---|---|---|
| Reichsübersicht | Handgemaltes Tempest-Panorama, klare Hotspots | Hotspots sind runde Emoji-Chips | Gebäude selbst leuchten/reagieren; kleine animierte Weltakzente |
| Abenteuerkarte | Große illustrierte Weltkarte, echtes Wegenetz | Schwebende Rechteck-/Kreisknoten verdecken die Landschaft | Orte als Bauwerke/Fundobjekte direkt im Terrain, Pfade und Nebel als Kartenebenen |
| Rasterkampf | Funktionierendes 7×5-System, Reichweite, Initiative, Status | Farbige leere Zellen und Emojis wirken wie Debug-UI | Isometrisches Schlachtfeld, Vollkörper-Sprites, Props, Effekte und kurze Animationen |
| Kreaturen | Portraits für alle 20 Linien | Portrait-Crops eignen sich nicht als Spielfiguren | Separater Board-Sprite-Atlas mit konsistenter Dreiviertelansicht |
| Management-UI | Klar und responsiv | Viele gleichartige blaue SaaS-Karten | Weniger Rahmen, stärkere Material- und Fraktionsakzente |

Die Reihenfolge ist deshalb eindeutig: **Kampf-Vertical-Slice → Abenteuerkarte → Reich → Management-Politur**. Ein neues allgemeines UI-Theme ohne neue Spielbühnen würde den sichtbaren Abstand kaum verkleinern.

## Technische Architektur

### Neue Dateien

```text
js/render/
  canvas-core.js       DPR, Kamera, Asset-Lader, Renderloop, Hit-Test
  adventure-scene.js   Landschaftsebenen, Orte, Wege, Nebel, Armeen
  battle-scene.js      Isometrisches 7×5-Feld, Einheiten, Props, Effekte
  effects.js           Tweening, Partikel, Trefferzahlen, Screen-Shake
js/art-data.js         Sprite-/Terrain-Metadaten; keine Spiellogik
assets/world/          Kartenobjekte, Nebelmasken, Armee-Marker
assets/battle/         Biome, Props, Einheiten, Effekte
```

### Rendering-Vertrag

- `GameSystems` verändert ausschließlich Zustand und Kampflogik.
- Renderer erhalten nur normalisierte View-Modelle, etwa `battleRenderState(state)`.
- Klick/Tap wird in logische Karte-/Rasterkoordinaten übersetzt und ruft bestehende Aktionen wie `moveArmyGroup`, `battleMove` oder `battleAction` auf.
- DOM-Buttons bleiben als Befehlsleiste erhalten. Canvas zeichnet keine kritischen Texteingaben oder Menüs.
- Animationen bestätigen bereits berechnete Ergebnisse; sie entscheiden niemals über Schaden oder Bewegung.

### Performance-Budget

- Canvas nur bei sichtbarer Karte/Kampf aktiv; im Ruhezustand eventbasiert statt permanent 60 FPS.
- Animationen mit maximal 30 FPS auf Mobilgeräten; `devicePixelRatio` auf 1,5 begrenzen.
- Vorgerenderte Hintergrundebenen cachen; Nebel und Markierungen getrennt aktualisieren.
- `prefers-reduced-motion` und eine Spieloption **Effekte: Aus / Reduziert / Voll**.
- Zielbudget für neue komprimierte Assets: **maximal 25 MB**, kein Einzelasset über 3 MB.

## Art Bible

### Perspektive und Licht

- Dreiviertelansicht von schräg oben, Licht grundsätzlich links oben.
- Jede Figur benötigt Kontakt- und weichen Fallschatten; keine schwebenden Sticker.
- Formen zuerst lesbar machen, Details erst danach. Kleine Einheiten erhalten überzeichnete Waffen/Köpfe.
- Tempest-Farbwelt: Waldgrün, Magie-Cyan, warmes Gold; Feinde über Violett/Rot statt über graue Transparenz trennen.

### Materialien

- Rahmen: dunkles Eisen/Obsidian, schmale Goldkante, leichte Gebrauchsspuren.
- Flächen: Pergament nur für Chronik/Erklärung; dunkler Stein für Befehlsleisten.
- Keine flächigen Neonrahmen um jedes Panel. Glühen nur für Magie, Auswahl und erreichbare Ziele.

### Biome

1. Jura-Wald: Moos, Wurzeln, Farn, warmes Streulicht.
2. Höhlen/Magistahl: dunkler Fels, cyanfarbene Kristalle, Nebelschleier.
3. Giftsumpf: Wasserlachen, Schilf, Pilze, grüne Dämpfe.
4. Ruinen/Dämonengrenze: gebrochener Stein, Glutadern, Asche.
5. Drachengebirge: Schnee/Fels, Windfahnen, Eispartikel.
6. Schatten-/Himmelsreich: violette Leere beziehungsweise helle Wolkeninseln.

## Asset-Spezifikation

### Kampf-Vertical-Slice

Zuerst nur Jura-Wald und sechs Linien: Schleim, Goblin, Wolf, Oger, Untot und Drache.

Pro Einheit:

- Transparenter Atlas, Dreiviertelansicht, Blick nach rechts; Gegner werden gespiegelt.
- Basiszelle 256×256 px, visuelle Figur etwa 180×220 px.
- Animationen: `idle` 4 Frames, `attack` 6, `hit` 3, `death` 6.
- Optional `cast` 6 Frames für Magier.
- Separater elliptischer Bodenring für Team/Auswahl, nicht in das Sprite eingebrannt.

Pro Schlachtfeld:

- Hintergrund 1920×1080 px mit freier Kampffläche in der Mitte.
- Nahtlose isometrische Boden-Diamanten oder ein vorgerenderter Boden plus Koordinatenmaske.
- 12–20 Props mit transparentem Hintergrund: Felsen, Baumstümpfe, Kisten, Kristalle, Ruinen.
- Effektatlas: Hieb, Block, Feuer, Frost, Blitz, Heilung, Seelensog, Tod.

### Abenteuerkarte

- Bestehende 1536×1024-Illustration bleibt Basis.
- 18 Ortsobjekte als transparente, perspektivisch passende Cutouts statt Emoji-Knoten.
- 3 Zustände je Ort: Nebel-Silhouette, entdeckt, gesichert/ausgebaut.
- Armee-Marker: 4 Richtungen × 4 Gehframes, 128×128 px.
- Wege als gezeichnete Ebene unter Objekten; erreichbarer Weg erhält nur einen dezenten Goldlauf.
- Nebel als weiche Maske mit freigelegten Radien statt grauer Deckkraft pro Knoten.

## Umsetzungsphasen

### Phase 33 – Renderer-Grundlage und Kampf-Vertical-Slice (umgesetzt 2026-06-21)

- `canvas-core.js`, Asset-Manifest, Kamera, Skalierung und Hit-Test.
- Jura-Wald-Schlachtfeld und sechs animierte Einheitenlinien.
- Bewegung, Angriff, Treffer, Tod und drei Magieeffekte sichtbar animieren.
- Logisches 7×5-Raster bleibt unverändert; DOM-Befehlsleiste bleibt Fallback.

Abnahme:

- Kampf ist bei 390×844 und 1440×900 spielbar.
- Einheit, Team, Stackzahl, LP und erreichbare Felder sind ohne Tooltip erkennbar.
- 30 FPS auf einem mittleren Mobilprofil; reduzierte Bewegung funktioniert.
- Bestehende Logik-/Save-Tests unverändert grün.

### Phase 34 – Illustrierte Abenteuerkarte als echte Spielwelt (umgesetzt 2026-06-21)

- Kartenknoten durch Ortsobjekte ersetzen.
- Weiche Nebelmaske, animierte Armeen, Wegvorschau und Umgebungsakzente.
- Details erscheinen in einem seitlichen/unteren Inspector, nicht dauerhaft auf der Karte.

Abnahme:

- Kein wesentlicher Ort verdeckt einen anderen oder wird von UI abgeschnitten.
- Gesperrt, erreichbar, bewacht und gesichert sind farb- und formunabhängig unterscheidbar.
- Alle bestehenden Pfad-, Fundort- und Armeeaktionen bleiben erreichbar.

Umgesetzt mit einem transparenten 6×3-Ortsatlas, einem 4×2-Armeeatlas, weich gecachter
Nebelmaske, vier formverschiedenen Statusmarkern, animierter Wegvorschau und
responsivem Ortsinspektor. Die Canvas-Schicht konsumiert nur das kopierte
`adventureRenderState()`; DOM-Fallback, Spielregeln und Save-Schema bleiben unverändert.

### Phase 35 – Alle Biome, Kreaturen und Effekte (umgesetzt 2026-06-21)

- Sechs Biome für Karte/Kampf.
- Board-Sprites für alle 20 Kreaturenlinien und wichtige Evolutionssilhouetten.
- Vollständiger Effektatlas, Statussymbole, Projektile und Umgebungsanimationen.

Abnahme:

- Keine Emoji-Figur mehr auf Karte oder Schlachtfeld.
- Jede Linie ist bei 64–96 px sichtbarer Höhe anhand ihrer Silhouette erkennbar.
- Assetbudget und Ladezeit bleiben innerhalb der definierten Grenzen.

Umgesetzt mit einem 3×2-Biomatlas, transparentem 5×4-Atlas für alle 20
Kreaturenlinien und einem 4×2-Effektatlas. Regionen wählen das Biome im
kopierten Kampf-View-Modell; Status, Projektile und Umgebungsakzente bleiben
reine Darstellung. Die drei Laufzeitassets bleiben einzeln unter 3 MB und
zusammen deutlich unter dem 25-MB-Budget.

### Phase 36 – Reich und UI materialisieren (umgesetzt 2026-06-21)

- Panorama-Hotspots auf echte Gebäudeflächen legen; Rauch, Wasser, Banner und Magielicht.
- Allgemeine Kartenmenge reduzieren und Rahmen auf Obsidian/Metall/Pergament vereinheitlichen.
- Einheitliche Iconfamilie für Ressourcen, Aktionen, Status und Orte.

Abnahme:

- Szene nimmt auf Desktop mindestens 70 % der sichtbaren Fläche ein.
- Mobile Tap-Ziele bleiben mindestens 44 px groß.
- Kontrast, Fokuszustände und `prefers-reduced-motion` bestehen automatisierte Checks.

Umgesetzt ohne weitere Rasterproduktion: Das vorhandene Reichspanorama nutzt
die volle Desktop-Inhaltsbreite und erhält Wasser-, Rauch-, Banner- und
Magielicht-Ebenen aus CSS. Große Gebäudeflächen bleiben die Trefferziele; nur
bei Fokus/Hover erscheinen kompakte Obsidian-Schilder. Die Reichsverwaltung
ist ein zusammenhängendes Bezirksbrett statt einer Kartenwand. Ein lokaler
24-Symbol-SVG-Atlas vereinheitlicht Ressourcen, Navigation, Orte, Aktionen und
Status. 44-px-Tapziele, sichtbarer Tastaturfokus, AA-Kontrastguards,
`prefers-contrast` und `prefers-reduced-motion` sind automatisiert abgesichert.

## Produktionsworkflow

1. Erst Graubox/Hit-Test mit farbigen Platzhaltern.
2. Ein einziges vollständiges Jura-Vertical-Slice abnehmen.
3. Stil-Prompt und Referenzblatt fixieren; erst danach Assets in Serie erzeugen.
4. Generierte Assets manuell auf Perspektive, Licht, Silhouette und transparente Ränder prüfen.
5. Quelldatei und final komprimiertes PNG/WebP gemeinsam versionieren; Manifest enthält Crop/Frame-Daten.
6. Jede Ausbaustufe in echter Mobil-/Desktop-Chromium-Suite prüfen.

## Bewusste Nicht-Ziele

- Kein fotorealistisches 3D und kein Nachbau geschützter Olden-Era-Assets.
- Kein UE-Wechsel für das bestehende Browserspiel.
- Keine komplette Neugestaltung aller Managementscreens vor dem Kampf-Vertical-Slice.
- Keine Animation, die Eingaben blockiert; Kampfgeschwindigkeit bleibt einstellbar.

## Hauptrisiken

- **Stil driftet zwischen Asset-Chargen:** festes Art-Bible-Referenzblatt und Abnahme pro Linie.
- **Sprites sehen als Portrait gut, in 80 px aber schlecht aus:** Silhouettentest vor Detailarbeit.
- **Canvas verschlechtert Bedienbarkeit:** DOM-Inspector/Befehle und versteckte zugängliche Beschriftungen beibehalten.
- **Dateigröße explodiert:** Framezahl begrenzen, Atlanten packen, WebP nur mit PNG-Fallback, Budgets in CI prüfen.
- **Renderer und Logik koppeln sich:** Render-View-Modelle testen; Animationen dürfen Zustand nie selbst mutieren.
