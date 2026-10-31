import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { DeleteAthlete } from "@/components/delete-athlete";
const mocks = vi.hoisted(() => ({ from: vi.fn(), eq: vi.fn(), single: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
describe("permanent athlete deletion", () => {
  it("does not delete until confirmed and targets only the chosen athlete", async () => {
    const select = vi.fn(() => ({ single: mocks.single }));
    mocks.eq.mockReturnValue({ select });
    const remove = vi.fn(() => ({ eq: mocks.eq }));
    mocks.from.mockReturnValue({ delete: remove });
    mocks.single.mockResolvedValue({ data: { id: "chosen-id" }, error: null });
    render(<QueryClientProvider client={new QueryClient()}><DeleteAthlete id="chosen-id" name="Ana" /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Ana" }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Eliminar Ana" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));
    await waitFor(() => expect(mocks.single).toHaveBeenCalledOnce());
    expect(mocks.from).toHaveBeenCalledWith("athletes");
    expect(mocks.eq).toHaveBeenCalledWith("id", "chosen-id");
  });
});