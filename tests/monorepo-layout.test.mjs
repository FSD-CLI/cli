import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const specPath = fileURLToPath(new URL("../docs/MONOREPO-LAYOUT.md", import.meta.url));

// The spec is a static document: the test pins the layout terms it must
// define. Detection of the layout is covered by CORE-20's tests
// (detectMonorepo in bin/commands/inspect-project.mjs), which check the
// same signals the spec names (pnpm-workspace.yaml, package.json workspaces,
// turbo.json, nx.json, lerna.json, apps/ directory).

test("monorepo layout spec defines apps/* and packages/* with their rules", () => {
  const spec = fs.readFileSync(specPath, "utf8");
  for (const required of [
    "apps/",
    "packages/shared-",
    "packages/entities-",
    "workspaceMemberName",
    "@<project>/<member>",
    '"multi-web"',
    "workspace:*",
    "private: true",
    "never imports from another app",
    "pnpm-workspace.yaml",
    "turbo.json",
    "nx.json",
    "MONO-03",
    "MONO-13",
    "MONO-17",
    "MONO-19",
  ]) {
    assert.ok(spec.includes(required), `spec is missing ${JSON.stringify(required)}`);
  }
});
