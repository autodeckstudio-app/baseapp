// A shareable "car story" the customer chooses to export for their own car.
//
// Safe by construction:
// - only DELIVERED visits, dated from sealedAt;
// - only CURRENT, studio-VERIFIED protection records (self-reported entries
//   are excluded by default - the customer can show those themselves);
// - the photo is included only when one is recorded for this vehicle
//   (the customer's own upload); never a stock or category image;
// - never: plate, odometer, invoices, prices, contact details, studio
//   address/phone, inspection notes or internal evidence.
// The app generates the file on-device; sharing it on is the customer's act.

export type ShareStoryInput = {
  carTitle: string;
  subtitle: string;
  photoUrl: string | null;
  visits: { date: string; service: string }[];
  protections: { title: string; detail: string }[];
  generatedOn: string;
};

const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function shareStoryHtml(i: ShareStoryInput): string {
  const photo = i.photoUrl ? `<img src="${esc(i.photoUrl)}" alt="${esc(i.carTitle)}" style="width:100%;border-radius:16px;margin-bottom:20px">` : "";
  const visits = i.visits.length
    ? `<h2>Care history</h2><ul>${i.visits.map((v) => `<li><b>${esc(v.service)}</b>, ${esc(v.date)}</li>`).join("")}</ul>`
    : "";
  const prot = i.protections.length
    ? `<h2>Protection on record</h2><ul>${i.protections.map((p) => `<li><b>${esc(p.title)}</b>${p.detail ? `, ${esc(p.detail)}` : ""}</li>`).join("")}</ul>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(i.carTitle)}, care story</title><style>body{font:15px/1.6 system-ui,sans-serif;color:#1b1b1f;max-width:560px;margin:24px auto;padding:0 16px}h1{font-size:26px;margin:0 0 2px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#777;margin:26px 0 8px}ul{margin:0;padding-left:18px}li{margin:4px 0}.sub{color:#666;margin:0 0 16px}.gen{color:#999;font-size:12px;margin-top:28px}</style></head><body>${photo}<h1>${esc(i.carTitle)}</h1><p class="sub">${esc(i.subtitle)}</p>${prot}${visits}<p class="gen">Care story from AutoDeck Studio, generated ${esc(i.generatedOn)}</p></body></html>`;
}

/** Nothing to share yet: no photo, no verified protection, no delivered visit. */
export function shareStoryReady(i: Pick<ShareStoryInput, "photoUrl" | "visits" | "protections">): boolean {
  return i.photoUrl !== null || i.visits.length > 0 || i.protections.length > 0;
}
