/** Browser-local OCR: no document or image is sent to a paid service. */
export async function readImageLines(image: File | HTMLCanvasElement): Promise<string[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa+eng");
  try {
    const { data } = await worker.recognize(image);
    return data.text.split(/\r?\n/).filter((line) => line.trim());
  } finally { await worker.terminate(); }
}