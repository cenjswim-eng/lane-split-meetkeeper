import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), clubs: vi.fn(), list: vi.fn(), remove: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { storage: { from: () => ({ list: mocks.list, remove: mocks.remove }) } } }));
import { resetManagementData } from "@/lib/reset.functions";
// Exercise the handler, with transport/auth middleware represented by its validated context.
const run = resetManagementData as unknown as (args: { data: { confirmation: string }; context: { userId: string; supabase: { rpc: typeof mocks.rpc; from: () => { select: typeof mocks.clubs } } } }) => Promise<unknown>;
const args = { data: { confirmation: "BORRAR TODO" }, context: { userId: "admin-id", supabase: { rpc: mocks.rpc, from: () => ({ select: mocks.clubs }) } } };
beforeEach(() => { vi.resetAllMocks(); });
describe("reset server authorization", () => {
  it("does not touch files or data for a non-admin", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(run(args)).rejects.toThrow("Solo el administrador");
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("only resets management data and club originals after authorization", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ error: null });
    mocks.clubs.mockResolvedValue({ data: [{ id: 'own-club' }], error: null });
    mocks.list.mockResolvedValueOnce({ data: [{ id: 'file-id', name: 'document.pdf' }], error: null }).mockResolvedValueOnce({ data: [], error: null });
    mocks.remove.mockResolvedValue({ error: null });
    await expect(run(args)).resolves.toEqual({ ok: true });
    expect(mocks.remove).toHaveBeenCalledWith(['own-club/document.pdf']);
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "reset_management_data", { p_confirmation: "BORRAR TODO" });
  });
  it('never deletes files if the database reset fails', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ error: { message: 'failed' } });
    mocks.clubs.mockResolvedValue({ data: [{ id: 'own-club' }], error: null });
    await expect(run(args)).rejects.toThrow('Tus documentos no fueron eliminados');
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});