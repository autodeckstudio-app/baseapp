import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function initHeroGL(host) {
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 8.5);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;

  /* glossy black clearcoat — paint under studio light */
  const geo = new THREE.TorusKnotGeometry(1.65, 0.5, 260, 48, 2, 3);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0c,
    metalness: 0.88,
    roughness: 0.16,
    clearcoat: 1.0,
    clearcoatRoughness: 0.07,
    envMapIntensity: 1.15,
  });
  const knot = new THREE.Mesh(geo, mat);
  knot.rotation.set(0.5, 0.2, -0.15);
  scene.add(knot);

  /* brand orange key light + cool rim */
  const key = new THREE.PointLight(0xec8638, 220, 0, 2);
  key.position.set(5.5, 3.2, 4.2);
  scene.add(key);
  const rim = new THREE.PointLight(0xbfd4ff, 60, 0, 2);
  rim.position.set(-6, -2.5, -3.5);
  scene.add(rim);
  const fill = new THREE.PointLight(0xffffff, 22, 0, 2);
  fill.position.set(-2.5, 4.5, 5.5);
  scene.add(fill);

  /* thin orange orbit ring — a studio light streak */
  const ringGeo = new THREE.TorusGeometry(3.1, 0.012, 8, 220);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xec8638, transparent: true, opacity: 0.75 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.set(1.25, 0.35, 0);
  scene.add(ring);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    /* keep the form right-of-centre on wide screens, centred on narrow */
    knot.position.x = w > 900 ? 1.9 : 0;
    ring.position.x = knot.position.x;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries[0] ? entries[0].isIntersecting : true;
  }, { threshold: 0.02 });
  io.observe(host);

  const clock = new THREE.Clock();
  const loop = () => {
    if (!visible) return;
    const t = clock.getElapsedTime();
    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    knot.rotation.y = 0.2 + t * 0.16 + pointer.x * 0.22;
    knot.rotation.x = 0.5 + Math.sin(t * 0.22) * 0.1 + pointer.y * 0.16;
    ring.rotation.z = t * 0.1;
    key.intensity = 220 + Math.sin(t * 0.8) * 26;
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(loop);

  document.addEventListener('visibilitychange', () => {
    renderer.setAnimationLoop(document.hidden ? null : loop);
  });

  return { renderer, scene, camera };
}
