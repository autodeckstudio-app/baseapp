"use client";

// Stories, laid out like the customer tray: a row of circles (Today, then the five highlights) and the posts of the picked circle below.
// Post a photo or short video. It shows for 24 hours in Today. A post can also sit in ONE highlight: PPF, Ceramic, Detailing, Washing or Modifications.
// Hide is a soft remove. Delete removes the post and its file for good, after a confirm in the page.
import { useRef, useState } from "react";
import { STORY_HIGHLIGHTS, type StoryHighlight, type StoryView } from "@autodeck/core";
import { PageHead } from "./Office";

const MAX_MB = 50;
const TODAY = "Today";
type Tab = typeof TODAY | StoryHighlight;

function timeLeft(s: StoryView): string {
  const left = Date.parse(s.expiresAt) - Date.now();
  if (left <= 0) return "Expired";
  const h = Math.floor(left / 3600e3);
  const m = Math.floor((left % 3600e3) / 60e3);
  return h > 0 ? `${h}h ${m}m left` : `${Math.max(1, m)}m left`;
}

function Thumb({ s }: { s: StoryView }) {
  return s.mediaType === "video"
    ? <video src={s.url} muted playsInline preload="metadata" />
    : <img src={s.url} alt={s.caption ?? "Story"} loading="lazy" />;
}

const asHighlight = (t: string | null): StoryHighlight | null => (STORY_HIGHLIGHTS as readonly string[]).includes(t ?? "") ? (t as StoryHighlight) : null;

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
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [collection, setCollection] = useState<StoryHighlight | "">("");
  const [tab, setTab] = useState<Tab>(TODAY);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const now = Date.now();
  const byNewest = [...p.stories].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const live = byNewest.filter((s) => !s.hidden && Date.parse(s.expiresAt) > now);
  const inHighlight = (h: StoryHighlight) => byNewest.filter((s) => s.pinned && asHighlight(s.highlightTitle) === h);
  const shown = tab === TODAY ? live : inHighlight(tab);
  const total = STORY_HIGHLIGHTS.reduce((n, h) => n + inHighlight(h).filter((s) => !s.hidden).length, 0);
  const bad = file && (!/^(image\/(jpeg|png|webp)|video\/mp4)$/.test(file.type) || file.size > MAX_MB * 1024 * 1024);

  const circle = (key: Tab, count: number, cover: StoryView | undefined) => (
    <button key={key} type="button" className="ax-story-circle" aria-pressed={tab === key} aria-label={`${key}, ${count} ${count === 1 ? "post" : "posts"}`} onClick={() => setTab(key)} style={{ display: "grid", justifyItems: "center", gap: 6, background: "none", border: 0, padding: 0, width: 72, cursor: "pointer" }}>
      <span style={{ width: 64, height: 64, borderRadius: 32, padding: 3, border: `2px solid ${tab === key ? "#EC8638" : "#D8D8DE"}`, display: "grid" }}>
        <span style={{ borderRadius: 28, overflow: "hidden", background: "#F2F2F5", display: "grid", placeItems: "center", fontWeight: 600, color: "#55555F" }}>
          {cover && cover.mediaType === "image" ? <img src={cover.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : key[0]}
        </span>
      </span>
      <span className="ax-sub" style={{ fontWeight: tab === key ? 600 : 400 }}>{key}</span>
    </button>
  );

  const card = (s: StoryView) => (
    <li key={s.id} className="ax-story">
      <div className="ax-story-media"><Thumb s={s} />{s.mediaType === "video" ? <span className="ax-story-tag">Video</span> : null}</div>
      <div className="ax-story-body">
        <span className="ax-person-name">{s.caption ?? (s.mediaType === "video" ? "Video" : "Photo")}</span>
        <span className="ax-sub">{new Date(s.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{Date.parse(s.expiresAt) > now ? ` · ${timeLeft(s)}` : ""}{s.hidden ? " · hidden" : ""}{asHighlight(s.highlightTitle) ? ` · ${s.highlightTitle}` : ""}</span>
      </div>
      <div className="ax-story-actions">
        <select aria-label="Highlight" value={s.pinned ? (asHighlight(s.highlightTitle) ?? "") : ""} disabled={p.busy} onChange={(e) => p.onPin(s, asHighlight(e.target.value))}>
          <option value="">No highlight</option>
          {STORY_HIGHLIGHTS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onHide(s)}>{s.hidden ? "Show" : "Hide"}</button>
        {confirmDelete === s.id ? (
          <div className="ax-form-section" style={{ width: "100%" }}>
            <p className="ax-note">Delete this post for good? The file is removed too. Hide keeps it.</p>
            <button type="button" className="ax-button ax-button--primary" disabled={p.busy} onClick={() => { setConfirmDelete(null); p.onDelete(s); }}>Delete post</button>
            <button type="button" className="ax-button" onClick={() => setConfirmDelete(null)}>Keep</button>
          </div>
        ) : <button type="button" className="ax-button" disabled={p.busy} onClick={() => setConfirmDelete(s.id)}>Delete</button>}
      </div>
    </li>
  );

  return (
    <div className="ax-page">
      <PageHead eyebrow="Studio" title="Stories" kpis={[{ value: live.length, label: "Live today" }, { value: total, label: "In highlights" }]} />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className="ax-detail">
        <div className="ax-detail-main">
          <section className="ax-panel">
            <div role="tablist" aria-label="Story circles" style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
              {circle(TODAY, live.length, live[0])}
              {STORY_HIGHLIGHTS.map((h) => circle(h, inHighlight(h).length, inHighlight(h).find((s) => s.mediaType === "image")))}
            </div>
            <p className="ax-note" style={{ marginTop: 8 }}>{tab === TODAY ? "Shown in the Today circle on the customer Home for 24 hours, then they leave on their own." : `Posts in ${tab}. Customers see them in the ${tab} circle for as long as they stay here.`}</p>
            {p.loading ? [0, 1].map((i) => <div key={i} className="ax-skel ax-skel--row" />) : shown.length === 0 ? <p className="ax-note">{tab === TODAY ? "Nothing live. Post a photo or video." : "Nothing here yet. Post a story and pick this highlight, or move an earlier post."}</p> : <ul className="ax-story-grid">{shown.map(card)}</ul>}
          </section>
        </div>

        <div className="ax-detail-side">
          <section className="ax-panel">
            <span className="ax-label">Post a story</span>
            <div className="ax-form-section">
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" aria-label="Photo or video" disabled={p.busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {bad && <p className="ax-note" role="alert">Use a JPG, PNG, WebP or MP4 under {MAX_MB} MB.</p>}
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" aria-label="Caption" maxLength={200} disabled={p.busy} />
              <select aria-label="Also keep in a highlight" value={collection} disabled={p.busy} onChange={(e) => setCollection(asHighlight(e.target.value) ?? "")}>
                <option value="">Today only</option>
                {STORY_HIGHLIGHTS.map((h) => <option key={h} value={h}>Also keep in {h}</option>)}
              </select>
              <button
                type="button"
                className="ax-button ax-button--primary"
                disabled={p.busy || !file || !!bad}
                onClick={() => { if (!file) return; p.onPublish({ file, caption: caption.trim(), highlightTitle: collection }); setFile(null); setCaption(""); setCollection(""); if (input.current) input.current.value = ""; }}
              >
                Post story
              </button>
              <p className="ax-note">Photos and videos (MP4) up to {MAX_MB} MB. Vertical 9:16 looks best.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
