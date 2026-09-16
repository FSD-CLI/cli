import { nextjsAdapter } from "./nextjs.mjs";
import { reactViteAdapter } from "./react-vite.mjs";

const adapters = new Map(
  [reactViteAdapter, nextjsAdapter].map((adapter) => [adapter.id, adapter])
);

export function getFrameworkAdapter(framework) {
  const adapter = adapters.get(framework);
  if (!adapter) {
    throw new Error(
      `Framework "${framework}" is registered but does not have an implementation adapter yet.`
    );
  }
  return adapter;
}

export function hasFrameworkAdapter(framework) {
  return adapters.has(framework);
}

export function listFrameworkAdapters() {
  return [...adapters.values()];
}
