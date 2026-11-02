import { describe, expect, it } from "vitest";
import { isModuleLoadError } from "@/lib/module-load-error";

describe("module load recovery", () => {
  it.each([
    "Importing a module script failed.",
    "Failed to fetch dynamically imported module: https://example.test/chunk.js",
    "error loading dynamically imported module",
    "Failed to load module script: MIME type mismatch",
  ])("recognizes browser load failures: %s", (message) => {
    expect(isModuleLoadError(new TypeError(message))).toBe(true);
  });

  it("does not reload for ordinary application errors", () => {
    expect(isModuleLoadError(new Error("Access denied"))).toBe(false);
    expect(isModuleLoadError(undefined)).toBe(false);
  });

  it("recognizes serialized browser errors", () => {
    expect(isModuleLoadError({ message: "Importing a module script failed." })).toBe(true);
  });
});