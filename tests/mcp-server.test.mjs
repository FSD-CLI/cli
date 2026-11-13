import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
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

// Servers started by each test. A temp dir is removed only after its test's
// servers have exited: Windows cannot delete a directory that is still a
// running process's working directory (EBUSY).
const serversByTest = new Map();

async function stopServers(t) {
  const children = serversByTest.get(t) ?? [];
  serversByTest.delete(t);
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null) return resolve();
          const timer = setTimeout(() => child.kill(), 2000);
          child.once("exit", () => {
            clearTimeout(timer);
            resolve();
          });
          child.stdin.end();
        }),
    ),
  );
}

function tempDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(async () => {
    await stopServers(t);
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  return dir;
}

function fixture(t) {
  const cwd = tempDir(t, "fsd-mcp-");
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify(createDefaultProjectConfig("react-vite")),
  );
  fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ name: "x" }));
  for (const [layer, names] of Object.entries(SLICES)) {
    fs.mkdirSync(path.join(cwd, "src", layer), { recursive: true });
    for (const name of names) {
      fs.mkdirSync(path.join(cwd, "src", layer, name), { recursive: true });
    }
  }
  return cwd;
}

function startServer(t, cwd) {
  const child = spawn(process.execPath, [cli, "mcp"], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (!serversByTest.has(t)) serversByTest.set(t, []);
  serversByTest.get(t).push(child);
  t.after(() => stopServers(t));
  const lines = [];
  let buffer = "";
  const waiters = [];
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      lines.push(JSON.parse(line));
      for (const waiter of waiters.splice(0)) waiter();
    }
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  async function waitFor(count) {
    const deadline = Date.now() + 5000;
    while (lines.length < count) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for ${count} responses (got ${lines.length}). stderr: ${stderr}`);
      }
      await new Promise((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 50);
      });
    }
    return lines;
  }

  function send(payload) {
    child.stdin.write(`${typeof payload === "string" ? payload : JSON.stringify(payload)}\n`);
  }

  return { child, send, waitFor, lines, stderr: () => stderr };
}

test("mcp initialize returns protocol version, capabilities and server info", async (t) => {
  const cwd = fixture(t);
  const server = startServer(t, cwd);
  server.send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  const [response] = await server.waitFor(1);
  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, 1);
  assert.equal(response.result.protocolVersion, "2024-11-05");
  assert.deepEqual(response.result.capabilities, { tools: {} });
  assert.equal(response.result.serverInfo.name, "fsd-cli");
  assert.match(response.result.serverInfo.version, /^\d+\.\d+\.\d+$/);
  server.child.stdin.end();
});

test("mcp tools/list exposes exactly check and explain", async (t) => {
  const cwd = fixture(t);
  const server = startServer(t, cwd);
  server.send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const [response] = await server.waitFor(1);
  assert.deepEqual(
    response.result.tools.map((tool) => tool.name),
    ["check", "explain"],
  );
  for (const tool of response.result.tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.properties.projectPath.type, "string");
  }
  server.child.stdin.end();
});

test("mcp check tool returns passing checks for a valid project", async (t) => {
  const cwd = fixture(t);
  const server = startServer(t, cwd);
  server.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "check", arguments: {} },
  });
  const [response] = await server.waitFor(1);
  assert.equal(response.error, undefined);
  const data = JSON.parse(response.result.content[0].text);
  assert.equal(data.passed, true);
  assert.equal(data.config.framework, "react-vite");
  assert.equal(data.checks.find((c) => c.label === "FSD layer: features").ok, true);
  server.child.stdin.end();
});

test("mcp explain tool returns stack and per-layer slice counts", async (t) => {
  const cwd = fixture(t);
  const server = startServer(t, cwd);
  server.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "explain", arguments: {} },
  });
  const [response] = await server.waitFor(1);
  const data = JSON.parse(response.result.content[0].text);
  assert.equal(data.framework, "react-vite");
  assert.equal(data.total, 4);
  assert.equal(data.layers.find((l) => l.layer === "features").slices.join(","), "auth,cart");
  assert.equal(data.layers.find((l) => l.layer === "entities").slices.join(","), "product");
  server.child.stdin.end();
});

test("mcp tools accept an explicit projectPath", async (t) => {
  const cwd = fixture(t);
  const server = startServer(t, os.tmpdir());
  server.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "explain", arguments: { projectPath: cwd } },
  });
  const [response] = await server.waitFor(1);
  const data = JSON.parse(response.result.content[0].text);
  assert.equal(data.total, 4);
  server.child.stdin.end();
});

test("mcp check reports failure, not an error, for a project without config", async (t) => {
  const cwd = tempDir(t, "fsd-mcp-noconfig-");
  const server = startServer(t, cwd);
  server.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "check", arguments: {} },
  });
  const [response] = await server.waitFor(1);
  assert.equal(response.result.isError, undefined);
  const data = JSON.parse(response.result.content[0].text);
  assert.equal(data.passed, false);
  // No fsd.config.json: the config is inferred from package.json, as `fsd check` does.
  assert.equal(data.config.framework, "react-vite");
  assert.equal(data.checks.find((c) => c.label === "FSD layer: features").ok, false);
  server.child.stdin.end();
});

test("mcp explain infers a config for a project without fsd.config.json", async (t) => {
  const cwd = tempDir(t, "fsd-mcp-noconfig-");
  const server = startServer(t, cwd);
  server.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "explain", arguments: {} },
  });
  const [response] = await server.waitFor(1);
  assert.equal(response.result.isError, undefined);
  const data = JSON.parse(response.result.content[0].text);
  assert.equal(data.framework, "react-vite");
  assert.equal(data.total, 0);
  server.child.stdin.end();
});

test("mcp explain reports a tool error for an unsupported config schema", async (t) => {
  const cwd = tempDir(t, "fsd-mcp-badconfig-");
  fs.writeFileSync(
    path.join(cwd, "fsd.config.json"),
    JSON.stringify({ framework: "react-vite", schemaVersion: 99 }),
  );
  const server = startServer(t, cwd);
  server.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "explain", arguments: {} },
  });
  const [response] = await server.waitFor(1);
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /Unsupported fsd\.config\.json schemaVersion: 99/);
  server.child.stdin.end();
});

test("mcp rejects unknown tools, unknown methods and malformed JSON", async (t) => {
  const cwd = fixture(t);
  const server = startServer(t, cwd);
  server.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "generate", arguments: {} },
  });
  server.send({ jsonrpc: "2.0", id: 2, method: "resources/list" });
  server.send("{not json");
  server.send({ jsonrpc: "2.0", method: "notifications/initialized" });
  const responses = await server.waitFor(3);
  assert.equal(responses[0].error.code, -32602);
  assert.match(responses[0].error.message, /unknown tool "generate"/);
  assert.equal(responses[1].error.code, -32601);
  assert.match(responses[1].error.message, /Method not found/);
  assert.equal(responses[2].error.code, -32700);
  assert.equal(responses[2].id, null);
  server.child.stdin.end();
});

test("mcp exits when stdin closes and rejects extra arguments", async (t) => {
  const cwd = fixture(t);
  const server = startServer(t, cwd);
  server.send({ jsonrpc: "2.0", id: 1, method: "ping" });
  await server.waitFor(1);
  server.child.stdin.end();
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not exit")), 5000);
    server.child.on("exit", (code) => {
      clearTimeout(timer);
      assert.equal(code, 0, server.stderr());
      resolve();
    });
  });

  const { spawnSync } = await import("node:child_process");
  const rejected = spawnSync(process.execPath, [cli, "mcp", "--bogus"], {
    cwd,
    encoding: "utf8",
    timeout: 5000,
  });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Unexpected argument "--bogus"/);
});
