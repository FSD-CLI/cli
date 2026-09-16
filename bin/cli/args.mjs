const BOOLEAN_FLAGS = new Map([
  ["--yes", "yes"],
  ["-y", "yes"],
  ["--no-install", "noInstall"],
  ["--no-start", "noStart"],
]);

const VALUE_FLAGS = new Map([
  ["--framework", "framework"],
  ["--template", "framework"],
  ["-f", "framework"],
]);

export class CliUsageError extends Error {}

export function parseCliArgs(args) {
  if (args.includes("--help") || args.includes("-h")) return { command: "help" };
  if (args.includes("--version") || args.includes("-v")) return { command: "version" };
  if (args.includes("--list-templates")) return { command: "list-templates" };

  const generateIndex = args.findIndex((arg) => arg === "--generate" || arg === "-g");
  if (generateIndex !== -1) {
    const values = [];
    let force = false;
    for (const argument of args.slice(generateIndex + 1)) {
      if (argument === "--force") {
        force = true;
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
    };
  }

  const options = {
    command: "create",
    projectName: undefined,
    framework: undefined,
    yes: false,
    noInstall: false,
    noStart: false,
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

  return options;
}
