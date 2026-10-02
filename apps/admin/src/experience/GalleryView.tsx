"use client";

// Gallery: the studio's public marketing wall. Active images are readable by
// anyone (marketing site + customer app); unpublished ones only show here.
import { useState } from "react";
import type { GalleryCategory, GalleryImage } from "@autodeck/core";
import { PageHead } from "./Office";

const CATEGORY_NAME: Record<GalleryCategory, string> = {
  BEFORE_AFTER: "Before / after",
  PPF: "PPF",
  CERAMIC: "Ceramic",
  WASH: "Wash",
  STUDIO: "Studio",
  OTHER: "Other",
};

export function GalleryView(p: {
  images: GalleryImage[];
  isAdmin: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  message: string | null;
  onAdd: (input: { imageUrl: string; category: GalleryCategory; caption: string; vehicleLabel: string }) => void;
  onToggle: (image: GalleryImage) => void;
  onDelete: (image: GalleryImage) => void;
}) {
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<GalleryCategory>("BEFORE_AFTER");
  const [caption, setCaption] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const active = p.images.filter((i) => i.active);
  const urlOk = /^https:\/\/.+\..+/.test(url.trim());

  return (
    <div className="ax-page">
      <PageHead
        eyebrow="Studio"
        title="Gallery"
        kpis={[
          { value: active.length, label: "Live" },
          { value: p.images.length - active.length, label: "Hidden", tone: p.images.length - active.length > 0 ? "accent" : undefined },
        ]}
      />
      {p.error && <p className="ax-status-msg ax-status-msg--warn" role="alert">{p.error}</p>}
      {p.message && <p className="ax-status-msg">{p.message}</p>}

      <div className="ax-detail">
        <div className="ax-detail-main">
          <section className="ax-panel">
            <span className="ax-label">Images</span>
            {p.loading ? (
              [0, 1, 2].map((i) => <div key={i} className="ax-skel ax-skel--row" />)
            ) : p.images.length === 0 ? (
              <p className="ax-note">No images yet. Add the first one from the form.</p>
            ) : (
              <ul className="ax-list">
                {p.images.map((img) => (
                  <li key={img.id} className="ax-list-row">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.imageUrl} alt={img.caption ?? CATEGORY_NAME[img.category]} width={72} height={48} style={{ objectFit: "cover", borderRadius: "var(--ad-radius-chip)" }} />
                    <span className="ax-slot-main">
                      <span className="ax-person-name">{img.caption ?? CATEGORY_NAME[img.category]}</span>
                      <span className="ax-sub">
                        {CATEGORY_NAME[img.category]}{img.vehicleLabel ? ` · ${img.vehicleLabel}` : ""} · {img.active ? "live" : "hidden"}
                      </span>
                    </span>
                    {p.isAdmin && (
                      <span className="ax-row-actions">
                        <button type="button" className="ax-button" disabled={p.busy} onClick={() => p.onToggle(img)}>
                          {img.active ? "Hide" : "Publish"}
                        </button>
                        {confirmId === img.id ? (
                          <>
                            <button type="button" className="ax-button ax-button--danger" disabled={p.busy} onClick={() => { p.onDelete(img); setConfirmId(null); }}>
                              Delete forever
                            </button>
                            <button type="button" className="ax-button" onClick={() => setConfirmId(null)}>Keep</button>
                          </>
                        ) : (
                          <button type="button" className="ax-button" onClick={() => setConfirmId(img.id)}>Delete</button>
                        )}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {p.isAdmin && (
          <div className="ax-detail-side">
            <section className="ax-panel">
              <span className="ax-label">Add image</span>
              <div className="ax-form-section">
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… image URL" aria-label="Image URL" disabled={p.busy} />
                <div className="ax-form-pair">
                  <select value={category} onChange={(e) => setCategory(e.target.value as GalleryCategory)} aria-label="Category" disabled={p.busy}>
                    {(Object.keys(CATEGORY_NAME) as GalleryCategory[]).map((c) => (
                      <option key={c} value={c}>{CATEGORY_NAME[c]}</option>
                    ))}
                  </select>
                  <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Vehicle (optional)" aria-label="Vehicle label" disabled={p.busy} />
                </div>
                <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" aria-label="Caption" disabled={p.busy} />
                <button
                  type="button"
                  className="ax-button ax-button--primary"
                  disabled={p.busy || !urlOk}
                  onClick={() => { p.onAdd({ imageUrl: url.trim(), category, caption: caption.trim(), vehicleLabel: vehicle.trim() }); setUrl(""); setCaption(""); setVehicle(""); }}
                >
                  Publish image
                </button>
                <p className="ax-note">Published images are publicly readable - customers can see them.</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
