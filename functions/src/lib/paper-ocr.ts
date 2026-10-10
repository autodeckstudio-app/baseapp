import { createWorker } from "tesseract.js";
import { createRequire } from "node:module";
const require = createRequire(__filename);
/** Offline OCR: all language data is shipped with the function, no third-party document disclosure. */
export async function readPaperImage(image: Buffer): Promise<{ text: string; confidence: number }> {
  const { langPath } = require("@tesseract.js-data/eng") as { langPath: string };
  const worker = await createWorker("eng", 1, { langPath, cachePath: "/tmp", gzip: true });
  try {
    const { data } = await worker.recognize(image);
    return { text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}
