import {useExperienceTheme} from "@autodeck/ui/native";
import { createElement, useEffect, useRef, useState } from "react";

/** Isolated document surface: shared invoice HTML, sized to content, no inner scroll. */
export function HorizonInvoice({ html }: { html: string }) {
  const {name}=useExperienceTheme();
  const day=name==="light";
  const surfaceStyle=`<style>.screen{--bg:${day?'#F5F8FC':'#202F42'};--ink:${day?'#242C33':'#ECF2F8'};--muted:${day?'#586A7D':'#B8C7D8'};--rule:${day?'#D4DDE8':'#41536A'};--orange:${day?'#586A7D':'#B8C7D8'}}.screen .hero{background:${day?'linear-gradient(120deg,#F5F8FC,#DFE8F3)':'linear-gradient(120deg,#202F42,#31475F)'};border-bottom-color:var(--rule)}.screen .orbit{display:none}.screen .edition,.screen .total strong{color:var(--ink)}.screen .total{background:${day?'#DFE8F3':'#31475F'}}.screen .logo{filter:${day?'brightness(.18)':'none'}}.screen .studio>b{display:none}@media(max-width:500px){.screen .titleblock{flex-direction:column;align-items:flex-start;gap:16px}.screen .edition{max-width:100%;overflow-wrap:anywhere;text-align:left;font-size:26px}.screen .edition:after{margin-left:0}.screen h1{font-size:40px}}</style>`;
  const screenHtml=html.replace('</head>',surfaceStyle+'</head>');
  const [height, setHeight] = useState(1100);
  const observer = useRef<{ disconnect: () => void } | null>(null);
  useEffect(() => () => observer.current?.disconnect(), [html]);
  return createElement("iframe", {
    title: "AutoDeck invoice",
    srcDoc: screenHtml,
    scrolling: "no",
    style: { display: "block", width: "100%", maxWidth: 794, height, border: 0, borderRadius: 24, margin: "0 auto", background: day?"#F5F8FC":"#202F42" },
    onLoad: (event: { currentTarget: { contentDocument: { body: { scrollHeight: number }; fonts: { ready: Promise<unknown> } } | null } }) => {
      const frame = event.currentTarget;
      const document = frame.contentDocument;
      if (!document) return;
      const size = () => setHeight(Math.ceil(document.body.scrollHeight));
      size();
      observer.current?.disconnect();
      const resize = new (globalThis as unknown as { ResizeObserver: new (cb: () => void) => { observe: (el: unknown) => void; disconnect: () => void } }).ResizeObserver(size);
      resize.observe(document.body);
      observer.current = resize;
      void document.fonts.ready.then(size);
    },
  });
}
