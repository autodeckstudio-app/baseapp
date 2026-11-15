// The declaration builder moved to @autodeck/core (packages/core/src/
// protection-declaration.ts) so the studio app and the admin console share
// ONE implementation of the staff-declared protection-work contract. This
// shim keeps existing studio import paths stable.
export {
  buildProtectionWork,
  newInstallDraft,
  newRemoveDraft,
  newReplaceDraft,
  selectTarget,
  targetableRecords,
  type DeclarationDraft,
  type DraftEvent,
  type DraftInstall,
  type DraftRemove,
  type DraftReplace,
} from "@autodeck/core";
