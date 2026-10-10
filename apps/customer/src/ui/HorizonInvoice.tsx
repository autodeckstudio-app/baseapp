import { createElement, useEffect, useRef, useState } from "react";

/** Isolated document surface: shared invoice HTML, sized to content, no inner scroll. */
export function HorizonInvoice({ html }: { html: string }) {
  const [height, setHeight] = useState(1100);
  const observer = useRef<{ disconnect: () => void } | null>(null);
  useEffect(() => () => observer.current?.disconnect(), [html]);
  return createElement("iframe", {
    title: "AutoDeck invoice",
    srcDoc: html,
    scrolling: "no",
    style: { display: "block", width: "100%", maxWidth: 794, height, border: 0, borderRadius: 18, margin: "0 auto", background: "#121413" },
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
