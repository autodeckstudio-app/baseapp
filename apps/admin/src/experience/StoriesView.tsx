"use client";

// Stories: post a photo or short video. It shows for 24 hours in the customer app's story circles.
// Pin it to keep it forever as a Highlight. Hiding is a soft remove; nothing is deleted.
import { useRef, useState } from "react";
import type { StoryView } from "@autodeck/core";
import { PageHead } from "./Office";

const MAX_MB = 50;

function status(s: StoryView): string {
  if (s.hidden) return "hidden";
  if (s.pinned) return `highlight: ${s.highlightTitle ?? "Highlights"}`;
  const left = Date.parse(s.expiresAt) - Date.now();
  return left > 0 ? `live, ${Math.max(1, Math.round(left / 3600e3))}h left` : "expired";
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
  const [title, setTitle] = useState("");
  const [pinId, setPinId] = useState<string | null>(null);
  const [pinTitle, setPinTitle] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const live = p.stories.filter((s) => !s.hidden && !s.pinned && Date.parse(s.expiresAt) > Date.now()).length;
  const pinned = p.stories.filter((s) => s.pinned && !s.hidden).length;
  const bad = file && (!/^(image\/(jpeg|png|webp)|video\/mp4)$/.test(file.type) || file.size > MAX_MB * 1024 * 1024);

  return (
    <div className="ax-page">
      <PageHead eyebrow="Studio" title="Stories" kpis={[{ value: live, label: "Live today" }, { value: pinned, label: "Highlights" }]} />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className="ax-detail">
        <div className="ax-detail-main">
          <section className="ax-panel">
            <span className="ax-label">Posted</span>
            {p.loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ax-skel ax-skel--row" />)
            ) : p.stories.length === 0 ? (
              <p className="ax-note">Nothing posted yet. Add today&apos;s first photo or video.</p>
            ) : (
              <ul className="ax-list">
                {p.stories.map((s) => (
                  <li key={s.id} className="ax-list-row">
                    {s.mediaType === "video" ? (
                      <video src={s.url} width={48} height={72} muted style={{ objectFit: "cover", borderRadius: "var(--ad-radius-chip)" }} />
                    ) : (
                      <img src={s.url} alt={s.caption ?? "Story"} width={48} height={72} style={{ objectFit: "cover", borderRadius: "var(--ad-radius-chip)" }} />
                    )}
                    <span className="ax-slot-main">
                      <span className="ax-person-name">{s.caption ?? (s.mediaType === "video" ? "Video" : "Photo")}</span>
                      <span className="ax-sub">{new Date(s.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {status(s)}</span>
                    </span>
                    <span className="ax-row-actions">
                      {s.pinned ? (
                        <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onPin(s, null)}>Unpin</button>
                      ) : pinId === s.id ? (
                        <>
                          <input value={pinTitle} onChange={(e) => setPinTitle(e.target.value)} placeholder="Highlight name" aria-label="Highlight name" maxLength={30} />
                          <button type="button" className="ax-button ax-button--primary" disabled={p.busy || !pinTitle.trim()} onClick={() => { p.onPin(s, pinTitle.trim()); setPinId(null); setPinTitle(""); }}>Save</button>
                          <button type="button" className="ax-button" onClick={() => setPinId(null)}>Cancel</button>
                        </>
                      ) : (
                        <button type="button" className="ax-button" disabled={p.busy} onClick={() => setPinId(s.id)}>Pin</button>
                      )}
                      <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onHide(s)}>{s.hidden ? "Show" : "Hide"}</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="ax-detail-side">
          <section className="ax-panel">
            <span className="ax-label">Post a story</span>
            <div className="ax-form-section">
              <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" aria-label="Photo or video" disabled={p.busy} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {bad && <p className="ax-note" role="alert">Use a JPG, PNG, WebP or MP4 under {MAX_MB} MB.</p>}
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" aria-label="Caption" maxLength={200} disabled={p.busy} />
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Highlight name (optional, keeps it forever)" aria-label="Highlight name" maxLength={30} disabled={p.busy} />
              <button
                type="button"
                className="ax-button ax-button--primary"
                disabled={p.busy || !file || !!bad}
                onClick={() => { if (!file) return; p.onPublish({ file, caption: caption.trim(), highlightTitle: title.trim() }); setFile(null); setCaption(""); setTitle(""); if (input.current) input.current.value = ""; }}
              >
                Post story
              </button>
              <p className="ax-note">Customers see it for 24 hours. Add a highlight name to keep it on their Home screen permanently.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
