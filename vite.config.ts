// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import type { Plugin } from "vite";

const browserPolyfills = nodePolyfills({ include: ["buffer", "events", "stream", "util", "process"], globals: { Buffer: true, global: true, process: true } }).flat().map((plugin): Plugin => {
  const originalConfig = plugin.config;
  return {
    ...plugin,
    applyToEnvironment: (environment) => environment.name === "client",
    ...(originalConfig ? { config: function (config, env) {
      const hook = typeof originalConfig === "function" ? originalConfig : originalConfig.handler;
      const result = hook.call(this, config, env);
      return Promise.resolve(result).then((options) => options ? { environments: { client: options } } : undefined);
    } } : {}),
  };
});

export default defineConfig({
  vite: { plugins: browserPolyfills },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
