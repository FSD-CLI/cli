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
  create-fsd-architecture --generate <type> <name> [--force]

Commands:
  -g, --generate <type> <name>  Generate an FSD slice in the current project
      --list-templates          Show stable and planned framework templates

Create options:
  -f, --framework <id>          Select a framework without the template prompt
  -y, --yes                     Accept defaults and skip interactive prompts
      --no-install              Create the project without installing packages
      --no-start                Do not start the development server

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
