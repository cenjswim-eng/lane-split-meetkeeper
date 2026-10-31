import JSZip from "jszip";

export function exportFilename(name: string, suffix: string) {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${base || "competencia"}${suffix}`;
}

export async function zipExport(file: File): Promise<File> {
  const zip = new JSZip();
  zip.file(file.name, await file.arrayBuffer());
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
  return new File([new Uint8Array(bytes)], file.name.replace(/\.[^.]+$/, ".zip"), { type: "application/zip" });
}

export function canShareFile(file: File): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

export async function shareFile(file: File): Promise<"shared" | "cancelled"> {
  if (!canShareFile(file)) throw new Error("Este navegador no permite compartir este archivo. Descárgalo y adjúntalo en WhatsApp.");
  try {
    await navigator.share({ files: [file], title: file.name });
    return "shared";
  } catch (error) {
    if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") return "cancelled";
    throw error;
  }
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}