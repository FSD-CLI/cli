#!/usr/bin/env node

import degit from "degit";
import prompts from "prompts";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";
import { execFileSync, spawn } from "child_process";
import { parseGenerateArgs, runGenerator } from "./generator.mjs";
import {
  DEFAULT_PROJECT_CONFIG,
  configureProject,
  normalizeProjectConfig,
} from "./project-config.mjs";

const TEMPLATES = [
  {
    title: "React + Vite",
    value: "react-vite",
    description: "React with Vite and FSD architecture",
    repo: "FSD-CLI/FSD",
    available: true,
  },
  {
    title: "Next.js",
    value: "nextjs",
    description: "Next.js — Full-stack React framework with SSR, SSG, and App Router.",
    repo: "FSD-CLI/FSD-NEXTJS",
    available: true,
  },
];

function showBanner() {
  const banner = `
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    ███████╗███████╗██████╗                                                  │
│    ██╔════╝██╔════╝██╔══██╗                                                 │
│    █████╗  ███████╗██║  ██║                                                 │
│    ██╔══╝  ╚════██║██║  ██║                                                 │
│    ██║     ███████║██████╔╝                                                 │
│    ╚═╝     ╚══════╝╚═════╝                                                  │
│                                                                             │
│           ◢◤◢◤◢◤  FEATURE-SLICED DESIGN ARCHITECTURE  ◢◤◢◤◢◤                │
│                                                                             │
│   app                                                                       │
│   └── pages                                                                 │
│       └── widgets                                                           │
│           └── features                                                      │
│               └── entities                                                  │
│                   └── shared                                                │
│                                                                             │
│   Scalable • Maintainable • Enterprise Frontend Architecture                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
  `;

  console.log(chalk.cyanBright(banner));
}

function showNextSteps(projectName, depsInstalled, packageManager) {
  console.log();
  console.log(chalk.bold.white("  Next steps:"));
  console.log();
  console.log(`    ${chalk.cyan("$")} cd ${projectName}`);
  if (!depsInstalled) {
    console.log(`    ${chalk.cyan("$")} ${packageManager} install`);
  }
  console.log(
    `    ${chalk.cyan("$")} ${packageManager === "npm" ? "npm run dev" : `${packageManager} dev`}`
  );
  console.log();
}

function handleCancel() {
  console.log();
  console.log(chalk.yellow("  Cancelled."));
  console.log();
  process.exit(0);
}

const onCancel = { onCancel: handleCancel };

async function promptProjectConfig(framework) {
  const answers = await prompts(
    [
      {
        type: "select",
        name: "apiClient",
        message: "API client",
        initial: 0,
        choices: [
          { title: "Axios", value: "axios" },
          { title: "Native Fetch", value: "fetch" },
        ],
      },
      {
        type: "select",
        name: "serverState",
        message: "Server state",
        initial: 0,
        choices: [
          { title: "TanStack React Query", value: "react-query" },
          { title: "None", value: "none" },
        ],
      },
      {
        type: "select",
        name: "clientState",
        message: "Client state",
        initial: 0,
        choices: [
          { title: "Zustand", value: "zustand" },
          { title: "Redux Toolkit", value: "redux" },
          { title: "None", value: "none" },
        ],
      },
      {
        type: "select",
        name: "forms",
        message: "Forms and validation",
        initial: 0,
        choices: [
          { title: "React Hook Form + Zod", value: "react-hook-form-zod" },
          { title: "None", value: "none" },
        ],
      },
      {
        type: "select",
        name: "packageManager",
        message: "Package manager",
        initial: 0,
        choices: [
          { title: "npm", value: "npm" },
          { title: "pnpm", value: "pnpm" },
          { title: "Yarn", value: "yarn" },
          { title: "Bun", value: "bun" },
        ],
      },
    ],
    onCancel
  );

  return normalizeProjectConfig(framework, {
    ...DEFAULT_PROJECT_CONFIG,
    ...answers,
  });
}

function packageManagerCommand(packageManager, script) {
  return packageManager === "npm"
    ? { command: "npm", args: ["run", script] }
    : { command: packageManager, args: [script] };
}

const REQUIRED_HUSKY_HOOKS = ["pre-commit", "commit-msg", "pre-push"];
const COMMITLINT_DEV_DEPENDENCIES = {
  "@commitlint/cli": "^20.5.3",
  "@commitlint/config-conventional": "^20.5.3",
};
const COMMITLINT_CONFIG_FILES = [
  "commitlint.config.js",
  "commitlint.config.cjs",
  "commitlint.config.mjs",
];

function runCommand(command, args, cwd, options = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
}

function ensureGitRepository(targetDir) {
  runCommand("git", ["init"], targetDir);
  runCommand("git", ["config", "core.hooksPath", ".husky"], targetDir);

  const remotes = runCommand("git", ["remote"], targetDir).split(/\r?\n/);
  if (remotes.includes("origin")) {
    runCommand("git", ["remote", "remove", "origin"], targetDir);
  }
}

function ensureCommitlintDependencies(targetDir) {
  const packageJsonPath = path.join(targetDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  packageJson.devDependencies = packageJson.devDependencies ?? {};

  let changed = false;
  for (const [name, version] of Object.entries(COMMITLINT_DEV_DEPENDENCIES)) {
    if (!packageJson.devDependencies[name] && !packageJson.dependencies?.[name]) {
      packageJson.devDependencies[name] = version;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`
    );
  }
}

function ensureCommitlintConfig(targetDir) {
  const hasCommitlintConfig = COMMITLINT_CONFIG_FILES.some((file) =>
    fs.existsSync(path.join(targetDir, file))
  );

  if (hasCommitlintConfig) {
    return;
  }

  fs.writeFileSync(
    path.join(targetDir, "commitlint.config.cjs"),
    "module.exports = { extends: ['@commitlint/config-conventional'] };\n"
  );
}

function createHuskyHooks(packageManager) {
  const run = (script) =>
    packageManager === "npm" ? `npm run ${script}` : `${packageManager} ${script}`;
  const execCommitlint = {
    npm: 'npx --no -- commitlint --edit "$1"',
    pnpm: 'pnpm exec commitlint --edit "$1"',
    yarn: 'yarn exec commitlint --edit "$1"',
    bun: 'bunx commitlint --edit "$1"',
  }[packageManager];

  return {
    "pre-commit": `${run("lint")}\ngit diff --check\n${run("build")}\n`,
    "commit-msg": `#!/bin/sh\n${execCommitlint}\n`,
    "pre-push": `${run("build")}\n`,
  };
}

function ensureHuskyHooks(targetDir, packageManager) {
  const huskyDir = path.join(targetDir, ".husky");
  const hooks = createHuskyHooks(packageManager);
  fs.mkdirSync(huskyDir, { recursive: true });

  for (const hook of REQUIRED_HUSKY_HOOKS) {
    const hookPath = path.join(huskyDir, hook);

    fs.writeFileSync(hookPath, hooks[hook]);

    fs.chmodSync(hookPath, 0o755);
  }
}

function verifyCommitlintRejectsInvalidMessage(targetDir) {
  const commitMsgHook = path.join(targetDir, ".husky", "commit-msg");
  const invalidMessagePath = path.join(
    targetDir,
    ".git",
    "COMMITLINT_INVALID_MESSAGE_CHECK"
  );

  fs.writeFileSync(invalidMessagePath, "test\n");

  try {
    runCommand(commitMsgHook, [invalidMessagePath], targetDir);
  } catch (err) {
    const output = `${err.stdout ?? ""}${err.stderr ?? ""}${err.message ?? ""}`;

    if (
      output.includes("subject may not be empty") &&
      output.includes("type may not be empty")
    ) {
      return true;
    }

    throw err;
  } finally {
    fs.rmSync(invalidMessagePath, { force: true });
  }

  throw new Error('Commitlint accepted invalid commit message "test".');
}

async function main() {
  const generateOptions = parseGenerateArgs(process.argv.slice(2));

  if (generateOptions.shouldGenerate) {
    await runGenerator(generateOptions);
    return;
  }

  showBanner();

  const argName = process.argv[2];

  const { projectName } = argName
    ? { projectName: argName }
    : await prompts(
        {
          type: "text",
          name: "projectName",
          message: "Project name",
          initial: "my-fsd-app",
        },
        onCancel
      );

  if (!projectName) {
    console.log(chalk.red("  Project name is required."));
    process.exit(1);
  }

  const targetDir = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(targetDir)) {
    console.log(chalk.red(`  Folder "${projectName}" already exists.`));
    process.exit(1);
  }

  const { template } = await prompts(
    {
      type: "select",
      name: "template",
      message: "Select project type",
      choices: TEMPLATES.map((t) => ({
        title: t.available
          ? t.title
          : `${t.title} ${chalk.dim("(Coming Soon)")}`,
        value: t.value,
      })),
    },
    onCancel
  );

  const selected = TEMPLATES.find((t) => t.value === template);

  if (!selected || !selected.available) {
    console.log();
    console.log(
      chalk.yellow(`  ${selected ? selected.title : "Template"} support is coming soon!`)
    );
    console.log(chalk.dim("  Stay tuned for updates."));
    console.log();
    process.exit(0);
  }

  const projectConfig = await promptProjectConfig(selected.value);

  console.log();

  const spinner = ora({
    text: "Downloading template...",
    color: "cyan",
  }).start();

  try {
    const emitter = degit(selected.repo, { cache: false, force: true });
    await emitter.clone(targetDir);
    spinner.succeed(chalk.green("Template downloaded."));
  } catch (err) {
    spinner.fail(chalk.red("Failed to download template."));
    console.error(chalk.dim(`  ${err.message}`));
    process.exit(1);
  }

  const gitSpinner = ora({
    text: "Initializing Git and Husky...",
    color: "cyan",
  }).start();

  try {
    configureProject(targetDir, projectConfig);
    ensureCommitlintDependencies(targetDir);
    ensureCommitlintConfig(targetDir);
    ensureGitRepository(targetDir);
    ensureHuskyHooks(targetDir, projectConfig.packageManager);
    gitSpinner.succeed(
      chalk.green("FSD stack, Git repository, and Husky hooks configured.")
    );
  } catch (err) {
    gitSpinner.fail(chalk.red("Failed to configure Git and Husky."));
    console.error(chalk.dim(`  ${err.message}`));
    process.exit(1);
  }

  const { installDeps } = await prompts(
    {
      type: "confirm",
      name: "installDeps",
      message: "Install dependencies now?",
      initial: true,
    },
    onCancel
  );

  let depsInstalled = false;

  if (installDeps) {
    const installSpinner = ora({
      text: "Installing dependencies...",
      color: "cyan",
    }).start();

    try {
      runCommand(projectConfig.packageManager, ["install"], targetDir);
      runCommand("git", ["config", "core.hooksPath", ".husky"], targetDir);
      installSpinner.succeed(chalk.green("Dependencies installed."));
      depsInstalled = true;
    } catch (err) {
      installSpinner.fail(chalk.red("Failed to install dependencies."));
      console.log(chalk.dim("  You can install them manually later."));
    }
  }

  if (depsInstalled) {
    const commitlintSpinner = ora({
      text: "Verifying Commitlint...",
      color: "cyan",
    }).start();

    try {
      verifyCommitlintRejectsInvalidMessage(targetDir);
      commitlintSpinner.succeed(
        chalk.green('Commitlint rejected invalid message "test".')
      );
    } catch (err) {
      commitlintSpinner.fail(chalk.red("Commitlint verification failed."));
      console.error(chalk.dim(`  ${err.message}`));
      process.exit(1);
    }
  } else {
    console.log(
      chalk.dim(
        '  Commitlint verification skipped until dependencies are installed.'
      )
    );
  }

  if (depsInstalled) {
    const { startDev } = await prompts(
      {
        type: "confirm",
        name: "startDev",
        message: "Start development server now?",
        initial: true,
      },
      onCancel
    );

    if (startDev) {
      console.log();
      console.log(chalk.cyan("  Starting development server..."));
      console.log();

      const devCommand = packageManagerCommand(projectConfig.packageManager, "dev");
      const child = spawn(devCommand.command, devCommand.args, {
        cwd: targetDir,
        stdio: "inherit",
        shell: false,
      });

      child.on("error", (err) => {
        console.log(chalk.red(`  Failed to start dev server: ${err.message}`));
        showNextSteps(projectName, true, projectConfig.packageManager);
      });

      return;
    }
  }

  console.log();
  console.log(chalk.green.bold("  Project created successfully!"));
  showNextSteps(projectName, depsInstalled, projectConfig.packageManager);
}

main().catch((err) => {
  console.error(chalk.red(`  Error: ${err.message}`));
  process.exit(1);
});
