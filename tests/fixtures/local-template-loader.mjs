// Replace only the network clone in integration tests; setup, installation,
// rollback, CLI exit handling and hooks are the production implementation.
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!url.endsWith("/bin/core/project-lifecycle.mjs")) return result;
  const signature = "export async function cloneTemplate(template, targetDir) {";
  const source = String(result.source);
  if (!source.includes(signature)) throw new Error("Clone test seam changed");
  return {
    ...result,
    source: source.replace(signature, `${signature}
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, "package.json"), '{"private":true,"dependencies":{}}');
      return;
    `),
  };
}
