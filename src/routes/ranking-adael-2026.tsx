import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/ranking-adael-2026')({
  staticData: { sitemap: false },
  beforeLoad: () => {
    throw redirect({ to: '/' });
  },
  component: () => null,
});
