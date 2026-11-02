/** Browser-specific messages for failed route chunks or stale dependency URLs. */
export function isModuleLoadError(error: unknown): boolean {
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "";
  return /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|failed to load module script|unable to preload css/i.test(message);
}