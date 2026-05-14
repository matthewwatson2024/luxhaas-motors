/* ── js/easter-egg.js — Floofy ──────────────────────────────────────────────
   Konami: ↑↑↓↓←→←→BA
   Professional 2D game-asset style: multi-tone gold corgi with dark outline,
   animated running legs + tail wag. Premium 5-spoke tire rolls ahead.
 ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ─── Palette ────────────────────────────────────────────────────────── */
  var G  = '#C9A84C'; // brand gold
  var GL = '#E8C86A'; // highlight gold
  var GM = '#96762A'; // mid gold
  var GD = '#6E5020'; // shadow gold
  var OL = '#2C1A00'; // outline
  var SK = '#F0DFA0'; // muzzle skin
  var BK = '#1A0E00'; // eye / nose

  /* ─── Konami sequence ──────────────────────────────────────────────────── */
  var SEQ = [
    'ArrowUp','ArrowUp','ArrowDown','ArrowDown',
    'ArrowLeft','ArrowRight','ArrowLeft','ArrowRight',
    'KeyB','KeyA'
  ];
  var ptr = 0, active = false;

  /* ─── SVG: Floofy — professional 2D game-art corgi, facing right ─────── */
  /* ViewBox 200×112, rendered 168×94. paint-order:stroke-fill via .eo class. */
  var CORGI_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 112"',
      ' width="168" height="94" overflow="visible">',

    /* ── ground shadow ── */
    '<ellipse cx="98" cy="112" rx="88" ry="4" fill="rgba(0,0,0,.22)"/>',

    /* ── TAIL GROUP (CSS wag animation) ── */
    '<g id="etail">',
      /* shadow/back layer */
      '<path class="eo" stroke="',OL,'" stroke-width="2.5" fill="',GD,'"',
        ' d="M28 70 C18 62,6 50,10 34 C14 22,26 20,28 32 C32 20,44 22,40 36',
        ' C48 26,56 36,48 50 C44 60,34 70,28 70 Z"/>',
      /* main gold fill */
      '<path stroke="none" fill="',G,'"',
        ' d="M28 68 C18 58,9 46,13 32 C17 22,27 20,29 32 C33 22,43 24,39 36',
        ' C45 28,52 36,44 48 C40 58,32 68,28 68 Z"/>',
      /* top highlight */
      '<path stroke="none" fill="',GL,'" opacity=".5"',
        ' d="M20 50 C14 42,10 30,15 24 C20 20,27 22,26 32"/>',
    '</g>',

    /* ── REAR FAR LEG — rl2 (darker, drawn before body) ── */
    '<g id="rl2">',
      '<path class="eo" stroke="',OL,'" stroke-width="2" fill="',GD,'"',
        ' d="M50 88 C47 88,43 92,43 100 C43 108,47 112,56 112',
        ' C60 112,64 110,65 107 L66 88 Z"/>',
      '<ellipse class="eo" cx="55" cy="111" rx="13" ry="4.5"',
        ' stroke="',OL,'" stroke-width="1.5" fill="',GD,'"/>',
    '</g>',

    /* ── FRONT FAR LEG — fl2 (darker, drawn before body) ── */
    '<g id="fl2">',
      '<path class="eo" stroke="',OL,'" stroke-width="2" fill="',GD,'"',
        ' d="M127 88 C124 88,120 92,120 100 C120 108,124 112,133 112',
        ' C137 112,141 110,142 107 L143 88 Z"/>',
      '<ellipse class="eo" cx="132" cy="111" rx="13" ry="4.5"',
        ' stroke="',OL,'" stroke-width="1.5" fill="',GD,'"/>',
    '</g>',

    /* ── MAIN BODY ── */
    '<path class="eo" stroke="',OL,'" stroke-width="3" fill="',G,'"',
      ' d="M32 54 C55 44,122 42,148 50 C160 54,166 64,162 74',
      ' C158 82,148 88,130 88 L46 88 C33 88,25 80,26 70',
      ' C26 62,28 56,32 54 Z"/>',
    /* back lit (top of back) */
    '<path stroke="none" fill="',GL,'" opacity=".44"',
      ' d="M36 54 C68 45,122 43,146 51 C138 47,84 43,36 54 Z"/>',
    /* belly shadow */
    '<ellipse cx="88" cy="87" rx="60" ry="4" fill="',GD,'" opacity=".32"/>',

    /* ── NECK / CHEST ── */
    '<path class="eo" stroke="',OL,'" stroke-width="2.5" fill="',G,'"',
      ' d="M146 54 C154 50,166 52,170 60 C172 66,168 76,158 78',
      ' C148 78,142 72,144 64 Z"/>',
    '<path stroke="none" fill="',GL,'" opacity=".32"',
      ' d="M150 54 C158 50,167 53,169 59 C164 52,154 50,150 54 Z"/>',

    /* ── HEAD ── */
    '<path class="eo" stroke="',OL,'" stroke-width="3" fill="',G,'"',
      ' d="M148 38 C154 26,170 22,180 30 C188 36,192 50,188 60',
      ' C184 68,174 72,164 70 C153 68,146 59,147 47 Z"/>',
    /* top highlight */
    '<path stroke="none" fill="',GL,'" opacity=".4"',
      ' d="M152 38 C160 28,174 24,183 32 C188 38,188 50,184 58',
      ' C186 46,182 32,170 26 C160 22,152 30,152 38 Z"/>',

    /* ── MUZZLE ── */
    '<path class="eo" stroke="',OL,'" stroke-width="2.5" fill="',SK,'"',
      ' d="M186 47 C192 43,200 47,200 56 C200 62,196 68,189 68',
      ' C184 68,181 63,182 57 Z"/>',
    /* muzzle crease */
    '<path stroke="',GM,'" stroke-width="1.8" fill="none" stroke-linecap="round"',
      ' d="M186 59 C190 64,196 63,199 59"/>',
    /* muzzle-cheek indent */
    '<path stroke="',GM,'" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".55"',
      ' d="M183 47 C185 42,183 38,179 38"/>',

    /* ── BACK EAR (darker, behind front ear) ── */
    '<path class="eo" stroke="',OL,'" stroke-width="2.5" fill="',GM,'"',
      ' d="M150 37 C147 25,146 11,153 5 C157 1,164 4,164 17 L163 37 Z"/>',
    '<path stroke="none" fill="',G,'"',
      ' d="M152 35 C150 24,149 12,155 6 C158 2,163 5,163 17 Z"/>',

    /* ── FRONT EAR ── */
    '<path class="eo" stroke="',OL,'" stroke-width="2.5" fill="',G,'"',
      ' d="M164 33 C162 21,163 9,169 4 C173 0,180 2,180 15 L178 33 Z"/>',
    '<path stroke="none" fill="',GL,'" opacity=".65"',
      ' d="M166 31 C164 20,165 10,171 5 C175 1,179 3,179 15 Z"/>',
    /* ear crease */
    '<path stroke="',GM,'" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".7"',
      ' d="M168 30 C167 21,168 12,172 7"/>',

    /* ── COLLAR ── */
    '<path class="eo" stroke="',OL,'" stroke-width="2" fill="#5A1515"',
      ' d="M158 67 C163 65,175 65,179 67 C181 69,179 73,175 73',
      ' C168 75,160 73,158 71 Z"/>',
    '<circle class="eo" cx="169" cy="74" r="4.2"',
      ' stroke="',OL,'" stroke-width="1.5" fill="',GL,'"/>',
    '<circle cx="169" cy="74" r="2.6" fill="',G,'"/>',

    /* ── EYE ── */
    '<circle fill="',BK,'" cx="178" cy="42" r="7"/>',
    '<circle fill="#3D2400" cx="178" cy="42" r="5"/>',
    '<circle fill="',BK,'" cx="178" cy="42" r="3"/>',
    '<circle fill="white" cx="180" cy="40" r="2.8"/>',
    '<circle fill="rgba(255,255,255,.48)" cx="176.5" cy="44.5" r="1.2"/>',

    /* ── NOSE ── */
    '<ellipse class="eo" cx="198" cy="54" rx="5" ry="4"',
      ' stroke="',OL,'" stroke-width="1" fill="',BK,'"/>',
    '<ellipse cx="196.5" cy="52.5" rx="2.2" ry="1.4" fill="rgba(255,255,255,.3)"/>',

    /* ── REAR NEAR LEG — rl1 (brighter, drawn after head) ── */
    '<g id="rl1">',
      '<path class="eo" stroke="',OL,'" stroke-width="2.5" fill="',GM,'"',
        ' d="M37 88 C34 88,30 92,30 100 C30 108,34 112,43 112',
        ' C47 112,51 110,53 107 L54 88 Z"/>',
      '<ellipse class="eo" cx="42" cy="111" rx="14" ry="5.5"',
        ' stroke="',OL,'" stroke-width="2" fill="',GM,'"/>',
      /* near-leg highlight */
      '<path stroke="none" fill="',GL,'" opacity=".42"',
        ' d="M37 90 C34 90,31 94,31 100 C31 106,34 111,40 112"/>',
    '</g>',

    /* ── FRONT NEAR LEG — fl1 (brighter, drawn last) ── */
    '<g id="fl1">',
      '<path class="eo" stroke="',OL,'" stroke-width="2.5" fill="',GM,'"',
        ' d="M112 88 C109 88,105 92,105 100 C105 108,109 112,118 112',
        ' C122 112,126 110,128 107 L129 88 Z"/>',
      '<ellipse class="eo" cx="117" cy="111" rx="14" ry="5.5"',
        ' stroke="',OL,'" stroke-width="2" fill="',GM,'"/>',
      '<path stroke="none" fill="',GL,'" opacity=".42"',
        ' d="M112 90 C109 90,106 94,106 100 C106 106,109 111,115 112"/>',
    '</g>',

    '</svg>'
  ].join('');

  /* ─── SVG: Paw print ─────────────────────────────────────────────────── */
  var PAW_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="28" height="28">',
    '<ellipse cx="22" cy="30" rx="12" ry="10" fill="',G,'" opacity=".58"/>',
    '<ellipse cx="9"  cy="17" rx="6"   ry="7"  fill="',G,'" opacity=".58"/>',
    '<ellipse cx="22" cy="13" rx="6"   ry="7"  fill="',G,'" opacity=".58"/>',
    '<ellipse cx="35" cy="17" rx="6"   ry="7"  fill="',G,'" opacity=".58"/>',
    /* centre pad highlight */
    '<ellipse cx="20" cy="27" rx="5" ry="4" fill="',GL,'" opacity=".22"/>',
    '</svg>'
  ].join('');

  /* ─── SVG: Tire — 5-spoke premium wheel ─────────────────────────────── */
  var TIRE_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"',
      ' width="88" height="88" overflow="visible">',

    /* outer tyre rubber */
    '<circle cx="50" cy="50" r="48" fill="#141008" stroke="',OL,'" stroke-width="1.5"/>',
    /* tread dashes */
    '<circle cx="50" cy="50" r="45" fill="none" stroke="',G,'"',
      ' stroke-width="3.5" stroke-dasharray="4.5 9" opacity=".38"/>',
    /* sidewall texture ring */
    '<circle cx="50" cy="50" r="42" fill="none" stroke="rgba(201,168,76,.1)" stroke-width="5"/>',

    /* rim circle */
    '<circle cx="50" cy="50" r="35" fill="#0D0904" stroke="',G,'" stroke-width="2.5"/>',
    /* rim bevel highlight arc (top-left) */
    '<path d="M22 35 A30 30 0 0 1 35 22" fill="none"',
      ' stroke="rgba(232,200,106,.42)" stroke-width="3.5" stroke-linecap="round"/>',

    /* 5 spokes — rotated rounded rects, connect hub (r≈15) to rim (r≈35) */
    '<rect x="47" y="15" width="6" height="20" rx="3" fill="',G,'" transform="rotate(0   50 50)"/>',
    '<rect x="47" y="15" width="6" height="20" rx="3" fill="',G,'" transform="rotate(72  50 50)"/>',
    '<rect x="47" y="15" width="6" height="20" rx="3" fill="',G,'" transform="rotate(144 50 50)"/>',
    '<rect x="47" y="15" width="6" height="20" rx="3" fill="',G,'" transform="rotate(216 50 50)"/>',
    '<rect x="47" y="15" width="6" height="20" rx="3" fill="',G,'" transform="rotate(288 50 50)"/>',
    /* spoke shadow side (slightly darker rect, offset 1px) */
    '<rect x="49" y="15" width="3" height="20" rx="1.5" fill="',GD,'" opacity=".45" transform="rotate(0   50 50)"/>',
    '<rect x="49" y="15" width="3" height="20" rx="1.5" fill="',GD,'" opacity=".45" transform="rotate(72  50 50)"/>',
    '<rect x="49" y="15" width="3" height="20" rx="1.5" fill="',GD,'" opacity=".45" transform="rotate(144 50 50)"/>',
    '<rect x="49" y="15" width="3" height="20" rx="1.5" fill="',GD,'" opacity=".45" transform="rotate(216 50 50)"/>',
    '<rect x="49" y="15" width="3" height="20" rx="1.5" fill="',GD,'" opacity=".45" transform="rotate(288 50 50)"/>',

    /* hub ring */
    '<circle cx="50" cy="50" r="14" fill="',G,'" stroke="',OL,'" stroke-width="2"/>',
    /* hub shadow */
    '<circle cx="50" cy="50" r="9" fill="#141008"/>',
    /* centre bolt */
    '<circle cx="50" cy="50" r="4.5" fill="',GL,'" stroke="',OL,'" stroke-width="1"/>',
    /* hub shine */
    '<circle cx="47" cy="47" r="2.2" fill="rgba(255,255,255,.28)"/>',

    '</svg>'
  ].join('');

  /* ─── Inject CSS ─────────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('ee-styles')) return;
    var s = document.createElement('style');
    s.id = 'ee-styles';
    s.textContent = [
      /* overlay */
      '#ee-overlay{position:fixed;inset:0;pointer-events:none;z-index:99984;overflow:hidden}',

      /* paint-order trick — stroke draws outside fill, giving a clean border */
      '#ee-corgi .eo{paint-order:stroke fill;stroke-linejoin:round;stroke-linecap:round}',

      /* corgi container */
      '#ee-corgi{position:absolute;bottom:0;left:-180px;width:168px;height:94px;',
        'filter:drop-shadow(0 5px 16px rgba(201,168,76,.42))}',
      '#ee-corgi svg{display:block}',

      /* body run cycle (synced with leg period 0.22s) */
      '#ee-corgi.ee-run{animation:ee-run .22s ease-in-out infinite}',
      '@keyframes ee-run{0%,100%{transform:translateY(-6px)}50%{transform:translateY(0)}}',

      /* legs — transform-box makes origin relative to each element's own bbox */
      '#ee-corgi #rl1,#ee-corgi #rl2,',
      '#ee-corgi #fl1,#ee-corgi #fl2{transform-box:fill-box;transform-origin:center top}',

      /* diagonal trot: fl1+rl2 are phase A; fl2+rl1 are phase B (−half-period) */
      '@keyframes ee-rl{0%,100%{transform:rotate(-24deg)}50%{transform:rotate(24deg)}}',
      '@keyframes ee-fl{0%,100%{transform:rotate(22deg)}50%{transform:rotate(-22deg)}}',
      '#ee-corgi.ee-run #fl1{animation:ee-fl .22s ease-in-out infinite 0s}',
      '#ee-corgi.ee-run #rl2{animation:ee-rl .22s ease-in-out infinite 0s}',
      '#ee-corgi.ee-run #fl2{animation:ee-fl .22s ease-in-out infinite -.11s}',
      '#ee-corgi.ee-run #rl1{animation:ee-rl .22s ease-in-out infinite -.11s}',

      /* tail wag */
      '#ee-corgi #etail{transform-box:fill-box;transform-origin:50% 100%}',
      '#ee-corgi.ee-run #etail{animation:ee-tw .36s ease-in-out infinite}',
      '@keyframes ee-tw{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}',

      /* paw prints */
      '.ee-paw{position:absolute;pointer-events:none;opacity:0;',
        'animation:ee-paw-anim 2.8s ease forwards}',
      '@keyframes ee-paw-anim{',
        '0%{opacity:0;transform:scale(.28) rotate(var(--r))}',
        '15%{opacity:.72;transform:scale(1.04) rotate(var(--r))}',
        '28%{opacity:.72;transform:scale(1) rotate(var(--r))}',
        '80%{opacity:.58}',
        '100%{opacity:0;transform:scale(1) rotate(var(--r))}}',

      /* tire */
      '#ee-tire{position:absolute;bottom:4px;opacity:0;',
        'filter:drop-shadow(0 7px 20px rgba(201,168,76,.4));',
        'transition:opacity .38s}',
      '#ee-tire.ee-tvis{opacity:1}',
      /* spin the SVG element, not the container, so drop-shadow stays fixed */
      '#ee-tire svg{animation:ee-tire-spin .76s linear infinite}',
      '@keyframes ee-tire-spin{to{transform:rotate(360deg)}}',

      /* gold flash */
      '#ee-flash{position:fixed;inset:0;pointer-events:none;z-index:99980;',
        'background:radial-gradient(ellipse 88% 68% at 50% 50%,',
          'rgba(201,168,76,.14) 0%,transparent 70%);',
        'animation:ee-flash-anim 1s ease forwards}',
      '@keyframes ee-flash-anim{0%,100%{opacity:0}38%,62%{opacity:1}}',

      /* FLOOFY label */
      '#ee-flabel{position:fixed;top:50%;left:50%;pointer-events:none;z-index:99990;',
        "font-family:'Bebas Neue',sans-serif;font-size:clamp(3.8rem,10vw,9rem);",
        'letter-spacing:.28em;color:#C9A84C;',
        'text-shadow:0 0 50px rgba(201,168,76,.72),0 0 100px rgba(201,168,76,.32);',
        'animation:ee-label-pop 1.8s cubic-bezier(.22,1,.36,1) forwards}',
      '@keyframes ee-label-pop{',
        '0%{opacity:0;transform:translate(-50%,-50%) scale(.58)}',
        '18%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}',
        '44%{opacity:1;transform:translate(-50%,-50%) scale(1)}',
        '80%{opacity:1;transform:translate(-50%,-50%) scale(1)}',
        '100%{opacity:0;transform:translate(-50%,-50%) scale(1.08)}}',

      /* sparkle trail */
      '.ee-spark{position:absolute;pointer-events:none;width:5px;height:5px;',
        'border-radius:50%;background:#C9A84C;',
        'animation:ee-spark-anim 1s ease forwards}',
      '@keyframes ee-spark-anim{',
        '0%{opacity:.82;transform:translate(0,0) scale(1)}',
        '100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.12)}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ─── Build DOM ──────────────────────────────────────────────────────── */
  function buildDOM() {
    if (document.getElementById('ee-overlay')) return;
    var ov = document.createElement('div');
    ov.id = 'ee-overlay';
    document.body.appendChild(ov);
  }

  /* ─── Key listener ───────────────────────────────────────────────────── */
  function onKey(e) {
    if (active) return;
    if (e.code === SEQ[ptr]) {
      ptr++;
      if (ptr === SEQ.length) { ptr = 0; fire(); }
    } else {
      ptr = (e.code === SEQ[0]) ? 1 : 0;
    }
  }

  /* ─── Entry: flash + title card, then launch ─────────────────────────── */
  function fire() {
    if (active) return;
    active = true;

    var flash = document.createElement('div');
    flash.id = 'ee-flash';
    document.body.appendChild(flash);
    setTimeout(function () { if (flash.parentNode) flash.parentNode.removeChild(flash); }, 1100);

    var label = document.createElement('div');
    label.id = 'ee-flabel';
    label.textContent = 'FLOOFY';
    document.body.appendChild(label);
    setTimeout(function () { if (label.parentNode) label.parentNode.removeChild(label); }, 1950);

    setTimeout(runCorgi, 1050);
  }

  /* ─── Main animation ─────────────────────────────────────────────────── */
  function runCorgi() {
    var ov = document.getElementById('ee-overlay');
    if (!ov) return;

    var corgi = document.createElement('div');
    corgi.id = 'ee-corgi';
    corgi.innerHTML = CORGI_SVG;
    corgi.classList.add('ee-run');
    ov.appendChild(corgi);

    var tire = document.createElement('div');
    tire.id = 'ee-tire';
    tire.innerHTML = TIRE_SVG;
    ov.appendChild(tire);

    var vw        = window.innerWidth;
    var totalDist = vw + 430;
    var duration  = Math.max(4200, vw * 3.2);
    var startX    = -180;

    var startTs     = null;
    var lastPawX    = -999;
    var pawIdx      = 0;
    var lastSparkX  = -999;
    var tireVisible = false;

    function frame(ts) {
      if (!startTs) startTs = ts;
      var t = Math.min((ts - startTs) / duration, 1);

      /* ease: short acceleration → long constant run → gentle coast out */
      var ease;
      if      (t < 0.08) ease = (t / 0.08) * 0.08;
      else if (t < 0.88) ease = 0.08 + (t - 0.08) / 0.80 * 0.80;
      else               ease = 0.88 + (t - 0.88) / 0.12 * 0.12;

      var x = startX + totalDist * ease;
      corgi.style.left = x + 'px';

      /* alternating paw prints */
      if (x - lastPawX >= 75 && x > -20 && pawIdx < 50) {
        var isLeft = (pawIdx % 2 === 0);
        dropPaw(ov, x + 55, isLeft ? 4 : 16, isLeft ? -17 : 14);
        lastPawX = x;
        pawIdx++;
      }

      /* sparkle trail off the rump */
      if (x - lastSparkX >= 42 && x > 0) {
        dropSpark(ov, x + 24, 60 + Math.random() * 22);
        lastSparkX = x;
      }

      /* tire rolls 155px ahead, bouncing on a sine arc */
      if (t >= 0.28 && !tireVisible) {
        tireVisible = true;
        tire.classList.add('ee-tvis');
      }
      if (tireVisible) {
        var bounce = Math.abs(Math.sin(ts * 0.0052)) * 36;
        tire.style.left   = (x + 155) + 'px';
        tire.style.bottom = (4 + bounce) + 'px';
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        if (corgi.parentNode) corgi.parentNode.removeChild(corgi);
        tire.classList.remove('ee-tvis');
        setTimeout(function () {
          if (tire.parentNode) tire.parentNode.removeChild(tire);
          active = false;
        }, 450);
      }
    }

    requestAnimationFrame(frame);
  }

  /* ─── Paw print ──────────────────────────────────────────────────────── */
  function dropPaw(container, x, yFromBottom, rotDeg) {
    var paw = document.createElement('div');
    paw.className = 'ee-paw';
    paw.style.setProperty('--r', rotDeg + 'deg');
    paw.style.left   = (x - 14) + 'px';
    paw.style.bottom = yFromBottom + 'px';
    paw.innerHTML = PAW_SVG;
    container.appendChild(paw);
    setTimeout(function () { if (paw.parentNode) paw.parentNode.removeChild(paw); }, 2950);
  }

  /* ─── Gold sparkle ───────────────────────────────────────────────────── */
  function dropSpark(container, x, yFromBottom) {
    var spark = document.createElement('div');
    spark.className = 'ee-spark';
    spark.style.setProperty('--dx', ((Math.random() - 0.5) * 40) + 'px');
    spark.style.setProperty('--dy', -(Math.random() * 28 + 10) + 'px');
    spark.style.left   = x + 'px';
    spark.style.bottom = yFromBottom + 'px';
    container.appendChild(spark);
    setTimeout(function () { if (spark.parentNode) spark.parentNode.removeChild(spark); }, 1100);
  }

  /* ─── Init ───────────────────────────────────────────────────────────── */
  function init() {
    injectCSS();
    buildDOM();
    document.addEventListener('keydown', onKey);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
