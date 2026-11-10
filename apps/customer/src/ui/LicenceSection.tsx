// The driving-licence block of the You tab. Extracted so the real section can be
// previewed session-free at /preview-licence (dev only) and tested on its own.
// The upload shares the screen's save lock and epoch with the name save: one write
// at a time, and a late result from before an account switch touches nothing.
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { SavedLicensePhotoView, useSavedLicensePhoto } from "./SavedLicensePhoto";
import { FileUploader } from "./inputs";
import { Button, T } from "./kit";
import { ListRow } from "./ListRow";
import type { VehiclePhotoBody } from "../lib/vehicle-service";

export function LicenceSection({ customerId, scope, upload, lock, epoch }: { customerId: string | null; scope: string; upload: (blob: VehiclePhotoBody, contentType: string) => Promise<unknown>; lock?: MutableRefObject<boolean>; epoch?: MutableRefObject<number> }) {
  const ownLock = useRef(false), ownEpoch = useRef(0);
  const saveLock = lock ?? ownLock, generation = epoch ?? ownEpoch;
  const [lic, setLic] = useState<{ blob: VehiclePhotoBody; contentType: string } | null>(null);
  const [licBusy, setLicBusy] = useState(false);
  const [licOpen, setLicOpen] = useState(false);
  const [licReplace, setLicReplace] = useState(false);
  const [licRefresh, setLicRefresh] = useState(0);
  const [licMsg, setLicMsg] = useState<string | null>(null);
  const licPhoto = useSavedLicensePhoto(customerId, scope, licRefresh);
  useEffect(() => { setLic(null); setLicBusy(false); setLicOpen(false); setLicReplace(false); setLicMsg(null); }, [scope]);
  async function saveLicense() {
    if (!lic || licBusy || saveLock.current) return;
    const gen = generation.current; saveLock.current = true;
    setLicBusy(true); setLicMsg(null);
    try { await upload(lic.blob, lic.contentType); if (generation.current !== gen) return; setLic(null); setLicReplace(false); setLicRefresh(n => n + 1); setLicMsg("Licence saved."); }
    catch (e) { if (generation.current === gen) setLicMsg(e instanceof Error ? e.message : "Could not save your licence. Try again."); }
    finally { if (generation.current === gen) { saveLock.current = false; setLicBusy(false); } }
  }
  return (
    <>
      <ListRow expanded={licOpen} icon="search" title="Driving licence" detail="Private photo for the studio" action={licOpen ? "Close" : licPhoto.state === "ready" ? "View licence" : "Add"} onPress={() => setLicOpen(!licOpen)} />
      {licOpen ? (
        <View style={{ gap: space.breath, paddingBottom: 14 }}>
          {customerId ? <SavedLicensePhotoView r={licPhoto} /> : <T role="caption">Customer profile could not be verified. Your licence has not been changed.</T>}
          {licPhoto.state === "ready" && !licReplace ? <Button kind="quiet" label="Replace licence photo" onPress={() => setLicReplace(true)} /> : null}
          {licPhoto.state === "ready" && !licReplace ? null : <FileUploader label={licPhoto.state === "ready" ? "Choose a new licence photo" : "Choose licence photo"} files={lic && !(lic.blob instanceof Uint8Array) ? [{ blob: lic.blob, type: lic.contentType }] : []} nativeEnabled nativeFileCount={lic ? 1 : 0} onNativeChange={fs => { const f = fs[0]; setLic(f ? { blob: f.bytes, contentType: f.type } : null); setLicMsg(null); }} onChange={(fs) => { const f = fs[0]; setLic(f ? { blob: f.blob, contentType: f.type } : null); setLicMsg(null); }} />}
          {lic ? <Button label="Save licence photo" busy={licBusy} onPress={() => void saveLicense()} /> : null}
          {licReplace && licPhoto.state === "ready" ? <Button kind="quiet" label="Keep current photo" onPress={() => { setLicReplace(false); setLic(null); }} /> : null}
          {licMsg ? <T role="caption" tone={licMsg.startsWith("Licence saved.") ? "tertiary" : "danger"}>{licMsg}</T> : null}
        </View>
      ) : null}
    </>
  );
}
