import { describe, expect, it } from "vitest";
import { requireResetAdmin, validateResetConfirmation } from "@/lib/reset-policy";

describe("borrado administrativo", () => {
  it("rechaza a quienes no son administradores", () => {
    expect(() => requireResetAdmin(false)).toThrow();
    expect(() => requireResetAdmin(null)).toThrow();
    expect(() => requireResetAdmin(true)).not.toThrow();
  });
  it("exige confirmación explícita", () => {
    expect(() => validateResetConfirmation("")).toThrow();
    expect(() => validateResetConfirmation("borrar todo")).toThrow();
    expect(validateResetConfirmation("BORRAR TODO")).toBe("BORRAR TODO");
  });
});