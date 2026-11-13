export function registrationStatus(expiresOn: string | null, today = new Date().toISOString().slice(0, 10)): "unregistered" | "active" | "expired" {
  if (!expiresOn) return "unregistered";
  return today > expiresOn ? "expired" : "active";
}