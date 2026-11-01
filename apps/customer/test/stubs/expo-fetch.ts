// expo/fetch on device streams RN blobs; the live harness runs in node where the
// global fetch is the real transport.
export const fetch = globalThis.fetch.bind(globalThis);
