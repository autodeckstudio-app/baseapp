"use client";

// Shared office-screen frame: page head with headline numbers, a toolbar,
// and a glass list pane with loading, empty and error states. Every office
// list (customers, payments, invoices, audit, ...) is built from these so
// the whole back office reads as one product.
import type { ReactNode } from "react";

export interface Kpi {
  value: ReactNode;
  label: string;
  tone?: "accent" | "premium" | "danger" | undefined;
}

export function PageHead({ eyebrow, title, kpis, children }: { eyebrow: string; title: string; kpis?: Kpi[]; children?: ReactNode }) {
  return (
    <header className="ad-page-head">
      <div>
        <p className="ad-label">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {kpis && kpis.length > 0 && (
        <div className="ad-kpis">
          {kpis.map((k) => (
            <div key={k.label}>
              <span className={`ad-kpi-v${k.tone ? ` ad-kpi-v--${k.tone}` : ""}`}>{k.value}</span>
              <span className="ad-label">{k.label}</span>
            </div>
          ))}
        </div>
      )}
      {children}
    </header>
  );
}

export function Toolbar({ children, count }: { children: ReactNode; count?: { shown: number; total: number } }) {
  return (
    <div className="ad-toolbar">
      {children}
      {count && (
        <span className="ad-count">
          {count.shown === count.total ? `${count.total} total` : `${count.shown} of ${count.total}`}
        </span>
      )}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="ad-seg" role="group">
      {options.map((o) => (
        <button key={o.value || "all"} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface Column<T> {
  key: string;
  head: string;
  cell: (row: T) => ReactNode;
  align?: "end";
  kind?: "data" | "strong" | "muted";
  width?: string;
}

export function ListPane<T extends { id: string }>({
  rows,
  columns,
  loading,
  error,
  empty,
  onOpen,
}: {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string | null;
  empty: { title: string; body: string };
  onOpen?: (row: T) => void;
}) {
  if (error) {
    return (
      <div className="ad-panel ad-empty" role="alert">
        <p className="ad-title">Couldn&apos;t load this list</p>
        <p>{error}</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="ad-list" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="ad-skel ad-skel--row" />)}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="ad-panel ad-empty">
        <p className="ad-title">{empty.title}</p>
        <p>{empty.body}</p>
      </div>
    );
  }
  const template = columns.map((c) => c.width ?? "minmax(0, 1fr)").join(" ");
  return (
    <div className="ad-list" role="table">
      <div className="ad-list-head" role="row" style={{ gridTemplateColumns: template }}>
        {columns.map((c) => (
          <span key={c.key} role="columnheader" className={c.align === "end" ? "is-end" : undefined}>{c.head}</span>
        ))}
      </div>
      {rows.map((row) => {
        const cells = columns.map((c) => (
          <span key={c.key} role="cell" className={[c.align === "end" ? "is-end" : "", c.kind ? `is-${c.kind}` : ""].join(" ").trim() || undefined}>
            {c.cell(row)}
          </span>
        ));
        return onOpen ? (
          <button key={row.id} type="button" role="row" className="ad-list-row is-link" style={{ gridTemplateColumns: template }} onClick={() => onOpen(row)}>
            {cells}
          </button>
        ) : (
          <div key={row.id} role="row" className="ad-list-row" style={{ gridTemplateColumns: template }}>
            {cells}
          </div>
        );
      })}
    </div>
  );
}

export function Drawer({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="ad-drawer-scrim" onClick={onClose}>
      <aside className="ad-drawer" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="ad-drawer-head">
          <div>
            {eyebrow && <p className="ad-label" style={{ margin: 0 }}>{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <button type="button" className="ad-button" onClick={onClose} aria-label="Close">Close</button>
        </div>
        {children}
      </aside>
    </div>
  );
}
