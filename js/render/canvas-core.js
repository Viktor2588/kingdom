/* ============================================================
   canvas-core.js — DPR-begrenzte Canvas-Fläche, Asset-Lader,
   30-FPS-Loop, Resize und Pointer-Koordinaten.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var imageCache = {};

  function loadImage(src) {
    if (imageCache[src]) return imageCache[src];
    imageCache[src] = new Promise(function (resolve, reject) {
      if (typeof Image === 'undefined') { reject(new Error('Image API fehlt')); return; }
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Asset konnte nicht geladen werden: ' + src)); };
      img.src = src;
    });
    return imageCache[src];
  }

  function reducedMotion() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function createSurface(canvas, options) {
    options = options || {};
    if (!canvas || typeof canvas.getContext !== 'function') return null;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var destroyed = false, dirty = true, raf = 0, lastFrame = 0;
    var fps = Math.max(1, Math.min(30, Number(options.maxFps) || 30));
    var frameMs = 1000 / fps, draw = options.draw || function () {}, animate = !!options.animate;
    var size = { width: 0, height: 0, dpr: 1 };

    function resize() {
      var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
      var width = Math.max(1, Math.round((rect && rect.width) || canvas.clientWidth || Number(canvas.getAttribute('width')) || 960));
      var height = Math.max(1, Math.round((rect && rect.height) || canvas.clientHeight || Number(canvas.getAttribute('height')) || 540));
      var dpr = Math.min(Number(options.dprCap) || 1.5, Math.max(1, root.devicePixelRatio || 1));
      if (width === size.width && height === size.height && dpr === size.dpr) return false;
      size = { width: width, height: height, dpr: dpr };
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = true;
      return true;
    }

    function schedule() {
      if (!destroyed && !raf && root.requestAnimationFrame) raf = root.requestAnimationFrame(tick);
    }

    function tick(now) {
      raf = 0;
      if (destroyed || !canvas.isConnected) { destroy(); return; }
      if (now - lastFrame < frameMs) { if (dirty || animate) schedule(); return; }
      resize();
      if (!dirty && !animate) return;
      lastFrame = now; dirty = false;
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      ctx.clearRect(0, 0, size.width, size.height);
      draw(ctx, size, now);
      if (dirty || animate) schedule();
    }

    function pointer(event) {
      if (!options.onPointer) return;
      var rect = canvas.getBoundingClientRect();
      options.onPointer({
        x: (event.clientX - rect.left) * (size.width / Math.max(1, rect.width)),
        y: (event.clientY - rect.top) * (size.height / Math.max(1, rect.height)),
        type: event.type,
        originalEvent: event
      });
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', pointer);
      canvas.removeEventListener('pointerleave', pointer);
      canvas.removeEventListener('pointerup', pointer);
      if (root.removeEventListener) root.removeEventListener('resize', onResize);
    }

    function onResize() { dirty = true; schedule(); }

    resize();
    canvas.addEventListener('pointermove', pointer);
    canvas.addEventListener('pointerleave', pointer);
    canvas.addEventListener('pointerup', pointer);
    if (root.addEventListener) root.addEventListener('resize', onResize);
    if (root.requestAnimationFrame) schedule(); else draw(ctx, size, 0);

    return {
      size: function () { return size; },
      invalidate: function () { dirty = true; schedule(); },
      setDraw: function (fn) { draw = fn || draw; dirty = true; schedule(); },
      setAnimated: function (value) { var next = !!value; if (next !== animate) { animate = next; dirty = true; schedule(); } },
      resize: resize,
      destroy: destroy
    };
  }

  root.GameCanvasCore = {
    loadImage: loadImage,
    createSurface: createSurface,
    reducedMotion: reducedMotion
  };
})();
