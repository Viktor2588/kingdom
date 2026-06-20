# Tempest — Königreich der Monster

Ein **Königreich-Builder fürs Handy & den Browser** im Universum von *That Time I Got
Reincarnated as a Slime* (Tensura), mit strategischer Karte im Stil von *Heroes of Might
and Magic*: Basistruppen automatisch in der Herrscherarmee stapeln, bis zu 20 Eliten
benennen, entwickeln und fusionieren, benannte Anführer über die Weltkarte bewegen, Magie erforschen, Ausrüstung schmieden,
Auto-Expeditionen oder taktische 7×5-Rasterkämpfe mit Bewegung, Initiative und Gegenwehr bestreiten und ein Reich gegen
Rivalen-Dämonenlords verteidigen. Der Herrscher spezialisiert sich zusätzlich über einen
Last-Epoch-artigen passiven Talentbaum mit drei Zweigen und einzeln steigerbaren Knoten.
Die Runenschmiede folgt demselben Prinzip: ein begrenztes Arsenal ohne Zufallsduplikate,
freischaltbare Baupläne und gezielte Qualitätsstufen über seltene Kampfkomponenten.
Nach zwei eroberten Territorien öffnen sich zusätzlich prozedurale **Echo-Netze**: verzweigte
Karten mit sichtbaren Belohnungen, stapelbaren Gegneraffixen, Boss-Kernen und endlos
skalierenden Zyklen. Ein gespeicherter Seed hält jeden laufenden Pfad reproduzierbar.

Die strategische Abenteuerkarte besitzt ein echtes verzweigtes Wegenetz, eroberbare und
ausbaubare Ressourcenanlagen sowie optionale Fundorte mit einmaliger Beute.
Die Desktop-Ansicht besitzt eine vollwertige Strategie-Spieloberfläche mit Seitenleiste,
Ressourcen-HUD, interaktivem Tempest-Panorama, großer Abenteuerkarte und nahezu
bildschirmfüllender Kampfbühne. Erkennbare lokale Monster-Portraits für die zentralen
Völker ersetzen dort die reinen Emoji-Platzhalter; das Spiel bleibt vollständig offline.
Die Magie ist in aktive Kampf-/Abenteuerzauber der Arkanen Akademie, dauerhafte
Reichsrituale und den Königreichs-Forschungsbaum getrennt.

> Spieler-Handbuch (deutsch): siehe **[GAMEGUIDE.md](GAMEGUIDE.md)**
> Verbindliche Spezifikation & Roadmap: siehe **[PLAN.md](PLAN.md)**

---

## Eigenschaften / Technik

- **Reines HTML + CSS + JavaScript** – kein Build-Schritt, keine Frameworks, keine
  externen Bibliotheken/CDNs.
- **Offline- & `file://`-tauglich:** Datei aufs Handy kopieren, im Browser öffnen → läuft.
- **Desktop-first ab 1100 px:** Strategie-HUD und breite Spielansichten; darunter bleibt
  die mobile Tab-/Kartenansicht mit großen Tap-Zielen erhalten.
- **Spielstand** via `localStorage` (Auto-Save + manuell, versioniertes Schema, Reset).
- **UI-Sprache Deutsch.** Spielgefühl: Aufbau & Management.
- Die **datengetriebene UI wird per JavaScript aus Daten gerendert** (sichere DOM-Erzeugung,
  kein zusammengesetztes HTML) → robust gegen Formatierungsfehler.

---

## Schnellstart

Es gibt **keinen Build**. Drei Wege, das Spiel zu starten:

**1. Direkt öffnen (offline)**
`index.html` im Browser öffnen (Doppelklick bzw. `file://…/index.html`). Läuft komplett
offline; der Spielstand liegt im `localStorage` des Browsers.

**2. Lokaler Server (empfohlen, auch fürs Handy im selben WLAN)**
```bash
python3 -m http.server 8000
# PC:    http://localhost:8000
# Handy: http://<PC-IP>:8000   (z. B. http://192.168.0.42:8000)
```

**3. Aufs Handy kopieren**
Den ganzen Ordner aufs Gerät kopieren und `index.html` im mobilen Browser öffnen.

---

## Projektstruktur

```
index.html          Minimales Grundgerüst: Topbar, Tab-Container, Navigation, Modal-/Toast-Wurzel
style.css           Responsives Theme (mobile Fallback + Desktop-Spiel-Shell)
assets/             Lokale Kreaturen-Sprites und Desktop-Königreichspanorama
js/
  data.js           Statische Inhalte (DOM-frei): Ränge, Ressourcen, Gebäude, Kreaturen +
                    Evolutionsketten, Skills/Aspekte, Magie, Baupläne/Schmiedekomponenten/Sets, Regionen,
                    Rivalen, Events, Affinitäten, Echo-Umgebungen/-Affixe/-Belohnungen,
                    Forschung, Herrscher-Stufen/-Talente, Hilfe-Texte
  state.js          Spielzustand, Standardwerte, Speichern/Laden (localStorage), normalize()
  systems.js        Spiellogik (DOM-frei, reine Funktionen): Tick/Produktion, Bauen,
                    Beschwören, Namensgebung, Evolution, Skills, Magie/Forschung, Schmieden,
                    Expeditionen, Armeegruppen/Kartenbewegung, taktischer Elementkampf, Rivalen/Bedrohung, Events,
                    Affinität, Fusion, Runenschmiede, Echo-Generator/-Kämpfe, Herrscher-Talente,
                    Skill-Meisterschaft, Auto-Modus, Freischaltungen/Gating
  ui.js             Darstellung: Views je Tab + Modals, alles per DOM-API gerendert
  main.js           Init, Spiel-Loop (1 Tick/Sek.), Offline-Fortschritt, Auto-Save
dev/                Entwickler-Tests (NICHT Teil des Spiels) — siehe unten
  sim.test.js       Headless-Logiktest (Bun, ohne DOM)
  domtest.test.js   DOM-Rendertest (jsdom)
  playthrough.test.js Komplettes Headless-Durchspiel (jsdom)
  balance.js        Balance-Analyse der Kraftkurven (Bun)
  shots.js          Mobile-/Desktop-Screenshots via Playwright/Chromium
  screenshots/      Erzeugte PNGs (390×844 und 1440×900)
```

### Architektur-Prinzipien

- **Logik DOM-frei halten.** `data.js`, `state.js` und `systems.js` dürfen *kein* `document`/
  `window`-DOM benutzen → unter Node headless testbar. Sie exportieren als
  `window.GameData` / `window.GameState` / `window.GameSystems` (im Browser) bzw.
  `globalThis.*` (unter Node).
- **UI nur in `ui.js`.** Oberfläche ausschließlich per `document.createElement`/`textContent`
  bauen (Helfer `el(tag, attrs, children)`), **niemals** HTML-Strings zusammensetzen.
- **`index.html` minimal halten.** Inhalte kommen aus den Daten, nicht aus handgeschriebenem
  Markup.
- **Spielstand-Kompatibilität:** Neue Zustandsfelder immer in `createDefault()` **und**
  `normalize()` (in `state.js`) ergänzen, damit alte Stände weiterladen.
- **`PLAN.md` ist die verbindliche Spezifikation** – Konzeptänderungen dort nachziehen.

---

## Spielstand & Debugging

- **Save-Key:** `tempest_kingdom_save_v2` im `localStorage`, internes Schema v8 (alte v1–v7-Stände werden automatisch migriert; bestehende Ausrüstung, Kartenfortschritt und Freischaltungen bleiben erhalten).
- **Zurücksetzen:** im Spiel über das Herrscher-Modal (oben links) → „🗑 Spielstand
  zurücksetzen", oder in der Browser-Konsole:
  ```js
  localStorage.removeItem('tempest_kingdom_save_v2'); location.reload();
  ```
- **Debug-Handle** in der Browser-Konsole:
  ```js
  const T = window.__TEMPEST__;
  T.state          // der komplette Spielzustand (identisch mit T.UI.state)
  T.SYS            // GameSystems (alle Logikfunktionen)
  T.GST            // GameState (save/load/reset/createDefault)
  T.UI             // GameUI (Render & Modals)
  T.stopLoop()     // den 1-Sekunden-Tick anhalten
  ```
  Beispiel – Ressourcen geben und neu zeichnen:
  ```js
  T.state.resources.gold += 100000; T.UI.refresh();
  ```

---

## Auto- / Simulations-Modus (Zuschauer-Modus)

Das Reich kann sich **selbst spielen** – ein Berater (`SYS.autoPlayStep`) führt pro Tick
eine sinnvolle Aktion aus (bauen, beschwören, benennen, entwickeln, Jobs zuweisen,
forschen, Magie lernen, schmieden, Expeditionen, Gegenangriffe, Affinität, Fusion,
Seelen opfern und freie Talentpunkte verteilen).

**Im Spiel:** Zuschauer-Modus per **👁️-Schalter oben in der Top-Bar** ein/aus, oder Tab
*Übersicht* → Karte **„Zuschauer-Modus"** → **▶ Starten**.
Mit **🎬 Sichtbar** erscheint jede Berater-Aktion als kurzer Dialog mit Pause und Verlauf.
Zusätzlich **⏩ Vorspulen 5 min** springt mehrere Minuten Spielzeit auf einmal.

**Per Konsole:**
```js
const T = window.__TEMPEST__;
T.state.settings.watch = true; T.UI.refresh();   // einschalten (entspricht „▶ Starten")
T.UI.fastForward(120);                            // 120 Sekunden vorspulen
T.state.settings.watch = false;                   // wieder ausschalten
```

**Headless (Node, ohne DOM)** – z. B. zum Tunen der Auto-Logik oder für Langzeit-Stabilität:
```js
require('./js/data.js'); require('./js/state.js'); require('./js/systems.js');
const GST = globalThis.GameState, SYS = globalThis.GameSystems, GD = globalThis.GameData;

const s = GST.createDefault();
SYS.syncUnlocks(s);                               // bestehende Freischaltungen abgleichen
for (let i = 0; i < 3000; i++) {                  // ~50 Minuten Spielzeit
  SYS.autoPlayStep(s);                            // eine Auto-Aktion …
  SYS.tick(s);                                    // … dann ein Welt-Tick
}
console.log('Stufe:', GD.rulerStages[s.herrscher.stage].name,
            'Regionen:', s.claimedRegions.length,
            'Kreaturen:', SYS.totalCreatureCount(s));
```

---

## Tests

Das Spiel selbst hat **keine Abhängigkeiten und keinen Build**. Das Dev-Tooling läuft
auf [Bun](https://bun.sh): einmal `bun install` (zieht jsdom, pngjs und playwright als
devDependencies), danach:

```bash
bun install                  # einmalig: devDependencies installieren

bun test                     # alle Tests (sim, domtest, playthrough)
bun test dev/sim.test.js     # nur die reinen Logiktests (ohne DOM)

bun run balance              # Balance-Analyse (Kraftkurven je Rang, Regions-Monotonie)
```

Erwartete Ausgabe (Soll-Stand):

| Befehl                             | Ergebnis (Konsole zeigt die Detailzählung)   |
|------------------------------------|----------------------------------------------|
| `bun test dev/sim.test.js`         | `1 pass` · `236 bestanden, 0 fehlgeschlagen` |
| `bun test dev/domtest.test.js`     | `1 pass` · `67 bestanden, 0 fehlgeschlagen`  |
| `bun test dev/playthrough.test.js` | `1 pass` · `61 bestanden, 0 fehlgeschlagen`  |
| `bun run balance`                  | Kraftkurven, Regionsbeute und Echo-Zyklen skalieren monoton |

### Screenshots (optional, Linux/WSL)

`dev/shots.js` fotografiert alle Tabs und Modals im Handy-Viewport (390×844) sowie die
wichtigsten Spielansichten auf Desktop (1440×900), prüft zusätzlich 1366×768 auf
horizontale Seitenüberbreite und meldet Browser-Laufzeitfehler. Es braucht
Playwright/Chromium plus ein paar System-Libs. Ohne root (z. B. in WSL):

```bash
# Chromium-Browser für Playwright (Playwright selbst kommt via `bun install`)
bunx playwright install chromium

# Fehlende Chromium-System-Libs ohne root beschaffen
mkdir -p /tmp/chromedeps /tmp/dldeps && ( cd /tmp/dldeps && apt-get download libnspr4 libnss3 libasound2t64 && for f in *.deb; do dpkg-deb -x "$f" /tmp/chromedeps; done )

# (einmalig, gegen ▢-Emoji-Kästchen) Emoji-Font
apt-get download fonts-noto-color-emoji && dpkg-deb -x fonts-noto-color-emoji_*.deb /tmp/emoji \
  && mkdir -p ~/.fonts && cp /tmp/emoji/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf ~/.fonts/ && fc-cache -f

# Screenshots erzeugen
LD_LIBRARY_PATH=/tmp/chromedeps/usr/lib/x86_64-linux-gnu bun run shots
# → 23 PNGs in dev/screenshots/, darunter Mobile-/Desktop-Echo-Netz und Rasterkampf
```

---

## Mitarbeiten / Konventionen

- **Keine externen Abhängigkeiten** im Spiel, **kein Build**. Klassische `<script>`-Tags,
  relative Pfade, muss über `file://` laufen.
- Logik **DOM-frei** (data/state/systems), UI **nur** über die DOM-Helfer in `ui.js`.
- Neue Zustandsfelder in `createDefault()` **und** `normalize()` ergänzen (Save-Kompatibilität).
- Nach Änderungen **die Tests laufen lassen** (mindestens `sim.test.js` + `domtest.test.js`),
  bei UI-Änderungen idealerweise auch Screenshots.
- Konzept-/Feature-Änderungen in **`PLAN.md`** nachziehen.

## Lizenz / Hinweis

Fan-/Lernprojekt im Tensura-Universum; die strategische Armee- und Kartenstruktur orientiert
sich spielmechanisch an klassischen rundenbasierten Fantasy-Strategiespielen.
