/** Subtract integer milliseconds before rounding for display. */
export function timeDiffMs(timeMs: number, referenceMs: number): number {
  if (![timeMs, referenceMs].every(Number.isSafeInteger)) throw new Error("Los tiempos deben ser milisegundos enteros.");
  return timeMs - referenceMs;
}

export function formatTimeDiff(ms: number): string {
  if (!Number.isSafeInteger(ms)) throw new Error("Diferencial inválido.");
  const cs = Math.floor((Math.abs(ms) + 5) / 10);
  const minutes = Math.floor(cs / 6000);
  const seconds = Math.floor(cs % 6000 / 100);
  const fraction = String(cs % 100).padStart(2, "0");
  return `${ms < 0 ? "-" : "+"}${minutes ? `${String(minutes).padStart(2, "0")}:` : ""}${String(seconds).padStart(2, "0")}.${fraction}`;
}

export function compactTime(ms: number | null): string {
  if (ms == null) return "—";
  const cs = Math.floor((ms + 5) / 10);
  return `${String(Math.floor(cs / 6000)).padStart(2, "0")}:${String(Math.floor(cs % 6000 / 100)).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}