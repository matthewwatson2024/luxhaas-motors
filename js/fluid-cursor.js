/* ══════════════════════════════════════════════════════════════
   LuxHaus — Water Ripple  (fluid-cursor.js  v4)
   ══════════════════════════════════════════════════════════════
   Strategy
   ─────────
   • Inject an SVG feTurbulence + feDisplacementMap filter.
   • Wrap all scrollable page content (sections, footer) in a
     single <div id="fc-wrap"> and apply filter:url(#fc-water)
     to that wrapper.  Fixed elements (nav, cursor, overlays)
     are left as direct <body> children and are never touched.
   • Cursor movement boosts the displacement scale (0 → ~18 px).
     The scale decays to 0 over ~1.2 s when the cursor is still,
     so content is undisturbed at rest and warps while moving.
   • A canvas overlay draws expanding gold rings as a visual cue
     that reinforces the ripple metaphor.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── desktop only ── */
  if ('ontouchstart' in window) return;
  if (window.matchMedia && window.matchMedia('(max-width:768px)').matches) return;

  console.log('[LuxHaus] fluid-cursor.js v4 loaded — water ripple distortion active');

  /* ══════════════════════════════════════════════════════════════
     1.  SVG FILTER
     feTurbulence generates a slowly-morphing noise field.
     feDisplacementMap uses that field to shift content pixels.
     Low baseFrequency → large, gentle waves (looks like water,
     not static noise).  scale is animated each frame (0 → 18).
  ══════════════════════════════════════════════════════════════ */
  var svgNS = 'http://www.w3.org/2000/svg';
  var filterSVG = document.createElementNS(svgNS, 'svg');
  filterSVG.id = 'fc-svg';
  filterSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  filterSVG.style.cssText =
    'position:fixed;width:0;height:0;top:0;left:0;overflow:hidden;pointer-events:none;';
  filterSVG.innerHTML =
    '<defs>' +
      '<filter id="fc-water" color-interpolation-filters="sRGB"' +
      '        x="-8%" y="-8%" width="116%" height="116%">' +
        '<feTurbulence id="fc-t" type="turbulence"' +
        '  baseFrequency="0.009 0.006" numOctaves="3" seed="11" result="w"/>' +
        '<feDisplacementMap id="fc-d" in="SourceGraphic" in2="w"' +
        '  scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>' +
    '</defs>';
  document.body.appendChild(filterSVG);

  var fcTurb = document.getElementById('fc-t');
  var fcDisp = document.getElementById('fc-d');

  /* ══════════════════════════════════════════════════════════════
     2.  CANVAS  (visual ripple rings — gold expanding arcs)
  ══════════════════════════════════════════════════════════════ */
  var cv = document.createElement('canvas');
  cv.id = 'fc-cv';
  cv.style.cssText =
    'position:fixed;top:0;left:0;pointer-events:none;z-index:9990;';
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d');

  function resize() {
    cv.width  = window.innerWidth;
    cv.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* ══════════════════════════════════════════════════════════════
     3.  CONTENT WRAPPER
     Wrap all non-fixed body children so the filter applies to
     page content but not to nav / cursor / overlays.

     Elements excluded from the wrapper (stay as body children):
       #mainNav     — position:fixed nav
       #mobileMenu  — slide-in mobile menu
       #pageIntro   — full-screen intro overlay
       .cursor      — custom dot cursor
       .cursor-ring — custom ring cursor
       SCRIPT/STYLE — already-executed scripts
       #fc-*        — our own injected elements
  ══════════════════════════════════════════════════════════════ */
  var SKIP_IDS = { mainNav: 1, mobileMenu: 1, pageIntro: 1 };
  var SKIP_CLS = ['cursor', 'cursor-ring'];

  function shouldSkip(el) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return true;
    if (el.id && (SKIP_IDS[el.id] || el.id.slice(0, 3) === 'fc-')) return true;
    for (var i = 0; i < SKIP_CLS.length; i++) {
      if (el.classList.contains(SKIP_CLS[i])) return true;
    }
    return false;
  }

  /* snapshot children now (live HTMLCollection changes as we move nodes) */
  var bodyKids = Array.prototype.slice.call(document.body.children);
  var toMove   = bodyKids.filter(function (el) { return !shouldSkip(el); });

  var wrap = document.createElement('div');
  wrap.id = 'fc-wrap';
  /* filter is applied here; will-change hints the GPU to composite
     this layer separately so scrolling performance is preserved.    */
  wrap.style.cssText = 'filter:url(#fc-water);will-change:filter;';

  document.body.appendChild(wrap);
  toMove.forEach(function (el) { wrap.appendChild(el); });

  /* ══════════════════════════════════════════════════════════════
     4.  STATE
  ══════════════════════════════════════════════════════════════ */
  var mx = -9999, my = -9999, pmx = -9999, pmy = -9999;
  var velSpd   = 0;     /* cursor speed this frame (px) */
  var dispTgt  = 0;     /* velocity-proportional displacement target */
  var dispCur  = 0;     /* smoothed value applied to SVG each frame */
  var rings    = [];    /* canvas ring objects */
  var lastSpawn = 0;
  var phase    = 0;
  var lastTs   = 0;

  /* ══════════════════════════════════════════════════════════════
     5.  MOUSE
  ══════════════════════════════════════════════════════════════ */
  window.addEventListener('mousemove', function (e) {
    mx = e.clientX;
    my = e.clientY;

    var dx = mx - pmx, dy = my - pmy;
    velSpd = Math.sqrt(dx * dx + dy * dy);

    if (velSpd > 1.5) {
      /* displacement target = velocity-proportional, capped at 18 px */
      dispTgt = Math.max(dispTgt, Math.min(velSpd * 0.30, 18));

      /* spawn a canvas ring every ~85 ms while moving */
      var now = performance.now();
      if (velSpd > 3 && now - lastSpawn > 85) {
        rings.push({
          x   : mx,
          y   : my,
          r   : 0,
          life: 1.0,
          spd : 115 + Math.min(velSpd, 60) * 1.6
        });
        if (rings.length > 10) rings.shift();
        lastSpawn = now;
      }
    }

    pmx = mx;
    pmy = my;
  });

  /* ══════════════════════════════════════════════════════════════
     6.  ANIMATION LOOP
  ══════════════════════════════════════════════════════════════ */
  function tick(ts) {
    var dt = lastTs ? Math.min((ts - lastTs) * 0.001, 0.05) : 0.016;
    lastTs = ts;
    phase += dt;

    /* ── displacement: decay target, smooth actual ── */
    /* target decays to ~0 in 1.2 s (pow(0.03, dt) per frame) */
    dispTgt *= Math.pow(0.03, dt);
    /* actual follows target with a fast lerp */
    dispCur += (dispTgt - dispCur) * Math.min(dt * 9, 1);

    /* push to SVG filter */
    if (fcDisp) {
      fcDisp.setAttribute('scale', dispCur.toFixed(3));
    }

    /* ── turbulence: slow undulation gives a living-water feel ──
       baseFrequency drifts gently so the distortion pattern moves
       even without cursor input.  A speed burst increases frequency
       briefly when moving fast (more turbulent = more disturbed).  */
    if (fcTurb) {
      var velBoost = Math.min(velSpd * 0.00025, 0.004);
      var bfX = 0.009 + Math.sin(phase * 0.30) * 0.002 + velBoost;
      var bfY = bfX * 0.67;
      fcTurb.setAttribute('baseFrequency', bfX.toFixed(5) + ' ' + bfY.toFixed(5));
    }

    velSpd *= 0.85;

    /* ── canvas ripple rings ── */
    ctx.clearRect(0, 0, cv.width, cv.height);

    for (var i = rings.length - 1; i >= 0; i--) {
      var rg = rings[i];
      rg.r    += rg.spd * dt;
      rg.life -= dt * 0.80;

      if (rg.life <= 0) { rings.splice(i, 1); continue; }

      var a = rg.life;

      /* primary gold ring */
      ctx.beginPath();
      ctx.arc(rg.x, rg.y, rg.r, 0, 6.2832);
      ctx.strokeStyle = 'rgba(201,168,76,' + (a * 0.55).toFixed(3) + ')';
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      /* secondary inner ring (white, very faint) */
      if (rg.r > 20) {
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r * 0.62, 0, 6.2832);
        ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.15).toFixed(3) + ')';
        ctx.lineWidth   = 0.8;
        ctx.stroke();
      }
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

})();
