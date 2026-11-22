/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
// React Native's BlobOptions permits lastModified. Retain that existing native
// extension when the web experience adds the standard DOM interfaces.
interface BlobPropertyBag { lastModified?: number | undefined; }
