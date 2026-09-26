import fs from "node:fs";
import { assertSupportedProjectConfig } from "../core/capability-matrix.mjs";

export const CURRENT_CONFIG_SCHEMA_VERSION = 1;

export class UpgradeStateError extends Error {
  constructor(message) {
    super(message);
    this.name = "UpgradeStateError";
    this.exitCode = 4;
  }
}

function readSchema(relativePath) {
  return JSON.parse(fs.readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

export const PROJECT_CONFIG_SCHEMA = readSchema("../../schema/fsd.config.schema.json");
export const MANIFEST_SCHEMA = readSchema("../../schema/fsd.manifest.schema.json");

function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function validateNode(value, schema, location, errors) {
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${location} must equal ${JSON.stringify(schema.const)}.`);
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${location} must be one of: ${schema.enum.join(", ")}.`);
    return;
  }
  if (schema.type) {
    const actual = valueType(value);
    const valid =
      actual === schema.type || (schema.type === "integer" && Number.isInteger(value));
    if (!valid) {
      errors.push(`${location} must be a ${schema.type}.`);
      return;
    }
  }
  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${location} must be at least ${schema.minimum}.`);
  }
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push(`${location} must not be empty.`);
  }
  if (schema.pattern && typeof value === "string" && !new RegExp(schema.pattern).test(value)) {
    errors.push(`${location} has an invalid format.`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${location} must contain at least ${schema.minItems} item(s).`);
    }
    if (schema.items) {
      value.forEach((item, index) => validateNode(item, schema.items, `${location}[${index}]`, errors));
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      if (!(required in value)) errors.push(`${location}.${required} is required.`);
    }
    for (const [key, item] of Object.entries(value)) {
      if (schema.propertyNames) validateNode(key, schema.propertyNames, `${location} key`, errors);
      const propertySchema = schema.properties?.[key];
      if (propertySchema) {
        validateNode(item, propertySchema, `${location}.${key}`, errors);
      } else if (schema.additionalProperties === false) {
        errors.push(`${location}.${key} is not allowed.`);
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        validateNode(item, schema.additionalProperties, `${location}.${key}`, errors);
      }
    }
  }
}

export function validateJsonSchema(value, schema, label) {
  const errors = [];
  validateNode(value, schema, label, errors);
  if (errors.length) throw new UpgradeStateError(errors.join(" "));
  return value;
}

function assertConfigEnvelope(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new UpgradeStateError("fsd.config.json must contain an object.");
  }
  if (!Number.isInteger(config.schemaVersion)) {
    throw new UpgradeStateError("fsd.config.json schemaVersion must be an integer.");
  }
}

export const CONFIG_MIGRATIONS = Object.freeze([]);

export function migrateProjectConfig(config) {
  assertConfigEnvelope(config);
  if (config.schemaVersion > CURRENT_CONFIG_SCHEMA_VERSION) {
    throw new UpgradeStateError(
      `fsd.config.json uses unsupported future schema ${config.schemaVersion}; this CLI supports ${CURRENT_CONFIG_SCHEMA_VERSION}.`
    );
  }

  let migrated = structuredClone(config);
  while (migrated.schemaVersion < CURRENT_CONFIG_SCHEMA_VERSION) {
    const migration = CONFIG_MIGRATIONS.find((item) => item.from === migrated.schemaVersion);
    if (!migration) {
      throw new UpgradeStateError(
        `No configuration migration is available from schema ${migrated.schemaVersion}.`
      );
    }
    migrated = migration.migrate(migrated);
    validateJsonSchema(migrated, migration.schema, "fsd.config.json");
  }
  return migrated;
}

export function readProjectConfig(projectRoot) {
  const configPath = `${projectRoot}/fsd.config.json`;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new UpgradeStateError(`Unable to read fsd.config.json: ${error.message}`);
  }
  const config = migrateProjectConfig(raw);
  validateJsonSchema(config, PROJECT_CONFIG_SCHEMA, "fsd.config.json");
  try {
    assertSupportedProjectConfig(config);
  } catch (error) {
    throw new UpgradeStateError(error.message);
  }
  return config;
}
