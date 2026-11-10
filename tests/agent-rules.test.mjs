import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createDefaultProjectConfig } from "../bin/commands/create-project.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

const SLICES = {
  app: ["providers"],
  pages: ["home"],
  widgets: [],
  features: ["auth", "cart"],
  entities: ["product"],
  shared: ["api", "ui"],
};

function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-agent-rules-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify(createDefaultProjectConfig("react-vite")),
  );
  for (const [layer, names] of Object.entries(SLICES)) {
    for (const name of names) {
      fs.mkdirSync(path.join(cwd, "src", layer, name), { recursive: true });
    }
  }
  return cwd;
}

function runAgentRules(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "agent-rules", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
  });
}

test("agent-rules writes AGENTS.md and .cursor/rules/fsd-cli.mdc from the project config", (t) => {
  const cwd = fixture(t);
  const result = runAgentRules(cwd);
  assert.equal(result.status, 0, result.stderr);

  const agentsPath = path.join(cwd, "AGENTS.md");
  assert.ok(fs.existsSync(agentsPath));
  const agents = fs.readFileSync(agentsPath, "utf8");
  assert.match(agents, /Framework: react-vite/);
  assert.match(agents, /Package manager: npm/);
  assert.match(agents, /features — 2 slices: auth, cart/);
  assert.match(agents, /entities — 1 slice: product/);
  assert.match(agents, /Total slices: 4/);
  assert.match(agents, /Imports flow downward only/);
  assert.match(agents, /app → pages → widgets → features → entities → shared/);
  assert.match(agents, /public API/);
  assert.match(agents, /agent-rules --force/);

  const cursorPath = path.join(cwd, ".cursor", "rules", "fsd-cli.mdc");
  assert.ok(fs.existsSync(cursorPath));
  const cursor = fs.readFileSync(cursorPath, "utf8");
  assert.match(cursor, /^---\n/);
  assert.match(cursor, /description: Feature-Sliced Design rules/);
  assert.match(cursor, /Framework: react-vite/);
  assert.match(cursor, /features — 2 slices: auth, cart/);
  assert.match(cursor, /Imports flow downward only/);
});

test("agent-rules refuses to overwrite an existing AGENTS.md without --force", (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, "AGENTS.md"), "# Hand-written rules\n", "utf8");
  const result = runAgentRules(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AGENTS\.md already exists/);
  assert.equal(
    fs.readFileSync(path.join(cwd, "AGENTS.md"), "utf8"),
    "# Hand-written rules\n",
  );
  assert.ok(!fs.existsSync(path.join(cwd, ".cursor", "rules", "fsd-cli.mdc")));
});

test("agent-rules refuses to overwrite existing Cursor rules without --force", (t) => {
  const cwd = fixture(t);
  const cursorPath = path.join(cwd, ".cursor", "rules", "fsd-cli.mdc");
  fs.mkdirSync(path.dirname(cursorPath), { recursive: true });
  fs.writeFileSync(cursorPath, "# Hand-written cursor rules\n", "utf8");
  const result = runAgentRules(cwd);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /fsd-cli\.mdc already exists/);
  assert.equal(
    fs.readFileSync(cursorPath, "utf8"),
    "# Hand-written cursor rules\n",
  );
  assert.ok(!fs.existsSync(path.join(cwd, "AGENTS.md")));
});

test("agent-rules --force overwrites both existing files", (t) => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, "AGENTS.md"), "# Old rules\n", "utf8");
  const cursorPath = path.join(cwd, ".cursor", "rules", "fsd-cli.mdc");
  fs.mkdirSync(path.dirname(cursorPath), { recursive: true });
  fs.writeFileSync(cursorPath, "# Old cursor rules\n", "utf8");
  const result = runAgentRules(cwd, ["--force"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(path.join(cwd, "AGENTS.md"), "utf8"), /Framework: react-vite/);
  assert.match(fs.readFileSync(cursorPath, "utf8"), /Framework: react-vite/);
});

test("agent-rules rejects unknown options", (t) => {
  const cwd = fixture(t);
  const result = runAgentRules(cwd, ["--bogus"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unexpected argument "--bogus"/);
});

test("help lists agent-rules", (t) => {
  const cwd = fixture(t);
  const result = spawnSync(process.execPath, [cli, "--help"], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /agent-rules \[--force\]/);
});
