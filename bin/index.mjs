import degit from "degit";
import prompts from "prompts";
import chalk from "chalk";
import ora from "ora";
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";

const TEMPLATES = [
  {
    title: "React + Vite",
    value: "react-vite",
    description: "React with Vite and FSD architecture",
    repo: "FSD-architectures/FSD",
    available: true,
  },
  {
    title: "Next.js",
    value: "nextjs",
    description: "Next.js — Full-stack React framework with SSR, SSG, and App Router.",
    repo: "ashrafmo-1/FSD-NEXTJS",
    available: true,
  },
];

function showBanner() {
  const banner = `
  ███████╗ ███████╗ ██████╗ 
  ██╔════╝ ██╔════╝ ██╔══██╗
  █████╗   ███████╗ ██║  ██║
  ██╔══╝   ╚════██║ ██║  ██║
  ██║      ███████║ ██████╔╝
  ╚═╝      ╚══════╝ ╚═════╝ 

  Feature-Sliced Design Scaffolding  
  `;
  
  console.log(chalk.cyanBright(banner));
}

function showNextSteps(projectName, depsInstalled) {
  console.log();
  console.log(chalk.bold.white("  Next steps:"));
  console.log();
  console.log(`    ${chalk.cyan("$")} cd ${projectName}`);
  if (!depsInstalled) {
    console.log(`    ${chalk.cyan("$")} npm install`);
  }
  console.log(`    ${chalk.cyan("$")} npm run dev`);
  console.log();
}

function handleCancel() {
  console.log();
  console.log(chalk.yellow("  Cancelled."));
  console.log();
  process.exit(0);
}

const onCancel = { onCancel: handleCancel };

async function main() {
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
      execSync("npm install", { cwd: targetDir, stdio: "pipe" });
      installSpinner.succeed(chalk.green("Dependencies installed."));
      depsInstalled = true;
    } catch (err) {
      installSpinner.fail(chalk.red("Failed to install dependencies."));
      console.log(chalk.dim("  You can install them manually later."));
    }
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

      const child = spawn("npm", ["run", "dev"], {
        cwd: targetDir,
        stdio: "inherit",
        shell: true,
      });

      child.on("error", (err) => {
        console.log(chalk.red(`  Failed to start dev server: ${err.message}`));
        showNextSteps(projectName, true);
      });

      return;
    }
  }

  console.log();
  console.log(chalk.green.bold("  Project created successfully!"));
  showNextSteps(projectName, depsInstalled);
}

main().catch((err) => {
  console.error(chalk.red(`  Error: ${err.message}`));
  process.exit(1);
});
