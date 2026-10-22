// Cars section: shows the cars AutoDeck has listed, from the existing public read-only endpoint (explicit allowlist: no price, plate, owner, photos).
// If the request fails or nothing is listed, the static "being prepared" panel stays as it is.
const ENDPOINT = "https://asia-south1-autodeck-studio.cloudfunctions.net/listPublicCarListings";
const APP = "https://app.autodeck.in";
type L = { id: string; status: string; make: string; model: string; variant?: string; year: number; kmDriven: number; fuel?: string; gearbox?: string };
const cap = (v?: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : "");

async function load() {
  const row = document.getElementById("carrow"), trk = document.getElementById("cartrk"), empty = document.getElementById("carsempty");
  if (!row || !trk) return;
  let list: L[] = [];
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: {} }), signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return;
    const j = await r.json();
    list = Array.isArray(j?.result?.listings) ? j.result.listings : [];
  } catch { return; }
  list = list.filter((l) => l && (l.status === "live" || l.status === "reserved") && l.make && l.model);
  if (!list.length) return;
  for (const l of list) {
    const a = document.createElement("a"); a.className = "carc"; a.href = APP + "/cars"; a.rel = "noopener";
    const st = document.createElement("span"); st.className = "carst"; st.textContent = l.status === "reserved" ? "Reserved" : "Listed";
    const h = document.createElement("strong"); h.textContent = l.make + " " + l.model;
    const v = document.createElement("em"); v.textContent = [l.variant, l.year].filter(Boolean).join(" \u00b7 ");
    const m = document.createElement("span"); m.className = "carm";
    m.textContent = [typeof l.kmDriven === "number" ? l.kmDriven.toLocaleString("en-IN") + "\u00a0km" : "", cap(l.fuel), cap(l.gearbox)].filter(Boolean).join(" \u00b7 ");
    const c = document.createElement("span"); c.className = "carcta"; c.textContent = "Price and details in the app";
    a.append(st, h, v, m, c); trk.append(a);
  }
  row.hidden = false; empty?.setAttribute("hidden", "");
  (empty as HTMLElement | null)?.style.setProperty("display", "none");
  const carsx = document.querySelector(".carsx") as HTMLElement | null;
  if (carsx) carsx.style.gridTemplateColumns = "1fr";
}
load();
