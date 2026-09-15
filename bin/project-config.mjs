import fs from "fs";
import path from "path";

export const DEFAULT_PROJECT_CONFIG = {
  schemaVersion: 1,
  packageManager: "npm",
  apiClient: "axios",
  serverState: "react-query",
  clientState: "zustand",
  forms: "react-hook-form-zod",
  ui: "shared-ui",
};

const OPTIONAL_DEPENDENCIES = [
  "@hookform/resolvers",
  "@reduxjs/toolkit",
  "@tanstack/react-query",
  "axios",
  "react-hook-form",
  "react-redux",
  "zod",
  "zustand",
];

const DEPENDENCY_VERSIONS = {
  "@hookform/resolvers": "^5.9.1",
  "@reduxjs/toolkit": "^2.12.0",
  "@tanstack/react-query": "^5.102.8",
  axios: "^1.20.0",
  "react-hook-form": "^7.88.0",
  "react-redux": "^9.3.0",
  zod: "^4.6.5",
  zustand: "^5.0.15",
};

export function normalizeProjectConfig(framework, answers = {}) {
  return {
    $schema:
      "https://raw.githubusercontent.com/FSD-CLI/cli/main/schema/fsd.config.schema.json",
    ...DEFAULT_PROJECT_CONFIG,
    ...answers,
    framework,
  };
}

export function configureProject(targetDir, config) {
  updateDependencies(targetDir, config);
  removeForeignLockfiles(targetDir, config.packageManager);
  writeJson(path.join(targetDir, "fsd.config.json"), config);
  writeApiClient(targetDir, config);
  writeProviders(targetDir, config);
}

function removeForeignLockfiles(targetDir, packageManager) {
  const lockfiles = {
    npm: ["package-lock.json"],
    pnpm: ["pnpm-lock.yaml"],
    yarn: ["yarn.lock"],
    bun: ["bun.lock", "bun.lockb"],
  };
  const keep = new Set(lockfiles[packageManager] ?? []);

  for (const name of Object.values(lockfiles).flat()) {
    const lockPath = path.join(targetDir, name);
    if (!keep.has(name) && fs.existsSync(lockPath)) {
      fs.rmSync(lockPath);
    }
  }
}

function updateDependencies(targetDir, config) {
  const packagePath = path.join(targetDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  packageJson.dependencies ??= {};

  for (const name of OPTIONAL_DEPENDENCIES) {
    delete packageJson.dependencies[name];
    delete packageJson.devDependencies?.[name];
  }

  const selected = [];
  if (config.apiClient === "axios") selected.push("axios");
  if (config.serverState === "react-query") {
    selected.push("@tanstack/react-query");
  }
  if (config.clientState === "zustand") selected.push("zustand");
  if (config.clientState === "redux") {
    selected.push("@reduxjs/toolkit", "react-redux");
  }
  if (config.forms === "react-hook-form-zod") {
    selected.push("react-hook-form", "zod", "@hookform/resolvers");
  }

  for (const name of selected) {
    packageJson.dependencies[name] = DEPENDENCY_VERSIONS[name];
  }

  packageJson.dependencies = sortObject(packageJson.dependencies);
  if (packageJson.devDependencies) {
    packageJson.devDependencies = sortObject(packageJson.devDependencies);
  }

  writeJson(packagePath, packageJson);
}

function writeApiClient(targetDir, config) {
  const apiDir = path.join(targetDir, "src", "shared", "api");
  fs.mkdirSync(apiDir, { recursive: true });
  fs.writeFileSync(
    path.join(apiDir, "client.ts"),
    config.apiClient === "axios"
      ? axiosClientContent(config.framework)
      : fetchClientContent(config.framework)
  );
  fs.writeFileSync(
    path.join(apiDir, "index.ts"),
    'export { apiClient } from "./client";\n'
  );
}

function writeProviders(targetDir, config) {
  const providersDir = path.join(targetDir, "src", "app", "providers");
  fs.mkdirSync(providersDir, { recursive: true });
  fs.writeFileSync(
    path.join(providersDir, "AppProviders.tsx"),
    providersContent(config)
  );
  fs.writeFileSync(
    path.join(providersDir, "index.ts"),
    'export { AppProviders } from "./AppProviders";\n'
  );

  const legacyNextProvider = path.join(providersDir, "providers.tsx");
  if (fs.existsSync(legacyNextProvider)) fs.rmSync(legacyNextProvider);

  const storePath = path.join(providersDir, "store.ts");
  const legacyStorePath = path.join(targetDir, "src", "app", "store.ts");
  if (config.clientState === "redux") {
    fs.writeFileSync(storePath, reduxStoreContent());
  } else if (fs.existsSync(storePath)) {
    fs.rmSync(storePath);
  }
  if (fs.existsSync(legacyStorePath)) fs.rmSync(legacyStorePath);
}

function axiosClientContent(framework) {
  const baseUrl =
    framework === "nextjs"
      ? 'process.env.NEXT_PUBLIC_API_URL ?? "/api"'
      : 'import.meta.env.VITE_API_URL ?? "/api"';

  return `import axios from "axios";

export const apiClient = axios.create({
  baseURL: ${baseUrl},
  headers: { "Content-Type": "application/json" },
});
`;
}

function fetchClientContent(framework) {
  const baseUrl =
    framework === "nextjs"
      ? 'process.env.NEXT_PUBLIC_API_URL ?? "/api"'
      : 'import.meta.env.VITE_API_URL ?? "/api"';

  return `type ApiResponse<T> = { data: T };

const baseUrl = ${baseUrl};

async function request<T>(
  pathname: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const response = await fetch(\`\${baseUrl}\${pathname}\`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(\`API request failed with status \${response.status}\`);
  }

  return { data: (await response.json()) as T };
}

export const apiClient = {
  get: <T>(pathname: string) => request<T>(pathname),
  post: <T>(pathname: string, payload?: unknown) =>
    request<T>(pathname, { method: "POST", body: JSON.stringify(payload) }),
  put: <T>(pathname: string, payload?: unknown) =>
    request<T>(pathname, { method: "PUT", body: JSON.stringify(payload) }),
  patch: <T>(pathname: string, payload?: unknown) =>
    request<T>(pathname, { method: "PATCH", body: JSON.stringify(payload) }),
  delete: <T>(pathname: string) => request<T>(pathname, { method: "DELETE" }),
};
`;
}

function providersContent(config) {
  const clientDirective = config.framework === "nextjs" ? '"use client";\n\n' : "";
  const imports = [];
  const setup = [];

  if (config.serverState === "react-query") {
    imports.push('import { QueryClient, QueryClientProvider } from "@tanstack/react-query";');
    setup.push("  const [queryClient] = useState(() => new QueryClient());");
  }

  imports.push(
    config.serverState === "react-query"
      ? 'import { type PropsWithChildren, useState } from "react";'
      : 'import type { PropsWithChildren } from "react";'
  );

  if (config.clientState === "redux") {
    imports.push('import { Provider as ReduxProvider } from "react-redux";');
    imports.push('import { store } from "./store";');
  }

  let returnedTree = "children";
  if (config.serverState === "react-query" && config.clientState === "redux") {
    returnedTree = `(
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ReduxProvider>
  )`;
  } else if (config.serverState === "react-query") {
    returnedTree = `(
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )`;
  } else if (config.clientState === "redux") {
    returnedTree = `(
    <ReduxProvider store={store}>{children}</ReduxProvider>
  )`;
  }

  return `${clientDirective}${imports.join("\n")}

export function AppProviders({ children }: PropsWithChildren) {
${setup.length ? `${setup.join("\n")}\n\n` : ""}  return ${returnedTree};
}
`;
}

function reduxStoreContent() {
  return `import { configureStore } from "@reduxjs/toolkit";
// fsd-cli:imports:start
// fsd-cli:imports:end

export const store = configureStore({
  reducer: {
    // fsd-cli:reducers:start
    // fsd-cli:reducers:end
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
`;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}
