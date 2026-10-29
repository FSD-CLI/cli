import {
  file,
  toCamelCase,
  toPascalCase,
  toTitle,
  viewContent,
} from "./shared.mjs";
import { isWidgetPreset, reactWidgetPresetContent } from "./widget-presets.mjs";
import { isPagePreset, reactPagePresetContent } from "./page-presets.mjs";

export function createEntityFiles(name) {
  const pascalName = toPascalCase(name);
  return [
    file(`model/${name}.types.ts`, entityTypesContent(pascalName), true),
    file(`ui/${name}-card.tsx`, entityCardContent(name, pascalName), true),
  ];
}

export function createWidgetFiles(name, config) {
  const content = isWidgetPreset(name)
    ? reactWidgetPresetContent(name, config)
    : viewContent(toPascalCase(name), `${toTitle(name)} widget`);
  return [file(`ui/${name}.tsx`, content, true)];
}

export function createPageFiles(name, config) {
  const content = isPagePreset(name)
    ? reactPagePresetContent(name, config)
    : viewContent(`${toPascalCase(name)}Page`, `${toTitle(name)} page`);
  return [file(`ui/${name}-page.tsx`, content, true)];
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
