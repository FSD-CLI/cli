// Editable migration plan (INT-06) — the second slice of `fsd adopt`.
//
// INT-05 analyzes; this module turns the analysis into a plan the user
// can edit before anything moves (execution is INT-07):
//
// - `buildAdoptionPlan` turns every flat file into a move (`from` → `to`,
//   status `pending`). Layer-root and unmapped files have no target yet,
//   so they are listed separately for a manual decision, not as moves.
// - The plan lives at `.fsd/adopt-plan.json` (the CLI-owned directory).
//   `writeAdoptionPlan` refuses to overwrite it unless `--force` is
//   passed — regenerating discards the user's edits.
// - `readAdoptionPlan` validates what it loads: version 1, moves with a
//   string id/from/to, a status of pending/approved/skipped, no duplicate
//   ids or duplicate sources. Anything else is rejected loudly, so a
//   hand-edited plan that INT-07 would misread never reaches execution.
//
// Editing the plan means editing the JSON: change a move's `to` to pick a
// different home, set its status to `approved` to include it or `skipped`
// to leave the file where it is. A move the user deletes from the file is
// simply not a move anymore.

import fs from "node:fs";
import path from "node:path";
import { analyzeAdoption } from "./adopt-analysis.mjs";

export const ADOPT_PLAN_FILE = path.join(".fsd", "adopt-plan.json");
export const ADOPT_PLAN_VERSION = 1;
export const ADOPT_PLAN_STATUSES = ["pending", "approved", "skipped"];

/**
 * Builds a migration plan from a fresh adoption analysis.
 *
 * @param {string} root project root
 * @param {ReturnType<typeof analyzeAdoption>} analysis from analyzeAdoption(root)
 * @returns {{version: number, generatedAt: string, sourceRoot: string, score: number, moves: {id: string, from: string, to: string, status: string, reason: string}[], layerRoot: {file: string, note: string}[], unmapped: {file: string, note: string}[]}}
 */
export function buildAdoptionPlan(root, analysis) {
  const sourceDir = path.relative(root, analysis.sourceRoot);
  let index = 0;
  const moves = analysis.files
    .filter((file) => file.status === "flat")
    .map((file) => ({
      id: `move-${String(++index).padStart(3, "0")}`,
      from: file.file,
      to: path.join(sourceDir, file.suggestion.to),
      status: "pending",
      reason: file.suggestion.reason,
    }));
  return {
    version: ADOPT_PLAN_VERSION,
    generatedAt: new Date().toISOString(),
    sourceRoot: sourceDir,
    score: analysis.score,
    moves,
    layerRoot: analysis.files
      .filter((file) => file.status === "layer-root")
      .map((file) => ({ file: file.file, note: file.note })),
    unmapped: analysis.files
      .filter((file) => file.status === "unmapped")
      .map((file) => ({ file: file.file, note: file.note })),
  };
}

/**
 * Counts a plan's moves by status.
 *
 * @param {ReturnType<typeof buildAdoptionPlan>} plan
 * @returns {{moves: number, pending: number, approved: number, skipped: number}}
 */
export function summarizePlan(plan) {
  return {
    moves: plan.moves.length,
    pending: plan.moves.filter((move) => move.status === "pending").length,
    approved: plan.moves.filter((move) => move.status === "approved").length,
    skipped: plan.moves.filter((move) => move.status === "skipped").length,
  };
}

/**
 * Writes a plan to `.fsd/adopt-plan.json`, creating `.fsd/` when needed.
 * Refuses to overwrite an existing plan unless `force` is passed.
 *
 * @param {string} root project root
 * @param {ReturnType<typeof buildAdoptionPlan>} plan
 * @param {{force?: boolean}} options
 * @returns {string} the written file path
 */
export function writeAdoptionPlan(root, plan, { force = false } = {}) {
  const file = path.join(root, ADOPT_PLAN_FILE);
  if (fs.existsSync(file) && !force) {
    throw new Error(
      `${ADOPT_PLAN_FILE} already exists. Edit it, or pass --force to regenerate it (regenerating discards your edits).`,
    );
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  return file;
}

/**
 * Reads and validates the plan. Throws when the file is missing, is not
 * valid JSON, has an unsupported version, or holds a malformed move.
 *
 * @param {string} root project root
 * @returns {ReturnType<typeof buildAdoptionPlan>}
 */
export function readAdoptionPlan(root) {
  const file = path.join(root, ADOPT_PLAN_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No adoption plan found at ${ADOPT_PLAN_FILE}. Generate one with: fsd adopt --plan`,
    );
  }
  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${ADOPT_PLAN_FILE} is not valid JSON: ${error.message}`);
  }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error(`${ADOPT_PLAN_FILE} must contain a JSON object.`);
  }
  if (plan.version !== ADOPT_PLAN_VERSION) {
    throw new Error(
      `${ADOPT_PLAN_FILE} has unsupported version ${JSON.stringify(plan.version)} (expected ${ADOPT_PLAN_VERSION}). Regenerate it with: fsd adopt --plan --force`,
    );
  }
  if (!Array.isArray(plan.moves)) {
    throw new Error(`${ADOPT_PLAN_FILE} must contain a "moves" array.`);
  }
  const ids = new Set();
  const sources = new Set();
  for (const [index, move] of plan.moves.entries()) {
    const where = `move ${index + 1}`;
    if (!move || typeof move !== "object") {
      throw new Error(`${ADOPT_PLAN_FILE}: ${where} must be an object.`);
    }
    for (const field of ["id", "from", "to"]) {
      if (typeof move[field] !== "string" || move[field] === "") {
        throw new Error(`${ADOPT_PLAN_FILE}: ${where} needs a non-empty "${field}".`);
      }
    }
    if (!ADOPT_PLAN_STATUSES.includes(move.status)) {
      throw new Error(
        `${ADOPT_PLAN_FILE}: ${where} has status ${JSON.stringify(move.status)} (expected one of ${ADOPT_PLAN_STATUSES.join(", ")}).`,
      );
    }
    if (ids.has(move.id)) {
      throw new Error(`${ADOPT_PLAN_FILE}: duplicate move id "${move.id}".`);
    }
    if (sources.has(move.from)) {
      throw new Error(`${ADOPT_PLAN_FILE}: duplicate move source "${move.from}".`);
    }
    ids.add(move.id);
    sources.add(move.from);
  }
  return plan;
}
