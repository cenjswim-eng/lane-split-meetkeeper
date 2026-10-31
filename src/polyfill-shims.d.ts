declare module "vite-plugin-node-polyfills/shims/process" {
  const process: { browser: boolean; version: string; nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void };
  export default process;
}