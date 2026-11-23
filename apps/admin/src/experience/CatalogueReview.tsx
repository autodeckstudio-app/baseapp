"use client";
import{SourcePriceReview,type SourcePricePreparedReview}from"./SourcePriceReview";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Service } from "@autodeck/core";
import { getCatalogueDraftHistory } from "../lib/catalogue-drafts";
import type {
  CatalogueDraftView,
  PublicCatalogueDestination,
} from "../lib/catalogue-drafts";
import {
  catalogueChangeLines,
  publishSelectionProblem,
} from "./catalogue-publish-review";
function Overlay({ children }: { children: ReactNode }) {
  return typeof document === "undefined"
    ? children
    : createPortal(children, document.body);
}
export function CatalogueReview({
  drafts,
  services = [],
  publishedCount = 0,
  primaryIds = [],
  onReviewAndPublish,
  onPrepareSourceReview,
  onEdit,
  onDiscard,
  busy,
  error,
  blocked = false,
}: {
  drafts: CatalogueDraftView[];
  services?: Service[];
  publishedCount?: number;
  primaryIds?: string[];
  onReview?: (d: CatalogueDraftView) => Promise<void>;
  onPublish?: (d: CatalogueDraftView) => Promise<void>;
  onDestination?: (
    d: CatalogueDraftView,
    v: PublicCatalogueDestination,
  ) => Promise<void>;
  onReviewAndPublish?: (drafts: CatalogueDraftView[],source?:SourcePricePreparedReview) => Promise<boolean>;
  onPrepareSourceReview?:(drafts:CatalogueDraftView[])=>Promise<SourcePricePreparedReview>;
  onEdit?: (d: CatalogueDraftView) => void;
  onDiscard?: (d: CatalogueDraftView) => Promise<void>;
  busy: boolean;
  blocked?: boolean;
  error?: string | null;
}) {
  const[sourceReview,setSourceReview]=useState<SourcePricePreparedReview|null>(null),[sourceBusy,setSourceBusy]=useState(false),[sourceError,setSourceError]=useState(''),[noSheetEdits,setNoSheetEdits]=useState(false);
  const [frozen, setFrozen] = useState<CatalogueDraftView[] | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [expanded, setExpanded] = useState<string | null>(null),
    [confirmDiscard, setConfirmDiscard] = useState<string | null>(null),
    [history, setHistory] = useState<CatalogueDraftView[]>([]),
    [historyError, setHistoryError] = useState(""),
    [historyCursor, setHistoryCursor] = useState<string | null>(null),
    [historyBusy, setHistoryBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null),
    dialog = useRef<HTMLElement>(null),
    flight = useRef(false);
  const pending = drafts.filter((d) => ["draft", "reviewed"].includes(d.state)),
    recent = pending.filter((d) => primaryIds.includes(d.id)),
    earlier = pending.filter((d) => !primaryIds.includes(d.id)),
    chosen = (frozen ?? []).filter((d) => selected.includes(d.id));
  const problem = publishSelectionProblem(chosen, services);
  const sourceSelection=chosen.map(d=>d.id+':'+d.version).sort().join('|');
  useEffect(()=>{let current=true;setSourceReview(null);setNoSheetEdits(false);setSourceError('');if(!onPrepareSourceReview||!frozen||!chosen.length){setSourceBusy(false);return;}setSourceBusy(true);void onPrepareSourceReview(chosen).then(r=>{if(current)setSourceReview(r)}).catch(()=>{if(current)setSourceError('Sheet prices could not be verified. Close this review and try again. Nothing was published.')}).finally(()=>{if(current)setSourceBusy(false)});return()=>{current=false};},[Boolean(frozen),sourceSelection,onPrepareSourceReview]);
  const open = (rows: CatalogueDraftView[]) => {
    setFrozen(JSON.parse(JSON.stringify(rows)));
    setSelected(rows.map((d) => d.id));
  };
  const close = () => {
    if (busy || flight.current) return;
    setFrozen(null);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (blocked) {
      setFrozen(null);
      trigger.current?.focus();
    }
  }, [blocked]);
  useEffect(() => {
    if (frozen) dialog.current?.focus();
  }, [Boolean(frozen)]);
  async function loadHistory(cursor?: string) {
    if (historyBusy) return;
    setHistoryBusy(true);
    try {
      const r = await getCatalogueDraftHistory(cursor);
      setHistory((old) => (cursor ? [...old, ...r.history] : r.history));
      setHistoryCursor(r.nextHistoryCursor);
      setHistoryError("");
    } catch {
      setHistoryError("History could not load.");
    } finally {
      setHistoryBusy(false);
    }
  }
  async function publish() {
    if (busy || flight.current || problem || !onReviewAndPublish || (onPrepareSourceReview&&(!sourceReview||sourceBusy||!noSheetEdits))) return;
    flight.current = true;
    try {
      if (await (sourceReview?onReviewAndPublish(chosen,sourceReview):onReviewAndPublish(chosen))) {
        setFrozen(null);
        trigger.current?.focus();
      }
    } finally {
      flight.current = false;
    }
  }
  return (
    <section className="ax-publish-simple" aria-label="Unpublished changes">
      {recent.length && !blocked ? (
        <div className="ax-publish-strip">
          <div>
            <strong>
              {recent.length === 1
                ? "1 unpublished change"
                : `${recent.length} unpublished changes`}
            </strong>
            <p>Your live menu is unchanged.</p>
          </div>
          <button
            ref={trigger}
            className="ax-button ax-button--primary"
            disabled={busy}
            onClick={() => open(recent)}
          >
            Review changes
          </button>
        </div>
      ) : null}
      {earlier.length || publishedCount ? (
        <details className="ax-saved-changes">
          <summary>
            Saved drafts{earlier.length ? ` (${earlier.length})` : ""} &amp;
            history
          </summary>
          {earlier.length ? (
            <p className="ax-sub">
              Saved earlier. Not included in your new changes.
            </p>
          ) : null}
          {earlier.map((d) => (
            <article key={d.id} className="ax-saved-draft">
              <div>
                <button
                  className="ax-link"
                  disabled={busy}
                  onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                >
                  {d.payload.name}
                </button>
                <span className="ax-sub"> Saved draft</span>
              </div>
              <button
                className="ax-button"
                disabled={busy}
                onClick={() => open([d])}
              >
                Review
              </button>
              {expanded === d.id ? (
                <div style={{ gridColumn: "1 / -1" }}>
                  {onEdit ? (
                    <button
                      className="ax-link"
                      disabled={busy}
                      onClick={() => onEdit(d)}
                    >
                      Edit draft
                    </button>
                  ) : null}
                  {onDiscard ? (
                    confirmDiscard === d.id ? (
                      <span role="alert">
                        Discard this saved draft? Your live menu stays
                        unchanged.{" "}
                        <button
                          className="ax-link"
                          disabled={busy}
                          onClick={() => {
                            setConfirmDiscard(null);
                            void onDiscard(d);
                          }}
                        >
                          Yes, discard draft
                        </button>
                        <button
                          className="ax-link"
                          onClick={() => setConfirmDiscard(null)}
                        >
                          Keep draft
                        </button>
                      </span>
                    ) : (
                      <button
                        className="ax-link"
                        disabled={busy}
                        onClick={() => setConfirmDiscard(d.id)}
                      >
                        Discard draft
                      </button>
                    )
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
          {publishedCount ? (
            <details>
              <summary>History ({publishedCount})</summary>
              <button
                className="ax-link"
                disabled={historyBusy}
                onClick={() => void loadHistory()}
              >
                Load history
              </button>
              {history.map((d) => (
                <p key={d.id}>{d.payload.name} · Published</p>
              ))}
              {historyCursor ? (
                <button
                  className="ax-link"
                  disabled={historyBusy}
                  onClick={() => void loadHistory(historyCursor)}
                >
                  Load older
                </button>
              ) : null}
              {historyError ? <p role="alert">{historyError}</p> : null}
            </details>
          ) : null}
        </details>
      ) : null}
      {frozen ? (
        <Overlay>
          <div className="ax-publish-overlay" onClick={close}>
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Publish changes"
              tabIndex={-1}
              ref={dialog}
              className="ax-publish-dialog"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  close();
                }
                if (e.key === "Tab") {
                  const els = Array.from(
                    e.currentTarget.querySelectorAll<HTMLElement>(
                      'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
                    ),
                  );
                  const first = els[0],
                    last = els.at(-1);
                  if (
                    e.shiftKey &&
                    (document.activeElement === first ||
                      document.activeElement === dialog.current)
                  ) {
                    e.preventDefault();
                    last?.focus();
                  } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                  }
                }
              }}
            >
              <h2>Publish changes?</h2>
              {onPrepareSourceReview?(sourceBusy?<p role="status">Checking actual sheet prices...</p>:sourceError?<p role="alert">{sourceError}</p>:sourceReview?<SourcePriceReview review={sourceReview} confirmed={noSheetEdits} onConfirm={setNoSheetEdits}/>:null):null}
              <p className="ax-sub">Only these changes will go live.</p>
              <div className="ax-publish-diff">
                {frozen.map((d) => {
                  const source = services.find((s) => s.id === d.serviceId),
                    lines = catalogueChangeLines(d, source);
                  const main = lines.filter((l) =>
                      /^(Name|Price|Included work|Shown to customers):/.test(l),
                    ),
                    visible = main.length ? main : lines.slice(0, 2),
                    other = lines.filter((l) => !visible.includes(l));
                  return (
                    <article key={d.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selected.includes(d.id)}
                          disabled={busy}
                          onChange={(e) =>
                            setSelected((old) =>
                              e.target.checked
                                ? [...old, d.id]
                                : old.filter((x) => x !== d.id),
                            )
                          }
                        />
                        <strong>{d.payload.name}</strong>
                      </label>
                      <ul>
                        {visible.map((line, i) => (
                          <li key={i}>{line.replaceAll(" → "," to ")}</li>
                        ))}
                      </ul>
                      {other.length > 0 ? (
                        <details>
                          <summary>
                            Other changed details ({other.length})
                          </summary>
                          <ul>
                            {other.map((line, i) => (
                              <li key={i}>{line.replaceAll(" → "," to ")}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                      {onEdit ? (
                        <button
                          className="ax-link"
                          disabled={busy}
                          onClick={() => {
                            close();
                            onEdit(d);
                          }}
                        >
                          Edit
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
              {problem ? (
                <p role="alert" className="ax-status-msg ax-status-msg--warn">
                  {problem}
                </p>
              ) : null}
              {error ? <p role="alert">{error}</p> : null}
              <footer>
                <button className="ax-button" disabled={busy} onClick={close}>
                  Cancel
                </button>
                <button
                  className="ax-button ax-button--primary"
                  disabled={busy || Boolean(problem) || !onReviewAndPublish || Boolean(onPrepareSourceReview&&(!sourceReview||sourceBusy||!noSheetEdits))}
                  onClick={() => void publish()}
                >
                  {busy ? "Publishing…" : "Publish"}
                </button>
              </footer>
            </section>
          </div>
        </Overlay>
      ) : null}
    </section>
  );
}
