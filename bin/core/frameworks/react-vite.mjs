export const reactViteAdapter = Object.freeze({
  id: "react-vite",
  family: "react",
  sourceDirectory: "src",
  clientDirective: "",
  publicApiBaseUrlExpression: 'import.meta.env.VITE_API_URL ?? "/api"',
});
