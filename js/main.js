/* ============================================================
   main.js — Initialisierung, Spiel-Loop (Tick), Offline-Fort-
   schritt, Auto-Speichern. Verbindet Zustand, Logik und UI.
   ============================================================ */
(function () {
  'use strict';
  var GST = window.GameState, SYS = window.GameSystems, UI = window.GameUI;
  var resetting = false;

  // Laden oder neu erstellen
  var state = GST.load() || GST.createDefault();

  // Offline-Fortschritt anrechnen
  if (state.lastSaved) {
    var elapsed = (Date.now() - state.lastSaved) / 1000;
    if (elapsed > 10) {
      var res = SYS.offlineProgress(state, elapsed);
      if (res.ticks > 10) {
        var mins = Math.max(1, Math.round(res.ticks / 60));
        SYS.log(state, '🌙 Während deiner Abwesenheit (~' + mins + ' Min) arbeitete dein Reich weiter.', 'gold');
      }
    }
  }

  // Bereits erfüllte Freischaltungen & Ziele merken, damit sie nicht als „neu"/„erfüllt" gemeldet werden
  SYS.syncUnlocks(state);
  SYS.syncQuests(state);
  if (window.GameAchievements) window.GameAchievements.sync(state);

  // UI starten; Speichern als Persist-Callback
  UI.start(state, function (s) { GST.save(s); });

  // Haupt-Loop: 1 Tick pro Sekunde
  var loop = setInterval(function () {
    var steps = window.GameChronicle ? window.GameChronicle.simSpeed(state) : 1;
    for (var i = 0; i < steps; i++) UI.onTick(SYS.tick(state));
  }, 1000);

  // Auto-Speichern alle 10 s
  var saveLoop = setInterval(function () { if (!resetting) GST.save(state); }, 10000);

  // Speichern beim Verlassen / Wegblenden (wichtig auf dem Handy)
  window.addEventListener('beforeunload', function () { if (!resetting) GST.save(state); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && !resetting) GST.save(state); });

  function resetGame(skipReload) {
    resetting = true;
    clearInterval(loop);
    clearInterval(saveLoop);
    GST.reset();
    if (!skipReload) window.location.reload();
  }

  function startChronicleRun(options, skipReload) {
    if (!window.GameChronicle) return { ok: false, reason: 'Chroniksystem nicht geladen.' };
    var result = window.GameChronicle.startNewRun(state, options);
    if (!result.ok) return result;
    var archived = GST.storeChronicleArchive(result.archive);
    if (!archived.ok) return { ok: false, reason: archived.reason === 'quota' ? 'Chronik-Archiv ist voll.' : 'Alter Run konnte nicht archiviert werden.' };
    var saved = GST.saveResult(result.state);
    if (!saved.ok) return { ok: false, reason: saved.reason === 'quota' ? 'Neuer Run passt nicht in den Spielstand.' : 'Neuer Run konnte nicht gespeichert werden.' };
    if (skipReload) {
      state = result.state;
      UI.start(state, function (s) { GST.save(s); });
      window.__TEMPEST__.state = state;
      return result;
    }
    resetting = true;
    clearInterval(loop);
    clearInterval(saveLoop);
    window.location.reload();
    return result;
  }

  // Für Debugging in der Browser-Konsole
  window.__TEMPEST__ = {
    state: state, SYS: SYS, GST: GST, UI: UI,
    stopLoop: function () { clearInterval(loop); clearInterval(saveLoop); },
    resetGame: resetGame,
    startChronicleRun: startChronicleRun,
    isResetting: function () { return resetting; }
  };
})();
