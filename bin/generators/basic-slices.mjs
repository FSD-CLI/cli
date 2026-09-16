import {
  file,
  toCamelCase,
  toPascalCase,
  toTitle,
  viewContent,
} from "./shared.mjs";

export function createEntityFiles(name) {
  const pascalName = toPascalCase(name);
  return [
    file(`model/${name}.types.ts`, entityTypesContent(pascalName), true),
    file(`ui/${name}-card.tsx`, entityCardContent(name, pascalName), true),
  ];
}

export function createWidgetFiles(name) {
  return [
    file(`ui/${name}.tsx`, viewContent(toPascalCase(name), `${toTitle(name)} widget`), true),
  ];
}

export function createPageFiles(name) {
  return [
    file(
      `ui/${name}-page.tsx`,
      viewContent(`${toPascalCase(name)}Page`, `${toTitle(name)} page`),
      true
    ),
  ];
}

function entityTypesContent(pascalName) {
  return `export type ${pascalName} = {
  id: string;
  name: string;
  description?: string;
};
`;
}

function entityCardContent(name, pascalName) {
  const propertyName = toCamelCase(name);
  return `import type { ${pascalName} } from "../model/${name}.types";

type ${pascalName}CardProps = {
  ${propertyName}: ${pascalName};
};

export function ${pascalName}Card({ ${propertyName} }: ${pascalName}CardProps) {
  return (
    <article>
      <h3>{${propertyName}.name}</h3>
      {${propertyName}.description ? <p>{${propertyName}.description}</p> : null}
    </article>
  );
}
`;
}
