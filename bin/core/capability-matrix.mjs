const COMMON_PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"];

export const CAPABILITY_LABELS = Object.freeze({
  apiClient: Object.freeze({
    axios: "Axios",
    fetch: "Native Fetch",
  }),
  serverState: Object.freeze({
    "react-query": "TanStack React Query",
    "vue-query": "TanStack Vue Query",
    "svelte-query": "TanStack Svelte Query",
    none: "None",
  }),
  clientState: Object.freeze({
    zustand: "Zustand",
    redux: "Redux Toolkit",
    pinia: "Pinia",
    "svelte-store": "Svelte stores",
    none: "None",
  }),
  forms: Object.freeze({
    "react-hook-form-zod": "React Hook Form + Zod",
    "vee-validate-zod": "VeeValidate + Zod",
    "sveltekit-superforms-zod": "SvelteKit Superforms + Zod",
    none: "None",
  }),
  packageManager: Object.freeze({
    npm: "npm",
    pnpm: "pnpm",
    yarn: "Yarn",
    bun: "Bun",
  }),
});

export const CAPABILITY_MATRIX = Object.freeze({
  "react-vite": Object.freeze({
    defaults: Object.freeze({
      apiClient: "axios",
      serverState: "react-query",
      clientState: "zustand",
      forms: "react-hook-form-zod",
      packageManager: "npm",
    }),
    apiClient: Object.freeze(["axios", "fetch"]),
    serverState: Object.freeze(["react-query", "none"]),
    clientState: Object.freeze(["zustand", "redux", "none"]),
    forms: Object.freeze(["react-hook-form-zod", "none"]),
    packageManager: Object.freeze([...COMMON_PACKAGE_MANAGERS]),
    generators: Object.freeze(["feature", "entity", "widget", "page"]),
  }),
  nextjs: Object.freeze({
    defaults: Object.freeze({
      apiClient: "axios",
      serverState: "react-query",
      clientState: "zustand",
      forms: "react-hook-form-zod",
      packageManager: "npm",
    }),
    apiClient: Object.freeze(["axios", "fetch"]),
    serverState: Object.freeze(["react-query", "none"]),
    clientState: Object.freeze(["zustand", "redux", "none"]),
    forms: Object.freeze(["react-hook-form-zod", "none"]),
    packageManager: Object.freeze([...COMMON_PACKAGE_MANAGERS]),
    generators: Object.freeze(["feature", "entity", "widget", "page"]),
  }),
  "vue-vite": Object.freeze({
    defaults: Object.freeze({
      apiClient: "axios",
      serverState: "vue-query",
      clientState: "pinia",
      forms: "vee-validate-zod",
      packageManager: "npm",
    }),
    apiClient: Object.freeze(["axios", "fetch"]),
    serverState: Object.freeze(["vue-query", "none"]),
    clientState: Object.freeze(["pinia", "none"]),
    forms: Object.freeze(["vee-validate-zod", "none"]),
    packageManager: Object.freeze([...COMMON_PACKAGE_MANAGERS]),
    generators: Object.freeze(["feature", "entity", "widget", "page"]),
  }),
  nuxt: Object.freeze({
    defaults: Object.freeze({
      apiClient: "axios",
      serverState: "vue-query",
      clientState: "pinia",
      forms: "vee-validate-zod",
      packageManager: "npm",
    }),
    apiClient: Object.freeze(["axios", "fetch"]),
    serverState: Object.freeze(["vue-query", "none"]),
    clientState: Object.freeze(["pinia", "none"]),
    forms: Object.freeze(["vee-validate-zod", "none"]),
    packageManager: Object.freeze([...COMMON_PACKAGE_MANAGERS]),
    generators: Object.freeze(["feature", "entity", "widget", "page"]),
  }),
  sveltekit: Object.freeze({
    defaults: Object.freeze({
      apiClient: "axios",
      serverState: "svelte-query",
      clientState: "svelte-store",
      forms: "sveltekit-superforms-zod",
      packageManager: "npm",
    }),
    apiClient: Object.freeze(["axios", "fetch"]),
    serverState: Object.freeze(["svelte-query", "none"]),
    clientState: Object.freeze(["svelte-store", "none"]),
    forms: Object.freeze(["sveltekit-superforms-zod", "none"]),
    packageManager: Object.freeze([...COMMON_PACKAGE_MANAGERS]),
    generators: Object.freeze(["feature", "entity", "widget", "page"]),
  }),
});

export function getCapabilities(framework) {
  const capabilities = CAPABILITY_MATRIX[framework];
  if (!capabilities) {
    throw new Error(`Unknown framework "${framework}".`);
  }
  return capabilities;
}

export function getCapabilityChoices(framework, capability) {
  const values = getCapabilities(framework)[capability];
  if (!values) {
    throw new Error(`Unknown capability "${capability}".`);
  }

  return values.map((value) => ({
    title: CAPABILITY_LABELS[capability]?.[value] ?? value,
    value,
  }));
}

export function getDefaultStack(framework) {
  return { ...getCapabilities(framework).defaults };
}

export function assertSupportedProjectConfig(config) {
  const capabilities = getCapabilities(config.framework);
  for (const key of [
    "apiClient",
    "serverState",
    "clientState",
    "forms",
    "packageManager",
  ]) {
    if (!capabilities[key].includes(config[key])) {
      throw new Error(
        `Unsupported ${key} "${config[key]}" for framework "${config.framework}".`
      );
    }
  }
  return config;
}

export function assertGeneratorSupported(framework, generatorType) {
  const capabilities = getCapabilities(framework);
  if (!capabilities.generators.includes(generatorType)) {
    throw new Error(
      `Generator "${generatorType}" is not supported by framework "${framework}".`
    );
  }
  return generatorType;
}
