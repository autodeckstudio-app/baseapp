import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* Hero car: a glossy black studio car you can drag to turn.
   Loaded lazily by main.js, never under prefers-reduced-motion. */
export function initHeroCar(host) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return { destroy() {} }; // no WebGL: the studio photos behind stay as the hero
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(3.6, 1.7, 6.6);
  camera.lookAt(0, 0.5, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

  /* studio light: soft white key, one quiet orange rim from the brand */
  scene.add(new THREE.HemisphereLight(0xf6f3ec, 0x1b1b19, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(4, 7, 3);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xec8638, 0.7);
  rim.position.set(-7, 2.5, -5);
  scene.add(rim);

  /* soft contact shadow only, no visible floor */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  /* glossy black clearcoat, orange spoiler accent: the car as it leaves the Detailing Lab */
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x101014, metalness: 0.9, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.2, roughness: 0.7 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xec8638, metalness: 0.4, roughness: 0.4 });

  const carGroup = new THREE.Group();
  scene.add(carGroup);

  new GLTFLoader().load('/assets/models/car.glb', (g) => {
    const car = g.scene;
    car.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      const n = (o.name || '').toLowerCase();
      o.material = n.includes('wheel') ? trim : n.includes('spoiler') ? accent : paint;
    });
    const box = new THREE.Box3().setFromObject(car);
    const size = box.getSize(new THREE.Vector3());
    car.scale.setScalar(3.1 / Math.max(size.x, size.z));
    const box2 = new THREE.Box3().setFromObject(car);
    car.position.y = -box2.min.y;
    carGroup.add(car);
    carGroup.rotation.y = -0.55; /* three-quarter front */
    host.classList.add('ready');
  });

  /* drag to turn, with a slow idle rotation and inertia */
  let dragging = false, px = 0, vel = 0;
  const idle = 0.0032;
  host.addEventListener('pointerdown', (e) => { dragging = true; px = e.clientX; host.setPointerCapture(e.pointerId); });
  host.addEventListener('pointerup', () => { dragging = false; });
  host.addEventListener('pointercancel', () => { dragging = false; });
  host.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - px;
    px = e.clientX;
    vel = dx * 0.006;
    carGroup.rotation.y += vel;
  });

  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    /* car sits right of the copy on wide screens, centred and quieter on phones */
    carGroup.position.x = w > 900 ? 1.5 : 0;
    carGroup.position.y = w > 900 ? 0 : -0.6;
  }
  resize();
  window.addEventListener('resize', resize);

  let visible = true;
  new IntersectionObserver((es) => { visible = es[0] ? es[0].isIntersecting : true; }, { threshold: 0.02 }).observe(host);

  const loop = () => {
    if (!visible) return;
    if (!dragging) { carGroup.rotation.y += idle + vel; vel *= 0.94; }
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(loop);
  document.addEventListener('visibilitychange', () => {
    renderer.setAnimationLoop(document.hidden ? null : loop);
  });

  return {
    destroy() {
      renderer.setAnimationLoop(null);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      host.removeChild(canvas);
    },
  };
}
