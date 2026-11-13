import { expect, it } from "vitest";
import { registrationStatus } from "@/lib/athlete-registration";
it("a registration remains valid through December 31 and expires January 1", () => {
  expect(registrationStatus("2026-12-31", "2026-12-31")).toBe("active");
  expect(registrationStatus("2026-12-31", "2027-01-01")).toBe("expired");
});
it("legacy registrations have unknown validity rather than invented expiration", () => {
  expect(registrationStatus(null, "2026-11-13")).toBe("unregistered");
});