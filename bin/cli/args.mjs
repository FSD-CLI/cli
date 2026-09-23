const BOOLEAN_FLAGS = new Map([
  ["--yes", "yes"],
  ["-y", "yes"],
  ["--no-install", "noInstall"],
  ["--no-start", "noStart"],
  ["--dry-run", "dryRun"],
  ["--force", "force"],
]);

const VALUE_FLAGS = new Map([
  ["--framework", "framework"],
  ["--template", "framework"],
  ["-f", "framework"],
  ["--package-manager", "packageManager"],
  ["--api-client", "apiClient"],
  ["--server-state", "serverState"],
  ["--client-state", "clientState"],
  ["--forms", "forms"],
]);

export class CliUsageError extends Error {}

export function parseCliArgs(args) {
  if (args.includes("--help") || args.includes("-h")) return { command: "help" };
  if (args.includes("--version") || args.includes("-v")) return { command: "version" };
  if (args.includes("--list-templates")) return { command: "list-templates" };

  if (["check", "doctor", "config"].includes(args[0])) {
    if (args.length > 1) {
      throw new CliUsageError(`Unexpected argument "${args[1]}".`);
    }
    return { command: args[0] };
  }

  const generateIndex = args.findIndex((arg) => arg === "--generate" || arg === "-g");
  if (generateIndex !== -1) {
    const values = [];
    let force = false;
    let dryRun = false;
    for (const argument of args.slice(generateIndex + 1)) {
      if (argument === "--force") {
        force = true;
      } else if (argument === "--dry-run") {
        dryRun = true;
      } else if (argument.startsWith("-")) {
        throw new CliUsageError(`Unknown generate option "${argument}".`);
      } else {
        values.push(argument);
      }
    }
    if (values.length > 2) {
      throw new CliUsageError(`Unexpected argument "${values[2]}".`);
    }
    return {
      command: "generate",
      type: values[0],
      name: values[1],
      force,
      dryRun,
    };
  }

  const options = {
    command: "create",
    projectName: undefined,
    framework: undefined,
    packageManager: undefined,
    apiClient: undefined,
    serverState: undefined,
    clientState: undefined,
    forms: undefined,
    yes: false,
    noInstall: false,
    noStart: false,
    dryRun: false,
    force: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const [inlineFlag, inlineValue] = argument.split("=", 2);

    if (BOOLEAN_FLAGS.has(argument)) {
      options[BOOLEAN_FLAGS.get(argument)] = true;
      continue;
    }

    if (VALUE_FLAGS.has(inlineFlag)) {
      const value = inlineValue ?? args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new CliUsageError(`${inlineFlag} requires a value.`);
      }
      options[VALUE_FLAGS.get(inlineFlag)] = value;
      if (inlineValue === undefined) index += 1;
      continue;
    }

    if (argument.startsWith("-")) {
      throw new CliUsageError(`Unknown option "${argument}".`);
    }

    if (options.projectName) {
      throw new CliUsageError(`Unexpected argument "${argument}".`);
    }
    options.projectName = argument;
  }

  if (options.yes && !options.projectName) {
    throw new CliUsageError("A project name is required when using --yes.");
  }
  if (options.yes && !options.framework) {
    throw new CliUsageError("--framework is required when using --yes (for example, --framework react-vite).");
  }

  return options;
}
