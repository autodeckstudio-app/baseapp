import { describe, expect, it, vi } from "vitest";
import { addCarAbandonAllowed, addCarEditsFrozen, createAddCarJournal, guardSavedTargetEdit, runAddCarJournal, journalPending, type AddCarJournalDeps, type JournalEntry, type JournalPhoto } from "./add-car-journal";

const entry = (id: string): JournalEntry => ({ kind: "ppf", entry: { brand: "Garware", years: "5", applied: "2024-01-15", declarationId: id } });
const photo: JournalPhoto = { blob: new Blob(["x"], { type: "image/png", lastModified: 0 }), contentType: "image/png" };

function deps(over: Partial<AddCarJournalDeps> = {}) {
  return {
    saveDeclaration: vi.fn(async (_v: string, _e: JournalEntry) => {}),
    uploadPhoto: vi.fn(async () => {}),
    isStale: () => false,
    onProtectionFailed: vi.fn(),
    onPhotoFailed: vi.fn(),
    ...over,
  };
}

describe("add-car journal runner", () => {
  it("declaration failure before the photo attempt keeps the photo pending; retry runs both", async () => {
    const d = deps({ saveDeclaration: vi.fn(async () => { throw new Error("network"); }) });
    const j = createAddCarJournal([entry("a")], photo);
    expect(await runAddCarJournal("v1", j, d)).toBe(false);
    expect(journalPending(j)).toBe(true);
    expect(d.uploadPhoto).not.toHaveBeenCalled(); // the old bug dropped the photo here
    expect(d.onProtectionFailed).toHaveBeenCalledOnce();
    d.saveDeclaration = vi.fn(async () => {});
    expect(await runAddCarJournal("v1", j, d)).toBe(true);
    expect(d.saveDeclaration).toHaveBeenCalledWith("v1", entry("a"));
    expect(d.uploadPhoto).toHaveBeenCalledWith("v1", photo);
    expect(journalPending(j)).toBe(false);
  });

  it("a second declaration failure stops again with nothing further written", async () => {
    const fail = vi.fn(async () => { throw new Error("network"); });
    const d = deps({ saveDeclaration: fail });
    const j = createAddCarJournal([entry("a")], photo);
    expect(await runAddCarJournal("v1", j, d)).toBe(false);
    expect(await runAddCarJournal("v1", j, d)).toBe(false);
    expect(fail).toHaveBeenCalledTimes(2);
    expect(d.uploadPhoto).not.toHaveBeenCalled();
    expect(d.onProtectionFailed).toHaveBeenCalledTimes(2);
  });

  it("declaration 1 commits and declaration 2 fails: retry sends exactly declaration 2, then the photo, once", async () => {
    let calls = 0;
    const d = deps({
      saveDeclaration: vi.fn(async () => { calls += 1; if (calls === 2) throw new Error("network"); }),
    });
    const j = createAddCarJournal([entry("a"), entry("b")], photo);
    expect(await runAddCarJournal("v1", j, d)).toBe(false);
    expect(j.entriesDone).toBe(1);
    expect(d.onProtectionFailed).toHaveBeenCalledOnce();

    d.saveDeclaration = vi.fn(async (_v: string, _e: JournalEntry) => {});
    expect(await runAddCarJournal("v1", j, d)).toBe(true);
    expect(d.saveDeclaration).toHaveBeenCalledTimes(1); // exactly declaration 2, not a re-send of 1
    expect(d.saveDeclaration).toHaveBeenCalledWith("v1", entry("b"));
    expect(d.uploadPhoto).toHaveBeenCalledTimes(1);
  });

  it("photo-only failure keeps declarations done and retries only the photo", async () => {
    const d = deps({ uploadPhoto: vi.fn(async () => { throw new Error("lost ack"); }) });
    const j = createAddCarJournal([entry("a")], photo);
    expect(await runAddCarJournal("v1", j, d)).toBe(false);
    expect(j.entriesDone).toBe(1);
    expect(j.photoDone).toBe(false);
    expect(d.onPhotoFailed).toHaveBeenCalledOnce();
    d.uploadPhoto = vi.fn(async () => {});
    expect(await runAddCarJournal("v1", j, d)).toBe(true);
    expect(d.saveDeclaration).toHaveBeenCalledTimes(1);
    expect(d.uploadPhoto).toHaveBeenCalledTimes(1);
  });

  it("a retry with all stages already completed runs nothing", async () => {
    const d = deps();
    const j = createAddCarJournal([entry("a")], photo);
    expect(await runAddCarJournal("v1", j, d)).toBe(true);
    expect(await runAddCarJournal("v1", j, d)).toBe(true);
    expect(d.saveDeclaration).toHaveBeenCalledTimes(1);
    expect(d.uploadPhoto).toHaveBeenCalledTimes(1);
  });

  it("stale after declaration 1 commits prevents the declaration 2 and photo writes, quietly", async () => {
    let stale = false;
    const d = deps({
      saveDeclaration: vi.fn(async () => { stale = true; }), // plate changed while declaration 1 was in flight
      isStale: () => stale,
    });
    const j = createAddCarJournal([entry("a"), entry("b")], photo);
    expect(await runAddCarJournal("v1", j, d)).toBe(false);
    expect(d.saveDeclaration).toHaveBeenCalledTimes(1); // decl 1 committed - no false undo
    expect(j.entriesDone).toBe(0); // progress not claimed for a stale context
    expect(d.uploadPhoto).not.toHaveBeenCalled();
    expect(d.onProtectionFailed).not.toHaveBeenCalled();
    expect(d.onPhotoFailed).not.toHaveBeenCalled();
  });

  it("stale before the first write dispatches nothing", async () => {
    const d = deps({ isStale: () => true });
    const j = createAddCarJournal([entry("a")], photo);
    expect(await runAddCarJournal("v1", j, d)).toBe(false);
    expect(d.saveDeclaration).not.toHaveBeenCalled();
    expect(d.uploadPhoto).not.toHaveBeenCalled();
  });

  it("stale after the photo commits claims no completion and calls no failure UI", async () => {
    let stale = false;
    const d = deps({
      uploadPhoto: vi.fn(async () => { stale = true; }),
      isStale: () => stale,
    });
    const j = createAddCarJournal([], photo);
    j.entriesDone = 0;
    expect(await runAddCarJournal("v1", j, d)).toBe(false);
    expect(j.photoDone).toBe(false);
    expect(d.onPhotoFailed).not.toHaveBeenCalled();
  });

  it("no entries and no photo completes immediately with no calls", async () => {
    const d = deps();
    const j = createAddCarJournal([], null);
    expect(journalPending(j)).toBe(false);
    expect(await runAddCarJournal("v1", j, d)).toBe(true);
    expect(d.saveDeclaration).not.toHaveBeenCalled();
    expect(d.uploadPhoto).not.toHaveBeenCalled();
  });
});

describe("add-car freeze/abandon contract", () => {
  it("frozen while a submit is in flight, even with no journal", () => {
    expect(addCarEditsFrozen(true, null)).toBe(true);
    expect(addCarAbandonAllowed(true, createAddCarJournal([entry("a")], photo))).toBe(false);
  });
  it("frozen while the journal has pending stages; editable once complete", () => {
    const pending = createAddCarJournal([entry("a")], photo);
    expect(addCarEditsFrozen(false, pending)).toBe(true);
    expect(addCarAbandonAllowed(false, pending)).toBe(true);
    const done = createAddCarJournal([entry("a")], photo);
    done.entriesDone = 1;
    done.photoDone = true;
    expect(addCarEditsFrozen(false, done)).toBe(false);
    expect(addCarAbandonAllowed(false, done)).toBe(false);
  });
  it("editable with no journal and nothing in flight (new car, pre-save)", () => {
    expect(addCarEditsFrozen(false, null)).toBe(false);
    expect(addCarAbandonAllowed(false, null)).toBe(false);
  });
  it("frozen until the LAST pending stage completes (photo pending alone still freezes)", () => {
    const j = createAddCarJournal([entry("a")], photo);
    j.entriesDone = 1;
    expect(addCarEditsFrozen(false, j)).toBe(true);
  });
});

describe("guarded saved-target edit callbacks", () => {
  it("a frozen callback no-ops for every input path shape; unfrozen it fires", () => {
    const fieldEdit = vi.fn();
    const sizeSelect = vi.fn();
    const protectionEdit = vi.fn();
    const photoPick = vi.fn();
    const frozen = true;
    guardSavedTargetEdit(frozen, (v: string) => fieldEdit(v))("MH12AB1234");
    guardSavedTargetEdit(frozen, (v: string) => sizeSelect(v))("suv");
    guardSavedTargetEdit(frozen, (k: string, f: string, v: string) => protectionEdit(k, f, v))("ppf", "brand", "X");
    guardSavedTargetEdit(frozen, (f: { blob: Blob; type: string } | null) => photoPick(f))(null);
    expect(fieldEdit).not.toHaveBeenCalled();
    expect(sizeSelect).not.toHaveBeenCalled();
    expect(protectionEdit).not.toHaveBeenCalled();
    expect(photoPick).not.toHaveBeenCalled();
    guardSavedTargetEdit(false, (v: string) => sizeSelect(v))("suv");
    expect(sizeSelect).toHaveBeenCalledWith("suv");
  });
});
