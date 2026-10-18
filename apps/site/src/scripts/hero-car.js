import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/* Hero: generic uncovered concept coupe, independent illustrative asset. Drag to turn.
   Loaded lazily by main.js, never under prefers-reduced-motion. */
export function initHeroCar(host) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    console.warn('[hero-car] WebGL unavailable, studio photos stay as the hero', e);
    return { destroy() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 600 ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
  camera.position.set(3.4, 1.5, 5.0);
  camera.lookAt(0, 0.48, 0);

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
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.ShadowMaterial({ opacity: 0.45 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const carGroup = new THREE.Group();
  scene.add(carGroup);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.load('/assets/models/concept-coupe/hero-coupe.glb', (g) => {
    const car = g.scene;
    car.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if(o.material) o.material.envMapIntensity = 1.25;
    });
    const box = new THREE.Box3().setFromObject(car);
    const size = box.getSize(new THREE.Vector3());
    car.scale.setScalar(3.6 / Math.max(size.x, size.z));
    const box2 = new THREE.Box3().setFromObject(car);
    car.position.set(-(box2.min.x + box2.max.x) / 2, -box2.min.y, -(box2.min.z + box2.max.z) / 2);
    carGroup.add(car);
    carGroup.rotation.y = -0.45; /* three-quarter front */
    host.classList.add('ready');
  }, undefined, (err) => console.warn('[hero-car] model failed to load', err));

  /* drag to turn, with a slow idle rotation and inertia */
  let dragging = false, px = 0, vel = 0;
  const idle = 0.0016;
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
    carGroup.position.x = 0;
    carGroup.position.y = 0;
  }
  resize();
  window.addEventListener('resize', resize);

  let visible = true;
  new IntersectionObserver((es) => { visible = es[0] ? es[0].isIntersecting : true; }, { threshold: 0.02 }).observe(host);

  let lastFrame = 0;
  const loop = (time) => {
    if (!visible || time - lastFrame < 1000/30) return;
    lastFrame = time;
    if (!dragging) { carGroup.rotation.y += idle + vel; vel *= 0.9; }
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
