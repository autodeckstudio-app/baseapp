// New homepage motion: scroll wash, services rows, app showcase, store carousel, menu.
// Window scroll at every width (the nested-scroll "boxed" mode existed only for the hosted preview viewer).
import { s12 } from "./home-v2-s12";
import { appr } from "./home-v2-appr";
import "./home-v2-cars";

const SC = {
  get y() { return window.scrollY; },
  get h() { return window.innerHeight; },
  to(a: any, b?: any) { if (typeof a === "object") window.scrollTo(a); else window.scrollTo(a, b); },
  on(t: string, f: any, o?: any) { window.addEventListener(t, f, o); },
};
s12({}, SC);
appr({}, SC);
