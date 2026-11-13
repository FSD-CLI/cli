import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseOpenApiSchema } from "../bin/commands/sync-api.mjs";

const cli = fileURLToPath(new URL("../bin/index.mjs", import.meta.url));

const SAMPLE = {
  openapi: "3.1.0",
  info: { title: "Pet Store", version: "1.0.0" },
  paths: {
    "/pets": {
      get: { operationId: "listPets", summary: "List all pets" },
      post: { operationId: "createPet" },
    },
    "/pets/{id}": {
      get: { operationId: "getPet" },
      delete: { operationId: "deletePet" },
    },
    "/health": {
      parameters: [{ name: "x-trace", in: "header" }],
    },
  },
  components: {
    schemas: {
      Pet: { type: "object" },
      Owner: { type: "object" },
    },
  },
};

test("parseOpenApiSchema detects entities and endpoints", () => {
  const report = parseOpenApiSchema(JSON.stringify(SAMPLE));
  assert.equal(report.version, "3.1.0");
  assert.equal(report.title, "Pet Store");
  assert.deepEqual(report.entities, ["Owner", "Pet"]);
  assert.deepEqual(report.endpoints, [
    { method: "GET", path: "/pets", operationId: "listPets", summary: "List all pets" },
    { method: "POST", path: "/pets", operationId: "createPet", summary: undefined },
    { method: "GET", path: "/pets/{id}", operationId: "getPet", summary: undefined },
    { method: "DELETE", path: "/pets/{id}", operationId: "deletePet", summary: undefined },
  ]);
});

test("parseOpenApiSchema tolerates a schema with no paths or components", () => {
  const report = parseOpenApiSchema(JSON.stringify({ openapi: "3.0.3" }));
  assert.deepEqual(report.entities, []);
  assert.deepEqual(report.endpoints, []);
});

test("parseOpenApiSchema rejects invalid JSON, non-OpenAPI JSON and Swagger 2.0", () => {
  assert.throws(() => parseOpenApiSchema("{not json"), /not valid JSON/);
  assert.throws(() => parseOpenApiSchema(JSON.stringify({ foo: 1 })), /not an OpenAPI document/);
  assert.throws(
    () => parseOpenApiSchema(JSON.stringify({ swagger: "2.0", paths: {} })),
    /not an OpenAPI document/,
  );
  assert.throws(
    () => parseOpenApiSchema(JSON.stringify({ openapi: "2.0", paths: {} })),
    /Only OpenAPI 3\.x/,
  );
});

function fixture(t, schema = SAMPLE) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-sync-api-"));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(path.join(cwd, "openapi.json"), JSON.stringify(schema, null, 2));
  return cwd;
}

function runSync(cwd, args = []) {
  return spawnSync(process.execPath, [cli, "sync", "api", ...args], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
  });
}

test("fsd sync api --dry-run prints entities and endpoints and writes nothing", (t) => {
  const cwd = fixture(t);
  const result = runSync(cwd, ["--schema", "openapi.json", "--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 entities/);
  assert.match(result.stdout, /- Owner/);
  assert.match(result.stdout, /- Pet/);
  assert.match(result.stdout, /4 endpoints/);
  assert.match(result.stdout, /GET \/pets \(listPets — List all pets\)/);
  assert.match(result.stdout, /POST \/pets \(createPet\)/);
  assert.match(result.stdout, /Dry run — no files were generated/);
  assert.deepEqual(fs.readdirSync(cwd), ["openapi.json"]);
});

test("fsd sync api requires --schema and --dry-run", (t) => {
  const cwd = fixture(t);
  const noSchema = runSync(cwd, ["--dry-run"]);
  assert.notEqual(noSchema.status, 0);
  assert.match(noSchema.stderr, /requires --schema/);

  const noDryRun = runSync(cwd, ["--schema", "openapi.json"]);
  assert.notEqual(noDryRun.status, 0);
  assert.match(noDryRun.stderr, /only supports --dry-run/);

  const missingFile = runSync(cwd, ["--schema", "missing.json", "--dry-run"]);
  assert.notEqual(missingFile.status, 0);
  assert.match(missingFile.stderr, /Schema file not found/);

  const wrongSubcommand = spawnSync(process.execPath, [cli, "sync", "webhooks", "--dry-run"], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
  });
  assert.notEqual(wrongSubcommand.status, 0);
  assert.match(wrongSubcommand.stderr, /supports only `api`/);
});

test("fsd sync api --dry-run accepts --schema=<file> and an empty schema", (t) => {
  const cwd = fixture(t, { openapi: "3.0.3" });
  const result = runSync(cwd, ["--schema=openapi.json", "--dry-run"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0 entities/);
  assert.match(result.stdout, /0 endpoints/);
});
