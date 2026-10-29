import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { getFrameworkAdapter } from "../core/frameworks/index.mjs";
import { toKebabCase, toPascalCase } from "./shared.mjs";

export const SHARED_SEGMENTS = ["ui", "api"];
export const SHARED_UI_COMPONENTS = ["button", "input", "label", "card"];

export function createSharedLayerPlan({ cwd, segment, items = [], config }) {
  if (!SHARED_SEGMENTS.includes(segment)) {
    throw new Error(
      `Shared generator supports ${SHARED_SEGMENTS.join(" and ")} (for example, -g shared ui button input).`
    );
  }
  const adapter = getFrameworkAdapter(config.framework);
  const segmentDir = path.join(cwd, adapter.sourceDirectory, "shared", segment);
  const files =
    segment === "ui"
      ? createSharedUiFiles(adapter, normalizeComponents(items))
      : createSharedApiFiles(adapter, config, items);

  const indexPath = path.join(segmentDir, "index.ts");
  assertNotSymlink(indexPath);
  const currentIndex = fs.existsSync(indexPath)
    ? fs.readFileSync(indexPath, "utf8")
    : null;
  const siblings = fs.existsSync(segmentDir)
    ? fs.readdirSync(segmentDir).map((entry) => moduleName(entry).toLowerCase())
    : [];

  const creates = [];
  const kept = [];
  for (const item of files) {
    const target = path.join(segmentDir, item.path);
    assertNotSymlink(target);
    const exists =
      siblings.includes(moduleName(item.path).toLowerCase()) ||
      exportsName(currentIndex, item.exportName);
    (exists ? kept : creates).push({ ...item, target });
  }
  const missingExports = creates
    .filter((item) => !exportsModule(currentIndex, item.path))
    .map((item) => item.exportLine);
  const index = missingExports.length
    ? {
        target: indexPath,
        exists: currentIndex !== null,
        content: mergeExports(currentIndex ?? "", missingExports),
      }
    : null;

  return { cwd, segment, segmentDir, creates, kept, index };
}

export function generateSharedLayer(plan) {
  const written = [];
  const indexSnapshot =
    plan.index?.exists ? fs.readFileSync(plan.index.target) : null;
  try {
    for (const item of plan.creates) {
      fs.mkdirSync(path.dirname(item.target), { recursive: true });
      fs.writeFileSync(item.target, item.content, { flag: "wx" });
      written.push(item.target);
    }
    if (plan.index) {
      fs.mkdirSync(path.dirname(plan.index.target), { recursive: true });
      fs.writeFileSync(plan.index.target, plan.index.content);
    }
  } catch (error) {
    for (const target of written) fs.rmSync(target, { force: true });
    if (plan.index) {
      if (indexSnapshot) fs.writeFileSync(plan.index.target, indexSnapshot);
      else fs.rmSync(plan.index.target, { force: true });
    }
    throw error;
  }
  return plan;
}

export function printSharedLayerPlan(plan, { dryRun = false } = {}) {
  const relative = (target) => path.relative(plan.cwd, target);
  console.log(
    chalk.bold(dryRun ? "\n  File plan (dry run)\n" : `\n  Shared ${plan.segment} generated\n`)
  );
  for (const item of plan.creates) console.log(`  CREATE  ${relative(item.target)}`);
  if (plan.index) {
    console.log(`  ${plan.index.exists ? "UPDATE" : "CREATE"}  ${relative(plan.index.target)}`);
  }
  for (const item of plan.kept) {
    console.log(chalk.dim(`  KEEP    ${relative(item.target)} (already exists)`));
  }
  if (!plan.creates.length) {
    console.log(chalk.dim("\n  Nothing to generate; existing files were preserved."));
  }
  if (dryRun) console.log(chalk.dim("\n  No files were changed."));
  console.log();
}

function normalizeComponents(items) {
  const components = (items.length ? items : SHARED_UI_COMPONENTS).map(toKebabCase);
  const unknown = components.filter((name) => !SHARED_UI_COMPONENTS.includes(name));
  if (unknown.length) {
    throw new Error(
      `Unknown shared ui component "${unknown[0]}". Available: ${SHARED_UI_COMPONENTS.join(", ")}.`
    );
  }
  return [...new Set(components)];
}

function assertNotSymlink(target) {
  if (fs.lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) {
    throw new Error(`Refusing symlink path: ${target}`);
  }
}

// Matches an existing re-export of the module regardless of quote style or
// whether the import keeps the .ts/.tsx extension.
function exportsModule(indexContent, pathname) {
  if (!indexContent) return false;
  const modulePath = pathname.replace(/\.(tsx|ts)$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`from\\s+["']\\./${modulePath}(\\.tsx?)?["']`).test(indexContent);
}

function moduleName(entry) {
  return entry.replace(/\.(tsx|ts|vue|svelte)$/, "");
}

function exportsName(indexContent, name) {
  return Boolean(indexContent) && new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(indexContent);
}

const EXPORT_FROM = /^export\s[^;]*\sfrom\s+["'](.+?)["'];?$/;

// Keep a pure re-export index sorted by module path (formatters such as Biome
// enforce it); otherwise append so hand-written content is left untouched.
function mergeExports(content, lines) {
  const existing = content.split("\n").filter((line) => line.trim());
  if (existing.every((line) => EXPORT_FROM.test(line))) {
    const source = (line) => line.match(EXPORT_FROM)[1];
    const sorted = [...existing, ...lines].sort((a, b) =>
      source(a) < source(b) ? -1 : source(a) > source(b) ? 1 : 0
    );
    return `${sorted.join("\n")}\n`;
  }
  const prefix = content && !content.endsWith("\n") ? `${content}\n` : content;
  return `${prefix}${lines.join("\n")}\n`;
}

function createSharedUiFiles(adapter, components) {
  if (adapter.family === "vue") {
    return components.map((name) => {
      const componentName = `App${toPascalCase(name)}`;
      return defaultExport(`${componentName}.vue`, componentName, vueUi[name]());
    });
  }
  if (adapter.family === "svelte") {
    return components.map((name) => {
      const componentName = `App${toPascalCase(name)}`;
      return defaultExport(`${componentName}.svelte`, componentName, svelteUi[name]());
    });
  }
  return components.map((name) => ({
    path: `${name}.tsx`,
    content: reactUi[name](),
    exportName: toPascalCase(name),
    exportLine: `export { ${toPascalCase(name)} } from "./${name}";`,
  }));
}

function createSharedApiFiles(adapter, config, items) {
  if (items.length) {
    throw new Error("Shared api does not take extra names (use -g shared api).");
  }
  const content =
    adapter.id === "nuxt"
      ? nuxtApiClientContent()
      : config.apiClient === "axios"
        ? axiosApiClientContent(adapter)
        : fetchApiClientContent(adapter);
  return [
    {
      path: "client.ts",
      content,
      exportName: "apiClient",
      exportLine: 'export { apiClient } from "./client";',
    },
  ];
}

function defaultExport(pathname, exportName, content) {
  return {
    path: pathname,
    content,
    exportName,
    exportLine: `export { default as ${exportName} } from "./${pathname}";`,
  };
}

function envImport(adapter) {
  return adapter.id === "sveltekit"
    ? 'import { env } from "$env/dynamic/public";\n\n'
    : "";
}

function axiosApiClientContent(adapter) {
  return `${envImport(adapter)}import axios from "axios";

export const apiClient = axios.create({
  baseURL: ${adapter.publicApiBaseUrlExpression},
  headers: { "Content-Type": "application/json" },
});
`;
}

function fetchApiClientContent(adapter) {
  return `${envImport(adapter)}type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiResponse<T> = { data: T };

const baseURL = ${adapter.publicApiBaseUrlExpression};

async function request<T>(
  method: Method,
  pathname: string,
  payload?: unknown,
): Promise<ApiResponse<T>> {
  const response = await fetch(\`\${baseURL}\${pathname}\`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(\`API request failed with status \${response.status}\`);
  }

  const data = (response.status === 204 ? undefined : await response.json()) as T;
  return { data };
}

export const apiClient = {
  get: <T>(pathname: string) => request<T>("GET", pathname),
  post: <T>(pathname: string, payload?: unknown) =>
    request<T>("POST", pathname, payload),
  put: <T>(pathname: string, payload?: unknown) =>
    request<T>("PUT", pathname, payload),
  patch: <T>(pathname: string, payload?: unknown) =>
    request<T>("PATCH", pathname, payload),
  delete: <T>(pathname: string) => request<T>("DELETE", pathname),
};
`;
}

function nuxtApiClientContent() {
  return `type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiResponse<T> = { data: T };

async function request<T>(
  method: Method,
  pathname: string,
  payload?: unknown,
): Promise<ApiResponse<T>> {
  const runtimeConfig = useRuntimeConfig();
  const data = await $fetch<T>(pathname, {
    baseURL: runtimeConfig.public.apiBase,
    method,
    body: payload as Record<string, unknown> | undefined,
  });

  return { data };
}

export const apiClient = {
  get: <T>(pathname: string) => request<T>("GET", pathname),
  post: <T>(pathname: string, payload?: unknown) =>
    request<T>("POST", pathname, payload),
  put: <T>(pathname: string, payload?: unknown) =>
    request<T>("PUT", pathname, payload),
  patch: <T>(pathname: string, payload?: unknown) =>
    request<T>("PATCH", pathname, payload),
  delete: <T>(pathname: string) => request<T>("DELETE", pathname),
};
`;
}

const reactUi = {
  button: () => `import type { ComponentProps } from "react";

export function Button({
  type = "button",
  ...props
}: ComponentProps<"button">) {
  return <button type={type} {...props} />;
}
`,
  input: () => `import type { ComponentProps } from "react";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} />;
}
`,
  label: () => `import type { ComponentProps } from "react";

export function Label(props: ComponentProps<"label">) {
  return <label {...props} />;
}
`,
  card: () => `import type { ComponentProps } from "react";

export function Card(props: ComponentProps<"article">) {
  return <article {...props} />;
}
`,
};

const vueUi = {
  button: () => `<script setup lang="ts">
withDefaults(defineProps<{ type?: "button" | "submit" | "reset" }>(), {
  type: "button",
});
</script>

<template>
  <button :type="type">
    <slot />
  </button>
</template>
`,
  input: () => `<script setup lang="ts">
const model = defineModel<string>({ default: "" });
</script>

<template>
  <input v-model="model">
</template>
`,
  label: () => `<template>
  <label>
    <slot />
  </label>
</template>
`,
  card: () => `<template>
  <article>
    <slot />
  </article>
</template>
`,
};

const svelteUi = {
  button: () => `<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    type = "button",
    children,
    ...rest
  }: HTMLButtonAttributes & { children?: Snippet } = $props();
</script>

<button {type} {...rest}>
  {@render children?.()}
</button>
`,
  input: () => `<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  let { value = $bindable(""), ...rest }: HTMLInputAttributes = $props();
</script>

<input bind:value {...rest} />
`,
  label: () => `<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLLabelAttributes } from "svelte/elements";

  let { children, ...rest }: HTMLLabelAttributes & { children?: Snippet } = $props();
</script>

<label {...rest}>
  {@render children?.()}
</label>
`,
  card: () => `<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  let { children, ...rest }: HTMLAttributes<HTMLElement> & { children?: Snippet } = $props();
</script>

<article {...rest}>
  {@render children?.()}
</article>
`,
};
