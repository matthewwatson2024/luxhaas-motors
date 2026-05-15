/* ============================================================
   LUXHAUS MOTORS — Main JavaScript
   ============================================================ */

'use strict';

/* ── Mobile / browser detection (global — shared by all three WebGL inits) ── */
// isMobile is declared here so heroScene and showcaseScene can use the same
// check that configScene uses. Previously it was only inside initConfigScene.
const isMobile = window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024);
// iOS Safari kills pages that open too many WebGL contexts or exceed ~500 MB RAM.
// Chrome for Android is more lenient. Flag lets us apply Safari-only workarounds.
const isSafariMobile = isMobile && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
// Android Chrome: less context-sensitive than Safari but has weaker GPU drivers.
// Used to choose shadow quality, pixel ratio cap, and PMREM fallback path.
const isAndroid = /android/i.test(navigator.userAgent);

/* ── Custom Cursor ── */
(function() {
  const cursor = document.querySelector('.cursor');
  const ring = document.querySelector('.cursor-ring');
  if (!cursor || !ring) return;

  let rx = 0, ry = 0, cx = 0, cy = 0;

  document.addEventListener('mousemove', e => {
    cx = e.clientX; cy = e.clientY;
    cursor.style.left = cx + 'px';
    cursor.style.top  = cy + 'px';
  });

  (function animRing() {
    rx += (cx - rx) * 0.14;
    ry += (cy - ry) * 0.14;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    requestAnimationFrame(animRing);
  })();

  document.querySelectorAll('a, button, .btn-gold, .btn-outline, .swatch, .filter-btn, .option-btn, .card-cta').forEach(el => {
    el.addEventListener('mouseenter', () => { cursor.classList.add('hovering'); ring.classList.add('hovering'); });
    el.addEventListener('mouseleave', () => { cursor.classList.remove('hovering'); ring.classList.remove('hovering'); });
  });
})();

/* ── Page Intro ── */
window.addEventListener('DOMContentLoaded', () => {
  const intro = document.querySelector('.page-intro');
  if (intro) {
    setTimeout(() => intro.classList.add('hidden'), 1600);
  }
  const currentYear = new Date().getFullYear();
  document.querySelectorAll('.current-year').forEach(el => {
    el.textContent = currentYear;
  });
  document.body.classList.add('page-loaded');
});

/* ── Navigation ── */
const nav = document.getElementById('mainNav');
window.addEventListener('scroll', () => {
  if (!nav) return;
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

// Set active link
document.querySelectorAll('.nav-links a').forEach(link => {
  if (link.href === window.location.href) link.classList.add('active');
});

// Mobile toggle
const navToggle = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
if (navToggle && mobileMenu) {
  navToggle.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    navToggle.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
}

/* ── Scroll Reveal ── */
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ── Counter Animation ── */
function animateCount(el) {
  const raw  = el.textContent.trim();
  const num  = parseInt(raw.replace(/\D/g, ''), 10);
  const suf  = raw.replace(/[\d,]/g, '');
  const dur  = 1800;
  const step = num / (dur / 16);
  let cur = 0;
  const tick = setInterval(() => {
    cur += step;
    if (cur >= num) { cur = num; clearInterval(tick); }
    el.textContent = Math.floor(cur).toLocaleString() + suf;
  }, 16);
}

const counterObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.stat-n').forEach(animateCount);
      counterObs.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.hero-stats').forEach(el => counterObs.observe(el));

/* ── Hero Image Parallax ── */
(function() {
  const heroBgImg = document.querySelector('.hero-bg img');
  if (!heroBgImg) return;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y < window.innerHeight) {
      heroBgImg.style.transform = `scale(1.05) translateY(${y * 0.25}px)`;
    }
  }, { passive: true });
})();

/* ── Three.js: Hero Scene ── */
function initHeroScene() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  // Mobile Safari crashes when 3 WebGL contexts are live simultaneously.
  // This canvas is purely decorative (particles + gem). Skip it on mobile so
  // the GPU budget is reserved entirely for the interactive config canvas.
  if (isMobile) { canvas.style.display = 'none'; return; }

  const scene    = new THREE.Scene();
  const w = window.innerWidth, h = window.innerHeight;
  const camera   = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true,
    antialias: false,           // MSAA doubles framebuffer memory; skip on this decorative canvas
    powerPreference: 'default', // don't request high-performance GPU for a decorative scene
  });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);

  /* Particles */
  const N   = 500;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 36;
    pos[i*3+1] = (Math.random() - 0.5) * 22;
    pos[i*3+2] = (Math.random() - 0.5) * 18;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xC9A84C, size: 0.045,
    transparent: true, opacity: 0.55,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  /* Central Gem — Icosahedron */
  const icoGeo = new THREE.IcosahedronGeometry(2.2, 1);
  const solidMat = new THREE.MeshStandardMaterial({
    color: 0xC9A84C, metalness: 0.95, roughness: 0.05,
    transparent: true, opacity: 0.1, side: THREE.DoubleSide,
  });
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xC9A84C, wireframe: true,
    transparent: true, opacity: 0.18,
    blending: THREE.AdditiveBlending,
  });
  const gem     = new THREE.Mesh(icoGeo, solidMat);
  const gemWire = new THREE.Mesh(icoGeo, wireMat);
  gem.position.set(3.5, 0.5, 0);
  gemWire.position.copy(gem.position);
  scene.add(gem, gemWire);

  /* Lights */
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const goldPt = new THREE.PointLight(0xC9A84C, 5, 25);
  goldPt.position.set(5, 5, 4);
  scene.add(goldPt);
  const coolPt = new THREE.PointLight(0x2244bb, 1.5, 18);
  coolPt.position.set(-4, -3, 3);
  scene.add(coolPt);

  /* Mouse parallax */
  let mx = 0, my = 0, tmx = 0, tmy = 0;
  window.addEventListener('mousemove', e => {
    tmx = (e.clientX / window.innerWidth  - 0.5) * 2;
    tmy = -(e.clientY / window.innerHeight - 0.5) * 2;
  });

  const clock = new THREE.Clock();

  // Context loss: Safari reclaims GPU memory under pressure. Without this guard,
  // renderer.render() throws after context loss and crashes the page.
  let heroActive = true;
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    heroActive = false;
  }, false);
  canvas.addEventListener('webglcontextrestored', () => { heroActive = true; }, false);

  (function frame() {
    requestAnimationFrame(frame);
    if (!heroActive) return;
    const t = clock.getElapsedTime();
    mx += (tmx - mx) * 0.03;
    my += (tmy - my) * 0.03;

    gem.rotation.x = t * 0.07 + my * 0.15;
    gem.rotation.y = t * 0.11 + mx * 0.15;
    gemWire.rotation.copy(gem.rotation);

    particles.rotation.y = t * 0.012;
    particles.rotation.x = t * 0.007;

    goldPt.position.x = Math.sin(t * 0.45) * 6;
    goldPt.position.y = Math.cos(t * 0.35) * 4;

    camera.position.x += (mx * 0.8 - camera.position.x) * 0.018;
    camera.position.y += (my * 0.4 - camera.position.y) * 0.018;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  })();

  window.addEventListener('resize', () => {
    const nw = window.innerWidth, nh = window.innerHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
}

/* ── Three.js: Showcase Scene ── */
function initShowcaseScene() {
  const canvas = document.getElementById('showcaseCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  // Same reason as heroScene: skip on mobile to keep the context count at 1.
  if (isMobile) { canvas.style.display = 'none'; return; }

  const scene    = new THREE.Scene();
  scene.background = new THREE.Color(0x0D0D0D);
  scene.fog        = new THREE.FogExp2(0x0D0D0D, 0.028);

  const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(-5, 2, 9);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,           // decorative scene — no MSAA needed
    powerPreference: 'default',
  });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

  /* Torus Knot — 220 segments is GPU-heavy; already skipped on mobile (returned above) */
  const tkGeo = new THREE.TorusKnotGeometry(1.9, 0.42, 220, 22);
  const tkMat = new THREE.MeshStandardMaterial({
    color: 0xC9A84C, metalness: 0.98, roughness: 0.04,
  });
  const tk = new THREE.Mesh(tkGeo, tkMat);
  tk.position.set(-2, 0, 0);
  scene.add(tk);

  /* Ring orbiting */
  const rGeo  = new THREE.TorusGeometry(3.5, 0.015, 8, 100);
  const rMat  = new THREE.MeshBasicMaterial({ color: 0xC9A84C, transparent: true, opacity: 0.2 });
  const ring1 = new THREE.Mesh(rGeo, rMat);
  ring1.rotation.x = Math.PI / 2.5;
  scene.add(ring1);
  const ring2 = ring1.clone();
  ring2.rotation.z = Math.PI / 3;
  scene.add(ring2);

  /* Particles */
  const pN = 900, pArr = new Float32Array(pN * 3);
  for (let i = 0; i < pN; i++) {
    pArr[i*3]   = (Math.random() - 0.5) * 24;
    pArr[i*3+1] = (Math.random() - 0.5) * 18;
    pArr[i*3+2] = (Math.random() - 0.5) * 18;
  }
  const pcGeo = new THREE.BufferGeometry();
  pcGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
  const pcMat = new THREE.PointsMaterial({
    color: 0xC9A84C, size: 0.025, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  scene.add(new THREE.Points(pcGeo, pcMat));

  /* Lights */
  scene.add(new THREE.AmbientLight(0x111111, 1));
  const top = new THREE.PointLight(0xC9A84C, 6, 20);
  top.position.set(0, 10, 0);
  scene.add(top);
  const front = new THREE.PointLight(0xffffff, 2.5, 14);
  front.position.set(4, 2, 6);
  scene.add(front);
  const back  = new THREE.PointLight(0xC9A84C, 2, 12);
  back.position.set(-5, -2, -5);
  scene.add(back);

  const clock = new THREE.Clock();

  let showcaseActive = true;
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    showcaseActive = false;
  }, false);
  canvas.addEventListener('webglcontextrestored', () => { showcaseActive = true; }, false);

  (function frame() {
    requestAnimationFrame(frame);
    if (!showcaseActive) return;
    const t = clock.getElapsedTime();
    tk.rotation.x = t * 0.09;
    tk.rotation.y = t * 0.14;
    ring1.rotation.z = t * 0.05;
    ring2.rotation.x = t * 0.04;
    top.intensity = 5 + Math.sin(t * 1.8) * 1.5;
    renderer.render(scene, camera);
  })();

  new ResizeObserver(() => {
    const p = canvas.parentElement;
    if (!p) return;
    camera.aspect = p.clientWidth / p.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(p.clientWidth, p.clientHeight);
  }).observe(canvas.parentElement);
}

/* ── WebGL probe + graceful fallback ─────────────────────────────────────────
   supportsWebGL()   — probes a scratch canvas before touching the real one.
                       Catches: hardware acceleration disabled, private-browsing
                       restrictions (iOS 16 Lockdown Mode), GPU process crash.
   showConfigFallback() — hides the canvas and inserts a branded static panel
                       so the rest of the configurator (swatches, price, options)
                       keeps working without the 3D view.
────────────────────────────────────────────────────────────────────────────── */
function supportsWebGL() {
  try {
    const probe = document.createElement('canvas');
    return !!(probe.getContext('webgl') || probe.getContext('experimental-webgl'));
  } catch (e) { return false; }
}

function showConfigFallback(canvas, reason) {
  if (!canvas) return;
  canvas.style.display = 'none';
  const parent = canvas.parentElement;
  if (!parent) return;
  const fb = document.createElement('div');
  Object.assign(fb.style, {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    width: '100%', height: '100%',
    background: '#080808',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter, sans-serif', textAlign: 'center',
    letterSpacing: '0.14em', textTransform: 'uppercase', padding: '2rem',
  });
  fb.setAttribute('aria-label', '3D configurator unavailable');
  fb.innerHTML =
    '<p style="margin:0 0 0.75rem;font-size:0.9rem;letter-spacing:0.08em">LUXHAUS M1165A1 HMMWV</p>' +
    '<p style="margin:0 0 0.5rem;font-size:0.65rem;opacity:0.55">' + (reason || '3D viewer unavailable') + '</p>' +
    '<p style="margin:0;font-size:0.55rem;opacity:0.32">Contact us to schedule a private viewing</p>';
  parent.appendChild(fb);
}

/* ── Three.js: Config/Customize Vehicle ── */
function initConfigScene() {
  const canvas = document.getElementById('configCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  // Probe before touching the real canvas. Covers: hardware acceleration
  // disabled, iOS Lockdown Mode, GPU process OOM on a cold start.
  if (!supportsWebGL()) {
    showConfigFallback(canvas, 'WebGL not available on this device');
    return;
  }


  /* ── Variant-swap state ──────────────────────────────────────
     baseModel    — the initially-loaded HMMWV_Desert showcase mesh.
     activeVariant — Hunter variant currently in scene (null = base shown).
     variantCache  — folder key → loaded THREE.Object3D for instant re-swap.
  ────────────────────────────────────────────────────────────── */
  let baseModel    = null;
  let activeVariant = null;
  const variantCache = new Map();

  // On mobile, cap the variant geometry cache to 3 entries to bound GPU memory.
  // Each variant OBJ is ~4–5 MB of geometry; 3 entries ≈ 12–15 MB peak.
  // On desktop, keep all variants warm for instant re-swap.
  const _variantCacheMax = isMobile ? 3 : Infinity;

  function _evictVariantCache() {
    if (variantCache.size <= _variantCacheMax) return;
    for (const [key, obj] of variantCache) {
      if (obj === activeVariant) continue; // never evict the visible model
      obj.traverse(child => {
        if (child.isMesh) child.geometry.dispose();
        // Materials are shared singletons — do not dispose them here
      });
      variantCache.delete(key);
      console.log('[LuxHaus] variant cache evicted:', key);
      break; // one eviction per load is enough
    }
  }

  const scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x080808);

  const pW = canvas.parentElement ? canvas.parentElement.clientWidth  : canvas.clientWidth;
  const pH = canvas.parentElement ? canvas.parentElement.clientHeight : canvas.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, pW / pH, 0.1, 200);
  camera.position.set(6, 2.8, 6);
  camera.lookAt(0, 0.8, 0);

  // Renderer creation with antialias retry fallback.
  // antialias:true is preferred (MSAA 4x) but can exhaust GPU memory on Android
  // and older iOS. If creation throws, retry without MSAA before giving up.
  const _pwrPref = isAndroid ? 'default' : 'high-performance';
  let renderer;
  let _activeAntialias = true;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: _pwrPref });
  } catch (_aaErr) {
    console.warn('[LuxHaus] antialias:true renderer failed, retrying without MSAA:', _aaErr.message || _aaErr);
    _activeAntialias = false;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: _pwrPref });
    } catch (secondErr) {
      console.error('[LuxHaus] WebGLRenderer init failed completely:', secondErr);
      showConfigFallback(canvas, 'GPU unavailable — try reloading the page');
      return;
    }
  }
  const _browserPath = isSafariMobile ? 'Safari Mobile'
    : isAndroid ? 'Chrome Android'
    : isMobile  ? 'Mobile (other)'
    : 'Desktop';
  console.log('[LuxHaus] renderer | path:', _browserPath,
    '| antialias:', _activeAntialias,
    '| pixelRatio:', Math.min(devicePixelRatio, isMobile ? 1.5 : 2),
    '| powerPreference:', _pwrPref);

  renderer.setSize(pW, pH);
  // Cap pixel ratio: 1.5 on mobile (saves ~44% fill-rate vs DPR=2), 2 on desktop.
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  // BasicShadowMap on Android: no PCF filter pass — ~30% cheaper shadow render.
  // PCFSoftShadowMap on desktop/Safari: soft penumbra for premium quality.
  renderer.shadowMap.type      = isAndroid ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
  renderer.outputEncoding      = THREE.sRGBEncoding;
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Context loss handler — Safari aggressively reclaims GPU memory when the
  // device is under pressure (background tabs, low battery, thermal throttle).
  // Without this, renderer.render() throws after loss and crashes the JS thread.
  let configActive = true;
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); // required: tells the browser we'll handle restoration
    configActive = false;
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    // Three.js r128 does not auto-restore GPU resources; reload the page if this
    // fires so the user gets a clean context rather than a broken scene.
    window.location.reload();
  }, false);

  /* ── Studio IBL environment map ──────────────────────────────
     Generates a synthetic equirectangular probe matching the 5-light
     studio rig below (warm key upper-right, cool fill left-back, cool
     rim upper-back). Processed by PMREMGenerator into a PMREM cube map
     and set on scene.environment so every MeshStandardMaterial /
     MeshPhysicalMaterial gets diffuse IBL + specular IBL for free.

     No UV coordinates are required — scene.environment is sampled by
     the shader using the surface reflection vector, not uv.
  ────────────────────────────────────────────────────────────── */
  // Flag set to false if PMREM compilation fails (Android GPU driver bug).
  // Consumed below to boost hemi intensity as a fallback ambient source.
  var _envReady = true;

  (function buildStudioEnv() {
      /* 64×32 equirectangular: enough for smooth PMREM blur levels.
         Values >1 in float would give HDR, but UnsignedByte is universally
         safe on macOS Metal WebGL (no OES_texture_float needed).
         The direct-light specular highlight is handled by the scene lights;
         the env map provides the ambient wrap-around reflective quality. */
      var EW = 64, EH = 32;
      var px = new Uint8Array(EW * EH * 4);

      /* Normalised directions matching scene light positions:
           key  (6, 12, 4)   → (0.429, 0.857, 0.286)
           fill (-8, 5, -6)  → (-0.715, 0.447, -0.537)
           rim  (0, 4, -10)  → (0.000, 0.371, -0.928)  */
      for (var ey = 0; ey < EH; ey++) {
        for (var ex = 0; ex < EW; ex++) {
          var phi  = (ey / EH) * Math.PI;
          var th   = (ex / EW) * Math.PI * 2;
          var sp   = Math.sin(phi);
          var nx   = sp * Math.sin(th);
          var ny   = Math.cos(phi);          /* 1=top, -1=floor */
          var nz   = sp * Math.cos(th);
          var tSky = (ny + 1) * 0.5;        /* 0=floor … 1=ceiling */

          /* Studio sky/ground gradient */
          var R = (0.02 + tSky * 0.09) * 255;
          var G = (0.03 + tSky * 0.11) * 255;
          var B = (0.07 + tSky * 0.20) * 255;

          /* Warm key light (upper-right-front) */
          var kd = Math.pow(Math.max(0, nx*0.429 + ny*0.857 + nz*0.286), 10);
          R = Math.min(255, R + kd*235); G = Math.min(255, G + kd*200); B = Math.min(255, B + kd*140);

          /* Cool fill (left-back) */
          var fd = Math.pow(Math.max(0, nx*(-0.715) + ny*0.447 + nz*(-0.537)), 4);
          R = Math.min(255, R + fd*65);  G = Math.min(255, G + fd*80);  B = Math.min(255, B + fd*125);

          /* Cool rim (upper-back) */
          var rd = Math.pow(Math.max(0, nx*0 + ny*0.371 + nz*(-0.928)), 6);
          R = Math.min(255, R + rd*80);  G = Math.min(255, G + rd*100); B = Math.min(255, B + rd*145);

          var ei = (ey * EW + ex) * 4;
          px[ei]=R; px[ei+1]=G; px[ei+2]=B; px[ei+3]=255;
        }
      }

      var envTex = new THREE.DataTexture(px, EW, EH, THREE.RGBAFormat, THREE.UnsignedByteType);
      envTex.encoding  = THREE.sRGBEncoding;
      envTex.needsUpdate = true;

      try {
        // compileEquirectangularShader() compiles a GLSL program at call time.
        // On some Android Adreno/Mali drivers this throws due to a shader
        // compiler bug — catch it here so the rest of the scene still renders.
        var pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        scene.environment = pmrem.fromEquirectangular(envTex).texture;
        envTex.dispose();
        pmrem.dispose();
      } catch (pmremErr) {
        console.warn('[LuxHaus] PMREM env failed — IBL disabled, boosting hemi:', pmremErr.message || pmremErr);
        _envReady = false;
        try { envTex.dispose(); } catch (_) {}
      }
  }());

  /* ── Lighting rig — full 5-light studio setup on all platforms ── */
  // When PMREM fails, compensate with a stronger hemisphere so surfaces
  // still get plausible ambient shading without IBL environment sampling.
  const hemi = new THREE.HemisphereLight(0xB8D4EE, 0x3A3828, _envReady ? 0.55 : 1.2);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xFFF5E0, 2.2);
  keyLight.position.set(6, 12, 4);
  keyLight.castShadow           = true;
  // 1024 on mobile: shadow map is the largest single GPU allocation in the scene.
  // Halving the resolution saves 75% of shadow map VRAM (4MB → 1MB at 32bpp).
  const shadowMapSize = isAndroid ? 1024 : 2048;
  keyLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  keyLight.shadow.camera.near   = 1;
  keyLight.shadow.camera.far    = 50;
  keyLight.shadow.camera.left   = -8;
  keyLight.shadow.camera.right  =  8;
  keyLight.shadow.camera.top    =  8;
  keyLight.shadow.camera.bottom = -8;
  keyLight.shadow.bias          = -0.0004;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xCBDFF5, 0.55);
  fillLight.position.set(-8, 5, -6);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xDEECF8, 1.0);
  rimLight.position.set(0, 4, -10);
  scene.add(rimLight);

  const bounceLight = new THREE.PointLight(0xFFEDD0, 0.7, 10);
  bounceLight.position.set(0, -0.5, 0);
  scene.add(bounceLight);

  /* ── Textures — full 4K PBR maps on all platforms ─────────────── */
  const TX = '/models/humvee-1/uploads_files_3017515_HMMWV_Desert_Textures/';

  const txLoader = new THREE.TextureLoader();
  // Anisotropic filtering: sharpens textures on surfaces seen at oblique angles.
  // Cap at 4 on desktop (sweet spot for quality/cost) and 1 on mobile (disables
  // it entirely — saves texture sampling work with minimal visible difference
  // on small screens).
  const _maxAniso = isMobile ? 1 : Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

  function loadTex(name, sRGB) {
    const t = txLoader.load(TX + name);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = true;
    t.minFilter  = THREE.LinearMipmapLinearFilter; // trilinear — prevents shimmer at distance
    t.anisotropy = _maxAniso;
    if (sRGB) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  const bodyColorTex   = loadTex('Body_Color.jpg',        true);
  const wheelColorTex  = loadTex('Wheels_Color.jpg',      true);
  const suspColorTex   = loadTex('Suspensions_Color.jpg', true);
  const glassColorTex  = loadTex('Glass_color.jpg',       true);
  const lightsColorTex = loadTex('lights_color.jpg',      true);
  const plateColorTex  = loadTex('Nameplates_color.jpg',  true);

  const bodyNormTex   = loadTex('Body_Normal.jpg',          false);
  const bodyRoughTex  = loadTex('Body_Metallic.jpg',        false);
  const wheelNormTex  = loadTex('Wheels_Normal.jpg',        false);
  const wheelRoughTex = loadTex('Wheels_Roughness.jpg',     false);
  const suspNormTex   = loadTex('Suspensions_Normal.jpg',   false);
  const suspMetalTex  = loadTex('Suspensions_Metallic.jpg', false);
  const plateOpacTex  = loadTex('Nameplates_opacity.jpg',   false);

  /* Body PBR material — used by the base HMMWV_Desert model (has UV). */
  const bodyMat = new THREE.MeshStandardMaterial({
    map:          bodyColorTex,
    normalMap:    bodyNormTex,
    roughnessMap: bodyRoughTex,
    metalness:    0.22,
    roughness:    0.65,
  });

  /* Premium automotive paint for UV-less Hunter variant meshes.
     Uses MeshPhysicalMaterial (extends MeshStandardMaterial) which adds
     clearcoat and finer PBR controls — all UV-independent.

     SAFE on macOS Metal WebGL: none of the active properties below
     sample a texture via uv coordinates. The shader only reads the
     surface normal and reflection vector, both of which are supplied
     by the geometry's vn attribute.

     clearcoat         — two-layer paint: pigment base + clear lacquer on top.
                         Gives the characteristic "depth" of premium paint.
     clearcoatRoughness— lacquer is nearly mirror-smooth (0.06); concentrates
                         specular into a crisp highlight band.
     roughness         — base coat under the lacquer; 0.30 = semi-gloss.
     metalness         — solid automotive paint is non-metallic (0.08).
     envMapIntensity   — picks up scene.environment IBL; drives the
                         wrap-around ambient reflection with no UV needed.
     reflectivity      — Fresnel at grazing angles; 0.6 ≈ 4% normal incidence. */
  const variantBodyMat = new THREE.MeshPhysicalMaterial({
    color:              new THREE.Color(0xC4A882),
    metalness:          0.08,
    roughness:          0.30,
    clearcoat:          0.70,
    clearcoatRoughness: 0.08,
    envMapIntensity:    1.4,
    reflectivity:       0.6,
  });

  /* Variant tire material — matte black rubber, no clearcoat, no UV needed. */
  const variantTireMat = new THREE.MeshStandardMaterial({
    color:     new THREE.Color(0x111111),
    metalness: 0.0,
    roughness: 0.88,
    envMapIntensity: 0.4,
  });

  /* Variant wheel-hub material — dark gunmetal, slightly metallic, no UV needed. */
  const variantWheelMat = new THREE.MeshStandardMaterial({
    color:     new THREE.Color(0x1C1F22),
    metalness: 0.55,
    roughness: 0.50,
    envMapIntensity: 0.9,
  });

  /* Variant undercarriage material — very dark metallic grey, matte, no UV needed. */
  const variantUndercarriageMat = new THREE.MeshStandardMaterial({
    color:     new THREE.Color(0x111213),
    metalness: 0.60,
    roughness: 0.70,
    envMapIntensity: 0.5,
  });

  /* Variant interior material — dark charcoal, near-flat finish, no UV needed. */
  const variantInteriorMat = new THREE.MeshStandardMaterial({
    color:     new THREE.Color(0x2D2820),
    metalness: 0.05,
    roughness: 0.85,
    envMapIntensity: 0.3,
  });

  /* Variant bumper material — dark military gray, matte, no UV needed. */
  const variantBumperMat = new THREE.MeshStandardMaterial({
    color:     new THREE.Color(0x1A1C1E),
    metalness: 0.45,
    roughness: 0.75,
    envMapIntensity: 0.6,
  });

  /* Variant window glass — tinted, semi-transparent, double-sided.
     Toggled by setGlassVisible(); hidden when "No Windows" is selected. */
  const variantGlassMat = new THREE.MeshPhysicalMaterial({
    color:        new THREE.Color(0x88AABB),
    transparent:  true,
    opacity:      0.22,
    roughness:    0.04,
    metalness:    0.0,
    transmission: 0.80,
    side:         THREE.DoubleSide,
    depthWrite:   false,
    envMapIntensity: 1.2,
  });

  const wheelMat = new THREE.MeshStandardMaterial({
    map:          wheelColorTex,
    normalMap:    wheelNormTex,
    roughnessMap: wheelRoughTex,
    metalness:    0.3,
    roughness:    0.7,
  });

  const suspMat = new THREE.MeshStandardMaterial({
    map:          suspColorTex,
    normalMap:    suspNormTex,
    roughnessMap: suspMetalTex,
    metalness:    0.5,
    roughness:    0.55,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    map:         glassColorTex,
    metalness:   0.05,
    roughness:   0.08,
    transparent: true,
    opacity:     0.52,
  });

  const lightsMat = new THREE.MeshStandardMaterial({
    map:               lightsColorTex,
    emissiveMap:       lightsColorTex,
    emissive:          new THREE.Color(0xffffff),
    emissiveIntensity: 0.35,
    metalness:         0.15,
    roughness:         0.12,
  });

  const plateMat = new THREE.MeshStandardMaterial({
    map:         plateColorTex,
    alphaMap:    plateOpacTex,
    transparent: true,
    metalness:   0.75,
    roughness:   0.25,
  });

  /* Map OBJ group names → materials */
  function materialForGroup(name) {
    if (name.includes('Body'))        return bodyMat;
    if (name.includes('Wheel'))       return wheelMat;
    if (name.includes('Suspension'))  return suspMat;
    if (name.includes('Glass'))       return glassMat;
    if (name.includes('Light'))       return lightsMat;
    if (name.includes('Nameplate'))   return plateMat;
    return bodyMat;
  }

  /* Rotation group */
  const group = new THREE.Group();
  scene.add(group);

  /* Loading indicator overlay */
  const loadOverlay = document.createElement('div');
  Object.assign(loadOverlay.style, {
    position: 'absolute', inset: '0', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none', zIndex: '5',
  });
  loadOverlay.innerHTML = '<span style="font-size:0.6rem;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.3)">Loading Model…</span>';
  // Guard: canvas could theoretically be unmounted by the time init runs on slow devices
  if (canvas.parentElement) {
    canvas.parentElement.style.position = 'relative';
    canvas.parentElement.appendChild(loadOverlay);
  }

  /* ── Shared model-positioning helper ─────────────────────────
     Auto-centres and scales any loaded OBJ to fit the 5.5-unit
     scene space, then grounds it on y=0.
  ────────────────────────────────────────────────────────────── */
  function fitToScene(object) {
    const box   = new THREE.Box3().setFromObject(object);
    const size  = box.getSize(new THREE.Vector3());
    const scale = 5.5 / Math.max(size.x, size.y, size.z);
    object.scale.setScalar(scale);
    const box2    = new THREE.Box3().setFromObject(object);
    const center2 = box2.getCenter(new THREE.Vector3());
    object.position.x = -center2.x;
    object.position.z = -center2.z;
    object.position.y = -box2.min.y;
  }

  /* ── Base HMMWV_Desert model loading ──────────────────────────── */
  const OBJ_PATH = '/models/humvee-1/uploads_files_3017515_HMMWV_Desert_OBJ/';
  const baseFile = 'HMMWV_Desert_OBJ.obj';

  function onBaseLoad(object) {
    object.traverse(function(child) {
      if (!child.isMesh) return;
      // On mobile, only body/wheel/bumper groups cast shadows — halves the
      // shadow draw call count since tires, glass, and interior rarely cast
      // visible shadows and are expensive to include in the depth pass.
      const _n = (child.name || '').toLowerCase();
      child.castShadow    = !isMobile || _n.includes('body') || _n.includes('wheel') || _n.includes('bumper') || _n === '';
      child.receiveShadow = true;
      const hasUV = !!child.geometry.attributes.uv;
      /* Safety gate: never assign a UV-sampling material to UV-less geometry.
         The base HMMWV_Desert OBJ has full UVs, so this should always be true. */
      child.material = hasUV ? materialForGroup(child.name) : variantBodyMat;
      console.log('[LuxHaus] base mesh "' + (child.name || '(unnamed)') + '" | hasUV:', hasUV, '| mat:', child.material.type);
    });
    fitToScene(object);
    group.add(object);
    baseModel = object;
    loadOverlay.remove();
    _needsRender = true; // bypass throttle — paint the model on the very next tick
  }

  function onBaseError(err) {
    console.error('[LuxHaus] base OBJ load error:', err);
    loadOverlay.remove();
    showConfigFallback(canvas, 'Model unavailable — check your connection');
  }

  // Guard: OBJLoader ships separately from core three.min.js. If its script tag
  // fails to load (CDN timeout, ad-blocker), fall back gracefully instead of
  // throwing "THREE.OBJLoader is not a constructor" and crashing the page.
  if (typeof THREE.OBJLoader !== 'function') {
    console.error('[LuxHaus] THREE.OBJLoader not loaded — check script include order');
    loadOverlay.remove();
    showConfigFallback(canvas, '3D loader failed to load — try reloading');
    return;
  }

  const objLoader = new THREE.OBJLoader();
  objLoader.setPath(OBJ_PATH);
  objLoader.load(baseFile, onBaseLoad, undefined, onBaseError);

  /* Drag-to-rotate controls */
  let isDragging = false, prevX = 0, prevY = 0;
  let rotY = 0.4, rotX = 0.1;

  canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
  window.addEventListener('mouseup',   () => { isDragging = false; });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    rotY += (e.clientX - prevX) * 0.008;
    rotX += (e.clientY - prevY) * 0.004;
    rotX  = Math.max(-0.35, Math.min(0.5, rotX));
    prevX = e.clientX; prevY = e.clientY;
  });

  canvas.addEventListener('touchstart', e => {
    isDragging = true;
    prevX = e.touches[0].clientX;
    prevY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchend', () => { isDragging = false; });
  window.addEventListener('touchmove', e => {
    if (!isDragging) return;
    rotY += (e.touches[0].clientX - prevX) * 0.008;
    rotX += (e.touches[0].clientY - prevY) * 0.004;
    rotX  = Math.max(-0.35, Math.min(0.5, rotX));
    prevX = e.touches[0].clientX;
    prevY = e.touches[0].clientY;
  }, { passive: true });

  /* ── Render loop ────────────────────────────────────────────────
     Desktop  : uncapped (rAF ≈ 60 fps), full quality.
     Mobile   : capped at 30 fps to halve GPU/battery load.
     Tab hidden or canvas scrolled off-screen: rendering suspended.
     Rotation speed is time-normalised so it is frame-rate independent.

     Safety rules:
       · requestAnimationFrame is ALWAYS the very first call — the loop
         never dies, even when we skip rendering for a given tick.
       · _canvasVisible defaults true and is only ever set false by the
         IntersectionObserver; a try/catch and a 500 ms safety timer
         prevent it getting stuck false on browsers that fire the
         observer early (before layout, when the canvas is still 0×0).
       · _needsRender bypasses the throttle gate so a model load or
         variant swap always produces at least one visible frame
         immediately, regardless of where we are in the 30 fps window.
  ────────────────────────────────────────────────────────────── */
  const _frameInterval = isMobile ? 1000 / 30 : 0; // ms; 0 = uncapped
  let   _lastFrameMs   = 0;   // initialised to 0 so first elapsed >> interval
  let   _canvasVisible = true; // assume visible until observer says otherwise
  let   _needsRender   = false; // bypasses throttle for model-load events

  // When the tab comes back from background, reset timestamp so the
  // accumulated elapsed doesn't produce a huge dt jump, and force one render.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      _lastFrameMs = 0;
      _needsRender = true;
    }
  }, false);

  // Pause when the canvas scrolls fully off-screen on mobile.
  // Wrapped in try/catch — IntersectionObserver is widely supported but
  // some privacy browsers disable it; on failure we stay visible.
  try {
    new IntersectionObserver(entries => {
      const nowVisible = entries[0].isIntersecting;
      if (!_canvasVisible && nowVisible) {
        _lastFrameMs = 0;   // reset on resume so next frame isn't throttled
        _needsRender = true;
      }
      _canvasVisible = nowVisible;
    }, { threshold: 0.01 }).observe(canvas);
  } catch (_ioErr) {
    _canvasVisible = true; // observer unavailable — stay always-on
  }

  // Safety net: if the observer fires false before layout settles (canvas
  // still 0×0), force _canvasVisible back to true after 500 ms. By then
  // the ResizeObserver will have given the canvas its real dimensions and
  // a subsequent observer callback will have fired the correct value.
  setTimeout(() => { if (!_canvasVisible) { _canvasVisible = true; _needsRender = true; } }, 500);

  (function frame(now) {
    requestAnimationFrame(frame); // ← ALWAYS first — loop never dies

    if (!configActive) return;

    // Suspend rendering when tab is backgrounded or canvas is off-screen.
    // rAF keeps ticking so we resume instantly when either condition lifts.
    if (document.hidden || !_canvasVisible) return;

    const elapsed = now - _lastFrameMs;

    // Throttle gate (mobile only). _needsRender bypasses it so model loads
    // and variant swaps always produce an immediate visible frame.
    if (!_needsRender && _frameInterval > 0 && elapsed < _frameInterval) return;
    _needsRender  = false;
    _lastFrameMs  = now;

    // Time-based rotation — identical visual speed at 30 fps and 60 fps.
    const dt = Math.min(elapsed || 16.667, 100); // clamp prevents post-pause jump
    if (!isDragging) rotY += 0.003 * (dt / 16.667);

    group.rotation.y = rotY;
    group.rotation.x = rotX;

    renderer.render(scene, camera);
  })();

  /* ── Procedural camo canvas texture ───────────────────────────
     Generates a woodland camouflage pattern using a deterministic
     LCG so the result is identical every call. Returns a
     THREE.CanvasTexture ready to assign to bodyMat.map. */
  function createCamoTexture() {
    const S   = 512;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = S;
    const ctx = cvs.getContext('2d');

    let seed = 0x3AF7C2;
    function rng() {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      return (seed >>> 0) / 0x100000000;
    }

    const palette = ['#7B7246', '#4B5E35', '#2F3D1E', '#3B2B14'];
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, S, S);

    for (let i = 0; i < 110; i++) {
      const bx  = rng() * S;
      const by  = rng() * S;
      const br  = 24 + rng() * 68;
      const col = palette[1 + Math.floor(rng() * 3)];
      const pts = 7 + Math.floor(rng() * 5);

      ctx.beginPath();
      for (let j = 0; j < pts; j++) {
        const a0 = (j       / pts) * Math.PI * 2;
        const a1 = ((j + 1) / pts) * Math.PI * 2;
        const rr = br * (0.6 + rng() * 0.8);
        const nr = br * (0.6 + rng() * 0.8);
        const ca = (a0 + a1) * 0.5 + (rng() - 0.5) * 0.5;
        const cr = br * (0.9 + rng() * 0.7);
        if (j === 0) ctx.moveTo(bx + rr * Math.cos(a0), by + rr * Math.sin(a0));
        ctx.quadraticCurveTo(
          bx + cr * Math.cos(ca), by + cr * Math.sin(ca),
          bx + nr * Math.cos(a1), by + nr * Math.sin(a1)
        );
      }
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS    = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  /* ── Color mode registry ───────────────────────────────────────
     Keys match data-color values from the HTML swatches (compared
     case-insensitively). Two kinds:
       'texture' — assign the provided map; color tint stays white
       'solid'   — no map; hex is applied directly as solid paint
     To add a new finish, register one entry here only. */
  /* solidFallback — colour used for Hunter variants (no UV) when the
     swatch normally drives a texture on the base model. */
  const COLOR_MODES = {
    '#C4A882': { kind: 'texture', map: bodyColorTex,        solidFallback: '#C4A882' },
    'CAMO':    { kind: 'texture', map: createCamoTexture(), solidFallback: '#4B5E35' },
  };

  window.setVehicleColor = function(raw) {
    const mode   = COLOR_MODES[raw.toUpperCase()] || COLOR_MODES[raw] || { kind: 'solid' };
    const isCamo = raw.toUpperCase() === 'CAMO';

    if (mode.kind === 'texture') {
      bodyMat.map = mode.map;
      bodyMat.color.set(0xffffff);
      variantBodyMat.color.set(mode.solidFallback || 0xffffff);
    } else {
      bodyMat.map = null;
      bodyMat.color.set(raw);
      variantBodyMat.color.set(raw);
    }

    /* Camo is a flat military field finish — dull, no clearcoat.
       Every other swatch is showroom automotive paint — high-gloss clearcoat. */
    if (isCamo) {
      variantBodyMat.roughness          = 0.75;
      variantBodyMat.metalness          = 0.02;
      variantBodyMat.clearcoat          = 0.05;
      variantBodyMat.clearcoatRoughness = 0.60;
    } else {
      variantBodyMat.roughness          = 0.30;
      variantBodyMat.metalness          = 0.08;
      variantBodyMat.clearcoat          = 0.70;
      variantBodyMat.clearcoatRoughness = 0.08;
    }

    bodyMat.needsUpdate        = true;
    variantBodyMat.needsUpdate = true;
  };

  /* ── Variant model swap API ───────────────────────────────────
     Hunter OBJ files use v//vn face format (normals only, no UV).
     variantBodyMat has zero UV-dependent shader features, preventing
     the "starry/fragmented" rendering caused by missing uv attributes
     feeding garbage values into a UV-sampling WebGL shader.

     Cache-hit:  instant swap — O(1), no network request.
     Cache-miss: loading overlay shown until OBJ is parsed and staged.
  ────────────────────────────────────────────────────────────── */
  window.swapVariantModel = function(folder) {

    /* Walk every mesh in the loaded OBJ hierarchy and assign the correct
       UV-free material based on the OBJ group name set by segment_variants.py.

       Group → material mapping:
         "tire"      → variantTireMat  (matte black rubber)
         "wheel_hub" → variantWheelMat (dark gunmetal)
         everything else → variantBodyMat (premium automotive paint)

       All three materials are UV-free — no map / normalMap / roughnessMap.
       macOS Metal WebGL is safe: no uv attribute is ever sampled. */
    /* Debug segmentation: set window.LH_DEBUG_SEG = true in console to see
       each group as a distinct flat colour — useful for inspecting classification. */
    var _debugMats = null;
    function _getDebugMat(name) {
      if (!_debugMats) {
        var dc = { body:0xC4A882, tire:0x111111, wheel_hub:0xC8C8C8,
                   undercarriage:0xCC2222, bumper:0x444444, interior:0x3355AA };
        _debugMats = {};
        Object.keys(dc).forEach(function(k) {
          _debugMats[k] = new THREE.MeshBasicMaterial({ color: dc[k], side: THREE.DoubleSide });
        });
        _debugMats['__unknown'] = new THREE.MeshBasicMaterial({ color: 0xFF00FF, side: THREE.DoubleSide });
      }
      return _debugMats[name] || _debugMats['__unknown'];
    }

    function applyVariantMaterial(obj) {
      obj.traverse(function(child) {
        if (!child.isMesh) return;

        const geo  = child.geometry;
        const name = (child.name || '').toLowerCase();

        var mat;
        if (window.LH_DEBUG_SEG) {
          mat = _getDebugMat(name);
        } else {
          /* Group → material mapping (groups set by segment_variants.py):
               tire          → matte black rubber
               wheel_hub     → dark gunmetal disc
               undercarriage → very dark metallic underside
               bumper        → dark military gray
               interior      → dark charcoal cabin
               body          → automotive paint + clearcoat (default) */
          if      (name === 'tire')          mat = variantTireMat;
          else if (name === 'wheel_hub')     mat = variantWheelMat;
          else if (name === 'undercarriage') mat = variantUndercarriageMat;
          else if (name === 'bumper')        mat = variantBumperMat;
          else if (name === 'interior')      mat = variantInteriorMat;
          else if (name === 'window_glass')  mat = variantGlassMat;
          else                               mat = variantBodyMat;
        }

        if (!geo.attributes.normal) geo.computeVertexNormals();

        child.material             = mat;
        child.material.needsUpdate = true;
        // Selective shadow casting on mobile: skip interior, glass, and undercarriage
        // in the depth pass — they add draw calls without meaningful shadow contribution.
        child.castShadow    = !isMobile || (name === 'body' || name === 'bumper' || name === 'wheel_hub');
        child.receiveShadow = true;
      });
    }

    function displayModel(obj) {
      if (activeVariant && activeVariant !== obj) {
        group.remove(activeVariant);
      }
      activeVariant = obj;
      if (baseModel) baseModel.visible = (obj === null);
      if (obj) {
        obj.visible = true;
        if (obj.parent !== group) group.add(obj);
      }
      _needsRender = true; // bypass throttle — paint swap on the very next tick
    }

    if (!folder) { displayModel(null); return; }

    if (variantCache.has(folder)) {
      console.log('[LuxHaus] variant cache hit:', folder);
      displayModel(variantCache.get(folder));
      return;
    }

    /* Not yet cached — fetch, process, stage, and display. */
    const ind = document.createElement('div');
    Object.assign(ind.style, {
      position: 'absolute', inset: '0', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(8,8,8,0.6)', pointerEvents: 'none',
      zIndex: '6', transition: 'opacity 0.25s',
    });
    ind.innerHTML = '<span style="font-size:0.55rem;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.28)">Loading…</span>';
    if (canvas.parentElement) canvas.parentElement.appendChild(ind);

    const url = '/models/variants/' + encodeURIComponent(folder) + '/web_model.obj';

    console.log('[LuxHaus] fetching variant:', folder, url);

    const loader = new THREE.OBJLoader();
    loader.load(url, function(obj) {
      applyVariantMaterial(obj);
      fitToScene(obj);
      variantCache.set(folder, obj);
      _evictVariantCache();
      displayModel(obj);
      ind.style.opacity = '0';
      setTimeout(() => ind.remove(), 260);
    }, undefined, function(err) {
      console.error('[LuxHaus] variant load error:', folder, err);
      ind.style.opacity = '0';
      setTimeout(() => ind.remove(), 260);
    });
  };

  /* ── Glass visibility toggle ─────────────────────────────────────
     Called by the UI when the window configuration changes.
     Hides the window_glass material group without reloading the model. */
  window.setGlassVisible = function(visible) {
    variantGlassMat.opacity    = visible ? 0.22 : 0.0;
    variantGlassMat.visible    = visible;
    variantGlassMat.depthWrite = false;
    variantGlassMat.needsUpdate = true;
  };

  /* ── Accessory overlay system ────────────────────────────────────
     Each accessory is a separate OBJ loaded from /models/accessories/<name>/.
     Active accessories are added to accessoryGroup (a child of group) and
     persist across base-variant swaps. Toggled on/off without re-fetching. */
  const accessoryGroup = new THREE.Group();
  group.add(accessoryGroup);
  const accessoryCache = new Map();

  window.swapAccessory = function(name, active) {
    if (accessoryCache.has(name)) {
      accessoryCache.get(name).visible = active;
      return;
    }
    if (!active) return; // not loaded yet and being toggled off — nothing to do

    const url = '/models/accessories/' + encodeURIComponent(name) + '/web_model.obj';
    console.log('[LuxHaus] fetching accessory:', name, url);
    const loader = new THREE.OBJLoader();
    loader.load(url, function(obj) {
      applyVariantMaterial(obj);
      fitToScene(obj);
      obj.visible = true;
      accessoryCache.set(name, obj);
      accessoryGroup.add(obj);
    }, undefined, function(err) {
      console.warn('[LuxHaus] accessory load failed (model not yet built):', name, err);
    });
  };

  new ResizeObserver(() => {
    const p = canvas.parentElement;
    if (!p) return;
    const w = p.clientWidth, h = p.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }).observe(canvas.parentElement);
}

/* ── Customize Config ── */
(function() {
  const swatches = document.querySelectorAll('.swatch');
  const optBtns  = document.querySelectorAll('.option-btn');

  const prices = {
    base: 165000,
    color: 0,
    roof: 0,
    wheels: 0,
    armor: 0,
    interior: 0,
  };

  function updateTotal() {
    const total = Object.values(prices).reduce((a,b) => a + b, 0);
    const el = document.getElementById('totalPrice');
    if (el) el.textContent = '$' + total.toLocaleString();
  }

  swatches.forEach(sw => {
    sw.addEventListener('click', () => {
      const group = sw.closest('.color-swatches');
      group.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      const hex = sw.dataset.color;
      if (window.setVehicleColor) window.setVehicleColor(hex);
      prices.color = parseInt(sw.dataset.price || 0, 10);
      updateTotal();
    });
  });

  optBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      document.querySelectorAll(`.option-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      prices[group] = parseInt(btn.dataset.price || 0, 10);
      updateTotal();
    });
  });
})();

/* ── Contact Form ── */
(function() {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.textContent = 'Message Sent — We\'ll Be In Touch';
    btn.style.background = '#2D5A27';
    btn.style.color = '#fff';
    btn.disabled = true;
  });
})();

/* ── Three.js: Mobile Image Sequence Viewer ─────────────────────────────────
   Replaces the WebGL configurator on mobile with a pre-rendered image
   sequence. Images live at:
     /images/viewer/{variantFolder}/{colorSlug}/frame-{NN}.jpg
   e.g. /images/viewer/4door-hardtop/sand/frame-01.jpg  (18 frames, 01–18)

   Usage from customize.html:
     window.mobileSetColor(rawColor)   — called when a color swatch is tapped
     window.mobileSetVariant(folder)   — called when body/top option changes
────────────────────────────────────────────────────────────────────────────── */
function initMobileViewer() {
  if (!isMobile) return;
  const viewer = document.getElementById('mobileViewer');
  if (!viewer) return; // not on the customize page

  const TOTAL = 18;  // frames per sequence (frame-01.jpg … frame-18.jpg)
  const EAGER = 4;   // frames loaded immediately; rest load in background

  /* ── State ── */
  let curVariant   = '4door-hardtop';
  let curColor     = 'sand';
  let curFrame     = 0;
  let inTransit    = false;

  /* ── DOM refs ── */
  const parallaxEl = viewer.querySelector('.mv-parallax');
  const imgA       = viewer.querySelector('.mv-img-a');
  const imgB       = viewer.querySelector('.mv-img-b');
  const progressEl = viewer.querySelector('.mv-progress');
  const placeholder= viewer.querySelector('.mv-placeholder');

  // imgA starts active (opacity 1), imgB hidden
  let activeImg   = imgA;
  let inactiveImg = imgB;

  /* ── Image cache: `variant/color` → [18 Image objects] ── */
  const seqCache = new Map();

  /* ── Color slug map ── */
  const COLOR_SLUG = {
    '#C4A882': 'sand',
    '#111111': 'obsidian',
    '#DCDCDC': 'arctic',
    '#2D5A27': 'ranger',
    '#CC0000': 'hero-red',
    '#C9A84C': 'gold',
    'CAMO'   : 'camo',
  };
  function toSlug(raw) {
    return COLOR_SLUG[raw] || COLOR_SLUG[(raw || '').toUpperCase()] || 'sand';
  }

  function frameSrc(variant, color, n) {
    return '/images/viewer/' + variant + '/' + color +
           '/frame-' + String(n + 1).padStart(2, '0') + '.jpg';
  }

  /* ── Preload a sequence; first EAGER frames load immediately ── */
  function ensureSequence(variant, color) {
    const key = variant + '/' + color;
    if (seqCache.has(key)) return seqCache.get(key);

    const frames = Array.from({ length: TOTAL }, () => new Image());
    seqCache.set(key, frames);

    for (let i = 0; i < EAGER; i++) {
      frames[i].decoding = 'async';
      frames[i].src = frameSrc(variant, color, i);
    }
    // Non-critical frames load after the current task yields
    setTimeout(function() {
      for (let i = EAGER; i < TOTAL; i++) {
        frames[i].decoding = 'async';
        frames[i].src = frameSrc(variant, color, i);
      }
    }, 0);

    return frames;
  }

  /* ── Progress bar ── */
  function setProgress(n) {
    if (!progressEl) return;
    progressEl.style.width = (n / (TOTAL - 1) * 100).toFixed(1) + '%';
  }

  /* ── Crossfade + slide between frames ──
     dir > 0 : rotating right (next)
     dir < 0 : rotating left  (prev) */
  function showFrame(targetFrame, dir) {
    if (inTransit) return;
    curFrame = ((targetFrame % TOTAL) + TOTAL) % TOTAL;
    setProgress(curFrame);

    const key    = curVariant + '/' + curColor;
    const frames = seqCache.get(key);
    const src    = (frames && frames[curFrame].src)
                 ? frames[curFrame].src
                 : frameSrc(curVariant, curColor, curFrame);

    inTransit = true;

    // Position inactive img off-screen (subtle — conveys rotation)
    inactiveImg.style.transition = 'none';
    inactiveImg.style.transform  = 'translateX(' + (dir > 0 ? '10%' : '-10%') + ')';
    inactiveImg.style.opacity    = '0';
    inactiveImg.src = src;

    function runTransition() {
      requestAnimationFrame(function() {
        inactiveImg.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
        inactiveImg.style.opacity    = '1';
        inactiveImg.style.transform  = 'translateX(0)';

        activeImg.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
        activeImg.style.opacity    = '0';
        activeImg.style.transform  = 'translateX(' + (dir > 0 ? '-6%' : '6%') + ')';

        setTimeout(function() {
          var tmp     = activeImg;
          activeImg   = inactiveImg;
          inactiveImg = tmp;
          inTransit   = false;
          // Show placeholder only when the current active image actually failed
          if (placeholder) {
            placeholder.style.opacity = (activeImg.naturalWidth === 0) ? '1' : '0';
          }
        }, 300);
      });
    }

    if (inactiveImg.complete && inactiveImg.naturalWidth > 0) {
      runTransition();
    } else {
      inactiveImg.onload  = runTransition;
      inactiveImg.onerror = function() {
        // Image not available — complete the swap anyway so nav stays working
        inactiveImg.style.transition = 'opacity 0.2s ease';
        inactiveImg.style.opacity    = '1';
        inactiveImg.style.transform  = 'translateX(0)';
        activeImg.style.transition   = 'opacity 0.2s ease';
        activeImg.style.opacity      = '0';
        if (placeholder) placeholder.style.opacity = '1';
        setTimeout(function() {
          var tmp = activeImg; activeImg = inactiveImg; inactiveImg = tmp;
          inTransit = false;
        }, 220);
      };
    }
  }

  function navigate(dir) { showFrame(curFrame + dir, dir); }

  /* ── Swipe detection (horizontal only, ignores vertical scroll) ── */
  var swipeX = 0, swipeY = 0;
  viewer.addEventListener('touchstart', function(e) {
    swipeX = e.touches[0].clientX;
    swipeY = e.touches[0].clientY;
  }, { passive: true });
  viewer.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - swipeX;
    var dy = e.changedTouches[0].clientY - swipeY;
    if (Math.abs(dx) > Math.abs(dy) * 1.4 && Math.abs(dx) > 40) {
      navigate(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  /* ── Arrow buttons ── */
  var prevBtn = viewer.querySelector('.mv-prev');
  var nextBtn = viewer.querySelector('.mv-next');
  if (prevBtn) prevBtn.addEventListener('click', function() { navigate(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function() { navigate(1); });

  /* ── Lightweight scroll parallax ── */
  if (parallaxEl) {
    window.addEventListener('scroll', function() {
      var rect = viewer.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      var ratio = Math.max(0, Math.min(1, -rect.top / (rect.height || 1)));
      parallaxEl.style.transform = 'translateY(' + (ratio * 22).toFixed(1) + 'px)';
    }, { passive: true });
  }

  /* ── Instantly swap to first frame of a new sequence ── */
  function loadSequenceStart(variant, color) {
    curVariant = variant || '4door-hardtop';
    curColor   = color   || 'sand';
    curFrame   = 0;
    inTransit  = false;
    setProgress(0);

    var frames = ensureSequence(curVariant, curColor);
    var f0     = frames[0];

    // Reset layers cleanly
    activeImg.style.transition  = 'none';
    inactiveImg.style.transition= 'none';
    activeImg.style.opacity     = '1';
    activeImg.style.transform   = 'translateX(0)';
    inactiveImg.style.opacity   = '0';

    function applyFrame() {
      activeImg.src = f0.src;
      if (placeholder) placeholder.style.opacity = '0';
    }

    if (f0.complete && f0.naturalWidth > 0) {
      applyFrame();
    } else {
      f0.onload  = applyFrame;
      f0.onerror = function() {
        if (placeholder) placeholder.style.opacity = '1';
      };
    }
  }

  /* ── Public API ── */
  window.mobileSetColor = function(rawColor) {
    loadSequenceStart(curVariant, toSlug(rawColor));
  };

  window.mobileSetVariant = function(variantFolder) {
    loadSequenceStart(variantFolder || '4door-hardtop', curColor);
  };

  /* ── Initial sequence ── */
  loadSequenceStart(curVariant, curColor);
}

/* ── Init ── */
window.addEventListener('DOMContentLoaded', () => {
  if (typeof THREE !== 'undefined') {
    initHeroScene();
    initShowcaseScene();
    // Skip WebGL configurator on mobile — image sequence viewer handles it
    if (!isMobile) initConfigScene();
  }
  initMobileViewer();
});
