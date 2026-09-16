import fs from "fs";
import { spawn } from "child_process";
import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { getCapabilityChoices } from "../core/capability-matrix.mjs";
import { getRunScriptCommand } from "../core/package-managers.mjs";
import { resolveProjectPath } from "../core/project-path.mjs";
import {
  cloneTemplate,
  installProjectDependencies,
  prepareProject,
  verifyCommitlintRejectsInvalidMessage,
} from "../core/project-lifecycle.mjs";
import {
  getAvailableTemplate,
  getTemplate,
  listTemplates,
} from "../core/template-registry.mjs";
import {
  DEFAULT_PROJECT_CONFIG,
  normalizeProjectConfig,
} from "../project-config.mjs";
import { showBanner } from "../cli/output.mjs";

function handleCancel() {
  console.log(`\n${chalk.yellow("  Cancelled.")}\n`);
  process.exit(0);
}

const onCancel = { onCancel: handleCancel };

async function selectProjectName(projectName) {
  if (projectName) return projectName;
  const answer = await prompts(
    {
      type: "text",
      name: "projectName",
      message: "Project name",
      initial: "my-fsd-app",
    },
    onCancel
  );
  return answer.projectName;
}

async function selectTemplate(framework) {
  if (framework) return getAvailableTemplate(framework);

  const answer = await prompts(
    {
      type: "select",
      name: "template",
      message: "Select project type",
      choices: listTemplates().map((template) => ({
        title: template.available
          ? template.title
          : `${template.title} ${chalk.dim("(Coming Soon)")}`,
        value: template.value,
      })),
    },
    onCancel
  );
  const template = getTemplate(answer.template);
  if (!template?.available) {
    throw new Error(`${template?.title ?? "Template"} support is coming soon.`);
  }
  return template;
}

async function promptProjectConfig(framework) {
  const answers = await prompts(
    [
      {
        type: "select",
        name: "apiClient",
        message: "API client",
        initial: 0,
        choices: getCapabilityChoices(framework, "apiClient"),
      },
      {
        type: "select",
        name: "serverState",
        message: "Server state",
        initial: 0,
        choices: getCapabilityChoices(framework, "serverState"),
      },
      {
        type: "select",
        name: "clientState",
        message: "Client state",
        initial: 0,
        choices: getCapabilityChoices(framework, "clientState"),
      },
      {
        type: "select",
        name: "forms",
        message: "Forms and validation",
        initial: 0,
        choices: getCapabilityChoices(framework, "forms"),
      },
      {
        type: "select",
        name: "packageManager",
        message: "Package manager",
        initial: 0,
        choices: getCapabilityChoices(framework, "packageManager"),
      },
    ],
    onCancel
  );
  return normalizeProjectConfig(framework, {
    ...DEFAULT_PROJECT_CONFIG,
    ...answers,
  });
}

function showNextSteps(projectName, depsInstalled, packageManager) {
  console.log(`\n${chalk.bold.white("  Next steps:")}\n`);
  console.log(`    ${chalk.cyan("$")} cd ${projectName}`);
  if (!depsInstalled) console.log(`    ${chalk.cyan("$")} ${packageManager} install`);
  const dev = getRunScriptCommand(packageManager, "dev");
  console.log(`    ${chalk.cyan("$")} ${dev.command} ${dev.args.join(" ")}`);
  console.log();
}

export async function runCreateProject(options) {
  showBanner();
  const projectName = await selectProjectName(options.projectName);
  if (!projectName) throw new Error("Project name is required.");

  const targetDir = resolveProjectPath(process.cwd(), projectName);
  if (fs.existsSync(targetDir)) {
    throw new Error(`Folder "${projectName}" already exists.`);
  }

  const template = await selectTemplate(options.framework);
  const projectConfig = options.yes
    ? normalizeProjectConfig(template.value, DEFAULT_PROJECT_CONFIG)
    : await promptProjectConfig(template.value);

  console.log();
  const downloadSpinner = ora({ text: "Downloading template...", color: "cyan" }).start();
  try {
    await cloneTemplate(template, targetDir);
    downloadSpinner.succeed(chalk.green("Template downloaded."));
  } catch (error) {
    downloadSpinner.fail(chalk.red("Failed to download template."));
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    throw error;
  }

  const setupSpinner = ora({
    text: "Configuring FSD stack, Git, and Husky...",
    color: "cyan",
  }).start();
  try {
    prepareProject(targetDir, projectConfig);
    setupSpinner.succeed(chalk.green("FSD stack, Git, and Husky configured."));
  } catch (error) {
    setupSpinner.fail(chalk.red("Project configuration failed."));
    throw error;
  }

  let shouldInstall = options.yes && !options.noInstall;
  if (!options.yes && !options.noInstall) {
    const answer = await prompts(
      {
        type: "confirm",
        name: "installDeps",
        message: "Install dependencies now?",
        initial: true,
      },
      onCancel
    );
    shouldInstall = answer.installDeps;
  }

  let depsInstalled = false;
  if (shouldInstall) {
    const installSpinner = ora({ text: "Installing dependencies...", color: "cyan" }).start();
    try {
      installProjectDependencies(targetDir, projectConfig.packageManager);
      installSpinner.succeed(chalk.green("Dependencies installed."));
      depsInstalled = true;
    } catch {
      installSpinner.fail(chalk.red("Failed to install dependencies."));
      console.log(chalk.dim("  You can install them manually later."));
    }
  }

  if (depsInstalled) {
    const commitlintSpinner = ora({ text: "Verifying Commitlint...", color: "cyan" }).start();
    try {
      verifyCommitlintRejectsInvalidMessage(targetDir);
      commitlintSpinner.succeed(chalk.green('Commitlint rejected invalid message "test".'));
    } catch (error) {
      commitlintSpinner.fail(chalk.red("Commitlint verification failed."));
      throw error;
    }
  } else {
    console.log(chalk.dim("  Commitlint verification skipped until dependencies are installed."));
  }

  let shouldStart = false;
  if (depsInstalled && !options.yes && !options.noStart) {
    const answer = await prompts(
      {
        type: "confirm",
        name: "startDev",
        message: "Start development server now?",
        initial: true,
      },
      onCancel
    );
    shouldStart = answer.startDev;
  }

  if (shouldStart) {
    console.log(`\n${chalk.cyan("  Starting development server...")}\n`);
    const dev = getRunScriptCommand(projectConfig.packageManager, "dev");
    const child = spawn(dev.command, dev.args, {
      cwd: targetDir,
      stdio: "inherit",
      shell: false,
    });
    child.on("error", (error) => {
      console.log(chalk.red(`  Failed to start dev server: ${error.message}`));
      showNextSteps(projectName, true, projectConfig.packageManager);
    });
    return;
  }

  console.log(`\n${chalk.green.bold("  Project created successfully!")}`);
  showNextSteps(projectName, depsInstalled, projectConfig.packageManager);
}
