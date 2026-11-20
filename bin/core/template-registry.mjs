import { getCapabilities } from "./capability-matrix.mjs";
import { hasFrameworkAdapter, listFrameworkAdaptersByTarget } from "./frameworks/index.mjs";
import { adapterTargetsForSelection } from "./project-target.mjs";

const templates = [
  {
    title: "React + Vite",
    value: "react-vite",
    description: "React with Vite and a complete FSD architecture",
    repo: "FSD-CLI/FSD",
    ref: "ca3420e912639d41572f550b8f73363ac4bcc8b4",
    status: "stable",
  },
  {
    title: "Next.js",
    value: "nextjs",
    description: "Next.js with App Router and a complete FSD architecture",
    repo: "FSD-CLI/FSD-NEXTJS",
    ref: "3d0ba898a93dccd679634a758caf824c40dd3cf5",
    status: "stable",
  },
  {
    title: "Vue + Vite",
    value: "vue-vite",
    description: "Vue with Vite and framework-native FSD segments",
    repo: "FSD-CLI/FSD-VUE",
    ref: "fd0f80d81e2e977ab6974b520c941cd23e31ab61",
    status: "stable",
  },
  {
    title: "Nuxt",
    value: "nuxt",
    description: "Nuxt with framework-native FSD segments",
    repo: "FSD-CLI/FSD-NUXT",
    ref: "3e16cb60ceb3ee855e7faa0aac8e5d75a5d70512",
    status: "stable",
  },
  {
    title: "SvelteKit",
    value: "sveltekit",
    description: "SvelteKit with framework-native FSD segments",
    repo: "FSD-CLI/fsd-sveltekit",
    ref: "904812e17fc70ceb36fd850fe8405ef9d6dc68ce",
    status: "stable",
  },
  {
    // Pinned ahead of scaffolding support: the adapter is still inspection
    // only, so the template stays planned until generators and upgrades land.
    title: "Angular",
    value: "angular",
    description: "Angular with standalone, signals, zoneless and FSD layers",
    repo: "FSD-CLI/fsd-angular",
    ref: "ae8090c9e3d9c8e5ee2acd5b9ca6ef415ca663f6",
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

/**
 * Lists the templates whose adapter supports a project target selection.
 *
 * A selection maps to one or more adapter targets (bin/core/project-target.mjs);
 * a template qualifies when its adapter serves any of them — a "universal"
 * project still creates one app at a time, so an adapter for either side is
 * a candidate. Selections no adapter serves yet (today: "mobile") return
 * an empty list; presenting that state is the caller's job.
 *
 * @param {string} selection - A project target selection ("web", "multi-web", "mobile", "universal").
 * @returns {object[]} The matching templates, in registry order.
 */
export function listTemplatesForTarget(selection) {
  const supportedIds = new Set(
    adapterTargetsForSelection(selection).flatMap((target) =>
      listFrameworkAdaptersByTarget(target).map((adapter) => adapter.id)
    )
  );
  return listTemplates().filter((template) => supportedIds.has(template.value));
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
