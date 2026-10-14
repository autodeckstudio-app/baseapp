/* eslint-disable @typescript-eslint/no-explicit-any */
// Real 3D car for the web care map. Models are CC0 (Grab3D, Kenney), loaded on demand.
// Drag to turn the car. Zone dots sit on the real surface and follow it as it turns.
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "@autodeck/ui/native";
import type { BodyShape, ZoneKey } from "../lib/car-models";
import { recolour } from "../lib/car-recolour";
import type { Car3DProps } from "./Car3D";

export type { Car3DProps };
export const car3dSupported = true;

type Pt = { x: number; y: number; vis: boolean };
const FILE: Record<BodyShape, string> = { sedan: "sedan", suv: "suv", pickup: "pickup", hatch: "hatch", mpv: "mpv" };
// Which end of the model's long axis is the nose, per model (+1 = positive axis).
const NOSE: Record<BodyShape, number> = { sedan: 1, suv: 1, pickup: 1, hatch: 1, mpv: 1 };

export function Car3D(p: Car3DProps) {
  const host = useRef<any>(null);
  const api = useRef<any>(null);
  const [pts, setPts] = useState<Partial<Record<ZoneKey, Pt>>>({});
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    let dead = false;
    let raf = 0;
    let cleanup = () => undefined;
    void (async () => {
      try {
        const THREE: any = await import("three");
        const { GLTFLoader } = (await import("three/examples/jsm/loaders/GLTFLoader.js")) as any;
        const { RoomEnvironment } = (await import("three/examples/jsm/environments/RoomEnvironment.js")) as any;
        const el = host.current as any;
        if (dead || !el) return;
        const W = latest.current.width, H = latest.current.height;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(2, (globalThis as any).devicePixelRatio ?? 1));
        renderer.setSize(W, H);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.domElement.style.display = "block";
        renderer.domElement.style.touchAction = "pan-y";
        el.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const pm = new THREE.PMREMGenerator(renderer);
        scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        const key = new THREE.DirectionalLight(0xffffff, 1);
        key.position.set(3, 6, 4);
        scene.add(key);
        // soft contact shadow
        const cv = (globalThis as any).document.createElement("canvas");
        cv.width = cv.height = 128;
        const cx = cv.getContext("2d");
        const gr = cx.createRadialGradient(64, 64, 4, 64, 64, 62);
        gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        cx.fillStyle = gr; cx.fillRect(0, 0, 128, 128);
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        scene.add(shadow);
        const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
        const root = new THREE.Group();
        scene.add(root);

        const base = (globalThis as any).location?.origin ?? "";
        const gltf: any = await new Promise((res, rej) => new GLTFLoader().load(`${base}/models/${FILE[latest.current.shape]}.glb`, res, undefined, rej));
        if (dead) { renderer.dispose(); return; }
        const car = gltf.scene;
        const box = new THREE.Box3().setFromObject(car);
        const size = box.getSize(new THREE.Vector3());
        const ctr = box.getCenter(new THREE.Vector3());
        const lenAxis = size.x >= size.z ? "x" : "z";
        const L = size[lenAxis];
        const k = 4 / L;
        car.scale.setScalar(k);
        car.position.set(-ctr.x * k, -box.min.y * k, -ctr.z * k);
        // turn the car so its nose points to +X
        const sign = NOSE[latest.current.shape];
        root.rotation.y = lenAxis === "x" ? (sign > 0 ? 0 : Math.PI) : (sign > 0 ? -Math.PI / 2 : Math.PI / 2);
        root.add(car);
        root.updateMatrixWorld(true);
        shadow.scale.set(4.8, 2.4, 1);
        shadow.position.y = 0.01;

        // body paint: repaint the atlas once per colour
        const bodyMats: any[] = [];
        car.traverse((m: any) => { if (m.isMesh) for (const mat of ([] as any[]).concat(m.material)) if (/body_pbr|colormap/.test(mat.name ?? "") && !bodyMats.includes(mat)) bodyMats.push(mat); });
        const orig = bodyMats.map((m) => { const img: any = m.map?.image; if (!img) return null; const c = (globalThis as any).document.createElement("canvas"); const s = Math.min(1, 1024 / img.width); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, c.width, c.height); return { c, g, data: g.getImageData(0, 0, c.width, c.height) }; });
        let painted = "";
        const paint = (hex: string) => {
          if (painted === hex) return; painted = hex;
          bodyMats.forEach((m, i) => {
            const o = orig[i]; if (!o) return;
            const d = o.g.createImageData(o.c.width, o.c.height); d.data.set(o.data.data);
            recolour(d.data, hex);
            const c2 = (globalThis as any).document.createElement("canvas"); c2.width = o.c.width; c2.height = o.c.height; c2.getContext("2d").putImageData(d, 0, 0);
            const t = new THREE.CanvasTexture(c2); t.flipY = m.map.flipY; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
            m.map = t; m.needsUpdate = true;
          });
        };

        // anchors: ray onto the real surface at each zone's position
        const rc = new THREE.Raycaster();
        const anchors: Partial<Record<ZoneKey, { p: any; n: any }>> = {};
        const hit = (from: any, dir: any) => { rc.set(from, dir); const h = rc.intersectObject(car, true)[0]; if (!h) return null; const n = h.face.normal.clone().transformDirection(h.object.matrixWorld); if (n.dot(dir) > 0) n.negate(); return { p: h.point.clone(), n }; };
        // Find the zones from the real shape: sample the roofline down the centre.
        const profile = () => {
          const out: Array<{ x: number; y: number } | null> = [];
          for (let i = 0; i <= 80; i++) { const x = -2 + (i / 80) * 4; const h = hit(new THREE.Vector3(x, 6, 0), new THREE.Vector3(0, -1, 0)); out.push(h ? { x, y: h.p.y } : null); }
          return out;
        };
        let prof = profile();
        const maxY = Math.max(...prof.map((q) => q?.y ?? 0));
        // The models are authored with the nose on the negative side of the long axis.
        root.rotation.y += Math.PI; root.updateMatrixWorld(true); prof = profile();
        const pts2 = prof.filter(Boolean) as Array<{ x: number; y: number }>;
        const noseX = Math.max(...pts2.map((q) => q.x)), tailX = Math.min(...pts2.map((q) => q.x));
        const roofs = pts2.filter((q) => q.y > maxY * 0.94);
        const roofFront = Math.max(...roofs.map((q) => q.x)), roofBack = Math.min(...roofs.map((q) => q.x));
        const lowFront = Math.min(...pts2.filter((q) => q.x > roofFront).map((q) => q.y).concat(maxY));
        const lowBack = Math.min(...pts2.filter((q) => q.x < roofBack).map((q) => q.y).concat(maxY));
        const crossing = (from: number, step: number, level: number) => { let x = from; while (x > tailX && x < noseX) { const q = pts2.find((r) => Math.abs(r.x - x) < 0.03); if (q && q.y < level) return x; x += step; } return from; };
        const wsTop = roofFront, wsBase = crossing(roofFront, 0.05, lowFront + (maxY - lowFront) * 0.25);
        const rgTop = roofBack, rgBase = crossing(roofBack, -0.05, lowBack + (maxY - lowBack) * 0.25);

        const topAt = (z: ZoneKey, x: number) => { const h = hit(new THREE.Vector3(x, 6, 0), new THREE.Vector3(0, -1, 0)); if (h) anchors[z] = h; };
        topAt("hood", (noseX - 0.1 + wsBase) / 2);
        topAt("windshield", (wsTop + wsBase) / 2);
        topAt("roof", (roofFront + roofBack) / 2);
        topAt("rear", (rgTop + rgBase) / 2);
        topAt("trunk", (tailX + 0.1 + rgBase) / 2);
        const doorX = (wsBase + rgBase) / 2;
        (["left", "right"] as ZoneKey[]).forEach((z) => { const side = z === "right" ? 1 : -1; const h = hit(new THREE.Vector3(doorX, maxY * 0.5, side * 3), new THREE.Vector3(0, 0, -side)); if (h) anchors[z] = h; });

        paint(latest.current.colour);
        let yaw = 0.7, vyaw = 0, drag = false, lastX = 0, lastEmit = 0;
        const ele = 0.38, dist = 6.8;
        const down = (e: any) => { drag = true; lastX = e.clientX; vyaw = 0; (e.target as any).setPointerCapture?.(e.pointerId); };
        const move = (e: any) => { if (!drag) return; const dx = e.clientX - lastX; lastX = e.clientX; yaw -= dx * 0.012; vyaw = -dx * 0.012; };
        const up = () => { drag = false; };
        renderer.domElement.addEventListener("pointerdown", down);
        renderer.domElement.addEventListener("pointermove", move);
        renderer.domElement.addEventListener("pointerup", up);
        renderer.domElement.addEventListener("pointercancel", up);
        const v = new THREE.Vector3();
        const tick = (t: number) => {
          raf = (globalThis as any).requestAnimationFrame(tick);
          const lp = latest.current;
          scene.environmentIntensity = lp.night ? 0.4 : 1;
          key.intensity = lp.night ? 0.7 : 1.5;
          paint(lp.colour);
          if (!drag) { yaw += vyaw; vyaw *= 0.92; }
          cam.position.set(Math.cos(yaw) * Math.cos(ele) * dist, Math.sin(ele) * dist + 0.4, Math.sin(yaw) * Math.cos(ele) * dist);
          cam.lookAt(0, 0.6, 0);
          renderer.render(scene, cam);
          if (t - lastEmit > 60) {
            lastEmit = t;
            const out: Partial<Record<ZoneKey, Pt>> = {};
            (Object.keys(anchors) as ZoneKey[]).forEach((z) => {
              const an = anchors[z]!;
              v.copy(an.p).project(cam);
              const toCam = cam.position.clone().sub(an.p).normalize();
              out[z] = { x: Math.round(((v.x + 1) / 2) * W), y: Math.round(((1 - v.y) / 2) * H), vis: an.n.dot(toCam) > 0.12 };
            });
            setPts(out);
          }
        };
        raf = (globalThis as any).requestAnimationFrame(tick);
        api.current = { renderer };
        setState("ready");
        cleanup = () => { (globalThis as any).cancelAnimationFrame(raf); renderer.dispose(); renderer.domElement.remove(); };
      } catch {
        if (!dead) setState("failed");
      }
    })();
    return () => { dead = true; (globalThis as any).cancelAnimationFrame(raf); cleanup(); };
  }, [p.shape, p.width, p.height]);

  return (
    <View style={{ width: p.width, height: p.height }}>
      {createHost(host, p.width, p.height)}
      {state === "ready" ? p.zones.map((z) => {
        const pt = pts[z.key];
        if (!pt || !pt.vis) return null;
        const on = z.key === p.selected;
        return (
          <Pressable key={z.key} accessibilityRole="button" accessibilityLabel={`${z.label}`} onPress={() => p.onSelect(z.key)} hitSlop={8}
            style={{ position: "absolute", left: pt.x - 15, top: pt.y - 15, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#EC8638" : "rgba(255,255,255,0.92)", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
            <Icon name={z.ok ? "check" : "plus"} color={on ? "#fff" : z.ok ? "#2E9E6B" : "#3A3D44"} size={15} />
          </Pressable>
        );
      }) : null}
    </View>
  );
}

import { createElement } from "react";
function createHost(ref: any, w: number, h: number) {
  return createElement("div", { ref, style: { width: w, height: h, position: "absolute", left: 0, top: 0, cursor: "grab" } });
}

