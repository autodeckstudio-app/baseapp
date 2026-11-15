"use client";
import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
type Summary = {
  revision: string;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  contentType: string;
};
export function StaffDocumentReview({
  employeeId,
  revisionKey,
}: {
  employeeId: string;
  revisionKey?: string | undefined;
}) {
  const [document, setDocument] = useState<Summary | null>(null),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [url, setUrl] = useState<string | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [off, setOff] = useState(false);
  const lock = useRef(false),
    generation = useRef(0),
    opened = useRef<string | null>(null);
  async function load(n: number) {
    try {
      const r = await httpsCallable<any, { document: Summary | null }>(
        functions,
        "getStaffDocument",
      )({ employeeId });
      if (n === generation.current) {
        setDocument(r.data.document);
        setLoaded(true);
      }
    } catch (e) {
      if (n === generation.current) {
        if (
          (e as { details?: { reason?: string } })?.details?.reason ===
          "staff_documents_disabled"
        ) {
          setOff(true);
          setError(null);
        } else {
          setError("Document unavailable. Retry.");
        }
        setLoaded(true);
      }
    }
  }
  useEffect(() => {
    const n = ++generation.current;
    setDocument(null);
    setLoaded(false);
    setUrl(null);
    setConfirmed(false);
    opened.current = null;
    setError(null);
    setOff(false);
    void load(n);
    return () => {
      generation.current++;
    };
  }, [employeeId, revisionKey]);
  useEffect(() => {
    if (!url) return;
    const t = setTimeout(() => {
      setUrl(null);
      opened.current = null;
    }, 115000);
    return () => clearTimeout(t);
  }, [url]);
  async function action(decision?: "reviewed" | "needs_resubmission") {
    if (lock.current || !document) return;
    const n = generation.current;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (decision) {
        if (opened.current !== document.revision || !confirmed)
          throw Error("Open the current document before recording a review.");
        await httpsCallable(
          functions,
          "reviewStaffDocument",
        )({ employeeId, revision: document.revision, decision });
        if (n === generation.current) {
          setUrl(null);
          opened.current = null;
          await load(n);
        }
      } else {
        const r = await httpsCallable<any, { document: Summary; url: string }>(
          functions,
          "getStaffDocument",
        )({ employeeId, open: true });
        if (n === generation.current) {
          setDocument(r.data.document);
          setConfirmed(false);
          setUrl(r.data.url);
          opened.current = r.data.document.revision;
        }
      }
    } catch (e) {
      if (n === generation.current)
        setError(
          e instanceof Error ? e.message : "Document action failed. Retry.",
        );
    } finally {
      lock.current = false;
      if (n === generation.current) setBusy(false);
    }
  }
  return (
    <div
      style={{
        width: "100%",
        minWidth: 0,
        gridColumn: "1 / -1",
        flexBasis: "100%",
        display: "grid",
        gap: 6,
      }}
    >
      <span className="ax-sub">
        {!loaded
          ? "Loading document status…"
          : off
            ? "Staff document review isn't available yet."
            : document
            ? document.status === "reviewed"
              ? "Aadhaar: Admin reviewed ✓"
              : document.status === "needs_resubmission"
                ? "Aadhaar: new copy requested"
                : "Aadhaar: awaiting review"
            : "Aadhaar: not submitted (optional)"}
      </span>
      {document ? (
        <>
          <div
            className="ax-row-actions"
            style={{ flexWrap: "wrap", whiteSpace: "normal" }}
          >
            <button
              type="button"
              className="ax-button"
              disabled={busy}
              onClick={() => void action()}
            >
              Open document
            </button>
            <button
              type="button"
              className="ax-button"
              disabled={
                busy || !confirmed || opened.current !== document.revision
              }
              onClick={() => void action("reviewed")}
            >
              Mark reviewed
            </button>
            <button
              type="button"
              className="ax-button"
              disabled={
                busy || !confirmed || opened.current !== document.revision
              }
              onClick={() => void action("needs_resubmission")}
            >
              Request new copy
            </button>
          </div>
          {url ? (
            <>
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                referrerPolicy="no-referrer"
                className="ax-button"
                style={{ whiteSpace: "normal", maxWidth: "100%" }}
              >
                View private document (2 min)
              </a>
              <label className="ax-sub">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={busy}
                />{" "}
                I reviewed the uploaded copy.
              </label>
              <span className="ax-sub">
                Review the copy. This is not government verification.
              </span>
            </>
          ) : null}
        </>
      ) : null}
      {error ? (
        <>
          <span role="alert" className="ax-sub">
            {error}
          </span>
          <button
            type="button"
            className="ax-button"
            disabled={busy}
            onClick={() => {
              setError(null);
              void load(generation.current);
            }}
          >
            Retry status
          </button>
        </>
      ) : null}
    </div>
  );
}
