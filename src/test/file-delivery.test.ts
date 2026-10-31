import { afterEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { canShareFile, downloadFile, exportFilename, shareFile, zipExport } from "@/lib/file-delivery";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function prepared() { return new File(["A0 swimming"], "competencia.sd3", { type: "application/octet-stream" }); }

describe("mobile file delivery", () => {
  it("passes the prepared file to native sharing immediately without exposing a public link", async () => {
    const file = prepared();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { canShare: vi.fn().mockReturnValue(true), share });
    const result = shareFile(file);
    expect(share).toHaveBeenCalledWith({ files: [file], title: "competencia.sd3" });
    expect(await result).toBe("shared");
  });
  it("does not download or report success when sharing is cancelled", async () => {
    vi.stubGlobal("navigator", { canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError")) });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    expect(await shareFile(prepared())).toBe("cancelled");
    expect(click).not.toHaveBeenCalled();
  });
  it("rejects unsupported sharing and keeps download available", async () => {
    vi.stubGlobal("navigator", {});
    expect(canShareFile(prepared())).toBe(false);
    await expect(shareFile(prepared())).rejects.toThrow("Descárgalo");
  });
  it("surfaces a failed native share rather than silently downloading", async () => {
    vi.stubGlobal("navigator", { canShare: () => true, share: vi.fn().mockRejectedValue(new Error("permission denied")) });
    await expect(shareFile(prepared())).rejects.toThrow("permission denied");
  });
  it("attaches download link and preserves its URL for 30 seconds", () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "blob:export", revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.isConnected).toBe(true);
      expect(this.download).toBe("competencia.sd3");
    });
    downloadFile(prepared());
    expect(click).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(29_999);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith("blob:export");
  });
  it("wraps SD3 unchanged in a shareable ZIP", async () => {
    const content = "A0 swimming\r\nZ0";
    const file = new File([content], "competencia.sd3");
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode(content).buffer });
    const archive = await zipExport(file);
    expect(archive.name).toBe("competencia.zip");
    expect(archive.type).toBe("application/zip");
    const bytes = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(archive);
    });
    const zip = await JSZip.loadAsync(bytes);
    expect(await zip.file("competencia.sd3")?.async("string")).toBe(content);
  });
  it("keeps portable Spanish filenames", () => {
    expect(exportFilename("Copa Natación 2026", "_marcas.pdf")).toBe("Copa_Natacion_2026_marcas.pdf");
  });
});