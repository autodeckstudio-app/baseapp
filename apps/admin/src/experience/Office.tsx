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
    <header className="ax-page-head">
      <div>
        <p className="ax-label">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {kpis && kpis.length > 0 && (
        <div className="ax-kpis">
          {kpis.map((k) => (
            <div key={k.label}>
              <span className={`ax-kpi-v${k.tone ? ` ax-kpi-v--${k.tone}` : ""}`}>{k.value}</span>
              <span className="ax-label">{k.label}</span>
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
    <div className="ax-toolbar">
      {children}
      {count && (
        <span className="ax-count">
          {count.shown === count.total ? `${count.total} total` : `${count.shown} of ${count.total}`}
        </span>
      )}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="ax-seg" role="group">
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
      <div className="ax-panel ax-empty" role="alert">
        <p className="ax-title">Couldn&apos;t load this list</p>
        <p>{error}</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="ax-list" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="ax-skel ax-skel--row" />)}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="ax-panel ax-empty">
        <p className="ax-title">{empty.title}</p>
        <p>{empty.body}</p>
      </div>
    );
  }
  const template = columns.map((c) => c.width ?? "minmax(0, 1fr)").join(" ");
  return (
    <div className="ax-list" role="table">
      <div className="ax-list-head" role="row" style={{ gridTemplateColumns: template }}>
        {columns.map((c) => (
          <span key={c.key} role="columnheader" className={c.align === "end" ? "is-end" : undefined}>{c.head}</span>
        ))}
      </div>
      {rows.map((row) => {
        const cells = columns.map((c) => (
          <span key={c.key} role="cell" data-col={c.key} className={[c.align === "end" ? "is-end" : "", c.kind ? `is-${c.kind}` : ""].join(" ").trim() || undefined}>
            {c.cell(row)}
          </span>
        ));
        return onOpen ? (
          <button key={row.id} type="button" role="row" className="ax-list-row is-link" style={{ gridTemplateColumns: template }} onClick={() => onOpen(row)}>
            {cells}
          </button>
        ) : (
          <div key={row.id} role="row" className="ax-list-row" style={{ gridTemplateColumns: template }}>
            {cells}
          </div>
        );
      })}
    </div>
  );
}

export function Drawer({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="ax-drawer-scrim" onClick={onClose}>
      <aside className="ax-drawer" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="ax-drawer-head">
          <div>
            {eyebrow && <p className="ax-label" style={{ margin: 0 }}>{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <button type="button" className="ax-button" onClick={onClose} aria-label="Close">Close</button>
        </div>
        {children}
      </aside>
    </div>
  );
}
