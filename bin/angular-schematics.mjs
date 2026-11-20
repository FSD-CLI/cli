// Tree-based planners behind the Angular schematics in /schematics. They read
// through a small host ({ exists, read }) and return the files to write, so
// the schematic factories only apply the result to the Angular Tree. All file
// content comes from the same renderers the CLI uses.
import { normalizeProjectConfig } from "./project-config.mjs";
import { getFrameworkAdapter } from "./core/frameworks/index.mjs";
import {
  angularRouteContent,
  buildSliceFiles,
  LAYER_DIRS,
  validateGenerateOptions,
} from "./generator.mjs";
import { angularApiClientContent } from "./generators/shared-layer.mjs";
import { toKebabCase, toPascalCase } from "./generators/shared.mjs";

const ROUTES_PATH = "src/app/app.routes.ts";
const APP_CONFIG_PATH = "src/app/app.config.ts";
const LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];
const COLLECTION = "create-fsd-architecture";

function readJson(host, path) {
  const text = host.read(path);
  return text === null ? null : JSON.parse(text);
}

/**
 * Reads the workspace's FSD configuration; ng-add must have run first.
 */
export function readAngularConfig(host) {
  const config = readJson(host, "fsd.config.json");
  if (!config) {
    throw new Error("fsd.config.json is missing. Run `ng add create-fsd-architecture` first.");
  }
  if (config.framework !== "angular") {
    throw new Error(`These schematics generate Angular slices; this project is "${config.framework}".`);
  }
  return normalizeProjectConfig("angular", config);
}

/**
 * Plans one slice (`ng g create-fsd-architecture:<type> <name>`): the slice
 * files plus, for pages, the lazy route registered in app.routes.ts.
 */
export function planAngularSlice(host, { type, name, force = false, authProvider }) {
  const sliceName = toKebabCase(name ?? "");
  validateGenerateOptions({ type, name: sliceName });
  const config = readAngularConfig(host);
  const sliceDir = `${getFrameworkAdapter("angular").sourceDirectory}/${LAYER_DIRS[type]}/${sliceName}`;
  if (host.exists(`${sliceDir}/index.ts`) && !force) {
    throw new Error(`Slice "${sliceDir}" already exists. Re-run with --force to overwrite it.`);
  }
  const writes = buildSliceFiles({ type, name: sliceName, config, authProvider }).map((file) => ({
    path: `${sliceDir}/${file.path}`,
    content: file.content,
  }));
  if (type === "page") {
    const routes = host.read(ROUTES_PATH);
    if (routes === null) throw new Error(`Routing entry "${ROUTES_PATH}" is missing.`);
    writes.push({
      path: ROUTES_PATH,
      content: angularRouteContent(routes, sliceName, `${toPascalCase(sliceName)}Page`),
    });
  }
  return writes;
}

function detectPackageManager(host) {
  if (host.exists("pnpm-lock.yaml")) return "pnpm";
  if (host.exists("yarn.lock")) return "yarn";
  if (host.exists("bun.lock") || host.exists("bun.lockb")) return "bun";
  return "npm";
}

// tsconfig.json from `ng new` starts with /* */ comments; keep them and
// rewrite only the JSON body.
function withLayerAliases(text) {
  const header = text.match(/^(\s*\/\*[\s\S]*?\*\/\s*)*/)[0];
  const json = JSON.parse(text.slice(header.length).replace(/\/\*[\s\S]*?\*\//g, ""));
  json.compilerOptions ??= {};
  const paths = { ...json.compilerOptions.paths };
  let changed = false;
  for (const layer of LAYERS) {
    if (!paths[`@${layer}/*`]) {
      paths[`@${layer}/*`] = [`./src/${layer}/*`];
      changed = true;
    }
  }
  if (!changed) return null;
  json.compilerOptions.paths = paths;
  return `${header}${JSON.stringify(json, null, 2)}\n`;
}

// Adds the marker block to `export const routes: Routes = [...]`, before a
// wildcard route when there is one so generated pages stay reachable.
function withRouteMarkers(text) {
  if (text.includes("// fsd-cli:routes:start")) return null;
  const markers = "  // fsd-cli:routes:start\n  // fsd-cli:routes:end\n";
  if (/=\s*\[\s*\];/.test(text)) return text.replace(/=\s*\[\s*\];/, `= [\n${markers}];`);
  const wildcard = text.search(/\n\s*\{\s*path:\s*['"]\*\*['"]/);
  if (wildcard !== -1) return `${text.slice(0, wildcard + 1)}${markers}${text.slice(wildcard + 1)}`;
  const end = text.lastIndexOf("];");
  if (end === -1) return undefined;
  const before = text.slice(0, end).replace(/\s*$/, "");
  const separator = before.endsWith("[") || before.endsWith(",") ? "" : ",";
  return `${before}${separator}\n${markers}${text.slice(end)}`;
}

function addImport(text, line) {
  if (text.includes(line)) return text;
  const imports = [...text.matchAll(/^import [^;]+;\n/gm)];
  if (!imports.length) return `${line}\n${text}`;
  const last = imports[imports.length - 1];
  const at = last.index + last[0].length;
  return `${text.slice(0, at)}${line}\n${text.slice(at)}`;
}

// Registers HttpClient (Fetch backend) and the TanStack Query provider in
// app.config.ts. Returns undefined when the providers array is not found.
function withAppProviders(text) {
  const additions = [];
  if (!/provideHttpClient\(/.test(text)) additions.push("provideHttpClient(withFetch())");
  if (!/provideAppQuery\(/.test(text)) additions.push("provideAppQuery()");
  if (!additions.length) return null;
  const match = text.match(/providers:\s*\[/);
  if (!match) return undefined;
  const at = match.index + match[0].length;
  let next = `${text.slice(0, at)}\n    ${additions.join(",\n    ")},${text.slice(at)}`;
  if (additions.includes("provideHttpClient(withFetch())")) {
    next = addImport(next, "import { provideHttpClient, withFetch } from '@angular/common/http';");
  }
  if (additions.includes("provideAppQuery()")) {
    next = addImport(next, "import { provideAppQuery } from './providers';");
  }
  return next;
}

const LAYER_READMES = {
  pages: "Route-level compositions. Generate one with `ng g page <name>`.",
  widgets: "Large reusable UI blocks. Generate one with `ng g widget <name>`.",
  features: "User interactions and business capabilities. Generate one with `ng g feature <name>`.",
  entities: "Business objects and their UI, model and API. Generate one with `ng g entity <name>`.",
};

/**
 * Plans `ng add create-fsd-architecture` for an Angular workspace: FSD
 * layers, aliases, fsd.config.json, the ApiClient and Query provider, route
 * markers, adapter dependencies and the schematic collection. Idempotent:
 * existing files are kept and reported.
 */
export function planAngularAdd(host) {
  const packageJson = readJson(host, "package.json");
  const angularJson = readJson(host, "angular.json");
  if (!packageJson || !angularJson) {
    throw new Error("ng add create-fsd-architecture must run in an Angular workspace (angular.json and package.json).");
  }
  if (!packageJson.dependencies?.["@angular/core"]) {
    throw new Error("@angular/core is not a dependency of this workspace.");
  }
  const existing = readJson(host, "fsd.config.json");
  if (existing && existing.framework !== "angular") {
    throw new Error(`fsd.config.json already targets "${existing.framework}".`);
  }

  const writes = [];
  const kept = [];
  const manual = [];
  const create = (path, content) => {
    if (host.exists(path)) kept.push(path);
    else writes.push({ path, content });
  };

  const config = existing
    ? normalizeProjectConfig("angular", existing)
    : normalizeProjectConfig("angular", { packageManager: detectPackageManager(host) });
  create("fsd.config.json", `${JSON.stringify(config, null, 2)}\n`);

  for (const [layer, text] of Object.entries(LAYER_READMES)) {
    create(`src/${layer}/README.md`, `# ${layer[0].toUpperCase()}${layer.slice(1)}\n\n${text}\n`);
  }
  create(
    "src/shared/config/public-config.ts",
    `import { z } from 'zod';

const publicConfigSchema = z.object({
  apiBaseUrl: z.string().min(1),
});

export const publicConfig = publicConfigSchema.parse({
  apiBaseUrl: '/api',
});
`,
  );
  create("src/shared/config/index.ts", "export { publicConfig } from './public-config';\n");
  create("src/shared/api/api-client.ts", angularApiClientContent());
  create("src/shared/api/index.ts", "export { ApiClient } from './api-client';\n");
  create(
    "src/app/providers/query/query-provider.ts",
    `import { QueryClient, provideTanStackQuery } from '@tanstack/angular-query-experimental';

export function provideAppQuery() {
  return provideTanStackQuery(
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60_000,
          retry: 1,
        },
      },
    }),
  );
}
`,
  );
  create("src/app/providers/query/index.ts", "export { provideAppQuery } from './query-provider';\n");
  create("src/app/providers/index.ts", "export { provideAppQuery } from './query';\n");

  const tsconfig = host.read("tsconfig.json");
  if (tsconfig !== null) {
    const next = withLayerAliases(tsconfig);
    if (next) writes.push({ path: "tsconfig.json", content: next });
  } else {
    manual.push("Add @app/*, @pages/*, @widgets/*, @features/*, @entities/* and @shared/* paths to your tsconfig.");
  }

  const routes = host.read(ROUTES_PATH);
  const routesNext = routes === null ? undefined : withRouteMarkers(routes);
  if (routesNext) writes.push({ path: ROUTES_PATH, content: routesNext });
  else if (routesNext === undefined) {
    manual.push(`Add "// fsd-cli:routes:start" and "// fsd-cli:routes:end" lines inside the routes array in ${ROUTES_PATH}.`);
  }

  const appConfig = host.read(APP_CONFIG_PATH);
  const appConfigNext = appConfig === null ? undefined : withAppProviders(appConfig);
  if (appConfigNext) writes.push({ path: APP_CONFIG_PATH, content: appConfigNext });
  else if (appConfigNext === undefined) {
    manual.push(`Add provideHttpClient(withFetch()) and provideAppQuery() (from src/app/providers) to your application providers.`);
  }

  const adapter = getFrameworkAdapter("angular");
  const packages = ["serverState", "clientState", "forms"].flatMap(
    (capability) => adapter.dependencies[capability][config[capability]] ?? []
  );
  const dependencies = { ...packageJson.dependencies };
  let addedDependencies = false;
  for (const name of packages) {
    if (!dependencies[name]) {
      dependencies[name] = adapter.dependencyVersions[name];
      addedDependencies = true;
    }
  }
  const collections = angularJson.cli?.schematicCollections ?? [];
  const nextAngularJson = collections.includes(COLLECTION)
    ? null
    : { ...angularJson, cli: { ...angularJson.cli, schematicCollections: [...collections, COLLECTION] } };
  if (nextAngularJson) writes.push({ path: "angular.json", content: `${JSON.stringify(nextAngularJson, null, 2)}\n` });
  if (addedDependencies) {
    const sorted = Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)));
    writes.push({ path: "package.json", content: `${JSON.stringify({ ...packageJson, dependencies: sorted }, null, 2)}\n` });
  }

  return { writes, kept, manual, installDependencies: addedDependencies, packageManager: config.packageManager };
}
