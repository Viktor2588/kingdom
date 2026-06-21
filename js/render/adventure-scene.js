/* ============================================================
   adventure-scene.js — Illustrierte Abenteuerkarte mit weichem
   Nebel, Ortsobjekten, Wegvorschau und animierten Armeen.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;

  function point(size, item) { return { x: item.x / 100 * size.width, y: item.y / 100 * size.height }; }
  function nodeRadius(size, node) {
    var base = Math.max(26, Math.min(52, size.width * 0.045));
    return node.kind === 'capital' ? base * 1.22 : (node.kind === 'region' ? base : base * 0.9);
  }
  function hitTest(view, width, height, px, py) {
    var size = { width: width, height: height }, closest = null, best = Infinity;
    (view.nodes || []).forEach(function (node) {
      var p = point(size, node), dx = px - p.x, dy = py - p.y, distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= nodeRadius(size, node) && distance < best) { closest = node.id; best = distance; }
    });
    return closest;
  }
  function direction(from, to) {
    var dx = to.x - from.x, dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'west' : 'east';
    return dy < 0 ? 'north' : 'south';
  }
  function nodeMap(view) {
    var out = {}; (view.nodes || []).forEach(function (node) { out[node.id] = node; }); return out;
  }

  function drawBiomeMotes(ctx, size, nodes, Art, now) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    (nodes || []).filter(function (node) { return node.unlocked; }).slice(0, 14).forEach(function (node, index) {
      var biome = Art.biomeFor(node.id), p = point(size, node); if (!biome) return;
      var phase = now / (biome.key === 'mountain' ? 520 : 760) + index * 1.71;
      var x = p.x + Math.cos(phase * 1.13) * (18 + index % 3 * 6);
      var y = p.y - 22 + Math.sin(phase) * 9;
      ctx.fillStyle = biome.particle; ctx.globalAlpha = 0.22 + (index % 3) * 0.08;
      if (biome.key === 'jura') { ctx.save(); ctx.translate(x, y); ctx.rotate(phase); ctx.fillRect(-3, -1, 6, 2); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(x, y, biome.key === 'mountain' ? 2.2 : 1.7, 0, Math.PI * 2); ctx.fill(); }
    });
    ctx.restore();
  }

  function drawRoute(ctx, size, from, to, status, highlighted, now) {
    var a = point(size, from), b = point(size, to);
    ctx.save(); ctx.lineCap = 'round';
    if (status === 'secured') { ctx.strokeStyle = '#73d99a'; ctx.lineWidth = highlighted ? 5 : 3; ctx.setLineDash([]); }
    else if (status === 'unlocked') { ctx.strokeStyle = '#e6bd63'; ctx.lineWidth = highlighted ? 5 : 2.5; ctx.setLineDash(highlighted ? [10, 7] : [6, 6]); }
    else { ctx.strokeStyle = 'rgba(83,78,98,.42)'; ctx.lineWidth = 2; ctx.setLineDash([4, 9]); }
    if (highlighted) { ctx.shadowColor = '#ffd36f'; ctx.shadowBlur = 12; ctx.lineDashOffset = -(now / 45) % 17; }
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
  }

  function drawStatus(ctx, p, radius, node, now) {
    var x = p.x + radius * 0.55, y = p.y - radius * 0.48;
    ctx.save(); ctx.lineWidth = 2.2;
    if (node.status === 'secured') {
      ctx.fillStyle = '#1f7650'; ctx.strokeStyle = '#a7f3c1'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 1, y + 3); ctx.lineTo(x + 5, y - 4); ctx.stroke();
    } else if (node.status === 'reachable') {
      var pulse = 1 + Math.sin(now / 260) * 0.12; ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.scale(pulse, pulse);
      ctx.fillStyle = '#5b3a18'; ctx.strokeStyle = '#ffd777'; ctx.fillRect(-8, -8, 16, 16); ctx.strokeRect(-8, -8, 16, 16);
    } else if (node.status === 'guarded') {
      ctx.fillStyle = '#6e2434'; ctx.strokeStyle = '#ff91a0'; ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 10, y + 8); ctx.lineTo(x - 10, y + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, y + 5);
    } else {
      ctx.fillStyle = '#252733'; ctx.strokeStyle = '#858898'; ctx.fillRect(x - 7, y - 2, 14, 11); ctx.strokeRect(x - 7, y - 2, 14, 11);
      ctx.beginPath(); ctx.arc(x, y - 2, 5, Math.PI, 0); ctx.stroke();
    }
    ctx.restore();
  }

  function mount(canvas, view, options) {
    options = options || {};
    var Core = root.GameCanvasCore, FX = root.GameCanvasEffects, Art = root.GameArtData;
    if (!Core || !FX || !Art || !root.CanvasRenderingContext2D) return null;
    var mode = options.mode || 'full'; if (Core.reducedMotion() && mode === 'full') mode = 'reduced';
    var timeline = FX.createTimeline(options.events || [], mode), selectedId = options.selectedId || 'hauptstadt', hoverId = null;
    var mapImage = null, locationAtlas = null, armyAtlas = null, assetsReady = false, surface = null;
    var nodes = nodeMap(view), lastSize = null, fogCanvas = root.document ? root.document.createElement('canvas') : null, fogKey = '';

    function drawFog(ctx, size) {
      if (!fogCanvas) return;
      var key = Math.round(size.width) + 'x' + Math.round(size.height) + ':' + (view.nodes || []).filter(function (node) { return node.unlocked; }).map(function (node) { return node.id + (node.secured ? ':s' : ':u'); }).join(',');
      if (key !== fogKey) {
        fogKey = key;
        if (fogCanvas.width !== Math.round(size.width) || fogCanvas.height !== Math.round(size.height)) { fogCanvas.width = Math.round(size.width); fogCanvas.height = Math.round(size.height); }
        var fctx = fogCanvas.getContext('2d'); fctx.clearRect(0, 0, size.width, size.height);
        fctx.fillStyle = 'rgba(4,7,14,.78)'; fctx.fillRect(0, 0, size.width, size.height);
        fctx.globalCompositeOperation = 'destination-out';
        (view.nodes || []).forEach(function (node) {
          if (!node.unlocked) return;
          var p = point(size, node), radius = Math.max(70, Math.min(155, size.width * (node.secured ? 0.13 : 0.095)));
          var gradient = fctx.createRadialGradient(p.x, p.y, radius * 0.25, p.x, p.y, radius);
          gradient.addColorStop(0, 'rgba(0,0,0,1)'); gradient.addColorStop(0.62, 'rgba(0,0,0,.9)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
          fctx.fillStyle = gradient; fctx.beginPath(); fctx.arc(p.x, p.y, radius, 0, Math.PI * 2); fctx.fill();
        });
        fctx.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(fogCanvas, 0, 0, size.width, size.height);
    }

    function drawLocation(ctx, size, node, now) {
      var sprite = Art.mapObjectFor(node.id), p = point(size, node), radius = nodeRadius(size, node);
      var selected = node.id === selectedId, hovered = node.id === hoverId;
      ctx.save(); ctx.globalAlpha = node.unlocked ? 1 : 0.18;
      ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + radius * 0.44, radius * 0.62, radius * 0.2, 0, 0, Math.PI * 2); ctx.fill();
      if (sprite && locationAtlas) {
        var sw = locationAtlas.width / Art.adventureLocationAtlas.columns, sh = locationAtlas.height / Art.adventureLocationAtlas.rows;
        var dw = radius * 1.8 * sprite.scale, dh = dw * sh / sw;
        ctx.drawImage(locationAtlas, sprite.col * sw, sprite.row * sh, sw, sh, p.x - dw / 2, p.y - dh * 0.76, dw, dh);
      } else {
        ctx.fillStyle = '#314a4b'; ctx.beginPath(); ctx.arc(p.x, p.y, radius * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = Math.round(radius * 0.62) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(node.icon, p.x, p.y + radius * 0.2);
      }
      ctx.globalAlpha = 1;
      if (selected || hovered) {
        var pulse = hovered ? 1 + Math.sin(now / 220) * 0.05 : 1;
        ctx.strokeStyle = selected ? '#ffe092' : '#9de4ff'; ctx.lineWidth = selected ? 3 : 2; ctx.setLineDash(selected ? [] : [5, 4]);
        ctx.beginPath(); ctx.ellipse(p.x, p.y + radius * 0.34, radius * 0.78 * pulse, radius * 0.28 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
      }
      drawStatus(ctx, p, radius, node, now);
      if (selected || hovered) {
        ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        var width = Math.min(170, ctx.measureText(node.name).width + 18), labelY = p.y + radius * 0.95;
        ctx.fillStyle = 'rgba(7,12,20,.9)'; ctx.strokeStyle = selected ? '#d8ad57' : '#587c91'; ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(p.x - width / 2, labelY - 12, width, 22, 6); else ctx.rect(p.x - width / 2, labelY - 12, width, 22);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f5f0df'; ctx.fillText(node.name, p.x, labelY + 3);
      }
      ctx.restore();
    }

    function armyPoint(size, army, sample) {
      if (sample.event && sample.event.type === 'army-move' && sample.event.key === army.renderKey) {
        var p = FX.easeInOut(sample.progress);
        return { x: (sample.event.from.x + (sample.event.to.x - sample.event.from.x) * p) / 100 * size.width, y: (sample.event.from.y + (sample.event.to.y - sample.event.from.y) * p) / 100 * size.height };
      }
      return point(size, army);
    }

    function drawArmy(ctx, size, army, sample, index, now) {
      var p = armyPoint(size, army, sample), event = sample.event;
      var facing = event && event.key === army.renderKey ? direction(event.from, event.to) : 'east';
      var sprite = Art.armyFor(army.rulerLed, facing), bob = mode === 'full' && sample.done ? Math.sin(now / 260 + index) * 2.4 : 0;
      var same = (view.armies || []).filter(function (item) { return item.nodeId === army.nodeId; }), offset = same.indexOf(army) - (same.length - 1) / 2;
      p.x += offset * 22; p.y -= 18;
      ctx.save(); ctx.translate(p.x, p.y + bob); if (mode === 'full') ctx.rotate(Math.sin(now / 420 + index) * 0.018);
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(0, 15, 19, 6, 0, 0, Math.PI * 2); ctx.fill();
      if (armyAtlas) {
        var sw = armyAtlas.width / Art.adventureArmyAtlas.columns, sh = armyAtlas.height / Art.adventureArmyAtlas.rows, dw = 56, dh = dw * sh / sw;
        ctx.drawImage(armyAtlas, sprite.col * sw, sprite.row * sh, sw, sh, -dw / 2, -dh * 0.77, dw, dh);
      } else { ctx.fillStyle = '#1d7597'; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#17131e'; ctx.strokeStyle = '#ffd77c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(18, 8, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe8a6'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(army.command), 18, 11);
      ctx.restore();
    }

    function draw(ctx, size, now) {
      lastSize = size;
      if (mapImage) ctx.drawImage(mapImage, 0, 0, size.width, size.height); else { ctx.fillStyle = '#193c35'; ctx.fillRect(0, 0, size.width, size.height); }
      ctx.fillStyle = 'rgba(6,12,18,.1)'; ctx.fillRect(0, 0, size.width, size.height);
      var targetId = hoverId || selectedId;
      (view.routes || []).forEach(function (route) {
        var from = nodes[route.fromId], to = nodes[route.toId]; if (!from || !to) return;
        var preview = !!targetId && (view.armies || []).some(function (army) { return army.movement > 0 && ((army.nodeId === route.fromId && targetId === route.toId) || (army.nodeId === route.toId && targetId === route.fromId)); });
        drawRoute(ctx, size, from, to, route.status, preview, now);
      });
      drawFog(ctx, size);
      (view.nodes || []).slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (node) { drawLocation(ctx, size, node, now); });
      var sample = timeline.sample(now);
      (view.armies || []).forEach(function (army, index) { drawArmy(ctx, size, army, sample, index, now); });
      if (mode === 'full') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        (view.nodes || []).filter(function (node) { return node.secured; }).slice(0, 8).forEach(function (node, index) {
          var p = point(size, node), angle = now / 900 + index * 2.1;
          ctx.fillStyle = 'rgba(113,234,192,.45)'; ctx.beginPath(); ctx.arc(p.x + Math.cos(angle) * 18, p.y - 22 + Math.sin(angle) * 8, 2, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
        drawBiomeMotes(ctx, size, view.nodes, Art, now);
      }
      if (surface && sample.done && mode !== 'full') surface.setAnimated(false);
    }

    function onPointer(pointer) {
      if (!lastSize) return;
      if (pointer.type === 'pointerleave') { hoverId = null; canvas.style.cursor = 'default'; surface.invalidate(); return; }
      hoverId = hitTest(view, lastSize.width, lastSize.height, pointer.x, pointer.y);
      canvas.style.cursor = hoverId ? 'pointer' : 'default';
      if (pointer.type === 'pointerup' && hoverId) { selectedId = hoverId; if (options.onNode) options.onNode(hoverId); }
      surface.invalidate();
    }

    surface = Core.createSurface(canvas, { maxFps: 20, dprCap: 1.25, animate: mode === 'full' || timeline.active(), draw: draw, onPointer: onPointer });
    if (!surface) return null;
    Promise.all([Core.loadImage(Art.assets.adventureMap), Core.loadImage(Art.assets.adventureLocations), Core.loadImage(Art.assets.adventureArmies)]).then(function (images) {
      mapImage = images[0]; locationAtlas = images[1]; armyAtlas = images[2]; assetsReady = true;
      if (canvas.parentNode) canvas.parentNode.classList.add('canvas-enhanced');
      canvas.setAttribute('data-assets-ready', '1'); surface.invalidate(); if (options.onReady) options.onReady();
    }).catch(function () { canvas.setAttribute('data-assets-ready', '0'); surface.invalidate(); });

    return {
      destroy: surface.destroy, invalidate: surface.invalidate, assetsReady: function () { return assetsReady; },
      setSelected: function (id) { selectedId = id; surface.invalidate(); }
    };
  }

  root.GameAdventureScene = { mount: mount, hitTest: hitTest, direction: direction };
})();
