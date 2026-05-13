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

  const scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x080808);
  scene.fog        = new THREE.FogExp2(0x080808, 0.035);

  const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
  camera.position.set(6, 2.8, 6);
  camera.lookAt(0, 0.8, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled   = true;
  renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
  renderer.outputEncoding      = THREE.sRGBEncoding;
  renderer.toneMapping         = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;


  /* ── Lighting rig ─────────────────────────────────────────────────
     3-point studio setup tuned for PBR + ACES tone mapping.

     · Hemisphere  — sky (cool blue) / ground (warm brown) gradient;
                     replaces flat AmbientLight so no surface is fully black
                     but shadow contrast is preserved.
     · Key         — primary light, front-right-high, slightly warm white;
                     defines the main highlight and casts soft shadows.
     · Fill        — opposite side (left-rear), cool blue-white, ~¼ key power;
                     lifts shadow faces without washing them out.
     · Rim         — directly behind the vehicle, cool neutral;
                     separates silhouette edges from the dark background.
     · Bounce      — low-intensity warm point near the ground plane;
                     simulates light bouncing back up into the undercarriage.
  ────────────────────────────────────────────────────────────────── */
  const hemi = new THREE.HemisphereLight(0xB8D4EE, 0x3A3828, 0.55);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xFFF5E0, 2.2);
  keyLight.position.set(6, 12, 4);
  keyLight.castShadow              = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near      = 1;
  keyLight.shadow.camera.far       = 50;
  keyLight.shadow.camera.left      = -8;
  keyLight.shadow.camera.right     =  8;
  keyLight.shadow.camera.top       =  8;
  keyLight.shadow.camera.bottom    = -8;
  keyLight.shadow.bias             = -0.0004;
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

  /* Texture loader + texture map */
  const TX = '/models/humvee-1/uploads_files_3017515_HMMWV_Desert_Textures/';
  const txLoader = new THREE.TextureLoader();
  function loadTex(name, sRGB) {
    const t = txLoader.load(TX + name);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (sRGB) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  const bodyColorTex  = loadTex('Body_Color.jpg',        true);
  const bodyNormTex   = loadTex('Body_Normal.jpg',        false);
  const bodyRoughTex  = loadTex('Body_Metallic.jpg',      false);
  const wheelColorTex = loadTex('Wheels_Color.jpg',       true);
  const wheelNormTex  = loadTex('Wheels_Normal.jpg',      false);
  const wheelRoughTex = loadTex('Wheels_Roughness.jpg',   false);
  const suspColorTex  = loadTex('Suspensions_Color.jpg',  true);
  const suspNormTex   = loadTex('Suspensions_Normal.jpg', false);
  const suspMetalTex  = loadTex('Suspensions_Metallic.jpg', false);
  const glassColorTex = loadTex('Glass_color.jpg',        true);
  const lightsColorTex= loadTex('lights_color.jpg',       true);
  const plateColorTex = loadTex('Nameplates_color.jpg',   true);
  const plateOpacTex  = loadTex('Nameplates_opacity.jpg', false);

  /* Body PBR material — referenced externally for color swaps */
  const bodyMat = new THREE.MeshStandardMaterial({
    map:          bodyColorTex,
    normalMap:    bodyNormTex,
    roughnessMap: bodyRoughTex,
    metalness:    0.22,
    roughness:    0.65,
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
    map:              lightsColorTex,
    emissiveMap:      lightsColorTex,
    emissive:         new THREE.Color(0xffffff),
    emissiveIntensity:0.35,
    metalness:        0.15,
    roughness:        0.12,
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

  /* Load OBJ with MTL */
  const mtlLoader = new THREE.MTLLoader();
  const OBJ_PATH  = '/models/humvee-1/uploads_files_3017515_HMMWV_Desert_OBJ/';
  mtlLoader.setPath(OBJ_PATH);
  mtlLoader.load('HMMWV_Desert_OBJ.mtl', function(mtlMats) {
    mtlMats.preload();
    const objLoader = new THREE.OBJLoader();
    objLoader.setMaterials(mtlMats);
    objLoader.setPath(OBJ_PATH);
    objLoader.load('HMMWV_Desert_OBJ.obj', function(object) {

      /* Apply PBR textures per named group.
         OBJLoader sets the group name on the Mesh itself (child.name),
         not on its parent container — using parent.name always returns ''
         and would assign bodyMat to every part. */
      object.traverse(function(child) {
        if (!child.isMesh) return;
        child.castShadow    = true;
        child.receiveShadow = true;
        child.material = materialForGroup(child.name);
      });

      /* Auto-center and scale to fit nicely in scene */
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const scale = 5.5 / Math.max(size.x, size.y, size.z);
      object.scale.setScalar(scale);

      /* After scaling recompute box to ground the model */
      const box2   = new THREE.Box3().setFromObject(object);
      const center2 = box2.getCenter(new THREE.Vector3());
      object.position.x = -center2.x;
      object.position.z = -center2.z;
      object.position.y = -box2.min.y;

      group.add(object);
      loadOverlay.remove();

    }, undefined, function(err) {
      console.error('HMMWV OBJ load error:', err);
      loadOverlay.querySelector('span').textContent = 'Model unavailable';
    });
  }, undefined, function(err) {
    console.warn('MTL load failed, loading OBJ without materials:', err);
    const objLoader = new THREE.OBJLoader();
    objLoader.setPath(OBJ_PATH);
    objLoader.load('HMMWV_Desert_OBJ.obj', function(object) {
      object.traverse(function(child) {
        if (!child.isMesh) return;
        child.castShadow    = true;
        child.receiveShadow = true;
        child.material = materialForGroup(child.name);
      });
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const scale = 5.5 / Math.max(size.x, size.y, size.z);
      object.scale.setScalar(scale);
      const box2    = new THREE.Box3().setFromObject(object);
      const center2 = box2.getCenter(new THREE.Vector3());
      object.position.x = -center2.x;
      object.position.z = -center2.z;
      object.position.y = -box2.min.y;
      group.add(object);
      loadOverlay.remove();
    });
  });

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

  const clock = new THREE.Clock();
  (function frame() {
    requestAnimationFrame(frame);
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

    // Woodland palette: sandy tan base, olive, dark forest green, bark brown
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
  const COLOR_MODES = {
    '#C4A882': { kind: 'texture', map: bodyColorTex          },
    'CAMO':    { kind: 'texture', map: createCamoTexture()   },
  };

  window.setVehicleColor = function(raw) {
    const mode = COLOR_MODES[raw.toUpperCase()] || COLOR_MODES[raw] || { kind: 'solid' };
    if (mode.kind === 'texture') {
      bodyMat.map = mode.map;
      bodyMat.color.set(0xffffff);
    } else {
      bodyMat.map = null;
      bodyMat.color.set(raw);
    }
    bodyMat.needsUpdate = true;
  };

  new ResizeObserver(() => {
    const p = canvas.parentElement;
    if (!p) return;
    camera.aspect = p.clientWidth / p.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(p.clientWidth, p.clientHeight);
  }).observe(canvas.parentElement);
}

/* ── Inventory Filter ── */
(function() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards      = document.querySelectorAll('.vehicle-card');
  if (!filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      cards.forEach(card => {
        const show = filter === 'all' || card.dataset.type === filter;
        card.style.display = show ? '' : 'none';
      });
    });
  });
})();

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
