export const nextjsAdapter = Object.freeze({
  id: "nextjs",
  family: "react",
  sourceDirectory: "src",
  clientDirective: '"use client";\n\n',
  publicApiBaseUrlExpression: 'process.env.NEXT_PUBLIC_API_URL ?? "/api"',
});
