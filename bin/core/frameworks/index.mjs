import { nextjsAdapter } from "./nextjs.mjs";
import { nuxtAdapter } from "./nuxt.mjs";
import { reactViteAdapter } from "./react-vite.mjs";
import { sveltekitAdapter } from "./sveltekit.mjs";
import { vueViteAdapter } from "./vue-vite.mjs";

const adapters = new Map(
  [
    reactViteAdapter,
    nextjsAdapter,
    vueViteAdapter,
    nuxtAdapter,
    sveltekitAdapter,
  ].map((adapter) => [adapter.id, adapter])
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

export function listManagedDependencies() {
  return [
    ...new Set(
      listFrameworkAdapters().flatMap((adapter) =>
        [
          ...(adapter.baseDependencies ?? []),
          ...Object.values(adapter.dependencies).flatMap((options) =>
            Object.values(options).flat()
          ),
        ]
      )
    ),
  ];
}
