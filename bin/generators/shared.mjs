export function file(pathname, content, isPublic) {
  return { path: pathname, content, public: isPublic };
}

export function dedupeFiles(files) {
  return [...new Map(files.map((item) => [item.path, item])).values()];
}

export function exportLine(filePath) {
  return `export * from "./${filePath.replace(/\.(tsx|ts)$/, "")}";`;
}

export function toKebabCase(value) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function toPascalCase(value) {
  return toKebabCase(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function toCamelCase(value) {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toTitle(value) {
  return toKebabCase(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function viewContent(componentName, title) {
  return `type ${componentName}Props = {
  title?: string;
};

export function ${componentName}({ title = "${title}" }: ${componentName}Props) {
  return (
    <section>
      <h2>{title}</h2>
    </section>
  );
}
`;
}
