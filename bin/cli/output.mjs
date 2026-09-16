import chalk from "chalk";

export function showBanner() {
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
│   app → pages → widgets → features → entities → shared                     │
│                                                                             │
│   Scalable • Maintainable • Enterprise Frontend Architecture                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘`;
  console.log(chalk.cyanBright(banner));
}

export function showHelp(version) {
  console.log(`create-fsd-architecture v${version}

Usage:
  create-fsd-architecture [project-name] [options]
  create-fsd-architecture --generate <type> <name> [--force] [--dry-run]
  create-fsd-architecture <check|doctor|config>

Commands:
  -g, --generate <type> <name>  Generate an FSD slice in the current project
      --list-templates          Show stable and planned framework templates
      check                     Validate the current FSD project
      doctor                    Diagnose the local project and toolchain
      config                    Print the resolved FSD configuration

Create options:
  -f, --framework <id>          Select a framework without the template prompt
  -y, --yes                     Accept defaults and skip interactive prompts
      --package-manager <id>    Select npm, pnpm, yarn, or bun
      --api-client <id>         Select axios or fetch
      --server-state <id>       Override the framework server-state default
      --client-state <id>       Override the framework client-state default
      --forms <id>              Override the framework forms default
      --no-install              Create the project without installing packages
      --no-start                Do not start the development server
      --dry-run                 Preview every planned change without writing files
      --force                   Replace an existing target with automatic rollback

Global options:
  -h, --help                    Show this help
  -v, --version                 Show the installed CLI version

Examples:
  npx create-fsd-architecture my-app
  npx create-fsd-architecture my-app --framework react-vite --yes --no-install
  npx create-fsd-architecture --generate feature auth`);
}

export function showTemplateList(templates) {
  console.log("Framework templates:\n");
  for (const template of templates) {
    const status = template.available ? chalk.green("stable") : chalk.yellow("planned");
    console.log(`  ${template.value.padEnd(14)} ${status.padEnd(17)} ${template.title}`);
  }
}
