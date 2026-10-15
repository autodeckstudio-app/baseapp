import type { IconName } from "@autodeck/ui/theme";

export type TopSvc = { id: string; category: string; name: string; price: string; brand?: string | null };
export type TopPick = { key: string; title: string; icon: IconName; service: TopSvc };
const priceNum = (t: string) => { const n = Number(t.replace(/[^0-9.]/g, "")); return t && n > 0 ? n : Number.POSITIVE_INFINITY; };
/** Four small cards drawn from the real catalogue: the cheapest of each kind, so nothing is invented. */
export function pickTopServices(all: TopSvc[]): TopPick[] {
  const cheapest = (xs: TopSvc[]) => [...xs].sort((a, b) => priceNum(a.price) - priceNum(b.price))[0];
  const out: TopPick[] = [];
  const wash = cheapest(all.filter((x) => x.category === "washing"));
  if (wash) out.push({ key: "wash", title: "Quick wash", icon: "wash", service: wash });
  const coat = cheapest(all.filter((x) => x.category === "ceramic" || x.category === "coating"));
  if (coat) out.push({ key: "coat", title: "Ceramic coating", icon: "ceramic", service: coat });
  const garage = cheapest(all.filter((x) => x.category === "garage" && x.price !== "Quote on request" && !/repair/i.test(x.name)));
  if (garage) out.push({ key: "garage", title: "Garage check", icon: "tools", service: garage });
  const insp = all.find((x) => /repair|inspection/i.test(x.name) && x.price === "Quote on request") ?? all.find((x) => /inspection/i.test(x.name));
  if (insp) out.push({ key: "inspect", title: "Book an inspection", icon: "search", service: insp });
  return out;
}

