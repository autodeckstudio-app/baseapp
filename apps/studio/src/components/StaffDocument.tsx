import { deleteAsync } from "expo-file-system";
import { getDocumentAsync } from "expo-document-picker";
import { createElement, useEffect, useRef, useState } from "react";
import { Platform, View, Text } from "react-native";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { Button, colors, spacing, typography } from "@autodeck/ui";
export function StaffDocument({
  employeeId,
  revisionKey,
}: {
  employeeId: string;
  revisionKey?: string | undefined;
}) {
  const [status, setStatus] = useState("Loading document status…"),
    [file, setFile] = useState<Blob | null>(null),
    [busy, setBusy] = useState(false),
    [consent, setConsent] = useState(false),
    [note, setNote] = useState<string | null>(null);
  const lock = useRef(false),
    generation = useRef(0),
    fileInput=useRef<{click:()=>void}|null>(null);
  async function choose() {
    const n = generation.current;
    try {
      const r = await getDocumentAsync({
        type: ["image/jpeg", "image/png", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (r.canceled) return;
      const a = r.assets[0];
      if (!a) return;
      if (a.size !== undefined && a.size > 5 * 1024 * 1024) {
        await deleteAsync(a.uri, { idempotent: true });
        throw Error("Choose a document up to 5 MB.");
      }
      let blob: Blob;
      try {
        blob = await (await fetch(a.uri)).blob();
      } finally {
        await deleteAsync(a.uri, { idempotent: true });
      }
      if (n === generation.current) {
        setFile(
          blob.type
            ? blob
            : new Blob([blob], {
                type: a.mimeType ?? "",
                lastModified: Date.now(),
              }),
        );
        setConsent(false);
      }
    } catch {
      if (n === generation.current)
        setNote("Could not open document picker. Try again.");
    }
  }
  useEffect(() => {
    const n = ++generation.current;
    setFile(null);
    setConsent(false);
    setNote(null);
    setStatus("Loading document status…");
    void httpsCallable<any, { document: { status: string } | null }>(
      functions,
      "getStaffDocument",
    )({ employeeId })
      .then((r) => {
        if (n === generation.current)
          setStatus(
            r.data.document?.status === "reviewed"
              ? "Admin reviewed ✓"
              : r.data.document?.status === "needs_resubmission"
                ? "Please submit a new document"
                : r.data.document
                  ? "Awaiting Admin review"
                  : "No document submitted",
          );
      })
      .catch(() => {
        if (n === generation.current)
          setStatus("Status unavailable. Reopen Account to retry.");
      });
    return () => {
      generation.current++;
    };
  }, [employeeId, revisionKey]);
  async function submit() {
    if (lock.current || !file || !consent) return;
    const n = generation.current;
    lock.current = true;
    setBusy(true);
    setNote(null);
    try {
      if (
        file.size <= 0 ||
        file.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "application/pdf"].includes(file.type)
      )
        throw Error("Choose JPG, PNG or PDF, up to 5 MB.");
      const { data } = await httpsCallable<
        any,
        {
          uploadId: string;
          uploadUrl: string;
          requiredHeaders: Record<string, string>;
        }
      >(
        functions,
        "issueStaffDocumentUpload",
      )({ employeeId, contentType: file.type, byteSize: file.size });
      if (n !== generation.current) return;
      const result = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: data.requiredHeaders,
        body: file,
      });
      if (!result.ok) throw Error("Upload failed. Please retry.");
      if (n !== generation.current) return;
      await httpsCallable(
        functions,
        "submitStaffDocument",
      )({ employeeId, uploadId: data.uploadId, consent: true });
      if (n === generation.current) {
        setStatus("Awaiting Admin review");
        setFile(null);
        setConsent(false);
        setNote("Submitted to Admin. Sign-in stays unchanged.");
      }
    } catch (e) {
      if (n === generation.current)
        setNote(
          e instanceof Error ? e.message : "Submission failed. Please retry.",
        );
    } finally {
      lock.current = false;
      if (n === generation.current) setBusy(false);
    }
  }
  return (
    <View style={{ gap: spacing.sm, padding: spacing.md }}>
      <Text style={{ ...typography.body, color: colors.textPrimary }}>
        Aadhaar (optional)
      </Text>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>
        {status}
      </Text>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>
        Use a masked copy. No Aadhaar number field.
      </Text>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>
        Private employee document for Admin review.
      </Text>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>
        Not government verification or a sign-in requirement.
      </Text>
      <>
        {Platform.OS === "web" ? (
          createElement("input", {
            type: "file",
            accept: "image/jpeg,image/png,application/pdf",
            "aria-label": "Optional masked Aadhaar document",
            disabled: busy,
            ref:(node:any)=>{fileInput.current=node},
            style: { display:"none" },
            onChange: (e: any) => {
              setFile(e.target.files?.[0] ?? null);
              setConsent(false);
            },
          })
        ) : (
          <Button
            label="Choose document"
            size="md"
            variant="secondary"
            disabled={busy}
            onPress={() => void choose()}
          />
        )}
        {Platform.OS==='web'?<Button label="Choose document" size="md" variant="secondary" disabled={busy} onPress={()=>fileInput.current?.click()}/>:null}
        {file?<Text style={{...typography.caption,color:colors.textMuted}}>Document selected • up to 5 MB</Text>:null}
        <Button
          label={consent ? "Sharing agreed ✓" : "Share copy with Admin"}
          variant="secondary"
          size="md"
          onPress={() => setConsent(!consent)}
          disabled={busy}
        />
        <Button
          label="Submit document"
          size="md"
          disabled={busy || !file || !consent}
          loading={busy}
          onPress={() => void submit()}
        />
      </>
      {note ? (
        <Text
          accessibilityRole="alert"
          style={{ ...typography.caption, color: colors.textPrimary }}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}
