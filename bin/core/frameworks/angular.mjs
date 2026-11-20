/** @type {import("./adapter-contract.mjs").FrameworkAdapter} */
export const angularAdapter = Object.freeze({
  id: "angular",
  family: "angular",
  targets: ["web"],
  runtime: "angular",
  sourceDirectory: "src",
  clientDirective: "",
  baseDependencies: [],
  capabilities: {
    defaults: {
      apiClient: "angular-http",
      serverState: "angular-query",
      clientState: "ngrx-signals",
      forms: "angular-forms-zod",
    },
    apiClient: ["angular-http"],
    serverState: ["angular-query"],
    clientState: ["ngrx-signals"],
    forms: ["angular-forms-zod"],
  },
  // Generators (feature/entity/widget/page/shared) land separately.
  generators: [],
  dependencies: {
    apiClient: { "angular-http": [] },
    serverState: { "angular-query": ["@tanstack/angular-query-experimental"] },
    clientState: { "ngrx-signals": ["@ngrx/signals"] },
    forms: { "angular-forms-zod": ["@angular/forms", "zod"] },
  },
  dependencyVersions: {
    "@angular/forms": "^22.2.2",
    "@ngrx/signals": "^22.0.1",
    "@tanstack/angular-query-experimental": "^5.103.1",
    zod: "^4.6.7",
  },
});
