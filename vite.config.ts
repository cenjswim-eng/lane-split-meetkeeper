// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { loadEnv, type Plugin } from "vite";
import { createRequire } from "node:module";

Object.assign(process.env, loadEnv(process.env['NODE_ENV'] === 'production' ? 'production' : 'development', process.cwd(), ''));

const require = createRequire(import.meta.url);
// Email renderers need entities v4; server-only exact-file resolution avoids
// replacing the browser MDB dependency graph with a shared directory alias.
const emailEntities: Plugin = {
  name: 'email-entities-server', enforce: 'pre',
  applyToEnvironment: environment => environment.name !== 'client',
  resolveId(id) {
    if (id === 'entities') return require.resolve('entities').replace('/lib/index.js', '/lib/esm/index.js');
    if (id === 'entities/lib/decode.js' || id === 'entities/lib/encode.js') return require.resolve(id).replace('/lib/', '/lib/esm/');
    return undefined;
  },
};
const browserPolyfills = nodePolyfills({ include: ["buffer", "events", "stream", "util", "process"], overrides: { buffer: "vite-plugin-node-polyfills/shims/buffer" }, protocolImports: true, globals: { Buffer: false, global: false, process: false } }).flat().map((plugin): Plugin => {
  const originalConfig = plugin.config;
  let browserAliases: Record<string, string> = {};
  return {
    ...plugin,
    applyToEnvironment: (environment) => environment.name === "client",
    // Vite aliases are shared, not per-environment. Resolve them in a client-only
    // hook instead: putting aliases inside environments.client.resolve ignores
    // them, while top-level aliases replace native server built-ins as well.
    ...(originalConfig ? { enforce: "pre" as const, resolveId: function (id) {
      const replacement = browserAliases[id];
      if (!replacement) return;
      // Return the absolute shim directly; re-entering Vite's dependency resolver
      // here can wait on the optimizer that is scanning this very import.
      return replacement;
    } } : {}),
    ...(originalConfig ? { config: function (config, env) {
      const hook = typeof originalConfig === "function" ? originalConfig : originalConfig.handler;
      const result = hook.call(this, config, env);
      return Promise.resolve(result).then((options) => {
        if (!options) return;
        const { resolve, ...clientOptions } = options;
        const aliases = resolve?.alias;
        if (aliases && !Array.isArray(aliases)) {
          browserAliases = Object.fromEntries(Object.entries(aliases).map(([id, target]) => [id, target.startsWith("vite-plugin-node-polyfills/shims/") ? require.resolve(target).replace(/\.cjs$/, ".js") : require.resolve(target)]));
        }
        return { environments: { client: clientOptions } };
      });
    } } : {}),
  };
});

export default defineConfig({
  vite: { plugins: [...browserPolyfills, emailEntities] },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
