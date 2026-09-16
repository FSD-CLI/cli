import { getCapabilities } from "./capability-matrix.mjs";
import { hasFrameworkAdapter } from "./frameworks/index.mjs";

const templates = [
  {
    title: "React + Vite",
    value: "react-vite",
    description: "React with Vite and a complete FSD architecture",
    repo: "FSD-CLI/FSD",
    status: "stable",
  },
  {
    title: "Next.js",
    value: "nextjs",
    description: "Next.js with App Router and a complete FSD architecture",
    repo: "FSD-CLI/FSD-NEXTJS",
    status: "stable",
  },
  {
    title: "Vue + Vite",
    value: "vue-vite",
    description: "Vue with Vite and framework-native FSD segments",
    repo: null,
    status: "planned",
  },
  {
    title: "Nuxt",
    value: "nuxt",
    description: "Nuxt with framework-native FSD segments",
    repo: null,
    status: "planned",
  },
  {
    title: "SvelteKit",
    value: "sveltekit",
    description: "SvelteKit with framework-native FSD segments",
    repo: null,
    status: "planned",
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

    if (template.status === "stable" && (!template.repo || !hasFrameworkAdapter(template.value))) {
      throw new Error(
        `Stable template "${template.value}" must provide a repository and framework adapter.`
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
