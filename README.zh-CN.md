# create-fsd-architecture

使用完整的
[Feature-Sliced Design](https://feature-sliced.design/) 结构创建前端入门项目。

[![npm version](https://img.shields.io/npm/v/create-fsd-architecture?style=flat-square&logo=npm&label=release)](https://www.npmjs.com/package/create-fsd-architecture)
[![Weekly downloads](https://img.shields.io/npm/dw/create-fsd-architecture?style=flat-square&logo=npm&label=downloads%2Fweek)](https://www.npmjs.com/package/create-fsd-architecture)
[![Total downloads](https://img.shields.io/npm/dt/create-fsd-architecture?style=flat-square&logo=npm&label=total%20downloads)](https://www.npmjs.com/package/create-fsd-architecture)
[![Node.js version](https://img.shields.io/node/v/create-fsd-architecture?style=flat-square&logo=nodedotjs&label=node)](https://www.npmjs.com/package/create-fsd-architecture)

[![Contributors](https://img.shields.io/github/contributors/FSD-CLI/cli?style=flat-square&logo=github)](https://github.com/FSD-CLI/cli/graphs/contributors)
[![Forks](https://img.shields.io/github/forks/FSD-CLI/cli?style=flat-square&logo=github)](https://github.com/FSD-CLI/cli/forks)
[![Stars](https://img.shields.io/github/stars/FSD-CLI/cli?style=flat-square&logo=github)](https://github.com/FSD-CLI/cli/stargazers)
[![Open issues](https://img.shields.io/github/issues/FSD-CLI/cli?style=flat-square&logo=github&label=issues%20open)](https://github.com/FSD-CLI/cli/issues?q=is%3Aissue%20is%3Aopen)
[![Closed issues](https://img.shields.io/github/issues-closed/FSD-CLI/cli?style=flat-square&logo=github&label=issues%20closed)](https://github.com/FSD-CLI/cli/issues?q=is%3Aissue%20is%3Aclosed)
[![License](https://img.shields.io/github/license/FSD-CLI/cli?style=flat-square&label=license)](https://github.com/FSD-CLI/cli/blob/main/LICENSE)

[![CI workflow](https://img.shields.io/github/actions/workflow/status/FSD-CLI/cli/ci.yml?branch=main&style=flat-square&logo=githubactions&label=CI)](https://github.com/FSD-CLI/cli/actions/workflows/ci.yml)
[![Dependency security workflow](https://img.shields.io/github/actions/workflow/status/FSD-CLI/cli/dependency-security.yml?branch=main&style=flat-square&logo=githubactions&label=dependency%20security)](https://github.com/FSD-CLI/cli/actions/workflows/dependency-security.yml)
[![Release workflow](https://img.shields.io/github/actions/workflow/status/FSD-CLI/cli/github-release.yml?style=flat-square&logo=githubactions&label=release%20workflow)](https://github.com/FSD-CLI/cli/actions/workflows/github-release.yml)

- 文档：https://fsdcli.me
- GitHub：https://github.com/FSD-CLI/cli
- English version: [README.md](./README.md)

## 验证范围

生成的项目只是起点。通过 CLI 或模板检查并不意味着应用自身的安全性、身份验证、运行时行为或生产部署得到了认证。请查阅[当前发布状态](docs/RELEASE-STATUS.md)了解已验证的证据和未经测试的组合。

## 仓库文档

Angular 的独立入门项目在 CLI 源码中有可检查的配置契约（`check`、`doctor`、`config`）。Angular 项目创建、切片生成和托管升级均不可用；以下五个稳定模板是受支持的脚手架框架。

- [更新日志](./docs/CHANGELOG.md)
- [安全升级架构](./docs/UPGRADE-ARCHITECTURE.md)
- [公开文档大纲](./docs/PUBLIC-DOCUMENTATION-OUTLINE.md)
- [安全政策](./SECURITY.md)

## 快速开始

```bash
npx create-fsd-architecture@latest my-app
```

或者安装一次并使用简短的 `fsd` 命令（同一个 CLI）：

```bash
npm install -g create-fsd-architecture
fsd create my-app
fsd generate entity product   # 或者：fsd g entity product
fsd check
```

## 🤖 AI Agent Skill (Beta)

教 Codex、Claude Code、Cursor 以及其他兼容 Agent Skills 的编程智能体，如何将自然语言脚手架请求转换为经过验证的 FSD CLI 命令：

```bash
npx skills add FSD-CLI/create-fsd-architecture --skill fsd-cli
```

该 Skill 目前以 `v1.0.0-beta.1` 版本提供。其命令和安装流程已经过验证，但智能体的行为可能因工具和现有项目结构的不同而有所差异。请在提交之前检查生成的更改。

该 Skill 会检查项目，并对受支持的结构性工作使用 CLI，而不是手动重新创建等效的文件夹。例如：

- “创建一个购物车功能。”
- “添加一个商品实体。”
- “创建一个结账页面。”
- “创建一个使用 Feature-Sliced Design 的新 Next.js 项目。”

该 Skill 刻意以执行为导向。方法论请使用官方的
[Feature-Sliced Design 文档](https://feature-sliced.design/)；本工具的真实命令、框架行为、安全规则和已知限制，请使用单独的
[`create-fsd-architecture` Agent Skill 仓库](https://github.com/FSD-CLI/create-fsd-architecture)。

交互式流程会选择框架、API 客户端、服务端状态、客户端状态、表单方案、包管理器、依赖安装，以及是否启动开发服务器。

对于 CI、演示和可重复的本地自动化：

```bash
npx create-fsd-architecture@latest my-app \
  --framework react-vite \
  --yes \
  --no-install \
  --no-start
```

## 命令

```bash
# 显示所有选项
npx create-fsd-architecture@latest --help

# 显示已安装的 CLI 版本
npx create-fsd-architecture@latest --version

# 发现稳定版和计划中的模板
npx create-fsd-architecture@latest --list-templates

# 在现有项目中生成
npx create-fsd-architecture@latest --generate feature auth
npx create-fsd-architecture@latest -g entity product

# 现成的布局组件与共享基础组件（2.7.0）
npx create-fsd-architecture@latest -g widget navbar sidebar footer bottom-bar
npx create-fsd-architecture@latest -g shared ui button input label card
npx create-fsd-architecture@latest -g shared api
npx create-fsd-architecture@latest -g page home about consult

# 预览创建或生成，不写入文件
npx create-fsd-architecture@latest my-app --framework vue-vite --yes --dry-run
npx create-fsd-architecture@latest -g page settings --dry-run

# 检查现有的 FSD 项目
npx create-fsd-architecture@latest check
npx create-fsd-architecture@latest doctor
npx create-fsd-architecture@latest config

# 安全地检查或迁移现有项目中由 CLI 管理的工具
npx create-fsd-architecture@latest upgrade --dry-run
npx create-fsd-architecture@latest upgrade --check
npx create-fsd-architecture@latest upgrade --yes --no-install
```

创建选项：

| 选项 | 用途 |
| --- | --- |
| `-f, --framework <id>` | 跳过框架选择提示 |
| `-y, --yes` | 不经提示直接接受框架默认值；需要提供项目名称和 `--framework` |
| `--package-manager <id>` | 以非交互方式选择 npm、pnpm、Yarn 或 Bun |
| `--package-name <name>` | 独立于文件夹名称设置 npm 包名；该名称必须可以在 npm 上发布 |
| `--api-client <id>` | 选择 Axios 或原生 Fetch |
| `--server-state <id>` | 覆盖框架的服务端状态选择 |
| `--client-state <id>` | 覆盖框架的客户端状态选择 |
| `--forms <id>` | 覆盖框架的表单方案选择 |
| `--no-install` | 不安装依赖 |
| `--no-start` | 不启动开发服务器 |
| `--dry-run` | 打印完整计划而不修改文件 |
| `--force` | 替换已有的目标；如果克隆、配置或安装失败则恢复它 |

## 安全升级

`upgrade` 只演进 CLI 能够证明其所有权的工具。它绝不会重新脚手架整个项目，也绝不会重写功能、实体、组件、页面、组件实现、样式、路由实现、环境文件、密钥、自定义脚本或无关依赖。

```bash
# 查看完整计划。这始终是只读操作。
npx create-fsd-architecture@latest upgrade --dry-run

# CI 状态检查。始终是非交互式且只读的。
npx create-fsd-architecture@latest upgrade --check

# 仅应用无冲突的计划，不进行提示。
npx create-fsd-architecture@latest upgrade --yes

# 应用源码/配置更改，但不安装依赖。
npx create-fsd-architecture@latest upgrade --yes --no-install

# 在明确接受脏 Git 工作树风险后应用。
npx create-fsd-architecture@latest upgrade --allow-dirty
```

该命令会从嵌套目录中找到最近的可靠项目根目录，然后打印选定的根目录、迁移路径、每一个创建/更新/保留/冲突/手动操作，以及验证结果。`--dry-run` 和 `--check` 不会创建备份、清单、日志、锁文件或临时项目文件。

新项目包含 `.fsd/manifest.json`，一份以原子方式写入的所有权清单。它仅记录 CLI 拥有文件的 SHA-256 哈希、标记区域和特定的托管依赖项条目。它不包含任何环境变量值、密钥或 `node_modules` 数据。被修改的受跟踪文件或标记属于冲突，而不是覆盖许可。升级有意不提供 `--force` 或盲目 `--adopt` 模式。

在清单出现之前创建的项目使用保守的旧版模式。CLI 仅接受生成产物、托管依赖项和 Nuxt 标记区域的精确已发布签名。缺失、自定义或不明确的托管路径会报告为 `CONFLICT` 或 `MANUAL`；请在重试之前解决它们。CLI 拥有范围之外的应用代码保持逐字节不变。

默认情况下，在脏 Git 工作树中会拒绝执行应用操作。`--dry-run` 和 `--check` 仍可使用。`--allow-dirty` 会打印警告，并使用内部的受影响路径备份；该命令绝不会重置、暂存、提交、切换分支，或以其他方式更改 Git 状态。也支持没有 Git 的项目。

在写入之前，upgrade 会将每个受影响的常规文件快照到 `.fsd/backups/` 下。写入使用同级临时文件和原子重命名，保留钩子权限，拒绝路径穿越和符号链接的托管路径，并在出错时按相反顺序回滚。失败升级后会保留备份并打印其位置。如果依赖安装失败，源码/配置、清单和锁文件路径会被恢复；请运行所选包管理器的 `install` 命令来恢复 `node_modules`。

`upgrade --check` 的退出码对 CI 保持稳定：

| 代码 | 含义 |
| --- | --- |
| `0` | 项目为最新状态 |
| `2` | 有可用的无冲突升级 |
| `3` | 冲突或手动工作阻止了升级 |
| `4` | 项目状态或配置不受支持或无效 |

首个托管状态版本支持来自已测试的 React + Vite、Next.js、Vue + Vite、Nuxt 和 SvelteKit 技术栈、使用 npm、pnpm、Yarn 或 Bun 的签名完全匹配的干净项目。它会安装所有权清单、加固已验证的旧版 Husky 钩子，并且仅在该路径尚不存在时添加 CLI 拥有的 pnpm 构建策略。目前没有声明任何依赖版本迁移；安装程序仅在未来的迁移更改托管依赖项时运行。确切的兼容性表、恢复指南和扩展规则请参阅[升级架构](./docs/UPGRADE-ARCHITECTURE.md)。

对于 pnpm，请使用 **10.26 或更新版本**（pnpm 11 还需要 Node 22+）。
新的 pnpm 项目会在 `pnpm-workspace.yaml` 中获得针对框架的 `allowBuilds` 列表。只有列出的构建依赖项可以执行脚本；未经审核的脚本会导致安装失败，而不是被默默信任。
已有的模板自带工作区策略会被保留。请使用 `pnpm approve-builds` 审核其他依赖项；不会更改任何全局审批设置。
请参阅 [pnpm 构建设置](https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md#allowbuilds)。

如果安装失败，CLI 会以非零状态退出并回滚目标。要在安装之前查看包管理器策略，请使用 `--no-install` 创建项目，然后在生成的项目内手动运行所选的管理器。

生成器类型：

- `feature`
- `entity`
- `widget`
- `page`

已有的切片受到保护。仅当你确实想替换某个切片时才使用 `--force`。页面生成器还会注册框架原生的路由：React + Vite 使用 React Router，Vue + Vite 使用 Vue Router，Next.js 使用 App Router 路由文件。Nuxt 和 SvelteKit 页面获得基于文件的轻量路由包装，而不会把 FSD 页面切片变成路由目录。

## 模板

| 模板 ID | 框架 | 状态 |
| --- | --- | --- |
| `react-vite` | React + Vite | 稳定 |
| `nextjs` | Next.js App Router | 稳定 |
| `vue-vite` | Vue + Vite | 稳定 |
| `nuxt` | Nuxt 4 | 稳定 |
| `sveltekit` | SvelteKit | 稳定 |

Vue 和 Nuxt 项目通过框架原生模块、Provider 和生成器使用 Pinia、TanStack Vue Query、VeeValidate 和 Zod。Nuxt 默认使用其原生的 `$fetch` 客户端，并为 Vue Query 提供 SSR 注水。

SvelteKit 项目使用 Svelte 5 runes、TanStack Svelte Query、Svelte stores、SvelteKit Superforms 和 Zod 4。它们默认使用原生 Fetch，并使用 `PUBLIC_API_BASE` 进行公开的运行时 API 配置。

## 生成的架构

```text
src/
├── app/          # 应用层配置、Provider、路由与样式
├── pages/        # 路由级组合
├── widgets/      # 大型可复用 UI 块
├── features/     # 用户交互与业务操作
├── entities/     # 业务实体及其表示
└── shared/       # API、资源、配置、工具函数、类型与 UI
```

Nuxt 在其官方 `app/` 源码目录下使用相同的完整分层。它的基于文件的路由包装位于 `app/app/routes`，与 FSD 的 `app/pages` 层分开。

SvelteKit 将各层保留在 `src/` 下，并将 `src/routes` 预留给基于文件的轻量路由包装。由于 SvelteKit 拥有 `$app` 别名，生成的项目对 FSD 应用层使用 `$fsd-app`，其他位置使用 `$pages` 和 `$shared` 等按层划分的别名。

每个层及其核心段从第一天起就存在。文档占位符使空的架构文件夹在 Git 克隆后依然保留。

## 项目配置

所选技术栈会一次性保存在 `fsd.config.json` 中。生成器会自动读取该文件，不会再要求开发者重新选择技术栈。

```json
{
  "$schema": "https://raw.githubusercontent.com/FSD-CLI/cli/main/schema/fsd.config.schema.json",
  "schemaVersion": 1,
  "packageManager": "npm",
  "apiClient": "axios",
  "serverState": "react-query",
  "clientState": "zustand",
  "forms": "react-hook-form-zod",
  "ui": "shared-ui",
  "framework": "react-vite"
}
```

生成 `feature auth` 会同时创建登录、注册、忘记密码、重置密码和验证码流程。使用默认技术栈时，它还会生成类型化的 React Hook Form 组件、Zod schema、React Query mutation，以及所选客户端状态的集成。

### 可选的 Supabase Auth 适配器（候选）

`-g feature auth --auth-provider supabase` 会生成一个官方浏览器 SDK 适配器，包含会话规范化、需要确认的注册和恢复 OTP 处理。这是候选工作，尚未包含在已发布的 npm 2.6.1 中。
请安装 SDK 并使用公开密钥配置浏览器客户端；SSR 授权和 RLS 需要单独的应用集成和后端接入。
请参阅[完整契约](docs/AUTH-SUPABASE-CONTRACT.md)。

## 2.2 中的核心架构

CLI 运行时被划分为稳定的边界：

```text
bin/
├── cli/                  # 参数解析与终端输出
├── commands/             # 面向用户的工作流
├── core/
│   ├── frameworks/       # 运行时专用的适配器
│   ├── capability-matrix.mjs
│   ├── template-registry.mjs
│   ├── package-managers.mjs
│   └── project-lifecycle.mjs
└── generators/           # 可复用的生成器构建块
```

- 模板注册表（Template Registry）是模板身份、仓库和发布状态的唯一事实来源。
- 能力矩阵（Capability Matrix）防止无效的跨框架技术栈组合。
- 框架适配器拥有环境变量和客户端组件行为。
- 项目生命周期（Project Lifecycle）拥有克隆、配置、Git、Husky、Commitlint 和安装行为。
- CLI 入口仅解析和路由命令。

这种划分让 React、Next.js、Vue、Nuxt 和 SvelteKit 共享同一个 CLI 生命周期，同时保留框架原生的 Provider 和生成的组件。

## 环境要求

- CLI 需要 Node.js 22.12.0 或更高版本
- 生成的 Nuxt 和 SvelteKit 项目需要 Node.js 22.22.2 或更高版本

CLI 运行时最低版本、各模板的最低版本以及受支持的包管理器版本均已在[运行时要求](./docs/RUNTIME-REQUIREMENTS.md)中验证。`doctor` 命令会强制执行这些要求，并在本地运行时不匹配时报告确切的所需版本。

## 开发

```bash
npm install
npm test
npm run check
```

## 发布

npm 发布是仅限维护者的手动步骤。推送版本标签会运行发布检查并创建 GitHub Release，但绝不会发布到 npm。

## 许可证

MIT

## 支持 FSD CLI

如果这个项目对你有帮助，你可以选择支持它的开发：

- [GitHub Sponsors](https://github.com/sponsors/ashrafmo-1?frequency=one-time&sponsor=ashrafmo-1)
- [Buy Me a Coffee](https://buymeacoffee.com/ashrafqopiah)
- **InstaPay（埃及）：** `ashrafmo-1`

使用 InstaPay 时，请完全按照所示填写用户名，并在确认转账之前于应用内核对收款人信息。捐赠完全自愿。

## 现有项目与提案

现有应用可以使用官方的[审计与引导式迁移流程](docs/EXISTING-PROJECT-SUPPORT.md)。
CLI 生成器需要经过验证的兼容项目；托管升级仍仅限于 CLI 拥有的文件。未排期的插件提案和迁移研究请参阅[提案决策](docs/PROPOSALS.md)。

## 可复现的模板来源

每个受支持的模板都在 CLI 注册表中绑定到一个完整的提交。创建时会获取该确切对象、验证其 SHA，并将仓库/请求的引用/解析后的提交记录在 `.fsd/template.json` 中。试运行会显示已固定的来源。不允许回退到不断变动的分支。更新模板需要经过审核的注册表更改和新的 CLI 产物；依赖版本范围仍需要各自的锁文件/运行时验证。旧的已生成项目和所有权清单无需这份可选的来源证明文件，依然有效。

### 模板来源验证

在 CLI 仓库中，`npm run smoke:templates` 会两次下载每个已注册的不可变提交，检查记录的来源证明并比较完整的源码字节树。
在发布 CLI 更新之前，请合并其配套的模板 PR 并验证固定提交仍然可用；在 squash/rebase 合并后重新绑定固定提交。
安全/构建检查与来源身份验证是分开的。

## Git 工作流规范

Git 和 Conventional Commits 仍是配置的一部分。提交前检查暂存区和工作树的空白字符；完整构建在 CI 中运行。将 `FSD_PRE_COMMIT_LINT=1` 设置为在提交时运行 lint，或将 `FSD_PRE_PUSH_CHECKS=1` 设置为在推送时运行 lint/构建。
对于有意的紧急绕过，Husky 支持 `HUSKY=0 git commit ...`；CI 仍是必需的质量关卡，失败仍须解决。

自动 PR 和 PR 标签功能是可选的。React 模板在 `.github/optional-workflows/` 中保留了已审核的示例；将选定的文件复制到 `.github/workflows/` 中即可启用。自动 PR 是手动触发的（`workflow_dispatch`），需要仓库权限才能创建 PR。Labeler 需要 `.github/labeler.yml`、标签 `documentation`、`source`、`ci`，以及 Actions 权限来应用标签。
在配置好其权限和标签之前，请勿启用自动化。

## 候选生成器改进

npm 2.6.1 中尚未包含：原生批量切片、带自定义根目录的仅结构段保留，以及通过 Steiger 实现的项目本地 `check --architecture`。
确切的语法、回滚和边界请参阅[生成器工作流](docs/GENERATOR-WORKFLOWS.md)。`--root` 需要 `--segments`；它不会重写框架路由/别名配置。
