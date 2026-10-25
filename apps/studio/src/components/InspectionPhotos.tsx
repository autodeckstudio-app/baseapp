import { createElement, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import { colors, spacing, radius, typography, Button } from "@autodeck/ui";
import { PhotoThumb } from "./PhotoThumb";
import { MAX_PHOTOS, checkPhotoUpload, isJobPhotoPath } from "../lib/inspection-photo-rules";
import { uploadInspectionPhoto } from "../lib/inspection-photos";

/** Damage and condition photos for an inspection. Provisional: shown only while INSPECTION_PHOTOS_ENABLED is on. Photos are attached to the inspection the customer can already read. */
type PickedFiles = ArrayLike<Blob> | null;

export function InspectionPhotos({ jobId, photos, readOnly }: { jobId: string; photos: string[]; readOnly: boolean }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const input = useRef<{ click: () => void } | null>(null);
  async function onFiles(files: PickedFiles) {
    if (!files || files.length === 0 || busy) return;
    setBusy(true); setNote(null);
    let count = photos.length;
    try {
      for (const f of Array.from(files as ArrayLike<Blob>)) {
        const c = checkPhotoUpload(f.type, count);
        if (!c.ok) { setNote(c.error); break; }
        await uploadInspectionPhoto(jobId, f, count);
        count += 1;
      }
    } catch (e) {
      setNote(e instanceof Error && /photo|JPEG|inspection holds/i.test(e.message) ? e.message : "The photo did not upload. Try again.");
    } finally { setBusy(false); }
  }
  const valid = photos.filter((p) => isJobPhotoPath(p, jobId));
  const unreadable = photos.length - valid.length;
  return (
    <View style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
      <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>Photos</Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
        <Text style={{ ...typography.body, color: colors.textPrimary }}>{`${valid.length} of ${MAX_PHOTOS} photos attached`}</Text>
        {unreadable > 0 ? <Text style={{ ...typography.caption, color: colors.textMuted }}>{`${unreadable} older ${unreadable === 1 ? "entry is" : "entries are"} not a photo this app can show.`}</Text> : null}
        {photos.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {valid.map((p) => <PhotoThumb key={p} path={p} />)}
          </View>
        ) : null}
        {!readOnly && Platform.OS === "web" ? (
          <>
            {createElement("input", { ref: (el: { click: () => void } | null) => { input.current = el; }, type: "file", accept: "image/jpeg,image/png,image/webp", multiple: true, disabled: busy, "aria-label": "Add inspection photos", onChange: (e: { target: { files: PickedFiles } }) => void onFiles(e.target.files), style: { display: "none" } })}
            <Button label="Add photos" size="md" variant="secondary" fullWidth={false} loading={busy} disabled={busy || photos.length >= MAX_PHOTOS} onPress={() => input.current?.click()} />
          </>
        ) : null}
        {busy ? <Text style={{ ...typography.caption, color: colors.textMuted }}>Uploading...</Text> : null}
        {note ? <Text accessibilityRole="alert" style={{ ...typography.caption, color: colors.error }}>{note}</Text> : null}
      </View>
    </View>
  );
}
