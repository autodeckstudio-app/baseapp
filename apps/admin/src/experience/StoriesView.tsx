"use client";

// Stories: post a photo or short video. It shows for 24 hours in the customer app's Today circle.
// Highlights is one place: pick which posts stay there for good. Hiding is a soft remove; nothing is deleted.
import { useRef, useState } from "react";
import type { StoryView } from "@autodeck/core";
import { PageHead } from "./Office";

const MAX_MB = 50;

const HIGHLIGHTS = "Highlights";

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

export function StoriesView(p: {
  stories: StoryView[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  onPublish: (input: { file: File; caption: string; highlightTitle: string }) => void;
  onPin: (s: StoryView, title: string | null) => void;
  onHide: (s: StoryView) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [keep, setKeep] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const now = Date.now();
  const byNewest = [...p.stories].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const live = byNewest.filter((s) => !s.hidden && Date.parse(s.expiresAt) > now);
  const highlights = byNewest.filter((s) => s.pinned && !s.hidden);
  const earlier = byNewest.filter((s) => !s.pinned && (s.hidden || Date.parse(s.expiresAt) <= now));
  const bad = file && (!/^(image\/(jpeg|png|webp)|video\/mp4)$/.test(file.type) || file.size > MAX_MB * 1024 * 1024);

  const card = (s: StoryView, mode: "live" | "highlight" | "earlier") => (
    <li key={s.id} className="ax-story">
      <div className="ax-story-media"><Thumb s={s} />{s.mediaType === "video" ? <span className="ax-story-tag">Video</span> : null}</div>
      <div className="ax-story-body">
        <span className="ax-person-name">{s.caption ?? (s.mediaType === "video" ? "Video" : "Photo")}</span>
        <span className="ax-sub">{new Date(s.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{mode === "live" ? ` · ${timeLeft(s)}` : s.hidden ? " · hidden" : ""}</span>
      </div>
      <div className="ax-story-actions">
        {s.pinned ? (
          <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onPin(s, null)}>Remove from Highlights</button>
        ) : (
          <button type="button" className="ax-button ax-button--primary" disabled={p.busy} onClick={() => p.onPin(s, HIGHLIGHTS)}>Add to Highlights</button>
        )}
        <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onHide(s)}>{s.hidden ? "Show" : "Hide"}</button>
      </div>
    </li>
  );
  const section = (label: string, note: string, list: StoryView[], mode: "live" | "highlight" | "earlier", empty: string) => (
    <section className="ax-panel">
      <span className="ax-label">{label}</span>
      <p className="ax-note" style={{ marginTop: 4 }}>{note}</p>
      {p.loading ? [0, 1].map((i) => <div key={i} className="ax-skel ax-skel--row" />) : list.length === 0 ? <p className="ax-note">{empty}</p> : <ul className="ax-story-grid">{list.map((s) => card(s, mode))}</ul>}
    </section>
  );

  return (
    <div className="ax-page">
      <PageHead eyebrow="Studio" title="Stories" kpis={[{ value: live.length, label: "Live today" }, { value: highlights.length, label: "In Highlights" }]} />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className="ax-detail">
        <div className="ax-detail-main">
          {section("Today", "Shown in the Today circle at the top of the customer Home for 24 hours, then they leave on their own.", live, "live", "Nothing live. Post a photo or video.")}
          {section("Highlights", "One circle on Home. Add any post here to keep it as long as you want, and remove it when you are done.", highlights, "highlight", "Nothing in Highlights yet. Use Add to Highlights on any post.")}
          {earlier.length > 0 ? section("Earlier", "Expired or hidden posts. Add one to Highlights to bring it back.", earlier, "earlier", "") : null}
        </div>

        <div className="ax-detail-side">
          <section className="ax-panel">
            <span className="ax-label">Post a story</span>
            <div className="ax-form-section">
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" aria-label="Photo or video" disabled={p.busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {bad && <p className="ax-note" role="alert">Use a JPG, PNG, WebP or MP4 under {MAX_MB} MB.</p>}
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" aria-label="Caption" maxLength={200} disabled={p.busy} />
              <label className="ax-check"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> <span>Also keep in Highlights</span></label>
              <button
                type="button"
                className="ax-button ax-button--primary"
                disabled={p.busy || !file || !!bad}
                onClick={() => { if (!file) return; p.onPublish({ file, caption: caption.trim(), highlightTitle: keep ? HIGHLIGHTS : "" }); setFile(null); setCaption(""); setKeep(false); if (input.current) input.current.value = ""; }}
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
