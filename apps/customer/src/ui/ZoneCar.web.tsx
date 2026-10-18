/* eslint-disable @typescript-eslint/no-explicit-any */
// The generic concept coupe from the website hero (CC BY 4.0, credit shown on the page). It is not the customer's car.
// Lazy: a still poster shows first; the 2.3 MB model loads after the page has painted and only when motion is allowed.
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { ZONE_NODES, type ZoneKey } from "../lib/service-zones";
import type { ZoneCarProps } from "./ZoneCar";

export type { ZoneCarProps };
export const zoneCarSupported = true;

type Pt = { x: number; y: number; vis: boolean };
const MODEL = "/models/hero-coupe.glb";
const POSTER = "/models/hero-coupe-poster.webp";

const motionOk = (): boolean => {
  const g = globalThis as any;
  if (g.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  if (g.navigator?.connection?.saveData) return false;
  return true;
};

export function ZoneCar(p: ZoneCarProps) {
  const host = useRef<any>(null);
  const latest = useRef(p);
  latest.current = p;
  const [pts, setPts] = useState<Partial<Record<ZoneKey, Pt>>>({});
  const [state, setState] = useState<"poster" | "loading" | "ready">("poster");

  useEffect(() => {
    if (!motionOk()) return;
    let dead = false;
    let raf = 0;
    let cleanup = () => undefined;
    const g = globalThis as any;
    const start = async () => {
      try {
        setState("loading");
        const THREE: any = await import("three");
        const { GLTFLoader } = (await import("three/examples/jsm/loaders/GLTFLoader.js")) as any;
        const { MeshoptDecoder } = (await import("three/examples/jsm/libs/meshopt_decoder.module.js")) as any;
        const { RoomEnvironment } = (await import("three/examples/jsm/environments/RoomEnvironment.js")) as any;
        const el = host.current as any;
        if (dead || !el) return;
        const W = latest.current.width, H = latest.current.height;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(g.devicePixelRatio ?? 1, W < 600 ? 1.25 : 1.5));
        renderer.setSize(W, H);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        renderer.domElement.style.display = "block";
        renderer.domElement.style.touchAction = "pan-y"; // a vertical swipe still scrolls the page
        renderer.domElement.setAttribute("aria-hidden", "true");
        el.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const pm = new THREE.PMREMGenerator(renderer);
        scene.environment = pm.fromScene(new RoomEnvironment(), 0.12).texture;
        scene.add(new THREE.HemisphereLight(0xf6f3ec, 0x1b1b19, 0.8));
        const key = new THREE.DirectionalLight(0xffffff, 1.5);
        key.position.set(4, 7, 3);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xf0aa70, 0.28);
        rim.position.set(-7, 2.5, -5);
        scene.add(rim);
        const fill = new THREE.DirectionalLight(0xdce7f5, 0.9);
        fill.position.set(-4, 3, 4);
        scene.add(fill);
        const cv = g.document.createElement("canvas");
        cv.width = cv.height = 128;
        const cx = cv.getContext("2d");
        const gr = cx.createRadialGradient(64, 64, 4, 64, 64, 62);
        gr.addColorStop(0, "rgba(0,0,0,0.5)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        scene.add(shadow);
        const cam = new THREE.PerspectiveCamera(31, W / H, 0.1, 100);

        const gltf: any = await new Promise((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(`${g.location?.origin ?? ""}${MODEL}`, res, undefined, rej));
        if (dead) { renderer.dispose(); return; }
        const car = gltf.scene;
        car.traverse((o: any) => { if (o.isMesh && o.material) { o.material.envMapIntensity = 1.05; if (o.material.name === "Paint 1 Carmine") { o.material.clearcoat = 1; o.material.clearcoatRoughness = 0.12; } } });
        const box = new THREE.Box3().setFromObject(car);
        const size = box.getSize(new THREE.Vector3());
        const k = 3.6 / Math.max(size.x, size.z);
        car.scale.setScalar(k);
        const b2 = new THREE.Box3().setFromObject(car);
        car.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2);
        scene.add(car);
        scene.updateMatrixWorld(true);
        shadow.scale.set(4.6, 2.4, 1);
        shadow.position.y = 0.01;

        // Zone anchors come from named parts of the model, projected onto the real surface.
        const wbox = (name: string) => { const n = car.getObjectByName(name); return n ? new THREE.Box3().setFromObject(n) : null; };
        const whole = new THREE.Box3().setFromObject(car);
        const centre = whole.getCenter(new THREE.Vector3());
        const hood = wbox("BodyHood")?.getCenter(new THREE.Vector3());
        const tail = wbox("BodyRearPanelsColor1")?.getCenter(new THREE.Vector3());
        const front = hood && tail ? new THREE.Vector3(hood.x - tail.x, 0, hood.z - tail.z).normalize() : new THREE.Vector3(1, 0, 0);
        const side = new THREE.Vector3(-front.z, 0, front.x);
        const rc = new THREE.Raycaster();
        const anchors: Partial<Record<ZoneKey, { p: any; f: any }>> = {};
        (Object.keys(ZONE_NODES) as ZoneKey[]).forEach((z) => {
          const def = ZONE_NODES[z];
          const bb = wbox(def.node);
          if (!bb) return;
          const c = bb.getCenter(new THREE.Vector3());
          let f = new THREE.Vector3(0, 1, 0);
          if (def.facing === "side") f = side.clone().multiplyScalar(Math.sign(side.dot(c.clone().sub(centre))) || 1);
          else if (def.facing === "front") f = front.clone();
          else if (def.facing === "back") f = front.clone().negate();
          const from = c.clone().add(f.clone().multiplyScalar(4));
          rc.set(from, f.clone().negate());
          const h = rc.intersectObject(car, true)[0];
          anchors[z] = { p: h ? h.point.clone() : c, f };
        });

        // Turn to the zone that was picked; idle spin otherwise.
        let yaw = Math.atan2(0.8, 1.2), target: number | null = null, vyaw = 0, drag = false, lastX = 0, lastEmit = 0, lastFrame = 0, lastSel: ZoneKey | null = null;
        const dist = 6.2, ele = 0.2;
        const down = (e: any) => { drag = true; lastX = e.clientX; vyaw = 0; target = null; e.target.setPointerCapture?.(e.pointerId); };
        const move = (e: any) => { if (!drag) return; const dx = e.clientX - lastX; lastX = e.clientX; yaw -= dx * 0.01; vyaw = -dx * 0.01; };
        const up = () => { drag = false; };
        renderer.domElement.addEventListener("pointerdown", down);
        renderer.domElement.addEventListener("pointermove", move);
        renderer.domElement.addEventListener("pointerup", up);
        renderer.domElement.addEventListener("pointercancel", up);
        let visible = true;
        const io = new g.IntersectionObserver((es: any[]) => { visible = es[0] ? es[0].isIntersecting : true; }, { threshold: 0.02 });
        io.observe(el);
        const v = new THREE.Vector3();
        const tick = (t: number) => {
          raf = g.requestAnimationFrame(tick);
          if (!visible || g.document.hidden || t - lastFrame < 1000 / 30) return;
          lastFrame = t;
          const lp = latest.current;
          scene.environmentIntensity = lp.night ? 0.55 : 1;
          key.intensity = lp.night ? 1 : 1.5;
          if (lp.selected !== lastSel) { lastSel = lp.selected; const a = lp.selected ? anchors[lp.selected] : undefined; target = a && a.f.y < 0.5 ? Math.atan2(a.f.z, a.f.x) : null; }
          if (target !== null) { let d = target - yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); yaw += d * 0.12; if (Math.abs(d) < 0.01) target = null; }
          else if (!drag) { yaw += (lastSel ? 0 : 0.0035) + vyaw; vyaw *= 0.92; }
          cam.position.set(Math.cos(yaw) * Math.cos(ele) * dist, Math.sin(ele) * dist + 0.9, Math.sin(yaw) * Math.cos(ele) * dist);
          cam.lookAt(0, 0.5, 0);
          renderer.render(scene, cam);
          if (t - lastEmit > 80) {
            lastEmit = t;
            const out: Partial<Record<ZoneKey, Pt>> = {};
            (Object.keys(anchors) as ZoneKey[]).forEach((z) => {
              const an = anchors[z]!;
              v.copy(an.p).project(cam);
              const toCam = cam.position.clone().sub(an.p).normalize();
              out[z] = { x: Math.round(((v.x + 1) / 2) * latest.current.width), y: Math.round(((1 - v.y) / 2) * latest.current.height), vis: an.f.dot(toCam) > 0.2 };
            });
            setPts(out);
          }
        };
        raf = g.requestAnimationFrame(tick);
        setState("ready");
        cleanup = () => { g.cancelAnimationFrame(raf); io.disconnect(); renderer.dispose(); renderer.domElement.remove(); };
      } catch {
        if (!dead) setState("poster"); // no WebGL or the model failed: the poster and the zone chips still work
      }
    };
    const idle = g.requestIdleCallback ? g.requestIdleCallback(() => void start(), { timeout: 1500 }) : g.setTimeout(() => void start(), 400);
    return () => { dead = true; g.cancelIdleCallback?.(idle); g.cancelAnimationFrame(raf); cleanup(); };
  }, []);

  const zoneKeys = new Set(p.zones.map((z) => z.key));
  return (
    <View style={{ width: p.width, height: p.height, overflow: "hidden" }}>
      <Image accessibilityLabel="A generic concept coupe" source={{ uri: POSTER }} resizeMode="contain" style={{ position: "absolute", left: 0, top: 0, width: p.width, height: p.height, opacity: state === "ready" ? 0 : 1 }} />
      <View ref={host} style={{ position: "absolute", left: 0, top: 0, width: p.width, height: p.height, cursor: "grab" } as never} />
      {state === "ready" ? p.zones.map((z) => {
        const pt = pts[z.key];
        if (!pt || !pt.vis || !zoneKeys.has(z.key)) return null;
        const on = z.key === p.selected;
        return (
          <Pressable key={z.key} accessibilityRole="button" accessibilityLabel={z.label} onPress={() => p.onSelect(z.key)}
            style={{ position: "absolute", left: pt.x - 22, top: pt.y - 22, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: on ? 20 : 16, height: on ? 20 : 16, borderRadius: 9999, borderWidth: 2, borderColor: on ? "#EC8638" : p.night ? "rgba(255,255,255,0.9)" : "rgba(30,30,34,0.85)", backgroundColor: on ? "rgba(236,134,56,0.35)" : p.night ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.55)", ...(on ? ({ boxShadow: "0 0 14px rgba(236,134,56,0.8)" } as object) : null) }} />
          </Pressable>
        );
      }) : null}
    </View>
  );
}
