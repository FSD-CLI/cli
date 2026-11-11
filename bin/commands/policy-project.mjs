import path from "node:path";
import chalk from "chalk";
import {
  POLICY_FILE_NAMES,
  loadPolicy,
} from "../core/policy.mjs";

// `fsd policy` loads and validates the project's policy file
// (fsd.policy.ts, or fsd.policy.mjs / fsd.policy.js). It reports what the
// policy declares; it does not evaluate the project against the rules —
// that is INT-36. Exit code 1 when the file exists but is invalid.
export async function runPolicyProject(command, cwd = process.cwd()) {
  const { found, path: file, policy, errors } = await loadPolicy(cwd);
  if (!found) {
    console.log(chalk.bold("\n  FSD policy\n"));
    console.log(
      `  No policy file found (looked for ${POLICY_FILE_NAMES.join(", ")}).`,
    );
    console.log(
      "  Create fsd.policy.ts to declare project rules — see docs/POLICY-FORMAT.md.\n",
    );
    return;
  }

  if (errors.length) {
    throw new Error(
      `Invalid policy in ${path.basename(file)}:\n${errors.map((error) => `  - ${error}`).join("\n")}`,
    );
  }

  console.log(chalk.bold("\n  FSD policy\n"));
  console.log(`  File: ${path.relative(cwd, file) || file}`);
  console.log(`  Version: ${policy.version}`);
  console.log(`  Rules: ${policy.rules.length}`);
  for (const rule of policy.rules) {
    const severity = rule.severity ?? "error";
    const detail =
      rule.id === "layer-boundaries" && rule.allow
        ? ` — ${Object.entries(rule.allow)
            .map(([layer, allowed]) => `${layer} → ${allowed.join(", ") || "none"}`)
            .join("; ")}`
        : "";
    console.log(`  - ${rule.id} (${severity})${detail}`);
  }
  console.log(
    "\n  Rules are declared here but not evaluated yet — enforcement lands with fsd check (INT-36).\n",
  );
}
