/* ============================================================
   action-scene.js — Canvas-Bühne für den Echtzeit-Action-Kampf
   (Phase 45, Schritt 4). Treibt die Sim mit echter Zeit voran
   (GameActionCombat.step), liest Eingaben (Drag-Joystick + Tastatur)
   und zeichnet Held, Gegner, Telegraf-Gefahrenzonen, Lebensbalken
   und Hotbar-Cooldowns. Verändert den Zustand nur über die Engine-API.
   Alle Listener hängen am Canvas → räumen sich beim Schließen selbst auf.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;

  var REGION_TINT = {
    feuer: ['#3a1410', '#1a0c0a'], wasser: ['#0e2436', '#081320'], wind: ['#22301a', '#0f1a10'],
    erde: ['#2c2414', '#15110a'], licht: ['#2e2a18', '#16140c'], dunkel: ['#1c1230', '#0c0818']
  };

  function project(size) {
    var A = root.GameActionCombat, s = Math.min(size.width / A.AW, size.height / A.AH);
    return { s: s, ox: (size.width - A.AW * s) / 2, oy: (size.height - A.AH * s) / 2 };
  }

  function mount(canvas, options) {
    options = options || {};
    var Core = root.GameCanvasCore, A = root.GameActionCombat;
    if (!Core || !A || !root.CanvasRenderingContext2D) return null;
    var getState = options.getState || function () { return null; };
    var reduced = Core.reducedMotion();
    var lastNow = 0, ended = false;
    var keys = {}, joy = null;                 // joy: {ox,oy,mx,my} in Canvas-Pixeln
    var pendingDodge = false, pendingSkills = [];

    function intentFromInput() {
      var mx = 0, my = 0;
      if (joy) {
        var R = 42;
        mx = Math.max(-1, Math.min(1, (joy.mx - joy.ox) / R));
        my = Math.max(-1, Math.min(1, (joy.my - joy.oy) / R));
      } else {
        if (keys.left) mx -= 1; if (keys.right) mx += 1;
        if (keys.up) my -= 1; if (keys.down) my += 1;
      }
      var intent = { moveX: mx, moveY: my, attack: true, dodge: pendingDodge, skills: pendingSkills.slice() };
      pendingDodge = false; pendingSkills = [];
      return intent;
    }

    function step(state, now) {
      if (ended) return;
      var dt = lastNow ? Math.min(120, now - lastNow) : 0; lastNow = now;
      A.setIntent(state, intentFromInput());
      var status = A.step(state, dt);
      if (status && status !== 'active' && !ended) { ended = true; if (options.onEnd) options.onEnd(status); }
    }

    // ---------- Zeichnen ----------
    function token(ctx, x, y, r, icon, ringColor, ringW) {
      ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.85, r * 1.05, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(12,16,24,.55)'; ctx.fill();
      ctx.lineWidth = ringW || 2; ctx.strokeStyle = ringColor; ctx.stroke();
      ctx.font = Math.round(r * 1.5) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(icon || '?', x, y + 1);
    }
    function hpBar(ctx, x, y, w, frac, color) {
      ctx.fillStyle = 'rgba(4,8,9,.8)'; ctx.fillRect(x - w / 2, y, w, 4);
      ctx.fillStyle = color; ctx.fillRect(x - w / 2 + 0.5, y + 0.5, Math.max(0, (w - 1) * frac), 3);
    }

    function draw(ctx, size, now) {
      var state = getState(); if (!state) return;
      step(state, now);
      var v = A.renderView(state); if (!v) return;
      var p = project(size), region = root.GameData && root.GameData.region(v.regionId);
      var tint = REGION_TINT[(region && region.element)] || ['#1a2230', '#0b0f16'];

      // Hintergrund + Arenarahmen
      var g = ctx.createLinearGradient(0, 0, 0, size.height);
      g.addColorStop(0, tint[0]); g.addColorStop(1, tint[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, size.width, size.height);
      ctx.strokeStyle = 'rgba(233,197,108,.35)'; ctx.lineWidth = 2;
      ctx.strokeRect(p.ox, p.oy, A.AW * p.s, A.AH * p.s);
      // Bodenraster (dezent)
      ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
      for (var gx = 10; gx < A.AW; gx += 10) { ctx.beginPath(); ctx.moveTo(p.ox + gx * p.s, p.oy); ctx.lineTo(p.ox + gx * p.s, p.oy + A.AH * p.s); ctx.stroke(); }

      // Telegraf-Gefahrenzonen (gefüllt nach Wind-up-Fortschritt) — zuerst, unter den Tokens
      v.enemies.forEach(function (e) {
        if (e.state !== 'windup' || !e.danger) return;
        var cx = p.ox + e.danger.x * p.s, cy = p.oy + e.danger.y * p.s, rr = e.danger.r * p.s;
        var prog = 1 - Math.max(0, Math.min(1, e.windup / (e.windupMax || 0.55)));
        ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,64,64,.16)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,90,90,.85)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, rr * prog, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,70,70,.34)'; ctx.fill();
      });

      // Gegner
      v.enemies.forEach(function (e) {
        var ex = p.ox + e.x * p.s, ey = p.oy + e.y * p.s, er = e.r * p.s;
        token(ctx, ex, ey, er, e.icon, e.state === 'windup' ? '#ff5a5a' : '#ff6f83', e.state === 'windup' ? 3 : 2);
        hpBar(ctx, ex, ey - er - 6, Math.max(16, er * 2.2), e.hp / e.maxHp, '#ff6579');
        (e.statuses || []).slice(0, 3).forEach(function (id, i) {
          ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
          ctx.fillText({ brand: '🔥', frost: '❄️', schock: '⚡' }[id] || '●', ex + (i - 1) * 11, ey - er - 13);
        });
      });

      // Held (Blitzen während i-Frames, Schweif beim Dash)
      var h = v.hero, hx = p.ox + h.x * p.s, hy = p.oy + h.y * p.s, hr = h.r * p.s;
      if (h.invuln > 0 && !reduced) { ctx.save(); ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(hx, hy, hr * 1.5, 0, Math.PI * 2); ctx.fillStyle = '#9fe8ff'; ctx.fill(); ctx.restore(); }
      token(ctx, hx, hy, hr, h.icon, h.invuln > 0 ? '#9fe8ff' : '#68d7ff', 3);
      // Blickrichtungs-Pfeil
      ctx.fillStyle = '#cdeaff'; ctx.beginPath();
      ctx.moveTo(hx + h.facing * hr * 1.4, hy); ctx.lineTo(hx + h.facing * hr * 0.7, hy - 4); ctx.lineTo(hx + h.facing * hr * 0.7, hy + 4); ctx.closePath(); ctx.fill();

      drawHud(ctx, size, v, p);
      drawJoystick(ctx);
    }

    function drawHud(ctx, size, v, p) {
      var h = v.hero;
      // Held-LP oben
      var w = Math.min(220, size.width * 0.5);
      ctx.fillStyle = 'rgba(6,10,16,.7)'; ctx.fillRect(10, 10, w, 16);
      ctx.fillStyle = '#53d98b'; ctx.fillRect(12, 12, (w - 4) * Math.max(0, h.hp / h.maxHp), 12);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('❤ ' + Math.ceil(h.hp) + '/' + h.maxHp, 16, 18);
      // Timer + Welle + Gegnerzahl rechts
      ctx.textAlign = 'right'; ctx.fillStyle = '#e9d8a8';
      ctx.fillText('⏱ ' + Math.max(0, Math.round(A.MAX_SECONDS - v.elapsed)) + 's   🌊 ' + v.wave + '/' + v.totalWaves + '   👹 ' + v.enemies.length, size.width - 12, 18);
      // Dodge-Bereitschaft
      ctx.textAlign = 'left'; ctx.fillStyle = h.dodgeCd > 0 ? '#7c8aa0' : '#9fe8ff';
      ctx.fillText(h.dodgeCd > 0 ? '⟳ Ausweichen ' + h.dodgeCd.toFixed(1) + 's' : '⟳ Ausweichen bereit', 12, 36);
      // Combo/Schwung
      if (v.combo > 1) { ctx.fillStyle = '#ffd66a'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('🔥 Combo ×' + v.combo, 12, 52); }
      // Hotbar unten: Icon + Cooldown-Radial
      var n = h.cooldowns.length, bw = 38, gap = 8, total = n * bw + (n - 1) * gap, x0 = (size.width - total) / 2, y = size.height - bw - 10;
      h.cooldowns.forEach(function (c, i) {
        var x = x0 + i * (bw + gap), cx = x + bw / 2, cy = y + bw / 2;
        ctx.fillStyle = 'rgba(10,14,22,.85)'; ctx.fillRect(x, y, bw, bw);
        ctx.strokeStyle = c.ready ? '#e9c56c' : '#44506a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, bw, bw);
        ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
        ctx.fillText(c.icon, cx, cy - 4);
        ctx.fillStyle = '#cbd6e8'; ctx.font = '9px sans-serif'; ctx.fillText(String(i + 1), x + 7, y + 7);
        if (!c.ready) {
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, bw / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (c.cdLeft / c.cd)); ctx.closePath();
          ctx.fillStyle = 'rgba(8,10,16,.6)'; ctx.fill();
        }
      });
    }

    function drawJoystick(ctx) {
      if (!joy) return;
      ctx.save(); ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 42, 0, Math.PI * 2); ctx.strokeStyle = '#9fe8ff'; ctx.lineWidth = 3; ctx.stroke();
      var dx = joy.mx - joy.ox, dy = joy.my - joy.oy, l = Math.hypot(dx, dy) || 1, k = Math.min(42, l) / l;
      ctx.beginPath(); ctx.arc(joy.ox + dx * k, joy.oy + dy * k, 16, 0, Math.PI * 2); ctx.fillStyle = '#68d7ff'; ctx.fill();
      ctx.restore();
    }

    // ---------- Eingabe (alles am Canvas → kein Leak beim Schließen) ----------
    function canvasPoint(ev) {
      var rect = canvas.getBoundingClientRect(), surf = surface ? surface.size() : { width: rect.width, height: rect.height };
      return { x: (ev.clientX - rect.left) * (surf.width / Math.max(1, rect.width)), y: (ev.clientY - rect.top) * (surf.height / Math.max(1, rect.height)) };
    }
    function onDown(ev) {
      canvas.focus && canvas.focus();
      var pt = canvasPoint(ev);
      var surf = surface ? surface.size() : { width: 0 };
      if (pt.x < surf.width * 0.6) { joy = { ox: pt.x, oy: pt.y, mx: pt.x, my: pt.y, id: ev.pointerId }; ev.preventDefault(); }
    }
    function onMove(ev) { if (joy && ev.pointerId === joy.id) { var pt = canvasPoint(ev); joy.mx = pt.x; joy.my = pt.y; } }
    function onUp(ev) { if (joy && ev.pointerId === joy.id) joy = null; }
    var KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
    function onKey(down) {
      return function (ev) {
        if (KEYMAP[ev.code]) { keys[KEYMAP[ev.code]] = down; ev.preventDefault(); return; }
        if (!down) return;
        if (ev.code === 'Space') { pendingDodge = true; ev.preventDefault(); }
        else if (ev.code === 'Digit1' || ev.code === 'Digit2' || ev.code === 'Digit3') { pendingSkills.push(Number(ev.code.slice(5)) - 1); ev.preventDefault(); }
      };
    }
    var keyDown = onKey(true), keyUp = onKey(false);

    canvas.setAttribute('tabindex', '0'); canvas.style.outline = 'none'; canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', keyDown);
    canvas.addEventListener('keyup', keyUp);

    var surface = Core.createSurface(canvas, { maxFps: 30, dprCap: 1.5, animate: true, draw: draw });
    if (!surface) return null;
    if (canvas.focus) try { canvas.focus(); } catch (e) {}

    return {
      destroy: function () { surface.destroy(); },
      invalidate: function () { surface.invalidate(); },
      queueDodge: function () { pendingDodge = true; },
      queueSkill: function (i) { pendingSkills.push(i | 0); }
    };
  }

  root.GameActionScene = { mount: mount, project: project };
})();
