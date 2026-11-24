import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/adael-2026")({
  staticData: { sitemap: false },
  beforeLoad: () => {
    throw redirect({ to: "/rankings" });
  },
  component: () => null,
});
