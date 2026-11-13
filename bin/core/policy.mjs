import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Policy as Code (INT-35): the `fsd.policy.ts` format and its loader.
//
// This module only defines the format and loads + validates a policy file.
// It does NOT evaluate the project against the rules — that is INT-36
// (`fsd check` will enforce the loaded policy there). The format below is a
// proposal: it is deliberately minimal and may change before evaluation
// lands, so keep new rule ids behind this module instead of spreading
// policy knowledge across commands.

export const POLICY_VERSION = 1;

export const POLICY_FILE_NAMES = [
  "fsd.policy.ts",
  "fsd.policy.mjs",
  "fsd.policy.js",
];

// The canonical file is `fsd.policy.ts`. The `.mjs`/`.js` spellings exist
// because Node only strips types from `.ts` files by default on Node
// >= 22.18; on the CLI's minimum runtime (Node 22.12) a plain JavaScript
// policy file is the portable alternative.
export const POLICY_FILE_NAME = "fsd.policy.ts";

export const POLICY_LAYERS = [
  "app",
  "pages",
  "widgets",
  "features",
  "entities",
  "shared",
];

export const POLICY_SEVERITIES = ["error", "warn"];

// Rule ids proposed for format version 1. `layer-boundaries` restricts
// which layers a layer may import from; `no-slice-cross-imports` forbids
// slices in the same layer from importing each other;
// `no-public-api-bypass` requires imports to go through a slice's public
// API instead of reaching into its internals.
export const POLICY_RULE_IDS = [
  "layer-boundaries",
  "no-slice-cross-imports",
  "no-public-api-bypass",
];

const TOP_LEVEL_KEYS = new Set(["version", "rules"]);
const RULE_KEYS = new Set(["id", "severity", "allow"]);

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function findPolicyFile(cwd = process.cwd()) {
  for (const fileName of POLICY_FILE_NAMES) {
    const candidate = path.join(cwd, fileName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function validatePolicy(policy) {
  const errors = [];
  if (!isPlainObject(policy)) {
    return ["Policy must export a default object."];
  }
  for (const key of Object.keys(policy)) {
    if (!TOP_LEVEL_KEYS.has(key)) {
      errors.push(`Unknown policy key "${key}".`);
    }
  }
  if (policy.version !== POLICY_VERSION) {
    errors.push(
      `Policy version must be ${POLICY_VERSION} (received ${JSON.stringify(policy.version)}).`,
    );
  }
  if (!Array.isArray(policy.rules)) {
    errors.push("Policy \"rules\" must be an array.");
    return errors;
  }
  const seenIds = new Set();
  policy.rules.forEach((rule, index) => {
    const where = `Rule ${index + 1}`;
    if (!isPlainObject(rule)) {
      errors.push(`${where} must be an object.`);
      return;
    }
    for (const key of Object.keys(rule)) {
      if (!RULE_KEYS.has(key)) {
        errors.push(`${where}: unknown key "${key}".`);
      }
    }
    if (typeof rule.id !== "string" || rule.id.length === 0) {
      errors.push(`${where} must have a string "id".`);
      return;
    }
    if (!POLICY_RULE_IDS.includes(rule.id)) {
      errors.push(
        `${where}: unknown rule id "${rule.id}" (supported: ${POLICY_RULE_IDS.join(", ")}).`,
      );
      return;
    }
    if (seenIds.has(rule.id)) {
      errors.push(`${where}: duplicate rule id "${rule.id}".`);
    }
    seenIds.add(rule.id);
    if (
      rule.severity !== undefined &&
      !POLICY_SEVERITIES.includes(rule.severity)
    ) {
      errors.push(
        `${where} ("${rule.id}"): severity must be ${POLICY_SEVERITIES.map((severity) => `"${severity}"`).join(" or ")} (received ${JSON.stringify(rule.severity)}).`,
      );
    }
    if (rule.id === "layer-boundaries" && rule.allow !== undefined) {
      if (!isPlainObject(rule.allow)) {
        errors.push(
          `${where} ("layer-boundaries"): "allow" must map a layer to the layers it may import.`,
        );
      } else {
        for (const [layer, allowed] of Object.entries(rule.allow)) {
          if (!POLICY_LAYERS.includes(layer)) {
            errors.push(
              `${where} ("layer-boundaries"): unknown layer "${layer}" in "allow" (layers: ${POLICY_LAYERS.join(", ")}).`,
            );
            continue;
          }
          if (
            !Array.isArray(allowed) ||
            allowed.some((entry) => !POLICY_LAYERS.includes(entry))
          ) {
            errors.push(
              `${where} ("layer-boundaries"): "${layer}" may only allow layers (${POLICY_LAYERS.join(", ")}).`,
            );
            continue;
          }
          if (allowed.includes(layer)) {
            errors.push(
              `${where} ("layer-boundaries"): "${layer}" cannot allow itself.`,
            );
          }
        }
      }
    }
    if (rule.id !== "layer-boundaries" && rule.allow !== undefined) {
      errors.push(
        `${where} ("${rule.id}"): "allow" only applies to "layer-boundaries".`,
      );
    }
  });
  return errors;
}

export async function loadPolicy(cwd = process.cwd()) {
  const file = findPolicyFile(cwd);
  if (!file) {
    return { found: false, path: null, policy: null, errors: [] };
  }
  let module;
  try {
    module = await import(pathToFileURL(file).href);
  } catch (error) {
    const hint =
      file.endsWith(".ts") && process.features.typescript !== "strip"
        ? " Loading a .ts policy needs Node >= 22.18 (type stripping) — use fsd.policy.mjs instead, or upgrade Node."
        : "";
    return {
      found: true,
      path: file,
      policy: null,
      errors: [`Failed to load ${path.basename(file)}: ${error.message}.${hint}`],
    };
  }
  const policy = module.default;
  if (policy === undefined) {
    return {
      found: true,
      path: file,
      policy: null,
      errors: [
        `${path.basename(file)} must have a default export (see docs/POLICY-FORMAT.md).`,
      ],
    };
  }
  return { found: true, path: file, policy, errors: validatePolicy(policy) };
}
