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
  scene.fog        = new THREE.FogExp2(0x080808, 0.04);

  const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
  camera.position.set(7, 3.5, 7);
  camera.lookAt(0, 0.5, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled  = true;
  renderer.shadowMap.type     = THREE.PCFSoftShadowMap;

  /* Vehicle Material */
  const bodyColor = 0xC4A882;
  const bodyMat   = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.2, roughness: 0.65 });
  const glassMat  = new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.1, roughness: 0.1, transparent: true, opacity: 0.45 });
  const trimMat   = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.35 });
  const rimMat    = new THREE.MeshStandardMaterial({ color: 0xC9A84C, metalness: 0.95, roughness: 0.05 });
  const tireMat   = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.0, roughness: 0.9 });

  const group = new THREE.Group();

  /* --- Body --- */
  const bodyGeo = new THREE.BoxGeometry(4.4, 1.3, 2.2);
  const body    = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.85;
  body.castShadow = true;
  group.add(body);

  /* --- Roof / Cab --- */
  const roofGeo = new THREE.BoxGeometry(2.9, 0.95, 2.0);
  const roof    = new THREE.Mesh(roofGeo, bodyMat);
  roof.position.set(0.1, 1.97, 0);
  roof.castShadow = true;
  group.add(roof);

  /* --- Hood --- */
  const hoodGeo = new THREE.BoxGeometry(1.4, 0.5, 2.2);
  const hood    = new THREE.Mesh(hoodGeo, bodyMat);
  hood.position.set(-2.2, 0.55, 0);
  hood.castShadow = true;
  group.add(hood);

  /* --- Windshield --- */
  const wsGeo = new THREE.BoxGeometry(0.08, 0.72, 1.8);
  const ws    = new THREE.Mesh(wsGeo, glassMat);
  ws.position.set(-1.38, 1.72, 0);
  ws.rotation.z = -0.25;
  group.add(ws);

  /* --- Rear window --- */
  const rwGeo = new THREE.BoxGeometry(0.08, 0.72, 1.85);
  const rw    = new THREE.Mesh(rwGeo, glassMat);
  rw.position.set(1.4, 1.72, 0);
  rw.rotation.z = 0.18;
  group.add(rw);

  /* --- Side windows (4) --- */
  [-0.3, 0.65].forEach(xPos => {
    const swGeo = new THREE.BoxGeometry(0.65, 0.52, 0.07);
    [-0.97, 0.97].forEach(z => {
      const sw = new THREE.Mesh(swGeo, glassMat);
      sw.position.set(xPos, 1.82, z);
      group.add(sw);
    });
  });

  /* --- Front bumper --- */
  const fbGeo = new THREE.BoxGeometry(0.18, 0.55, 2.0);
  const fb    = new THREE.Mesh(fbGeo, trimMat);
  fb.position.set(-3.0, 0.5, 0);
  group.add(fb);

  /* --- Grille --- */
  const grGeo = new THREE.BoxGeometry(0.08, 0.75, 1.75);
  const gr    = new THREE.Mesh(grGeo, trimMat);
  gr.position.set(-2.94, 0.72, 0);
  group.add(gr);

  /* --- Headlights --- */
  const hlGeo = new THREE.BoxGeometry(0.15, 0.22, 0.38);
  const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.6 });
  [0.75, -0.75].forEach(z => {
    const hl = new THREE.Mesh(hlGeo, hlMat);
    hl.position.set(-2.93, 0.82, z);
    group.add(hl);
  });

  /* --- Taillights --- */
  const tlGeo = new THREE.BoxGeometry(0.12, 0.22, 0.35);
  const tlMat = new THREE.MeshStandardMaterial({ color: 0xff2200, emissive: 0xff1100, emissiveIntensity: 0.5 });
  [0.78, -0.78].forEach(z => {
    const tl = new THREE.Mesh(tlGeo, tlMat);
    tl.position.set(2.93, 0.82, z);
    group.add(tl);
  });

  /* --- Wheels (4) --- */
  const wheelPositions = [
    [-1.5, 0, 1.2], [-1.5, 0, -1.2],
    [ 1.5, 0, 1.2], [ 1.5, 0, -1.2],
  ];
  const tireGeo = new THREE.CylinderGeometry(0.56, 0.56, 0.42, 28);
  const rimGeo  = new THREE.CylinderGeometry(0.32, 0.32, 0.46, 16);
  const hubGeo  = new THREE.CylinderGeometry(0.1,  0.1,  0.5,  8);

  wheelPositions.forEach(([x, , z]) => {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    const rim  = new THREE.Mesh(rimGeo,  rimMat);
    const hub  = new THREE.Mesh(hubGeo,  trimMat);
    [tire, rim, hub].forEach(m => {
      m.rotation.z = Math.PI / 2;
      m.position.set(x, 0.56, z);
      m.castShadow = true;
      group.add(m);
    });
  });

  /* --- Spare tire (rear) --- */
  const spGeo  = new THREE.TorusGeometry(0.44, 0.12, 12, 28);
  const spare  = new THREE.Mesh(spGeo, tireMat);
  spare.position.set(2.85, 1.1, 0);
  spare.rotation.y = Math.PI / 2;
  group.add(spare);

  /* --- Antenna --- */
  const antGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6);
  const ant    = new THREE.Mesh(antGeo, trimMat);
  ant.position.set(0.5, 2.52, 0.9);
  group.add(ant);

  scene.add(group);
  group.position.y = 0.12;

  /* Ground */
  const groundGeo = new THREE.PlaneGeometry(30, 30);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4, metalness: 0.6 });
  const ground    = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* Grid lines on ground */
  const gridHelper = new THREE.GridHelper(20, 30, 0xC9A84C, 0x1a1a1a);
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.15;
  scene.add(gridHelper);

  /* Lights */
  scene.add(new THREE.AmbientLight(0x222222, 1));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(5, 10, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  scene.add(keyLight);
  const fillLight = new THREE.PointLight(0xffeedd, 1.5, 18);
  fillLight.position.set(-6, 3, -4);
  scene.add(fillLight);
  const rimLight = new THREE.PointLight(0xC9A84C, 3, 15);
  rimLight.position.set(0, 2, -7);
  scene.add(rimLight);
  const underLight = new THREE.PointLight(0xC9A84C, 0.8, 6);
  underLight.position.set(0, -0.4, 0);
  scene.add(underLight);

  /* Orbit controls (manual) */
  let isDragging = false, prevX = 0, prevY = 0;
  let rotY = 0.4, rotX = 0.15;

  canvas.addEventListener('mousedown', e => { isDragging = true; prevX = e.clientX; prevY = e.clientY; });
  window.addEventListener('mouseup',   ()  => { isDragging = false; });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    rotY += (e.clientX - prevX) * 0.008;
    rotX += (e.clientY - prevY) * 0.004;
    rotX  = Math.max(-0.4, Math.min(0.55, rotX));
    prevX = e.clientX; prevY = e.clientY;
  });

  canvas.addEventListener('touchstart', e => { isDragging = true; prevX = e.touches[0].clientX; prevY = e.touches[0].clientY; });
  window.addEventListener('touchend',   ()  => { isDragging = false; });
  window.addEventListener('touchmove',  e => {
    if (!isDragging) return;
    rotY += (e.touches[0].clientX - prevX) * 0.008;
    prevX = e.touches[0].clientX;
  });

  const clock = new THREE.Clock();
  (function frame() {
    requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    if (!isDragging) rotY += 0.003;

    group.rotation.y = rotY;
    group.rotation.x = rotX;

    rimLight.position.x = Math.sin(t * 0.5) * 7;
    rimLight.position.z = Math.cos(t * 0.5) * 7 - 7;

    renderer.render(scene, camera);
  })();

  /* Expose color changer globally */
  window.setVehicleColor = function(hex) {
    bodyMat.color.set(hex);
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
