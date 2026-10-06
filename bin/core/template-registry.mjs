import { getCapabilities } from "./capability-matrix.mjs";
import { hasFrameworkAdapter } from "./frameworks/index.mjs";

const templates = [
  {
    title: "React + Vite",
    value: "react-vite",
    description: "React with Vite and a complete FSD architecture",
    repo: "FSD-CLI/FSD",
    ref: "e144552d8a766e4d5aba69448c13d398ed80d4d5",
    status: "stable",
  },
  {
    title: "Next.js",
    value: "nextjs",
    description: "Next.js with App Router and a complete FSD architecture",
    repo: "FSD-CLI/FSD-NEXTJS",
    ref: "9d8a0d3af7e49ebd9c83aff3d8c9bfa086644cab",
    status: "stable",
  },
  {
    title: "Vue + Vite",
    value: "vue-vite",
    description: "Vue with Vite and framework-native FSD segments",
    repo: "FSD-CLI/FSD-VUE",
    ref: "33bf851b925998bee2c26d754a195e5442657154",
    status: "stable",
  },
  {
    title: "Nuxt",
    value: "nuxt",
    description: "Nuxt with framework-native FSD segments",
    repo: "FSD-CLI/FSD-NUXT",
    ref: "0b445b2efe0566263e8b56b28e4954da4a980446",
    status: "stable",
  },
  {
    title: "SvelteKit",
    value: "sveltekit",
    description: "SvelteKit with framework-native FSD segments",
    repo: "FSD-CLI/fsd-sveltekit",
    ref: "5db760e9091f2deaff26c082271783909fc47734",
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
