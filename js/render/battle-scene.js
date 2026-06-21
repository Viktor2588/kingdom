/* ============================================================
   battle-scene.js — Isometrische 7×5-Canvas-Kampfbühne.
   Liest nur ein normalisiertes View-Modell und sendet Zellklicks
   zurück; Schaden, Bewegung und Sieg bleiben GameSystems-Sache.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;

  function cellKey(x, y) { return x + ',' + y; }
  function renderKey(actor) { return actor.side + ':' + String(actor.key); }

  function geometry(width, height, cols, rows) {
    cols = cols || 7; rows = rows || 5;
    var tileW = Math.max(38, Math.min((width - 20) / 6.3, (height - 36) / 2.8, 132));
    var tileH = tileW * 0.46;
    return {
      width: width, height: height, cols: cols, rows: rows,
      tileW: tileW, tileH: tileH,
      originX: width / 2 - ((cols - 1) - (rows - 1)) * tileW / 4,
      originY: Math.max(tileH * 0.9, height * 0.52 - ((cols - 1) + (rows - 1)) * tileH / 4)
    };
  }

  function cellPoint(g, x, y) {
    return { x: g.originX + (x - y) * g.tileW / 2, y: g.originY + (x + y) * g.tileH / 2 };
  }

  function hitTest(g, px, py) {
    var dx = (px - g.originX) / (g.tileW / 2);
    var dy = (py - g.originY) / (g.tileH / 2);
    var x = Math.round((dx + dy) / 2), y = Math.round((dy - dx) / 2);
    if (Object.is(x, -0)) x = 0; if (Object.is(y, -0)) y = 0;
    if (x < 0 || x >= g.cols || y < 0 || y >= g.rows) return null;
    var point = cellPoint(g, x, y);
    var inside = Math.abs(px - point.x) / (g.tileW / 2) + Math.abs(py - point.y) / (g.tileH / 2) <= 1.08;
    return inside ? { x: x, y: y } : null;
  }

  function diamond(ctx, point, tileW, tileH) {
    ctx.beginPath();
    ctx.moveTo(point.x, point.y - tileH / 2);
    ctx.lineTo(point.x + tileW / 2, point.y);
    ctx.lineTo(point.x, point.y + tileH / 2);
    ctx.lineTo(point.x - tileW / 2, point.y);
    ctx.closePath();
  }

  function coverImage(ctx, image, width, height) {
    var scale = Math.max(width / image.width, height / image.height);
    var dw = image.width * scale, dh = image.height * scale;
    ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
  }

  function coverAtlasCell(ctx, image, sprite, columns, rows, width, height) {
    var cellW = image.width / columns, cellH = image.height / rows;
    var scale = Math.max(width / cellW, height / cellH);
    var sourceW = width / scale, sourceH = height / scale;
    var sx = sprite.col * cellW + (cellW - sourceW) / 2;
    var sy = sprite.row * cellH + (cellH - sourceH) / 2;
    ctx.drawImage(image, sx, sy, sourceW, sourceH, 0, 0, width, height);
  }

  function fallbackBackdrop(ctx, width, height) {
    var gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#355636'); gradient.addColorStop(0.5, '#6f7138'); gradient.addColorStop(1, '#173a31');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  }

  function effectColor(element) {
    return ({ feuer: '#ff7b3f', wasser: '#79d9ff', wind: '#d8ff8d', erde: '#e9bf72', licht: '#fff2a5', dunkel: '#c488ff', geist: '#72f1e5' })[element] || '#ffe09a';
  }

  function effectSpriteId(element) {
    return ({ feuer: 'fire', wasser: 'frost', wind: 'lightning', erde: 'slash', licht: 'heal', dunkel: 'death', geist: 'soul' })[element] || 'soul';
  }

  function drawEffectSprite(ctx, atlas, Art, id, x, y, size, progress, rotation) {
    var sprite = atlas && Art.effectFor(id); if (!sprite) return false;
    var sw = atlas.width / Art.battleEffectAtlas.columns, sh = atlas.height / Art.battleEffectAtlas.rows;
    var pulse = Math.sin(Math.PI * Math.max(0, Math.min(1, progress)));
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation || 0); ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.max(0.18, pulse); ctx.drawImage(atlas, sprite.col * sw, sprite.row * sh, sw, sh, -size / 2, -size / 2, size, size);
    ctx.restore(); return true;
  }

  function drawMagic(ctx, from, to, event, progress, reduced, effectAtlas, Art) {
    var color = effectColor(event.element), eased = root.GameCanvasEffects.easeOut(progress);
    var x = from.x + (to.x - from.x) * eased, y = from.y + (to.y - from.y) * eased;
    if (drawEffectSprite(ctx, effectAtlas, Art, effectSpriteId(event.element), x, y - 18, reduced ? 52 : 74, Math.min(1, progress * 1.35), Math.atan2(to.y - from.y, to.x - from.x))) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.globalAlpha = 0.85 * (1 - progress * 0.35); ctx.lineWidth = reduced ? 3 : 5;
    ctx.beginPath(); ctx.moveTo(from.x, from.y - 12); ctx.lineTo(x, y - 18); ctx.stroke();
    var count = reduced ? 3 : 7;
    for (var i = 0; i < count; i++) {
      var angle = i * 2.399 + progress * 4;
      var radius = (8 + i * 2) * (0.45 + progress);
      ctx.beginPath(); ctx.arc(x + Math.cos(angle) * radius, y - 18 + Math.sin(angle) * radius * 0.55, 2.5 + (i % 2), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawSlash(ctx, from, to, progress, effectAtlas, Art) {
    var pulse = Math.sin(Math.PI * progress), mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2 - 18;
    if (drawEffectSprite(ctx, effectAtlas, Art, 'slash', mx, my, 82 + pulse * 26, progress, Math.atan2(to.y - from.y, to.x - from.x))) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fff0b0'; ctx.lineWidth = 2 + pulse * 5; ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.arc(mx, my, 12 + pulse * 25, -1.1, 0.65); ctx.stroke(); ctx.restore();
  }

  function drawHeal(ctx, point, progress, reduced, effectAtlas, Art) {
    if (drawEffectSprite(ctx, effectAtlas, Art, 'heal', point.x, point.y - 25, reduced ? 58 : 84, progress, 0)) return;
    var count = reduced ? 3 : 7;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#8dffc2'; ctx.globalAlpha = 0.9 * (1 - progress * 0.45);
    for (var i = 0; i < count; i++) {
      var angle = i / count * Math.PI * 2, radius = 10 + progress * 25;
      ctx.fillRect(point.x + Math.cos(angle) * radius - 2, point.y - 25 + Math.sin(angle) * radius * 0.5 - progress * 18, 4, 11);
    }
    ctx.restore();
  }

  function drawStatusIcons(ctx, actor, x, y) {
    var palette = { brand: '#ff744a', frost: '#79dfff', schock: '#d493ff' };
    (actor.statuses || []).slice(0, 3).forEach(function (status, index) {
      var px = x + (index - ((actor.statuses.length - 1) / 2)) * 14;
      ctx.fillStyle = palette[status.id] || '#ffe091'; ctx.strokeStyle = 'rgba(8,10,16,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, y - 6); ctx.lineTo(px + 6, y); ctx.lineTo(px, y + 6); ctx.lineTo(px - 6, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    });
  }

  function drawAmbient(ctx, size, now, biome, mode, color) {
    if (mode !== 'full') return;
    var count = 13, rising = biome === 'ruins' || biome === 'swamp' || biome === 'shadow';
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = color || '#dff3a0';
    for (var i = 0; i < count; i++) {
      var cycle = (now / (biome === 'mountain' ? 34 : 55) + i * 79) % (size.height + 80);
      var x = (i * 137 + now / (biome === 'sky' ? 42 : 95)) % (size.width + 60) - 30;
      var y = rising ? size.height + 20 - cycle : cycle - 40;
      var radius = biome === 'mountain' ? 1.8 + (i % 3) : 1.2 + (i % 2);
      ctx.globalAlpha = 0.18 + (i % 4) * 0.08;
      if (biome === 'jura') { ctx.save(); ctx.translate(x, y); ctx.rotate(now / 700 + i); ctx.fillRect(-3, -1, 6, 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  function drawObstacle(ctx, point, g, index) {
    var size = g.tileW * 0.18;
    ctx.save(); ctx.translate(point.x, point.y + g.tileH * 0.04);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, size * 0.7, size * 1.35, size * 0.48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = index % 2 ? '#4b493b' : '#5b513f'; ctx.strokeStyle = '#252b25'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-size, size * 0.5); ctx.lineTo(-size * 0.75, -size * 0.9); ctx.lineTo(0, -size * 1.35); ctx.lineTo(size, -size * 0.3); ctx.lineTo(size * 0.85, size * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#67a052'; ctx.beginPath(); ctx.arc(-size * 0.35, -size * 0.62, size * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function mount(canvas, view, options) {
    options = options || {};
    var Core = root.GameCanvasCore, FX = root.GameCanvasEffects, Art = root.GameArtData;
    if (!Core || !FX || !Art || !root.CanvasRenderingContext2D) return null;
    var effectiveMode = options.mode || 'full';
    if (Core.reducedMotion() && effectiveMode === 'full') effectiveMode = 'reduced';
    var timeline = FX.createTimeline(options.events || [], effectiveMode);
    var background = null, atlas = null, effectAtlas = null, assetsReady = false, hover = null, lastGeometry = null, timelineDone = !timeline.active();
    var reachable = {}, actorsByKey = {};
    (view.reachable || []).forEach(function (cell) { reachable[cellKey(cell.x, cell.y)] = true; });
    (view.actors || []).forEach(function (actor) { actorsByKey[actor.renderKey || renderKey(actor)] = actor; });

    function actorPoint(g, actor, sample) {
      var x = actor.pos.x, y = actor.pos.y, event = sample.event, progress = sample.progress;
      if (event && event.key === actor.renderKey && event.type === 'move' && event.from && event.to) {
        var p = FX.easeInOut(progress); x = event.from.x + (event.to.x - event.from.x) * p; y = event.from.y + (event.to.y - event.from.y) * p;
      }
      var point = cellPoint(g, x, y);
      if (event && event.key === actor.renderKey && (event.type === 'attack' || event.type === 'magic')) {
        var target = actorsByKey[event.targetKey], targetPoint = target ? cellPoint(g, target.pos.x, target.pos.y) : point;
        var lunge = Math.sin(Math.PI * progress) * (event.type === 'attack' ? 0.32 : 0.08);
        point.x += (targetPoint.x - point.x) * lunge; point.y += (targetPoint.y - point.y) * lunge;
      }
      if (event && event.key === actor.renderKey && event.type === 'hit') point.x += Math.sin(progress * Math.PI * 8) * (1 - progress) * 7;
      return point;
    }

    function drawActor(ctx, g, actor, sample, index, now) {
      var event = sample.event, point = actorPoint(g, actor, sample), footY = point.y + g.tileH * 0.25;
      var alpha = actor.dead ? 0.28 : 1, scale = 1;
      if (event && event.key === actor.renderKey && event.type === 'death') { alpha = 1 - sample.progress; scale = 1 - sample.progress * 0.25; }
      var idle = effectiveMode === 'full' && sample.done && !actor.dead ? Math.sin(now / 430 + index * 1.7) * 2.2 : 0;
      var sprite = Art.unitFor(actor.line);

      ctx.save(); ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,.34)'; ctx.beginPath(); ctx.ellipse(point.x, footY + 3, g.tileW * 0.29, g.tileH * 0.24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = actor.side === 'party' ? '#68d7ff' : '#ff6f83'; ctx.lineWidth = actor.renderKey === view.currentKey ? 4 : 2;
      ctx.fillStyle = actor.side === 'party' ? 'rgba(42,165,215,.18)' : 'rgba(205,55,78,.18)';
      ctx.beginPath(); ctx.ellipse(point.x, footY, g.tileW * 0.34, g.tileH * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      if (sprite && atlas) {
        var sw = atlas.width / Art.battleAtlas.columns, sh = atlas.height / Art.battleAtlas.rows;
        var dw = g.tileW * 1.30 * sprite.scale * scale, dh = dw * (sh / sw);
        ctx.save(); ctx.translate(point.x, 0); if (actor.side === 'enemy') ctx.scale(-1, 1);
        ctx.drawImage(atlas, sprite.col * sw, sprite.row * sh, sw, sh, -dw / 2, footY - dh * sprite.anchorY + idle, dw, dh);
        ctx.restore();
      } else {
        ctx.fillStyle = actor.side === 'party' ? '#1e789d' : '#8d3047'; ctx.beginPath(); ctx.arc(point.x, footY - g.tileW * 0.28 + idle, g.tileW * 0.25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = Math.round(g.tileW * 0.32) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(actor.icon || '?', point.x, footY - g.tileW * 0.18 + idle);
      }

      if (actor.defending) drawEffectSprite(ctx, effectAtlas, Art, 'block', point.x, footY - g.tileW * 0.34, g.tileW * 0.56, 0.5, 0);
      if ((actor.statuses || []).length) drawStatusIcons(ctx, actor, point.x, footY - g.tileW * 0.83);

      var barW = Math.min(58, g.tileW * 0.74), barY = footY + g.tileH * 0.38;
      ctx.fillStyle = 'rgba(4,8,9,.8)'; ctx.fillRect(point.x - barW / 2, barY, barW, 6);
      ctx.fillStyle = actor.side === 'party' ? '#53d98b' : '#ff6579'; ctx.fillRect(point.x - barW / 2 + 1, barY + 1, Math.max(0, (barW - 2) * actor.hpFraction), 4);
      if (actor.stack > 1) {
        ctx.fillStyle = '#15121e'; ctx.strokeStyle = '#e9c56c'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(point.x + barW * 0.42, barY - 8, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffe191'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(actor.stack), point.x + barW * 0.42, barY - 5);
      }
      if (event && event.key === actor.renderKey && event.type === 'hit' && event.amount) {
        ctx.fillStyle = '#fff0b0'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('−' + event.amount, point.x, footY - g.tileW * 0.95 - sample.progress * 18);
      }
      ctx.restore();
    }

    function draw(ctx, size, now) {
      var g = geometry(size.width, size.height, view.width, view.height); lastGeometry = g;
      var biome = Art.biomeFor(view.biome || view.regionId || 'jura');
      if (background && biome) coverAtlasCell(ctx, background, biome, Art.battleBiomeAtlas.columns, Art.battleBiomeAtlas.rows, size.width, size.height);
      else if (background) coverImage(ctx, background, size.width, size.height); else fallbackBackdrop(ctx, size.width, size.height);
      ctx.fillStyle = 'rgba(3,12,10,.13)'; ctx.fillRect(0, 0, size.width, size.height);
      if (view.biome === 'shadow') { ctx.fillStyle = 'rgba(35,5,67,.22)'; ctx.fillRect(0, 0, size.width, size.height); }
      else if (view.biome === 'sky') { ctx.fillStyle = 'rgba(255,245,208,.08)'; ctx.fillRect(0, 0, size.width, size.height); }
      var sample = timeline.sample(now); timelineDone = sample.done;

      var occupied = {};
      (view.actors || []).forEach(function (actor) { if (!actor.dead) occupied[cellKey(actor.pos.x, actor.pos.y)] = true; });
      for (var depth = 0; depth <= view.width + view.height - 2; depth++) {
        for (var y = 0; y < view.height; y++) {
          var x = depth - y; if (x < 0 || x >= view.width) continue;
          var key = cellKey(x, y), point = cellPoint(g, x, y), isReachable = !!reachable[key], isHover = hover && hover.x === x && hover.y === y;
          diamond(ctx, point, g.tileW, g.tileH);
          ctx.fillStyle = isReachable ? (isHover ? 'rgba(104,238,147,.38)' : 'rgba(70,188,113,.22)') : 'rgba(14,35,26,.13)';
          ctx.strokeStyle = isReachable ? '#8ce8a9' : 'rgba(234,224,184,.24)'; ctx.lineWidth = isHover ? 3 : 1;
          ctx.fill(); ctx.stroke();
          if (isReachable && !occupied[key]) { ctx.fillStyle = 'rgba(225,255,218,.75)'; ctx.beginPath(); ctx.arc(point.x, point.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
        }
      }

      (view.obstacles || []).forEach(function (key, index) {
        var parts = key.split(','); drawObstacle(ctx, cellPoint(g, Number(parts[0]), Number(parts[1])), g, index);
      });

      var actors = (view.actors || []).slice().sort(function (a, b) { return (a.pos.x + a.pos.y) - (b.pos.x + b.pos.y) || a.pos.y - b.pos.y; });
      actors.forEach(function (actor, index) { drawActor(ctx, g, actor, sample, index, now); });

      if (sample.event) {
        var event = sample.event, source = actorsByKey[event.key], target = actorsByKey[event.targetKey];
        var from = source ? actorPoint(g, source, sample) : null, to = target ? cellPoint(g, target.pos.x, target.pos.y) : null;
        if (event.type === 'magic' && from && to) drawMagic(ctx, from, to, event, sample.progress, effectiveMode !== 'full', effectAtlas, Art);
        else if (event.type === 'attack' && from && to) drawSlash(ctx, from, to, sample.progress, effectAtlas, Art);
        else if (event.type === 'heal' && to) drawHeal(ctx, to, sample.progress, effectiveMode !== 'full', effectAtlas, Art);
        else if (event.type === 'death' && source) drawEffectSprite(ctx, effectAtlas, Art, 'death', from.x, from.y - 18, 92, sample.progress, 0);
      }

      drawAmbient(ctx, size, now, view.biome || 'jura', effectiveMode, biome && biome.particle);

      if (surface && timelineDone && effectiveMode !== 'full') surface.setAnimated(false);
    }

    function onPointer(pointer) {
      if (!lastGeometry) return;
      if (pointer.type === 'pointerleave') { hover = null; canvas.style.cursor = 'default'; if (surface) surface.invalidate(); return; }
      var cell = hitTest(lastGeometry, pointer.x, pointer.y);
      hover = cell && reachable[cellKey(cell.x, cell.y)] ? cell : null;
      canvas.style.cursor = hover ? 'pointer' : 'default';
      if (pointer.type === 'pointerup' && hover && options.onCell) options.onCell(hover.x, hover.y);
      if (surface) surface.invalidate();
    }

    var surface = root.GameCanvasCore.createSurface(canvas, { maxFps: 30, dprCap: 1.5, animate: effectiveMode === 'full' || timeline.active(), draw: draw, onPointer: onPointer });
    if (!surface) return null;
    Promise.all([root.GameCanvasCore.loadImage(Art.assets.battleBiomes), root.GameCanvasCore.loadImage(Art.assets.battleUnits), root.GameCanvasCore.loadImage(Art.assets.battleEffects)]).then(function (images) {
      background = images[0]; atlas = images[1]; effectAtlas = images[2]; assetsReady = true;
      if (canvas.parentNode) canvas.parentNode.classList.add('canvas-enhanced');
      canvas.setAttribute('data-assets-ready', '1'); surface.invalidate();
      if (options.onReady) options.onReady();
    }).catch(function () { canvas.setAttribute('data-assets-ready', '0'); surface.invalidate(); });

    return { destroy: surface.destroy, invalidate: surface.invalidate, assetsReady: function () { return assetsReady; } };
  }

  root.GameBattleScene = { mount: mount, geometry: geometry, cellPoint: cellPoint, hitTest: hitTest };
})();
