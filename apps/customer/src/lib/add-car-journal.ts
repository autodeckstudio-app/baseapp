/**
 * Add-car submit journal (extracted from the screen for testability; the
 * screen contract is unchanged). The journal is frozen at submit time with
 * BOTH post-create stages pending from the outset. Retries run exactly the
 * stages still pending from this frozen snapshot - the same declaration
 * entries with their declarationIds and the same photo blob - never a
 * re-snapshot of the editable form, so a declaration failure before the
 * photo attempt can no longer silently drop the photo.
 *
 * Progress is tracked PER ENTRY: when declaration 1 commits and declaration
 * 2 fails, the retry sends exactly declaration 2 (then the photo), never a
 * duplicate of declaration 1. The staleness gate is checked before every
 * write and after every awaited write: a newer submit, a plate change, or
 * an unmount stops the run before the NEXT write. A write that already
 * committed cannot be undone, so the runner stops quietly and reports
 * false - no false undo, no stale navigation.
 */
import type { MyProtectionKind } from "./protection-service";

export type JournalEntry = {
  kind: MyProtectionKind;
  entry: { brand: string; years: string; applied: string; declarationId: string };
};
export type JournalPhoto = { blob: Blob; contentType: string };

export type AddCarJournal = {
  entries: JournalEntry[];
  photo: JournalPhoto | null;
  /** Count of declaration entries already committed (they run in order). */
  entriesDone: number;
  photoDone: boolean;
};

export function createAddCarJournal(entries: JournalEntry[], photo: JournalPhoto | null): AddCarJournal {
  return { entries, photo, entriesDone: 0, photoDone: photo === null };
}

export function journalPending(j: AddCarJournal): boolean {
  return j.entriesDone < j.entries.length || !j.photoDone;
}

export type AddCarJournalDeps = {
  saveDeclaration: (vehicleId: string, e: JournalEntry) => Promise<void>;
  uploadPhoto: (vehicleId: string, photo: JournalPhoto) => Promise<void>;
  /** True when a newer submit, a plate change, or an unmount superseded this run. */
  isStale: () => boolean;
  onProtectionFailed: () => void;
  onPhotoFailed: () => void;
};

/**
 * Run the pending stages in order: declarations first, then the photo. A
 * failed stage stops the run with progress kept so a retry resumes exactly
 * there; declarationId server dedup is the second line, per-entry progress
 * is the first. Returns true only when nothing remains pending.
 */
export async function runAddCarJournal(vehicleId: string, journal: AddCarJournal, deps: AddCarJournalDeps): Promise<boolean> {
  while (journal.entriesDone < journal.entries.length) {
    if (deps.isStale()) return false;
    try {
      await deps.saveDeclaration(vehicleId, journal.entries[journal.entriesDone]!);
    } catch {
      if (deps.isStale()) return false;
      deps.onProtectionFailed();
      return false;
    }
    if (deps.isStale()) return false; // committed; cannot undo - stop, no failure UI
    journal.entriesDone += 1;
  }
  if (!journal.photoDone && journal.photo) {
    if (deps.isStale()) return false;
    try {
      await deps.uploadPhoto(vehicleId, journal.photo);
    } catch {
      if (deps.isStale()) return false;
      deps.onPhotoFailed();
      return false;
    }
    if (deps.isStale()) return false;
    journal.photoDone = true;
  }
  return true;
}

/**
 * Freeze contract for the Add-car screen: while a submit is in flight or
 * the journal still has pending stages, every saved-target edit path (car
 * fields, protection fields, photo) must refuse, in BOTH the UI and the
 * handlers, so an ordinary edit can never drop pending work.
 */
export function addCarEditsFrozen(loading: boolean, journal: AddCarJournal | null): boolean {
  return loading || (journal !== null && journalPending(journal));
}

/**
 * Abandon is only ever an explicit, deliberate action: refused while a
 * write is in flight (outcome unknown) or when nothing is pending.
 */
export function addCarAbandonAllowed(loading: boolean, journal: AddCarJournal | null): boolean {
  return !loading && journal !== null && journalPending(journal);
}

/**
 * Guard a saved-target edit callback (car field, size select, protection
 * field, photo pick): while frozen the callback no-ops, so no input path -
 * pointer, keyboard, or programmatic - can mutate saved-target state behind
 * a pending journal.
 */
export function guardSavedTargetEdit<A extends unknown[]>(frozen: boolean, fn: (...args: A) => void): (...args: A) => void {
  return (...args: A) => {
    if (frozen) return;
    fn(...args);
  };
}
