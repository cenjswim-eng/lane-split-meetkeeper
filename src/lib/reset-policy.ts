export const RESET_CONFIRMATION = "BORRAR TODO";

export function validateResetConfirmation(value: string): string {
  if (value !== RESET_CONFIRMATION) throw new Error("Escribe BORRAR TODO para confirmar.");
  return value;
}

export function requireResetAdmin(isAdmin: boolean | null) {
  if (isAdmin !== true) throw new Error("Solo el administrador puede borrar los datos.");
}