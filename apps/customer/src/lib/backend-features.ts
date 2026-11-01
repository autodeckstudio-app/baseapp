// Backend availability gates; see apps/admin/src/lib/backend-features.ts.
// updateMyPaper / deleteMyPaper
export const PAPER_EDIT_ENABLED = true;
// removeMyListingPhoto / replaceMyListingPhoto
export const LISTING_PHOTO_EDIT_ENABLED = true;
// removeMyVehicleImage
export const VEHICLE_IMAGE_REMOVE_ENABLED = true;

/**
 * Dev-only preview of the paper-edit UI while PAPER_EDIT_ENABLED is false.
 * All three are required, always: a dev build (__DEV__), a VERIFIED emulator
 * backend (lib/firebase emulatorBackend - never just the flag), and an
 * explicit ?paperedit=1 query flag. Anything less stays on the release path.
 */
export function paperEditPreviewAllowed(input: {
  devBuild: boolean;
  emulatorBackend: boolean;
  queryFlag: boolean;
}): boolean {
  return input.devBuild && input.emulatorBackend && input.queryFlag;
}
