import { describe, expect, it } from "vitest";
import { isHexColor, readableOn } from "@/lib/profile-theme";

describe("profile theme", () => {
  it("accepts only 6-digit hex colors", () => {
    expect(isHexColor("#12abEF")).toBe(true);
    expect(isHexColor("red")).toBe(false);
    expect(isHexColor("#fff")).toBe(false);
  });
  it("picks dark text on light colors and light text on dark colors", () => {
    expect(readableOn("#ffffff")).toContain("0.17");
    expect(readableOn("#0a1a40")).toContain("0.98");
  });
});
