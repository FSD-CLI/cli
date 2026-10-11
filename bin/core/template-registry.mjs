import { getCapabilities } from "./capability-matrix.mjs";
import { hasFrameworkAdapter } from "./frameworks/index.mjs";

const templates = [
  {
    title: "React + Vite",
    value: "react-vite",
    description: "React with Vite and a complete FSD architecture",
    repo: "FSD-CLI/FSD",
    ref: "96b8d86a64276ab77ede0aa5edb52056e390c163",
    status: "stable",
  },
  {
    title: "Next.js",
    value: "nextjs",
    description: "Next.js with App Router and a complete FSD architecture",
    repo: "FSD-CLI/FSD-NEXTJS",
    ref: "f06175fb129777c645851f31b1b847b936b93117",
    status: "stable",
  },
  {
    title: "Vue + Vite",
    value: "vue-vite",
    description: "Vue with Vite and framework-native FSD segments",
    repo: "FSD-CLI/FSD-VUE",
    ref: "67f3d2dd17c29273a02f0fc57c43cac748478dd0",
    status: "stable",
  },
  {
    title: "Nuxt",
    value: "nuxt",
    description: "Nuxt with framework-native FSD segments",
    repo: "FSD-CLI/FSD-NUXT",
    ref: "387a96f5a4be005eb57714a7f4f4261d1338f52f",
    status: "stable",
  },
  {
    title: "SvelteKit",
    value: "sveltekit",
    description: "SvelteKit with framework-native FSD segments",
    repo: "FSD-CLI/fsd-sveltekit",
    ref: "546f6769c1a0c391a6d9a4249bdcd3ce2f2b367c",
    status: "stable",
  },
];

function validateRegistry(items) {
  const ids = new Set();
  for (const template of items) {
    if (ids.has(template.value)) {
      throw new Error(`Duplicate template id "${template.value}".`);
    }
    ids.add(template.value);
    getCapabilities(template.value);

    if (template.status === "stable" && (!template.repo || !/^[a-f0-9]{40}$/.test(template.ref ?? "") || !hasFrameworkAdapter(template.value))) {
      throw new Error(
        `Stable template "${template.value}" must provide a repository, full immutable commit and framework adapter.`
      );
    }
  }
}

validateRegistry(templates);

export const TEMPLATE_REGISTRY = Object.freeze(
  templates.map((template) =>
    Object.freeze({
      ...template,
      available: template.status === "stable",
    })
  )
);

export function listTemplates({ includePlanned = true } = {}) {
  return includePlanned
    ? [...TEMPLATE_REGISTRY]
    : TEMPLATE_REGISTRY.filter((template) => template.available);
}

export function getTemplate(templateId) {
  return TEMPLATE_REGISTRY.find((template) => template.value === templateId);
}

export function getAvailableTemplate(templateId) {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Unknown framework "${templateId}".`);
  }
  if (!template.available) {
    throw new Error(`${template.title} support is planned but not available yet.`);
  }
  return template;
}

export function getTemplateProvenance(template) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(template.repo ?? "") ||
      !/^[a-f0-9]{40}$/.test(template.ref ?? "")) {
    throw new Error("Template source must be a GitHub repository and full immutable commit.");
  }
  return {schemaVersion: 1, framework: template.value, repository: template.repo,
    requestedRef: template.ref, resolvedCommit: template.ref};
}
