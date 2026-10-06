import fs from "node:fs";
import path from "node:path";
import { getFrameworkAdapter } from "../core/frameworks/index.mjs";
import { toKebabCase } from "./shared.mjs";

const layers = {
  feature: "features",
  entity: "entities",
  widget: "widgets",
  page: "pages",
  shared: "shared",
  app: "app",
};
const validName = /^[a-z][a-z0-9-]*$/;

function safePath(target) {
  for (let current = path.resolve(target); ; current = path.dirname(current)) {
    if (
      fs.existsSync(current) ||
      fs.lstatSync(current, { throwIfNoEntry: false })
    ) {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink())
        throw new Error(`Refusing symlink path: ${current}`);
      if (current !== path.resolve(target) && !stat.isDirectory())
        throw new Error(`Path ancestor is not a directory: ${current}`);
    }
    if (path.dirname(current) === current) break;
  }
}

export function generateStructure({
  cwd,
  type,
  name,
  names,
  segments,
  root,
  dryRun = false,
}) {
  if (!layers[type])
    throw new Error(
      "Structure type must be feature, entity, widget, page, shared, or app.",
    );
  if (!segments?.length || segments.some((segment) => !validName.test(segment)))
    throw new Error(
      "Segments must be comma-separated lowercase names (for example ui,api,model).",
    );
  const sliceless = type === "shared" || type === "app";
  if (sliceless && (name || names?.length))
    throw new Error("For shared/app use --segments without slice names.");
  const targets = sliceless ? [""] : names || [name];
  if (targets.some((value) => !sliceless && !validName.test(value || "")))
    throw new Error(
      "Structure slice names must be lowercase names starting with a letter.",
    );
  const source = path.resolve(
    cwd,
    root || (fs.existsSync(path.join(cwd, "app", "features")) ? "app" : "src"),
  );
  if (!root && fs.existsSync(path.join(cwd, "fsd.config.json"))) {
    const config = JSON.parse(
      fs.readFileSync(path.join(cwd, "fsd.config.json"), "utf8"),
    );
    const expected = getFrameworkAdapter(config.framework).sourceDirectory;
    return generateStructure({
      cwd,
      type,
      name,
      names,
      segments,
      root: expected,
      dryRun,
    });
  }
  const directories = new Set();
  const indexes = new Set();
  for (const slice of new Set(targets)) {
    const base = path.join(source, layers[type], slice);
    directories.add(base);
    if (!sliceless) indexes.add(path.join(base, "index.ts"));
    for (const segment of new Set(segments)) {
      directories.add(path.join(base, segment));
      if (sliceless) indexes.add(path.join(base, segment, "index.ts"));
    }
  }
  for (const directory of directories) {
    safePath(directory);
    if (fs.existsSync(directory) && !fs.statSync(directory).isDirectory())
      throw new Error(`Segment path is a file: ${directory}`);
  }
  for (const index of indexes) {
    safePath(index);
    if (fs.existsSync(index) && !fs.statSync(index).isFile())
      throw new Error(`Public API path is not a file: ${index}`);
  }
  const created = [];
  const missingDirectories = new Set();
  for (const directory of directories) {
    for (
      let current = directory;
      !fs.existsSync(current);
      current = path.dirname(current)
    )
      missingDirectories.add(current);
  }
  const planned = [
    ...missingDirectories,
    ...[...indexes].filter((file) => !fs.existsSync(file)),
  ];
  if (dryRun) return planned.map((file) => path.relative(cwd, file));
  try {
    for (const directory of [...missingDirectories].sort(
      (a, b) => a.length - b.length,
    )) {
      fs.mkdirSync(directory);
      created.push(directory);
    }
    for (const index of indexes) {
      if (fs.existsSync(index)) continue;
      fs.writeFileSync(index, "", { flag: "wx" });
      created.push(index);
    }
    return created.map((file) => path.relative(cwd, file));
  } catch (error) {
    for (const item of created.reverse()) {
      if (fs.statSync(item).isDirectory()) fs.rmdirSync(item);
      else fs.unlinkSync(item);
    }
    throw error;
  }
}

export function generateBatch(options, helpers) {
  if (options.force)
    throw new Error(
      "Batch generation does not support --force; replace one reviewed slice at a time.",
    );
  const cwd = process.cwd();
  const names = options.names.map(toKebabCase);
  if (new Set(names).size !== names.length)
    throw new Error("Batch contains duplicate normalized slice names.");
  const config = helpers.loadProjectConfig(cwd);
  const plans = names.map((name) =>
    helpers.createGeneratorPlan({ ...options, cwd, name, config }),
  );
  if (options.dryRun) {
    plans.forEach(helpers.printFilePlan);
    return;
  }
  const files = new Set(
    plans.flatMap((plan) =>
      plan.changedFiles.map((file) => path.join(cwd, file)),
    ),
  );
  files.add(path.join(cwd, ".fsd", "manifest.json"));
  const snapshots = [...files].map((file) => {
    safePath(file);
    return {
      file,
      bytes: fs.existsSync(file) ? fs.readFileSync(file) : null,
      mode: fs.existsSync(file) ? fs.statSync(file).mode : null,
    };
  });
  for (const plan of plans) safePath(plan.sliceDir);
  const missingDirectories = new Set();
  for (const target of [
    ...plans.map((plan) => plan.sliceDir),
    ...[...files].map((file) => path.dirname(file)),
  ]) {
    for (
      let current = target;
      !fs.existsSync(current);
      current = path.dirname(current)
    )
      missingDirectories.add(current);
  }
  const completed = [];
  try {
    for (const plan of plans) {
      const result = helpers.generateSlice({
        ...options,
        cwd,
        name: plan.name,
        config,
      });
      completed.push(plan.sliceDir);
      helpers.printSuccess(result);
    }
  } catch (error) {
    for (const directory of completed.reverse())
      fs.rmSync(directory, { recursive: true, force: true });
    for (const snapshot of snapshots) {
      if (snapshot.bytes === null) fs.rmSync(snapshot.file, { force: true });
      else
        fs.writeFileSync(snapshot.file, snapshot.bytes, {
          mode: snapshot.mode,
        });
    }
    for (const directory of [...missingDirectories].sort(
      (a, b) => b.length - a.length,
    )) {
      if (fs.existsSync(directory) && fs.readdirSync(directory).length === 0)
        fs.rmdirSync(directory);
    }
    throw error;
  }
}
