"use client";

// Stories, the way the customer sees them: ONE row of ringed circles. "+ Add story" first, then Today and the five highlights.
// A circle with posts has an orange ring, an empty one a grey ring. Tap a circle to open a full-screen viewer: swipe through the posts,
// move a post to a highlight, hide it, or delete it (after a confirm). New posts come from the full-screen New story sheet.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { STORY_HIGHLIGHTS, type StoryHighlight, type StoryView } from "@autodeck/core";
import { PageHead } from "./Office";

const MAX_MB = 50;
const TODAY = "Today";
type Tab = typeof TODAY | StoryHighlight;
const ORANGE = "#EC8638";

function timeLeft(s: StoryView): string {
  const left = Date.parse(s.expiresAt) - Date.now();
  if (left <= 0) return "Expired";
  const h = Math.floor(left / 3600e3);
  const m = Math.floor((left % 3600e3) / 60e3);
  return h > 0 ? `${h}h ${m}m left` : `${Math.max(1, m)}m left`;
}
const asHighlight = (t: string | null): StoryHighlight | null => (STORY_HIGHLIGHTS as readonly string[]).includes(t ?? "") ? (t as StoryHighlight) : null;

function Media({ s, fit }: { s: StoryView; fit: "cover" | "contain" }) {
  const style = { width: "100%", height: "100%", objectFit: fit } as const;
  return s.mediaType === "video"
    ? <video src={s.url} muted={fit === "cover"} controls={fit === "contain"} playsInline preload="metadata" style={style} />
    : <img src={s.url} alt={s.caption ?? "Story"} loading="lazy" style={style} />;
}

/** A tappable circle. A div, not a button: the admin button style would put a grey box behind it. */
function Tap({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <div role="button" tabIndex={0} aria-label={label} onClick={onClick} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }} style={{ display: "grid", justifyItems: "center", gap: 6, width: 76, cursor: "pointer", flex: "0 0 auto" }}>{children}</div>;
}

const overlay = { position: "fixed", inset: 0, zIndex: 1000, background: "#fff", display: "flex", flexDirection: "column" } as const;

export function StoriesView(p: {
  stories: StoryView[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  onPublish: (input: { file: File; caption: string; highlightTitle: StoryHighlight | "" }) => void;
  onPin: (s: StoryView, title: StoryHighlight | null) => void;
  onHide: (s: StoryView) => void;
  onDelete: (s: StoryView) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [collection, setCollection] = useState<StoryHighlight | "">("");
  const [open, setOpen] = useState<Tab | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const now = Date.now();
  const byNewest = [...p.stories].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const live = byNewest.filter((s) => !s.hidden && Date.parse(s.expiresAt) > now);
  const inHighlight = (h: StoryHighlight) => byNewest.filter((s) => s.pinned && asHighlight(s.highlightTitle) === h);
  const postsOf = (t: Tab) => (t === TODAY ? live : inHighlight(t));
  const bad = file && (!/^(image\/(jpeg|png|webp)|video\/mp4)$/.test(file.type) || file.size > MAX_MB * 1024 * 1024);
  const posts = open ? postsOf(open) : [];
  const current = posts[Math.min(index, Math.max(0, posts.length - 1))];

  useEffect(() => { setIndex(0); setConfirmDelete(null); if (track.current) track.current.scrollTo({ left: 0 }); }, [open]);
  useEffect(() => { if (!open && !adding) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(null); setAdding(false); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open, adding]);

  const ringed = (label: string, count: number, cover: StoryView | undefined, onClick: () => void) => (
    <Tap key={label} label={`${label}, ${count} ${count === 1 ? "post" : "posts"}`} onClick={onClick}>
      <span style={{ width: 68, height: 68, borderRadius: 9999, padding: 3, border: `2px solid ${count > 0 ? ORANGE : "#D8D8DE"}`, display: "grid" }}>
        <span style={{ borderRadius: 9999, overflow: "hidden", background: "#F2F2F5", display: "grid", placeItems: "center", fontWeight: 600, color: "#55555F" }}>
          {cover && cover.mediaType === "image" ? <img src={cover.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : label[0]}
        </span>
      </span>
      <span className="ax-sub" style={{ whiteSpace: "nowrap" }}>{label}</span>
    </Tap>
  );

  return (
    <div className="ax-page">
      <PageHead eyebrow="Studio" title="Stories" kpis={[{ value: live.length, label: "Live today" }, { value: STORY_HIGHLIGHTS.reduce((n, h) => n + inHighlight(h).filter((s) => !s.hidden).length, 0), label: "In highlights" }]} />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <section className="ax-panel">
        <div role="list" aria-label="Story circles" style={{ display: "flex", gap: 16, overflowX: "auto", padding: "4px 2px 8px", scrollbarWidth: "none" }}>
          <Tap label="Add story" onClick={() => setAdding(true)}>
            <span style={{ width: 68, height: 68, borderRadius: 9999, background: "#111", color: "#fff", display: "grid", placeItems: "center", fontSize: 30, lineHeight: 1 }}>+</span>
            <span className="ax-sub" style={{ whiteSpace: "nowrap" }}>Add story</span>
          </Tap>
          {p.loading ? [0, 1, 2].map((i) => <div key={i} className="ax-skel" style={{ width: 68, height: 68, borderRadius: 9999, flex: "0 0 auto" }} />) : null}
          {!p.loading ? ringed(TODAY, live.length, live[0], () => setOpen(TODAY)) : null}
          {!p.loading ? STORY_HIGHLIGHTS.map((h) => ringed(h, inHighlight(h).length, inHighlight(h).find((s) => s.mediaType === "image"), () => setOpen(h))) : null}
        </div>
        <p className="ax-note" style={{ marginTop: 4 }}>Today shows posts for 24 hours. A highlight keeps its posts until you remove them. Orange ring means it has posts.</p>
      </section>

      {adding && typeof document !== "undefined" ? createPortal(
        <div style={overlay} role="dialog" aria-modal="true" aria-label="New story">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px" }}>
            <strong style={{ fontSize: 18 }}>New story</strong>
            <button type="button" className="ax-button" onClick={() => { setAdding(false); setFile(null); setCaption(""); setCollection(""); }}>Close</button>
          </div>
          <div className="ax-form-section" style={{ padding: "0 20px 24px", maxWidth: 520, width: "100%", margin: "0 auto", overflowY: "auto" }}>
            <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" aria-label="Photo or video" disabled={p.busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {bad && <p className="ax-note" role="alert">Use a JPG, PNG, WebP or MP4 under {MAX_MB} MB.</p>}
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" aria-label="Caption" maxLength={200} disabled={p.busy} />
            <select aria-label="Also keep in a highlight" value={collection} disabled={p.busy} onChange={(e) => setCollection(asHighlight(e.target.value) ?? "")}>
              <option value="">Today only</option>
              {STORY_HIGHLIGHTS.map((h) => <option key={h} value={h}>Also keep in {h}</option>)}
            </select>
            <button type="button" className="ax-button ax-button--primary" disabled={p.busy || !file || !!bad} onClick={() => { if (!file) return; p.onPublish({ file, caption: caption.trim(), highlightTitle: collection }); setAdding(false); setFile(null); setCaption(""); setCollection(""); }}>Post story</button>
            <p className="ax-note">Photos and videos (MP4) up to {MAX_MB} MB. Vertical 9:16 looks best.</p>
          </div>
        </div>, document.body) : null}

      {open && typeof document !== "undefined" ? createPortal(
        <div style={overlay} role="dialog" aria-modal="true" aria-label={`${open} stories`}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px" }}>
            <strong style={{ fontSize: 18 }}>{open}{posts.length ? ` (${Math.min(index, posts.length - 1) + 1} of ${posts.length})` : ""}</strong>
            <button type="button" className="ax-button" onClick={() => setOpen(null)}>Close</button>
          </div>
          {posts.length === 0 ? (
            <p className="ax-note" style={{ padding: "0 20px" }}>{open === TODAY ? "Nothing live. Tap Close, then + Add story." : `Nothing in ${open} yet. Add a story and keep it in ${open}, or move a post here from Today.`}</p>
          ) : (
            <>
              <div ref={track} onScroll={(e) => { const el = e.currentTarget; setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); setConfirmDelete(null); }} style={{ flex: 1, minHeight: 0, display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
                {posts.map((s) => (
                  <div key={s.id} style={{ flex: "0 0 100%", scrollSnapAlign: "center", display: "grid", placeItems: "center", background: "#F6F6F8", minWidth: 0 }}>
                    <div style={{ width: "100%", height: "100%", maxWidth: 520, padding: 12 }}><Media s={s} fit="contain" /></div>
                  </div>
                ))}
              </div>
              {current ? (
                <div style={{ padding: "12px 20px 20px", display: "grid", gap: 10, maxWidth: 560, width: "100%", margin: "0 auto" }}>
                  <div><strong>{current.caption ?? (current.mediaType === "video" ? "Video" : "Photo")}</strong><br /><span className="ax-sub">{new Date(current.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {timeLeft(current)}{current.hidden ? " · hidden" : ""}</span></div>
                  <div role="group" aria-label="Highlight" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {STORY_HIGHLIGHTS.map((h) => {
                      const on = current.pinned && asHighlight(current.highlightTitle) === h;
                      return <button key={h} type="button" aria-pressed={on} disabled={p.busy} className="ax-button" style={on ? { background: "#111", color: "#fff", borderColor: "#111" } : undefined} onClick={() => p.onPin(current, on ? null : h)}>{h}</button>;
                    })}
                  </div>
                  {confirmDelete === current.id ? (
                    <div className="ax-form-section">
                      <p className="ax-note">Delete this post for good? The file is removed too. Hide keeps it.</p>
                      <button type="button" className="ax-button ax-button--primary" disabled={p.busy} onClick={() => { setConfirmDelete(null); p.onDelete(current); }}>Delete post</button>
                      <button type="button" className="ax-button" onClick={() => setConfirmDelete(null)}>Keep</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onHide(current)}>{current.hidden ? "Show" : "Hide"}</button>
                      <button type="button" className="ax-button" disabled={p.busy} onClick={() => setConfirmDelete(current.id)}>Delete</button>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>, document.body) : null}
    </div>
  );
}
