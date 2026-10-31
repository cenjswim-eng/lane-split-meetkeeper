import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), emptyBucket: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { storage: { emptyBucket: mocks.emptyBucket } } }));
import { resetManagementData } from "@/lib/reset.functions";
// Exercise the handler, with transport/auth middleware represented by its validated context.
const run = resetManagementData as unknown as (args: { data: { confirmation: string }; context: { userId: string; supabase: { rpc: typeof mocks.rpc } } }) => Promise<unknown>;
const args = { data: { confirmation: "BORRAR TODO" }, context: { userId: "admin-id", supabase: { rpc: mocks.rpc } } };
beforeEach(() => { vi.resetAllMocks(); });
describe("reset server authorization", () => {
  it("does not touch files or data for a non-admin", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(run(args)).rejects.toThrow("Solo el administrador");
    expect(mocks.emptyBucket).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("only resets management data and club originals after authorization", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ error: null });
    mocks.emptyBucket.mockResolvedValue({ error: null });
    await expect(run(args)).resolves.toEqual({ ok: true });
    expect(mocks.emptyBucket).toHaveBeenCalledWith("club-documents");
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "reset_management_data", { p_confirmation: "BORRAR TODO" });
  });
});