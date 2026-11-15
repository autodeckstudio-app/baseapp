import { createWorker } from "tesseract.js";
import { createRequire } from "node:module";
const require = createRequire(__filename);
/** Offline OCR: all language data is shipped with the function, no third-party document disclosure. */
export async function readPaperImage(image: Buffer): Promise<{ text: string; confidence: number }> {
  const { langPath } = require("@tesseract.js-data/eng") as { langPath: string };
  // tesseract.js 7 reports a bad image twice: the recognize() promise rejects AND its default worker errorHandler throws
  // asynchronously, which is an uncaught exception that can take the whole function instance down. The handler below
  // keeps the failure on the rejected promise only (callers treat it as unreadable -> manual review); the error is
  // recorded, never discarded: if the worker errored but recognize() still resolved, that result is not trusted.
  let workerError: string | null = null;
  const worker = await createWorker("eng", 1, { langPath, cachePath: "/tmp", gzip: true, errorHandler: (err: unknown) => { workerError = String(err); } });
  try {
    const { data } = await worker.recognize(image);
    if (workerError) throw new Error(`OCR worker error: ${workerError}`);
    return { text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}
