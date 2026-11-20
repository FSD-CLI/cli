import fs from "fs";
import path from "path";

// The slots that carry the template's own identity. Each one is rewritten
// structurally, so the replacement does not depend on the template's wording:
// the React title is "FSD Architecture Starter" and the Vue one is
// "FSD CLI — Vue + Vite", but both are replaced the same way.
const README_PATH = "README.md";
const INDEX_HTML_PATH = "index.html";
const ANGULAR_INDEX_HTML_PATH = "src/index.html";
const ANGULAR_JSON_PATH = "angular.json";
// SvelteKit renders the document title from a plain <title> element in the
// root layout's <svelte:head>, so that layout is the title slot for it.
const SVELTEKIT_LAYOUT_PATH = "src/routes/+layout.svelte";
const LAYOUT_PATHS = [
  "src/app/layout.tsx",
  "src/app/layout.route.tsx",
  "app/layout.tsx",
  "app/layout.route.tsx",
];

function lastPathSegment(projectName) {
  const segments = String(projectName)
    .split("/")
    .filter((segment) => segment.trim() !== "");
  return segments[segments.length - 1] ?? String(projectName);
}

function rewriteMarkdownTitle(content, title) {
  const match = content.match(/^#\s+.*$/m);
  if (!match) return null;
  return content.replace(/^#\s+.*$/m, `# ${title}`);
}

function rewriteHtmlTitle(content, title) {
  if (!/<title>[\s\S]*?<\/title>/.test(content)) return null;
  return content.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
}

// Angular project names must match ^[a-zA-Z][.0-9a-zA-Z]*(-[.0-9a-zA-Z]*)*$.
function toAngularProjectName(title) {
  const name = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[^a-z]+/, "")
    .replace(/-+$/, "");
  return name || "app";
}

// Rewrites a value tree, replacing "<from>:<target>" references such as
// "fsd-angular:build:production" with the renamed project.
function renameTargetReferences(value, from, to) {
  if (typeof value === "string") {
    return value.startsWith(`${from}:`) ? `${to}${value.slice(from.length)}` : value;
  }
  if (Array.isArray(value)) return value.map((item) => renameTargetReferences(item, from, to));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, renameTargetReferences(item, from, to)])
    );
  }
  return value;
}

function rewriteAngularProjectName(content, title) {
  let angularJson;
  try {
    angularJson = JSON.parse(content);
  } catch {
    return null;
  }

  const projects = angularJson?.projects;
  if (!projects || typeof projects !== "object") return null;

  let changed = false;
  for (const project of Object.values(projects)) {
    if (project && typeof project === "object" && "projectName" in project) {
      project.projectName = title;
      changed = true;
    }
  }

  // A single-project workspace (the template) is renamed by its key, which
  // also names the build output and every "<project>:<target>" reference.
  const keys = Object.keys(projects);
  const name = toAngularProjectName(title);
  if (keys.length === 1 && keys[0] !== name) {
    const [from] = keys;
    angularJson.projects = { [name]: renameTargetReferences(projects[from], from, name) };
    if (angularJson.defaultProject === from) angularJson.defaultProject = name;
    changed = true;
  }
  if (!changed) return null;

  return `${JSON.stringify(angularJson, null, 2)}\n`;
}

// Next.js renders the document title from the metadata export, so the layout
// file is the <title> slot for that framework.
function rewriteMetadataTitle(content, title) {
  const exportIndex = content.indexOf("export const metadata");
  if (exportIndex === -1) return null;

  const titleIndex = content.indexOf("title:", exportIndex);
  if (titleIndex === -1) return null;

  const valueStart = content.indexOf('"', titleIndex);
  const singleQuoteStart = content.indexOf("'", titleIndex);
  const start =
    valueStart === -1
      ? singleQuoteStart
      : singleQuoteStart === -1
        ? valueStart
        : Math.min(valueStart, singleQuoteStart);
  if (start === -1) return null;

  const quote = content[start];
  let end = start + 1;
  while (end < content.length && content[end] !== quote) {
    if (content[end] === "\\") end += 1;
    end += 1;
  }
  if (end >= content.length) return null;

  return (
    content.slice(0, start) + quote + title + quote + content.slice(end + 1)
  );
}

function applyToFile(targetDir, relativePath, rewrite, title, changed) {
  const filePath = path.join(targetDir, relativePath);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  const updated = rewrite(content, title);
  if (updated === null || updated === content) return;

  fs.writeFileSync(filePath, updated);
  changed.push(relativePath);
}

/**
 * Removes the template's own identity from the files that name the project:
 * the README title, the document title and the Angular project name.
 *
 * @param {string} targetDir the generated project directory
 * @param {string} projectName the project name as the user typed it
 * @returns {{title: string, changed: string[]}}
 */
export function applyTemplateIdentity(targetDir, projectName) {
  const title = lastPathSegment(projectName);
  const changed = [];

  applyToFile(targetDir, README_PATH, rewriteMarkdownTitle, title, changed);
  applyToFile(targetDir, INDEX_HTML_PATH, rewriteHtmlTitle, title, changed);
  if (fs.existsSync(path.join(targetDir, ANGULAR_JSON_PATH))) {
    applyToFile(targetDir, ANGULAR_INDEX_HTML_PATH, rewriteHtmlTitle, title, changed);
  }
  applyToFile(
    targetDir,
    SVELTEKIT_LAYOUT_PATH,
    rewriteHtmlTitle,
    title,
    changed
  );
  applyToFile(
    targetDir,
    ANGULAR_JSON_PATH,
    rewriteAngularProjectName,
    title,
    changed
  );
  for (const layoutPath of LAYOUT_PATHS) {
    applyToFile(targetDir, layoutPath, rewriteMetadataTitle, title, changed);
  }

  return { title, changed };
}
