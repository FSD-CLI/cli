# create-fsd-architecture

Crie projetos iniciais de frontend com uma estrutura completa de
[Feature-Sliced Design](https://feature-sliced.design/).

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

- Documentação: https://fsdcli.me
- GitHub: https://github.com/FSD-CLI/cli
- English version: [README.md](./README.md)

## Alcance da validação

Os projetos gerados são pontos de partida. A aprovação nas verificações do
CLI ou dos templates não certifica a segurança própria da aplicação, a
autenticação, o comportamento em tempo de execução nem o deploy em produção.
Consulte o [estado atual da versão](docs/RELEASE-STATUS.md) para ver as
evidências e as combinações não testadas.

## Documentação do repositório

O starter standalone do Angular tem um contrato de configuração inspecionável
no código-fonte do CLI (`check`, `doctor`, `config`). A criação de projetos
Angular, a geração de slices e as atualizações gerenciadas não estão
disponíveis; os cinco templates estáveis abaixo são os frameworks de
scaffolding suportados.

- [Changelog](./docs/CHANGELOG.md)
- [Arquitetura de upgrade seguro](./docs/UPGRADE-ARCHITECTURE.md)
- [Esboço da documentação pública](./docs/PUBLIC-DOCUMENTATION-OUTLINE.md)
- [Política de segurança](./SECURITY.md)

## Início rápido

```bash
npx create-fsd-architecture@latest my-app
```

Ou instale uma vez e use o comando curto `fsd` (o mesmo CLI):

```bash
npm install -g create-fsd-architecture
fsd create my-app
fsd generate entity product   # ou: fsd g entity product
fsd check
```

## 🤖 AI Agent Skill (Beta)

Ensine Codex, Claude Code, Cursor e outros agentes de código compatíveis com
Agent Skills a traduzir pedidos de scaffolding em linguagem natural em
comandos verificados do FSD CLI:

```bash
npx skills add FSD-CLI/create-fsd-architecture --skill fsd-cli
```

A skill está disponível atualmente como `v1.0.0-beta.1`. Seus comandos e o
fluxo de instalação são verificados, mas o comportamento do agente pode variar
entre ferramentas e estruturas de projeto existentes. Revise as alterações
geradas antes de fazer commit.

A skill inspeciona o projeto e usa o CLI para o trabalho estrutural suportado,
em vez de recriar manualmente as pastas equivalentes. Por exemplo:

- “Crie uma feature de carrinho.”
- “Adicione uma entity de produto.”
- “Crie uma página de checkout.”
- “Crie um novo projeto Next.js com Feature-Sliced Design.”

A skill é deliberadamente focada em execução. Use a documentação oficial do
[Feature-Sliced Design](https://feature-sliced.design/) para a metodologia;
use o repositório separado da
[`create-fsd-architecture` Agent Skill](https://github.com/FSD-CLI/create-fsd-architecture)
para os comandos reais desta ferramenta, o comportamento dos frameworks, as
regras de segurança e as limitações conhecidas.

O fluxo interativo seleciona o framework, o cliente de API, o estado do
servidor, o estado do cliente, a stack de formulários, o gerenciador de
pacotes, a instalação de dependências e a inicialização opcional do servidor
de desenvolvimento.

Para CI, demonstrações e automação local repetível:

```bash
npx create-fsd-architecture@latest my-app \
  --framework react-vite \
  --yes \
  --no-install \
  --no-start
```

## Comandos

```bash
# Mostra todas as opções
npx create-fsd-architecture@latest --help

# Mostra a versão instalada do CLI
npx create-fsd-architecture@latest --version

# Descubra os templates estáveis e planejados
npx create-fsd-architecture@latest --list-templates

# Gera dentro de um projeto existente
npx create-fsd-architecture@latest --generate feature auth
npx create-fsd-architecture@latest -g entity product

# Widgets de layout prontos e primitivas compartilhadas (2.7.0)
npx create-fsd-architecture@latest -g widget navbar sidebar footer bottom-bar
npx create-fsd-architecture@latest -g shared ui button input label card
npx create-fsd-architecture@latest -g shared api
npx create-fsd-architecture@latest -g page home about consult

# Pré-visualiza a criação ou a geração sem escrever arquivos
npx create-fsd-architecture@latest my-app --framework vue-vite --yes --dry-run
npx create-fsd-architecture@latest -g page settings --dry-run

# Inspeciona um projeto FSD existente
npx create-fsd-architecture@latest check
npx create-fsd-architecture@latest doctor
npx create-fsd-architecture@latest config

# Inspeciona ou migra com segurança as ferramentas próprias do CLI em um projeto existente
npx create-fsd-architecture@latest upgrade --dry-run
npx create-fsd-architecture@latest upgrade --check
npx create-fsd-architecture@latest upgrade --yes --no-install
```

Opções de criação:

| Opção | Finalidade |
| --- | --- |
| `-f, --framework <id>` | Pula o prompt do framework |
| `-y, --yes` | Aceita os padrões do framework sem prompts; exige um nome de projeto e `--framework` |
| `--package-manager <id>` | Seleciona npm, pnpm, Yarn ou Bun de forma não interativa |
| `--package-name <name>` | Define o nome do pacote npm independentemente do nome da pasta; o nome precisa ser publicável no npm |
| `--api-client <id>` | Seleciona Axios ou Fetch nativo |
| `--server-state <id>` | Substitui a escolha de estado do servidor do framework |
| `--client-state <id>` | Substitui a escolha de estado do cliente do framework |
| `--forms <id>` | Substitui a escolha de formulários do framework |
| `--no-install` | Não instala as dependências |
| `--no-start` | Não inicia o servidor de desenvolvimento |
| `--dry-run` | Imprime o plano completo sem alterar arquivos |
| `--force` | Substitui um destino existente; restaura-o se a clonagem, a configuração ou a instalação falhar |

## Atualizações seguras

O `upgrade` evolui apenas as ferramentas que o CLI pode provar que são dele.
Ele nunca recria um projeto do zero e nunca reescreve feature, entity, widget,
page, componente, estilo, implementação de rota, arquivo de ambiente, segredo,
script personalizado ou dependência não relacionada.

```bash
# Inspeciona o plano completo. Sempre é somente leitura.
npx create-fsd-architecture@latest upgrade --dry-run

# Verificação de status para CI. Sempre é não interativa e somente leitura.
npx create-fsd-architecture@latest upgrade --check

# Aplica apenas um plano sem conflitos e sem perguntar.
npx create-fsd-architecture@latest upgrade --yes

# Aplica as alterações de código e configuração sem instalar dependências.
npx create-fsd-architecture@latest upgrade --yes --no-install

# Aplica após aceitar explicitamente o risco de um worktree do Git com alterações não confirmadas.
npx create-fsd-architecture@latest upgrade --allow-dirty
```

O comando localiza a raiz de projeto confiável mais próxima a partir de
diretórios aninhados e, em seguida, imprime a raiz selecionada, o caminho de
migração, cada ação de create/update/preserve/conflict/manual e as validações.
`--dry-run` e `--check` não criam backups, manifestos, logs, lockfiles nem
arquivos temporários de projeto.

Os novos projetos contêm `.fsd/manifest.json`, um manifesto de propriedade
escrito atomicamente. Ele registra hashes SHA-256 apenas para arquivos próprios
do CLI, regiões de marcadores e entradas específicas de dependências
gerenciadas. Não contém valores de ambiente, segredos nem dados de
`node_modules`. Um arquivo ou marcador rastreado que mudou é um conflito, não
uma permissão de sobrescrita. Intencionalmente não existe modo `--force` nem
`--adopt` cego para upgrades.

Os projetos criados antes do manifesto usam o modo legado conservador. O CLI
adota apenas assinaturas exatas lançadas para artefatos gerados, dependências
gerenciadas e regiões de marcadores do Nuxt. Caminhos gerenciados ausentes,
personalizados ou ambíguos são relatados como `CONFLICT` ou `MANUAL`; resolva-os
antes de tentar novamente. O código da aplicação fora das superfícies próprias
do CLI permanece intacto, byte a byte.

Por padrão, uma aplicação é recusada em um worktree do Git com alterações não
confirmadas. `--dry-run` e `--check` continuam disponíveis. `--allow-dirty`
imprime um aviso e usa o backup interno de caminhos afetados; o comando nunca
faz reset, stash, commit, troca de branch nem altera o estado do Git de
nenhuma outra forma. Projetos sem Git são suportados.

Antes das escritas, o upgrade faz um snapshot de cada arquivo regular afetado
em `.fsd/backups/`. As escritas usam arquivos temporários irmãos e renomeação
atômica, preservam as permissões dos hooks, rejeitam travessia de diretórios e
caminhos gerenciados com symlinks, e revertem em ordem inversa em caso de erro.
O backup é mantido após um upgrade com falha e sua localização é impressa. Se
a instalação de dependências falhar, os caminhos de código/configuração,
manifesto e lockfile são restaurados; execute o comando `install` do
gerenciador de pacotes selecionado para restaurar `node_modules`.

Os códigos de saída de `upgrade --check` são estáveis para CI:

| Código | Significado |
| --- | --- |
| `0` | O projeto está atualizado |
| `2` | Um upgrade sem conflitos está disponível |
| `3` | Conflitos ou trabalho manual bloqueiam um upgrade |
| `4` | O estado ou a configuração do projeto não é suportado ou é inválido |

A primeira versão com estado gerenciado suporta projetos limpos com
assinaturas correspondentes das stacks testadas React + Vite, Next.js, Vue +
Vite, Nuxt e SvelteKit, usando npm, pnpm, Yarn ou Bun. Ela instala o manifesto
de propriedade, reforça os hooks legados verificados do Husky e adiciona a
política de build do pnpm própria do CLI apenas quando o caminho ainda não
existe. Nenhuma migração de versão de dependência está declarada atualmente; o
instalador só é executado quando uma migração futura alterar as dependências
gerenciadas. Consulte [a arquitetura de upgrade](./docs/UPGRADE-ARCHITECTURE.md)
para a tabela exata de compatibilidade, as orientações de recuperação e as
regras de extensão.

Para pnpm, use **10.26 ou mais recente** (o pnpm 11 também exige Node 22+).

Os novos projetos pnpm recebem uma lista `allowBuilds` específica do framework
em `pnpm-workspace.yaml`. Apenas as dependências de build listadas podem
executar scripts; scripts não revisados falham na instalação em vez de serem
confiados silenciosamente. Uma política de workspace existente, própria do
template, é preservada. Revise dependências adicionais com
`pnpm approve-builds`; nenhuma configuração global de aprovação é alterada.
Consulte as [configurações de build do pnpm](https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md#allowbuilds).

Se a instalação falhar, o CLI sai com código diferente de zero e reverte o
destino. Para revisar a política do gerenciador de pacotes antes de instalar,
crie com `--no-install` e execute o gerenciador selecionado manualmente dentro
do projeto gerado.

Tipos de gerador:

- `feature`
- `entity`
- `widget`
- `page`

Os slices existentes são protegidos. Use `--force` apenas quando quiser
intencionalmente substituir um slice. Os geradores de páginas também registram
rotas nativas do framework: React Router para React + Vite, Vue Router para
Vue + Vite e arquivos de rota do App Router para Next.js. As páginas Nuxt e
SvelteKit recebem wrappers finos de rota baseados em arquivos, sem transformar
os slices de página FSD em diretórios de rota.

## Templates

| ID do template | Framework | Status |
| --- | --- | --- |
| `react-vite` | React + Vite | Estável |
| `nextjs` | Next.js App Router | Estável |
| `vue-vite` | Vue + Vite | Estável |
| `nuxt` | Nuxt 4 | Estável |
| `sveltekit` | SvelteKit | Estável |

Os projetos Vue e Nuxt usam Pinia, TanStack Vue Query, VeeValidate e Zod por
meio de módulos, providers e geradores nativos do framework. O Nuxt usa por
padrão seu cliente nativo `$fetch` e inclui hidratação SSR para o Vue Query.

Os projetos SvelteKit usam runes do Svelte 5, TanStack Svelte Query, stores do
Svelte, Superforms do SvelteKit e Zod 4. Eles usam Fetch nativo por padrão e
`PUBLIC_API_BASE` para a configuração pública da API em tempo de execução.

## Arquitetura gerada

```text
src/
├── app/          # Configuração do app, providers, roteamento e estilos
├── pages/        # Composições no nível de rota
├── widgets/      # Blocos grandes de UI reutilizáveis
├── features/     # Interações do usuário e ações de negócio
├── entities/     # Entidades de negócio e suas representações
└── shared/       # API, assets, config, utilitários, tipos e UI
```

O Nuxt usa as mesmas camadas completas em seu diretório oficial de
código-fonte `app/`. Seus wrappers de rota baseados em arquivos ficam em
`app/app/routes`, separados da camada `app/pages` do FSD.

O SvelteKit mantém as camadas em `src/` e reserva `src/routes` para wrappers
finos de rota baseados em arquivos. Como o SvelteKit é dono do alias `$app`, os
projetos gerados usam `$fsd-app` para a camada app do FSD e aliases específicos
de camada, como `$pages` e `$shared`, em todo o resto.

Cada camada e seus segmentos principais existem desde o primeiro dia. Os
placeholders de documentação mantêm as pastas arquiteturais vazias presentes
em clones do Git.

## Configuração do projeto

A stack selecionada é salva uma vez em `fsd.config.json`. Os geradores leem
esse arquivo automaticamente e não pedem ao desenvolvedor para escolher a stack
novamente.

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

Gerar `feature auth` cria juntos os fluxos de login, registro, esqueci a senha,
redefinição de senha e código de verificação. Com a stack padrão, também gera
componentes tipados do React Hook Form, schemas Zod, mutations do React Query e
a integração de estado do cliente selecionada.

### Adaptador opt-in do Supabase Auth (candidato)

`-g feature auth --auth-provider supabase` gera um adaptador oficial do SDK de
navegador com normalização de sessão, cadastro com confirmação obrigatória e
tratamento de OTP de recuperação. É um trabalho candidato e não está disponível
no npm 2.6.1 publicado. Instale o SDK e configure um cliente de navegador com
chaves públicas; autorização SSR e RLS precisam de integração separada da
aplicação e aceitação do backend.
Consulte [o contrato completo](docs/AUTH-SUPABASE-CONTRACT.md).

## Arquitetura principal em 2.2

O runtime do CLI é dividido em fronteiras estáveis:

```text
bin/
├── cli/                  # Interpretação de argumentos e saída do terminal
├── commands/             # Fluxos voltados ao usuário
├── core/
│   ├── frameworks/       # Adaptadores específicos do runtime
│   ├── capability-matrix.mjs
│   ├── template-registry.mjs
│   ├── package-managers.mjs
│   └── project-lifecycle.mjs
└── generators/           # Blocos de construção reutilizáveis do gerador
```

- O Template Registry é a única fonte da verdade para identidade, repositório
  e status de lançamento dos templates.
- A Capability Matrix impede combinações inválidas de stack entre frameworks.
- Os Framework Adapters são donos das variáveis de ambiente e do comportamento
  dos componentes de cliente.
- O Project Lifecycle é dono do comportamento de clonagem, configuração, Git,
  Husky, Commitlint e instalação.
- O entrypoint do CLI apenas interpreta e roteia comandos.

Essa separação permite que React, Next.js, Vue, Nuxt e SvelteKit compartilhem
um único ciclo de vida do CLI, mantendo providers nativos do framework e
componentes gerados.

## Requisitos

- Node.js 22.12.0 ou posterior para o CLI
- Node.js 22.22.2 ou posterior para projetos Nuxt e SvelteKit gerados

O piso do runtime do CLI, os pisos por template e as versões suportadas dos
gerenciadores de pacotes são verificados em
[docs/RUNTIME-REQUIREMENTS.md](./docs/RUNTIME-REQUIREMENTS.md). O comando
`doctor` os aplica e informa a versão exata exigida quando o runtime local não
corresponde.

## Desenvolvimento

```bash
npm install
npm test
npm run check
```

## Lançamentos

A publicação no npm é uma etapa manual, apenas para mantenedores. Enviar uma
tag de versão executa as verificações de lançamento e cria um GitHub Release,
mas nunca publica no npm.

## Licença

MIT

## Apoie o FSD CLI

Se este projeto ajuda você, você pode opcionalmente apoiar seu desenvolvimento:

- [GitHub Sponsors](https://github.com/sponsors/ashrafmo-1?frequency=one-time&sponsor=ashrafmo-1)
- [Buy Me a Coffee](https://buymeacoffee.com/ashrafqopiah)
- **InstaPay (Egito):** `ashrafmo-1`

Para InstaPay, use o nome de usuário exatamente como mostrado e verifique os
dados do destinatário no app antes de confirmar uma transferência. As doações
são opcionais.

## Projetos existentes e propostas

As aplicações existentes podem usar o fluxo oficial de [auditoria e migração
guiada](docs/EXISTING-PROJECT-SUPPORT.md).
Os geradores do CLI exigem um projeto compatível verificado; o upgrade
gerenciado continua limitado a arquivos próprios do CLI. Consulte as [decisões
de propostas](docs/PROPOSALS.md) para as propostas não agendadas de add/plugin
e a pesquisa de migração.

## Fontes reproduzíveis de templates

Cada template suportado está vinculado a um commit completo no registro do CLI.
A criação busca esse objeto exato, verifica seu SHA e registra
repositório/ref solicitada/commit resolvido em `.fsd/template.json`. Dry-runs
mostram a fonte fixada. Nenhum fallback para uma branch móvel é permitido.
Atualizar um template exige uma alteração revisada do registro e um novo
artefato do CLI; intervalos de versão de dependências ainda precisam de sua
própria verificação de lockfile/runtime. Projetos gerados antigos e manifestos
de propriedade continuam válidos sem esse arquivo opcional de procedência.

### Verificação da fonte dos templates

A partir do repositório do CLI, `npm run smoke:templates` baixa cada commit
imutável registrado duas vezes, verifica a procedência registrada e compara a
árvore completa de bytes do código-fonte. Antes de lançar uma atualização do
CLI, faça merge de seus PRs companheiros de template e verifique se os commits
fixados continuam disponíveis; vincule novamente os pins após merges
squash/rebase. As verificações de segurança/build são separadas da verificação
de identidade da fonte.

## Política de fluxo de trabalho com Git

Git e Conventional Commits continuam parte da configuração. O pre-commit
verifica espaços em branco do staged e do worktree; builds completos rodam no
CI. Defina `FSD_PRE_COMMIT_LINT=1` para rodar lint no commit ou
`FSD_PRE_PUSH_CHECKS=1` para rodar lint/build no push. Para um bypass
intencional de emergência, o Husky suporta `HUSKY=0 git commit ...`; o CI
continua sendo o portão de qualidade obrigatório e as falhas ainda precisam ser
resolvidas.

Auto-PR e rotulagem de PR são opcionais. O template React mantém exemplos
revisados em `.github/optional-workflows/`; copie um arquivo escolhido para
`.github/workflows/` para habilitá-lo. O Auto-PR é manual
(`workflow_dispatch`) e precisa de permissão no repositório para criar PRs. O
Labeler precisa de `.github/labeler.yml`, dos labels `documentation`,
`source`, `ci` e de permissão do Actions para aplicar labels. Não habilite a
automação antes de configurar suas permissões e labels.

## Melhorias candidatas do gerador

Não está no npm 2.6.1: slices em lote nativos, preservação de segmentos apenas
estruturais com roots personalizados e `check --architecture` local do projeto
via Steiger. Consulte os [fluxos de trabalho do gerador](docs/GENERATOR-WORKFLOWS.md)
para a sintaxe exata, rollback e limites. `--root` exige `--segments`; ele não
reescreve a configuração de rota/alias do framework.
