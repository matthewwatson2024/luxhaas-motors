/* ============================================================
   LUXHAUS MOTORS — Main JavaScript
   ============================================================ */

'use strict';

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

  const scene    = new THREE.Scene();
  const w = window.innerWidth, h = window.innerHeight;
  const camera   = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
  camera.position.set(0, 0, 9);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
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

  (function frame() {
    requestAnimationFrame(frame);
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

  const scene    = new THREE.Scene();
  scene.background = new THREE.Color(0x0D0D0D);
  scene.fog        = new THREE.FogExp2(0x0D0D0D, 0.028);

  const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(-5, 2, 9);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  /* Torus Knot */
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
  (function frame() {
    requestAnimationFrame(frame);
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

/* ── Three.js: Config/Customize Vehicle ── */
function initConfigScene() {
  const canvas = document.getElementById('configCanvas');
  if (!canvas || typeof THREE === 'undefined') return;

  /* ── Mobile detection ────────────────────────────────────────
     isMobile gates renderer settings, shadow maps, particles,
     pixel ratio, frame-rate cap, and which model file to load.
  ────────────────────────────────────────────────────────────── */
  const isMobile   = window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 1024);
  const renderScale = isMobile ? 0.55 : 1.0;

  /* ── Variant-swap state ──────────────────────────────────────
     baseModel    — the initially-loaded HMMWV_Desert showcase mesh.
     activeVariant — Hunter variant currently in scene (null = base shown).
     variantCache  — folder key → loaded THREE.Object3D for instant re-swap.
  ────────────────────────────────────────────────────────────── */
  let baseModel    = null;
  let activeVariant = null;
  const variantCache = new Map();

  const scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x080808);

  const pW = canvas.parentElement ? canvas.parentElement.clientWidth  : canvas.clientWidth;
  const pH = canvas.parentElement ? canvas.parentElement.clientHeight : canvas.clientHeight;
  const camera = new THREE.PerspectiveCamera(45, pW / pH, 0.1, 200);
  camera.position.set(6, 2.8, 6);
  camera.lookAt(0, 0.8, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile });
  renderer.setSize(Math.floor(pW * renderScale), Math.floor(pH * renderScale), false);
  renderer.setPixelRatio(isMobile ? 1 : Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled   = !isMobile;
  if (!isMobile) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding      = THREE.sRGBEncoding;
  renderer.toneMapping         = isMobile ? THREE.LinearToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = isMobile ? 1.2 : 1.1;

  if (isMobile) { canvas.style.width = '100%'; canvas.style.height = '100%'; }

  /* ── Studio IBL environment map ──────────────────────────────
     Generates a synthetic equirectangular probe matching the 5-light
     studio rig below (warm key upper-right, cool fill left-back, cool
     rim upper-back). Processed by PMREMGenerator into a PMREM cube map
     and set on scene.environment so every MeshStandardMaterial /
     MeshPhysicalMaterial gets diffuse IBL + specular IBL for free.

     No UV coordinates are required — scene.environment is sampled by
     the shader using the surface reflection vector, not uv.
     Desktop only: mobile uses simpler lighting path.
  ────────────────────────────────────────────────────────────── */
  if (!isMobile) {
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

      var envTex       = new THREE.DataTexture(px, EW, EH, THREE.RGBAFormat, THREE.UnsignedByteType);
      envTex.encoding  = THREE.sRGBEncoding;
      envTex.needsUpdate = true;

      var pmrem        = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      scene.environment = pmrem.fromEquirectangular(envTex).texture;

      envTex.dispose();
      pmrem.dispose();
    })();
  }

  /* ── Lighting rig ─────────────────────────────────────────────
     Desktop: full 5-light studio rig + PCFSoft 2048² shadow map.
     Mobile:  hemisphere + key (no shadow) + fill — saves the full
              shadow-map render pass and 2 light evaluations per frag.
  ────────────────────────────────────────────────────────────── */
  const hemi = new THREE.HemisphereLight(0xB8D4EE, 0x3A3828, isMobile ? 0.7 : 0.55);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xFFF5E0, isMobile ? 2.0 : 2.2);
  keyLight.position.set(6, 12, 4);
  if (!isMobile) {
    keyLight.castShadow           = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near   = 1;
    keyLight.shadow.camera.far    = 50;
    keyLight.shadow.camera.left   = -8;
    keyLight.shadow.camera.right  =  8;
    keyLight.shadow.camera.top    =  8;
    keyLight.shadow.camera.bottom = -8;
    keyLight.shadow.bias          = -0.0004;
  }
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xCBDFF5, 0.55);
  fillLight.position.set(-8, 5, -6);
  scene.add(fillLight);

  if (!isMobile) {
    const rimLight = new THREE.DirectionalLight(0xDEECF8, 1.0);
    rimLight.position.set(0, 4, -10);
    scene.add(rimLight);

    const bounceLight = new THREE.PointLight(0xFFEDD0, 0.7, 10);
    bounceLight.position.set(0, -0.5, 0);
    scene.add(bounceLight);
  }

  /* ── Textures ─────────────────────────────────────────────────
     Desktop: original 4 K PBR maps (~74 MB).
     Mobile:  pre-baked 512×512 JPEG equivalents (~520 KB total).
              Normal + roughness maps omitted on mobile — simpler
              fragment shader, 7 fewer texture fetches.
  ────────────────────────────────────────────────────────────── */
  const TX = isMobile
    ? '/models/humvee-1/mobile-textures/'
    : '/models/humvee-1/uploads_files_3017515_HMMWV_Desert_Textures/';

  const txLoader = new THREE.TextureLoader();
  function loadTex(name, sRGB) {
    const t = txLoader.load(TX + name);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (sRGB) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  const bodyColorTex   = loadTex('Body_Color.jpg',        true);
  const wheelColorTex  = loadTex('Wheels_Color.jpg',      true);
  const suspColorTex   = loadTex('Suspensions_Color.jpg', true);
  const glassColorTex  = loadTex('Glass_color.jpg',       true);
  const lightsColorTex = loadTex('lights_color.jpg',      true);
  const plateColorTex  = loadTex('Nameplates_color.jpg',  true);

  const bodyNormTex   = isMobile ? null : loadTex('Body_Normal.jpg',          false);
  const bodyRoughTex  = isMobile ? null : loadTex('Body_Metallic.jpg',        false);
  const wheelNormTex  = isMobile ? null : loadTex('Wheels_Normal.jpg',        false);
  const wheelRoughTex = isMobile ? null : loadTex('Wheels_Roughness.jpg',     false);
  const suspNormTex   = isMobile ? null : loadTex('Suspensions_Normal.jpg',   false);
  const suspMetalTex  = isMobile ? null : loadTex('Suspensions_Metallic.jpg', false);
  const plateOpacTex  = isMobile ? null : loadTex('Nameplates_opacity.jpg',   false);

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
    envMapIntensity:    isMobile ? 0.7 : 1.4,
    reflectivity:       0.6,
  });

  /* Variant tire material — matte black rubber, no clearcoat, no UV needed. */
  const variantTireMat = new THREE.MeshStandardMaterial({
    color:     new THREE.Color(0x111111),
    metalness: 0.0,
    roughness: 0.88,
    envMapIntensity: isMobile ? 0.2 : 0.4,
  });

  /* Variant wheel-hub material — dark gunmetal, slightly metallic, no UV needed. */
  const variantWheelMat = new THREE.MeshStandardMaterial({
    color:     new THREE.Color(0x1C1F22),
    metalness: 0.55,
    roughness: 0.50,
    envMapIntensity: isMobile ? 0.4 : 0.9,
  });

  /* Variant undercarriage material — very dark metallic grey, matte, no UV needed. */
  const variantUndercarriageMat = new THREE.MeshStandardMaterial({
    color:     new THREE.Color(0x111213),
    metalness: 0.60,
    roughness: 0.70,
    envMapIntensity: isMobile ? 0.2 : 0.5,
  });

  /* Variant interior material — dark charcoal, near-flat finish, no UV needed. */
  const variantInteriorMat = new THREE.MeshStandardMaterial({
    color:     new THREE.Color(0x2D2820),
    metalness: 0.05,
    roughness: 0.85,
    envMapIntensity: isMobile ? 0.1 : 0.3,
  });

  /* Variant bumper material — dark military gray, matte, no UV needed. */
  const variantBumperMat = new THREE.MeshStandardMaterial({
    color:     new THREE.Color(0x1A1C1E),
    metalness: 0.45,
    roughness: 0.75,
    envMapIntensity: isMobile ? 0.2 : 0.6,
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
  canvas.parentElement.style.position = 'relative';
  canvas.parentElement.appendChild(loadOverlay);

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

  /* ── Base HMMWV_Desert model loading ─────────────────────────
     Desktop: MTL first (preserves material groups), then full OBJ.
     Mobile:  skip MTL (we override all mats anyway), load smaller
              pre-decimated mesh for faster load + lower GPU cost.
  ────────────────────────────────────────────────────────────── */
  const OBJ_PATH = '/models/humvee-1/uploads_files_3017515_HMMWV_Desert_OBJ/';
  const baseFile = isMobile ? 'HMMWV_Desert_Mobile.obj' : 'HMMWV_Desert_OBJ.obj';

  function onBaseLoad(object) {
    object.traverse(function(child) {
      if (!child.isMesh) return;
      child.castShadow    = !isMobile;
      child.receiveShadow = !isMobile;
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
  }

  function onBaseError(err) {
    console.error('[LuxHaus] base OBJ load error:', err);
    loadOverlay.querySelector('span').textContent = 'Model unavailable';
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

  /* ── Render loop ──────────────────────────────────────────────
     Mobile: capped at 30 fps — rAF fires at 60 Hz but render work
     is skipped on alternate ticks. Primed at -interval so the first
     tick always renders.
  ────────────────────────────────────────────────────────────── */
  const clock = new THREE.Clock();
  const mobileInterval = 1000 / 30;
  let lastFrameMs = -mobileInterval;

  (function frame(now) {
    requestAnimationFrame(frame);

    if (isMobile) {
      if ((now || 0) - lastFrameMs < mobileInterval) return;
      lastFrameMs = now || 0;
    }

    const t = clock.getElapsedTime();
    if (!isDragging) rotY += 0.003;

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
          else                               mat = variantBodyMat;
        }

        if (!geo.attributes.normal) geo.computeVertexNormals();

        child.material             = mat;
        child.material.needsUpdate = true;
        child.castShadow           = !isMobile;
        child.receiveShadow        = !isMobile;
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
    canvas.parentElement.appendChild(ind);

    const HF  = 'new humvee files from our friend hunter';
    const url = '/models/' + encodeURIComponent(HF) + '/' +
                encodeURIComponent(folder) + '/web_model.obj';

    console.log('[LuxHaus] fetching variant:', folder, url);

    const loader = new THREE.OBJLoader();
    loader.load(url, function(obj) {
      applyVariantMaterial(obj);
      fitToScene(obj);
      variantCache.set(folder, obj);
      displayModel(obj);
      ind.style.opacity = '0';
      setTimeout(() => ind.remove(), 260);
    }, undefined, function(err) {
      console.error('[LuxHaus] variant load error:', folder, err);
      ind.style.opacity = '0';
      setTimeout(() => ind.remove(), 260);
    });
  };

  new ResizeObserver(() => {
    const p = canvas.parentElement;
    if (!p) return;
    const w = p.clientWidth, h = p.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(Math.floor(w * renderScale), Math.floor(h * renderScale), !isMobile);
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

/* ── Init ── */
window.addEventListener('DOMContentLoaded', () => {
  if (typeof THREE !== 'undefined') {
    initHeroScene();
    initShowcaseScene();
    initConfigScene();
  }
});
