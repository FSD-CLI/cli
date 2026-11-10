import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";

export const SYNC_HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "patch",
  "options",
  "head",
  "trace",
];

// INT-13 (scoped): `fsd sync api --schema openapi.json --dry-run` only
// previews what a JSON OpenAPI schema contains. It never writes files;
// entity generation is INT-14 and safe regeneration is INT-15.
export function parseOpenApiSchema(text) {
  let document;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Error("The schema file is not valid JSON.");
  }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("The schema file must contain a JSON OpenAPI document.");
  }
  if (typeof document.openapi !== "string") {
    throw new Error(
      "The schema file is not an OpenAPI document (missing \"openapi\" version).",
    );
  }
  if (!document.openapi.startsWith("3.")) {
    throw new Error(
      `Only OpenAPI 3.x schemas are supported (received "${document.openapi}").`,
    );
  }
  if (document.paths !== undefined && (typeof document.paths !== "object" || document.paths === null || Array.isArray(document.paths))) {
    throw new Error("The OpenAPI document has an invalid \"paths\" object.");
  }

  const schemas =
    document.components && typeof document.components === "object" && !Array.isArray(document.components)
      ? document.components.schemas
      : undefined;
  const entities =
    schemas && typeof schemas === "object" && !Array.isArray(schemas)
      ? Object.keys(schemas).sort()
      : [];

  const endpoints = [];
  for (const route of Object.keys(document.paths ?? {}).sort()) {
    const item = document.paths[route];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    for (const method of SYNC_HTTP_METHODS) {
      const operation = item[method];
      if (!operation || typeof operation !== "object") continue;
      endpoints.push({
        method: method.toUpperCase(),
        path: route,
        operationId:
          typeof operation.operationId === "string" ? operation.operationId : undefined,
        summary:
          typeof operation.summary === "string" ? operation.summary : undefined,
      });
    }
  }

  return {
    version: document.openapi,
    title:
      document.info && typeof document.info === "object" && typeof document.info.title === "string"
        ? document.info.title
        : undefined,
    entities,
    endpoints,
  };
}

export function inspectOpenApiSchema(schemaPath, cwd = process.cwd()) {
  const resolved = path.resolve(cwd, schemaPath);
  let text;
  try {
    text = fs.readFileSync(resolved, "utf8");
  } catch {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  return { schemaPath: resolved, ...parseOpenApiSchema(text) };
}

function plural(count, singular, pluralForm) {
  return count === 1 ? singular : pluralForm;
}

function printDryRun(report, schemaPath) {
  const { version, title, entities, endpoints } = report;
  console.log(chalk.bold("\n  FSD sync api — dry run\n"));
  console.log(`  Schema: ${path.relative(process.cwd(), schemaPath) || schemaPath}`);
  console.log(`  OpenAPI: ${version}${title ? ` (${title})` : ""}`);
  console.log();
  console.log(`  ${entities.length} ${plural(entities.length, "entity", "entities")}:`);
  if (!entities.length) console.log("  (none)");
  for (const entity of entities) console.log(`  - ${entity}`);
  console.log();
  console.log(`  ${endpoints.length} ${plural(endpoints.length, "endpoint", "endpoints")}:`);
  if (!endpoints.length) console.log("  (none)");
  for (const { method, path: route, operationId, summary } of endpoints) {
    const detail = [operationId, summary].filter(Boolean).join(" — ");
    console.log(`  ${method} ${route}${detail ? ` (${detail})` : ""}`);
  }
  console.log();
  console.log("  Dry run — no files were generated.\n");
}

export async function runSyncApiProject(
  command,
  cwd = process.cwd(),
  { schema, dryRun = false } = {},
) {
  if (!dryRun) {
    throw new Error(
      "`fsd sync api` only supports --dry-run for now. Add --dry-run to preview detected entities and endpoints.",
    );
  }
  const report = inspectOpenApiSchema(schema, cwd);
  printDryRun(report, report.schemaPath);
}
