// Staff document upload/review stays DISABLED until the private GCS signed-URL
// lifecycle is proved against the real backend (today the upload PUT is an
// emulator-only skip and the signing/storage path is mocked in callable tests,
// so the path is unproved against real storage). Default OFF everywhere -
// the production environment does not set this variable - so a code release
// keeps the feature inert. Enabling later is a deliberate environment
// configuration plus redeploy (a held activation decision), never implicit.
// Emulator tests opt in with STAFF_DOCUMENTS_ENABLED=true.
export function staffDocumentsEnabled(): boolean {
  return process.env["STAFF_DOCUMENTS_ENABLED"] === "true";
}
