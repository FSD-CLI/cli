// Minimal semver range evaluation.
//
// The CLI has to explain runtime requirements in user-facing messages, so it
// needs to evaluate the same `engines.node` ranges that npm publishes for its
// dependencies. Only the subset that actually appears in those fields is
// supported: `>=`, `>`, `=`, `^`, `~`, exact versions, and `||` alternatives
// combined with a space separated AND list.

const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/;

export function parseVersion(value) {
  if (value && typeof value === "object") return value;
  const match = VERSION_PATTERN.exec(String(value ?? ""));
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) {
    throw new TypeError(`Cannot compare versions "${left}" and "${right}".`);
  }

  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }

  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease < b.prerelease ? -1 : 1;
}

function nextMajor(version) {
  return `${version.major + 1}.0.0`;
}

function nextMinor(version) {
  return `${version.major}.${version.minor + 1}.0`;
}

function caretBounds(version) {
  if (version.major !== 0) return nextMajor(version);
  if (version.minor !== 0) return `0.${version.minor + 1}.0`;
  return `0.0.${version.patch + 1}`;
}

function satisfiesComparator(version, comparator) {
  const trimmed = comparator.trim();
  if (!trimmed) return true;

  const match = /^(>=|<=|>|<|\^|~|=)?\s*(.+)$/.exec(trimmed);
  if (!match) return false;

  const operator = match[1] ?? "=";
  const target = parseVersion(match[2]);
  if (!target) return false;

  const comparison = compareVersions(version, target);
  switch (operator) {
    case ">=":
      return comparison >= 0;
    case "<=":
      return comparison <= 0;
    case ">":
      return comparison > 0;
    case "<":
      return comparison < 0;
    case "^":
      return comparison >= 0 && compareVersions(version, caretBounds(target)) < 0;
    case "~":
      return comparison >= 0 && compareVersions(version, nextMinor(target)) < 0;
    default:
      return comparison === 0;
  }
}

export function satisfiesRange(version, range) {
  const parsed = parseVersion(version);
  if (!parsed) return false;

  return String(range)
    .split("||")
    .some((alternative) =>
      alternative
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .every((comparator) => satisfiesComparator(parsed, comparator))
    );
}

export function lowestVersionInRange(range) {
  const candidates = String(range)
    .split("||")
    .map((alternative) =>
      alternative
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((comparator) => /^(>=|<=|>|<|\^|~|=)?\s*(.+)$/.exec(comparator))
        .filter(Boolean)
        .map(([, , raw]) => parseVersion(raw))
        .filter(Boolean)
    )
    .filter((versions) => versions.length > 0);

  if (candidates.length === 0) return null;

  return candidates
    .map((versions) => versions.reduce((lowest, current) =>
      compareVersions(current, lowest) < 0 ? current : lowest
    ))
    .reduce((lowest, current) => (compareVersions(current, lowest) < 0 ? current : lowest));
}
