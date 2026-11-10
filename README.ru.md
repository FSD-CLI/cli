# create-fsd-architecture

Создавайте стартовые проекты фронтенда с полной структурой
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

- Документация: https://fsdcli.me
- GitHub: https://github.com/FSD-CLI/cli
- English version: [README.md](./README.md)

## Область проверки

Сгенерированные проекты — это стартовые заготовки. Прохождение проверок CLI
или шаблонов не подтверждает безопасность конкретного приложения,
аутентификацию, поведение во время выполнения или готовность к
продакшен-развёртыванию. Актуальные данные о проверенных комбинациях смотрите
в документе [о текущем статусе релиза](docs/RELEASE-STATUS.md).

## Документация репозитория

У автономного стартера Angular есть проверяемый контракт конфигурации в
исходном коде CLI (`check`, `doctor`, `config`). Создание проектов Angular,
генерация срезов и управляемые обновления недоступны; пять стабильных шаблонов
ниже — это поддерживаемые фреймворки для скаффолдинга.

- [Журнал изменений](./docs/CHANGELOG.md)
- [Архитектура безопасного обновления](./docs/UPGRADE-ARCHITECTURE.md)
- [План публичной документации](./docs/PUBLIC-DOCUMENTATION-OUTLINE.md)
- [Политика безопасности](./SECURITY.md)

## Быстрый старт

```bash
npx create-fsd-architecture@latest my-app
```

Или установите один раз и используйте короткую команду `fsd` (тот же CLI):

```bash
npm install -g create-fsd-architecture
fsd create my-app
fsd generate entity product   # или: fsd g entity product
fsd check
```

## 🤖 Навык для ИИ-агентов (бета)

Научите Codex, Claude Code, Cursor и других ИИ-агентов, совместимых с
Agent Skills, переводить запросы на естественном языке о скаффолдинге в
проверенные команды FSD CLI:

```bash
npx skills add FSD-CLI/create-fsd-architecture --skill fsd-cli
```

Сейчас навык доступен в версии `v1.0.0-beta.1`. Его команды и процесс установки
проверены, но поведение агентов может различаться в зависимости от инструментов
и существующей структуры проекта. Проверяйте сгенерированные изменения перед
коммитом.

Навык изучает проект и использует CLI для поддерживаемых структурных работ,
вместо того чтобы вручную воссоздавать эквивалентные папки. Например:

- «Создай фичу корзины.»
- «Добавь сущность товара.»
- «Создай страницу оформления заказа.»
- «Создай новый проект Next.js с Feature-Sliced Design.»

Навык намеренно ориентирован на выполнение. Для методологии используйте
официальную
[документацию Feature-Sliced Design](https://feature-sliced.design/); для
реальных команд, поведения фреймворков, правил безопасности и известных
ограничений этого инструмента используйте отдельный
[репозиторий навыка `create-fsd-architecture` для агентов](https://github.com/FSD-CLI/create-fsd-architecture).

Интерактивный мастер выбирает фреймворк, API-клиент, серверное состояние,
клиентское состояние, стек форм, пакетный менеджер, установку зависимостей и
необязательный запуск dev-сервера.

Для CI, демо и повторяемой локальной автоматизации:

```bash
npx create-fsd-architecture@latest my-app \
  --framework react-vite \
  --yes \
  --no-install \
  --no-start
```

## Команды

```bash
# Показать все опции
npx create-fsd-architecture@latest --help

# Показать установленную версию CLI
npx create-fsd-architecture@latest --version

# Узнать о стабильных и планируемых шаблонах
npx create-fsd-architecture@latest --list-templates

# Генерация внутри существующего проекта
npx create-fsd-architecture@latest --generate feature auth
npx create-fsd-architecture@latest -g entity product

# Готовые виджеты раскладки и общие примитивы (2.7.0)
npx create-fsd-architecture@latest -g widget navbar sidebar footer bottom-bar
npx create-fsd-architecture@latest -g shared ui button input label card
npx create-fsd-architecture@latest -g shared api
npx create-fsd-architecture@latest -g page home about consult

# Предпросмотр создания или генерации без записи файлов
npx create-fsd-architecture@latest my-app --framework vue-vite --yes --dry-run
npx create-fsd-architecture@latest -g page settings --dry-run

# Проверка существующего FSD-проекта
npx create-fsd-architecture@latest check
npx create-fsd-architecture@latest doctor
npx create-fsd-architecture@latest config

# Безопасная проверка или миграция инструментов CLI в существующем проекте
npx create-fsd-architecture@latest upgrade --dry-run
npx create-fsd-architecture@latest upgrade --check
npx create-fsd-architecture@latest upgrade --yes --no-install
```

Опции создания:

| Опция | Назначение |
| --- | --- |
| `-f, --framework <id>` | Пропустить вопрос о фреймворке |
| `-y, --yes` | Принять настройки фреймворка по умолчанию без вопросов; требует имя проекта и `--framework` |
| `--package-manager <id>` | Выбрать npm, pnpm, Yarn или Bun неинтерактивно |
| `--package-name <name>` | Задать имя npm-пакета независимо от имени папки; имя должно быть публикуемым в npm |
| `--api-client <id>` | Выбрать Axios или нативный Fetch |
| `--server-state <id>` | Переопределить выбор серверного состояния для фреймворка |
| `--client-state <id>` | Переопределить выбор клиентского состояния для фреймворка |
| `--forms <id>` | Переопределить выбор стека форм для фреймворка |
| `--no-install` | Не устанавливать зависимости |
| `--no-start` | Не запускать dev-сервер |
| `--dry-run` | Вывести полный план без изменения файлов |
| `--force` | Заменить существующую цель; восстановить её, если клонирование, настройка или установка завершатся ошибкой |

## Безопасные обновления

Команда `upgrade` развивает только те инструменты, владение которыми CLI
может доказать. Она никогда не пересоздаёт проект с нуля и никогда не
переписывает фичи, сущности, виджеты, страницы, компоненты, стили, реализацию
маршрутов, файлы окружения, секреты, пользовательские скрипты или несвязанные
зависимости.

```bash
# Просмотреть полный план. Всегда только для чтения.
npx create-fsd-architecture@latest upgrade --dry-run

# Проверка статуса для CI. Всегда неинтерактивна и только для чтения.
npx create-fsd-architecture@latest upgrade --check

# Применить только план без конфликтов, без вопросов.
npx create-fsd-architecture@latest upgrade --yes

# Применить изменения исходников и конфигурации без установки зависимостей.
npx create-fsd-architecture@latest upgrade --yes --no-install

# Применить, явно приняв риск грязного Git-дерева.
npx create-fsd-architecture@latest upgrade --allow-dirty
```

Команда находит ближайший надёжный корень проекта из вложенных директорий,
затем выводит выбранный корень, путь миграции, каждое действие
создания/обновления/сохранения/конфликта/ручной работы и проверки.
`--dry-run` и `--check` не создают резервные копии, манифесты, журналы,
лок-файлы или временные файлы проекта.

Новые проекты содержат `.fsd/manifest.json` — атомарно записываемый манифест
владения. В нём записаны только SHA-256-хэши файлов, принадлежащих CLI,
регионов-маркеров и отдельных управляемых записей зависимостей. В нём нет
значений окружения, секретов или данных `node_modules`. Изменённый
отслеживаемый файл или маркер — это конфликт, а не разрешение на перезапись.
Режимов `--force` или слепого `--adopt` для обновлений намеренно нет.

Проекты, созданные до появления манифеста, используют консервативный
legacy-режим. CLI принимает только точные сигнатуры выпущенных версий для
сгенерированных артефактов, управляемых зависимостей и маркерных регионов
Nuxt. Отсутствующие, изменённые или неоднозначные управляемые пути
сообщаются как `CONFLICT` или `MANUAL`; устраните их перед повторной
попыткой. Код приложения вне поверхностей, принадлежащих CLI, остаётся
нетронутым байт в байт.

По умолчанию применение запрещено в грязном Git-дереве. `--dry-run` и
`--check` остаются доступными. `--allow-dirty` выводит предупреждение и
использует внутреннюю резервную копию затронутых путей; команда никогда не
сбрасывает, не прячет в stash, не коммитит, не переключает ветки и никак иначе
не меняет состояние Git. Проекты без Git поддерживаются.

Перед записью upgrade делает снимок каждого затронутого обычного файла в
`.fsd/backups/`. Записи используют соседние временные файлы и атомарное
переименование, сохраняют права хуков, отклоняют обход путей и управляемые
пути-симлинки, а при ошибке откатываются в обратном порядке. Резервная копия
сохраняется после неудачного обновления, и её расположение выводится.
Если установка зависимостей завершилась ошибкой, пути исходников, конфигурации,
манифеста и лок-файла восстанавливаются; выполните команду `install`
выбранного пакетного менеджера, чтобы восстановить `node_modules`.

Коды выхода `upgrade --check` стабильны для CI:

| Код | Значение |
| --- | --- |
| `0` | Проект актуален |
| `2` | Доступно обновление без конфликтов |
| `3` | Конфликты или ручная работа блокируют обновление |
| `4` | Состояние проекта или конфигурация не поддерживаются или недействительны |

Первый релиз с управляемым состоянием поддерживает проекты с чистым
совпадением сигнатур из протестированных стеков React + Vite, Next.js,
Vue + Vite, Nuxt и SvelteKit с npm, pnpm, Yarn или Bun. Он устанавливает
манифест владения, усиливает проверенные legacy-хуки Husky и добавляет
CLI-политики сборки pnpm только там, где такой путь ещё не существует.
Миграций версий зависимостей сейчас не объявлено; установщик запускается
только когда будущее изменение затронет управляемые зависимости.
Точную таблицу совместимости, рекомендации по восстановлению и правила
расширения смотрите в
[архитектуре обновления](./docs/UPGRADE-ARCHITECTURE.md).

Для pnpm используйте версию **10.26 или новее** (pnpm 11 также требует Node 22+).
Новые проекты pnpm получают фреймворк-специфичный список `allowBuilds` в
`pnpm-workspace.yaml`. Выполнять скрипты могут только перечисленные зависимости
сборки; непроверенные скрипты приводят к ошибке установки, а не к молчаливому
доверию. Существующая политика рабочего пространства, принадлежащая шаблону,
сохраняется. Проверяйте дополнительные зависимости командой
`pnpm approve-builds`; глобальные настройки одобрения не меняются.
Подробнее — [настройки сборки pnpm](https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md#allowbuilds).

Если установка завершается ошибкой, CLI выходит с ненулевым кодом и
откатывает цель. Чтобы проверить политику пакетного менеджера до установки,
создайте проект с `--no-install`, а затем запустите выбранный менеджер
вручную внутри сгенерированного проекта.

Типы генераторов:

- `feature`
- `entity`
- `widget`
- `page`

Существующие срезы защищены. Используйте `--force`, только если намеренно
хотите заменить срез. Генераторы страниц также регистрируют нативные для
фреймворка маршруты: React Router для React + Vite, Vue Router для Vue +
Vite и файлы маршрутов App Router для Next.js. Страницы Nuxt и SvelteKit
получают тонкие обёртки маршрутов на основе файлов, не превращая срезы
страниц FSD в каталоги маршрутов.

## Шаблоны

| ID шаблона | Фреймворк | Статус |
| --- | --- | --- |
| `react-vite` | React + Vite | Стабильный |
| `nextjs` | Next.js App Router | Стабильный |
| `vue-vite` | Vue + Vite | Стабильный |
| `nuxt` | Nuxt 4 | Стабильный |
| `sveltekit` | SvelteKit | Стабильный |

Проекты Vue и Nuxt используют Pinia, TanStack Vue Query, VeeValidate и Zod
через нативные для фреймворка модули, провайдеры и генераторы. Nuxt по
умолчанию использует нативный клиент `$fetch` и включает SSR-гидрацию для
Vue Query.

Проекты SvelteKit используют руны Svelte 5, TanStack Svelte Query, сторы
Svelte, Superforms для SvelteKit и Zod 4. По умолчанию они используют
нативный Fetch и `PUBLIC_API_BASE` для публичной конфигурации API во время
выполнения.

## Сгенерированная архитектура

```text
src/
├── app/          # Настройка уровня приложения, провайдеры, маршрутизация и стили
├── pages/        # Композиции уровня маршрутов
├── widgets/      # Крупные переиспользуемые блоки интерфейса
├── features/     # Взаимодействия пользователя и бизнес-действия
├── entities/     # Бизнес-сущности и их представления
└── shared/       # API, ассеты, конфигурация, утилиты, типы и UI
```

Nuxt использует те же полные слои в своём официальном каталоге исходников
`app/`. Его файловые обёртки маршрутов находятся в `app/app/routes`, отдельно
от слоя `app/pages` в FSD.

SvelteKit хранит слои в `src/` и резервирует `src/routes` для тонких файловых
обёрток маршрутов. Поскольку SvelteKit владеет алиасом `$app`, сгенерированные
проекты используют `$fsd-app` для слоя app в FSD и алиасы по слоям, такие как
`$pages` и `$shared`, во всех остальных местах.

Каждый слой и его основные сегменты существуют с первого дня. Плейсхолдеры
документации сохраняют пустые архитектурные папки при клонировании из Git.

## Конфигурация проекта

Выбранный стек один раз сохраняется в `fsd.config.json`. Генераторы читают
этот файл автоматически и больше не просят разработчика снова выбирать стек.

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

Генерация `feature auth` создаёт вместе потоки входа, регистрации, восстановления
пароля, сброса пароля и кода подтверждения. Со стеком по умолчанию она также
генерирует типизированные компоненты React Hook Form, схемы Zod, мутации
React Query и интеграцию с выбранным клиентским состоянием.

### Опциональный адаптер Supabase Auth (кандидат)

Команда `-g feature auth --auth-provider supabase` генерирует адаптер
официального браузерного SDK с нормализацией сессии, регистрацией с
обязательным подтверждением и обработкой OTP для восстановления. Это
кандидатская работа, она недоступна в опубликованном npm 2.6.1.
Установите SDK и настройте браузерный клиент с публичными ключами;
SSR-авторизация и RLS требуют отдельной интеграции приложения и бэкенда.
Полный контракт смотрите в документе
[о контракте Supabase Auth](docs/AUTH-SUPABASE-CONTRACT.md).

## Основная архитектура в 2.2

Рантайм CLI разделён на стабильные границы:

```text
bin/
├── cli/                  # Разбор аргументов и вывод в терминал
├── commands/             # Пользовательские сценарии
├── core/
│   ├── frameworks/       # Адаптеры для конкретных рантаймов
│   ├── capability-matrix.mjs
│   ├── template-registry.mjs
│   ├── package-managers.mjs
│   └── project-lifecycle.mjs
└── generators/           # Переиспользуемые строительные блоки генераторов
```

- Реестр шаблонов (Template Registry) — единственный источник истины для
  идентичности шаблона, репозитория и статуса релиза.
- Матрица возможностей (Capability Matrix) предотвращает недопустимые
  межфреймворковые комбинации стеков.
- Адаптеры фреймворков владеют переменными окружения и поведением
  клиентских компонентов.
- Жизненный цикл проекта (Project Lifecycle) владеет клонированием,
  конфигурацией, Git, Husky, Commitlint и поведением установки.
- Точка входа CLI только разбирает и маршрутизирует команды.

Это разделение позволяет React, Next.js, Vue, Nuxt и SvelteKit использовать
один жизненный цикл CLI, сохраняя при этом нативные для фреймворка провайдеры
и сгенерированные компоненты.

## Требования

- Node.js 22.12.0 или новее для CLI
- Node.js 22.22.2 или новее для сгенерированных проектов Nuxt и SvelteKit

Минимальные версии рантайма CLI, минимальные версии для каждого шаблона и
поддерживаемые версии пакетных менеджеров проверены в документе
[о требованиях рантайма](./docs/RUNTIME-REQUIREMENTS.md). Команда `doctor`
обеспечивает их соблюдение и сообщает точную требуемую версию, когда локальный
рантайм не соответствует.

## Разработка

```bash
npm install
npm test
npm run check
```

## Релизы

Публикация в npm — это ручной шаг, доступный только мейнтейнерам. Отправка
тега версии запускает проверки релиза и создаёт GitHub Release, но никогда
не публикует пакет в npm.

## Лицензия

MIT

## Поддержать FSD CLI

Если этот проект вам помогает, вы можете опционально поддержать его разработку:

- [GitHub Sponsors](https://github.com/sponsors/ashrafmo-1?frequency=one-time&sponsor=ashrafmo-1)
- [Buy Me a Coffee](https://buymeacoffee.com/ashrafqopiah)
- **InstaPay (Египет):** `ashrafmo-1`

Для InstaPay используйте имя пользователя точно как показано и проверьте
данные получателя в приложении перед подтверждением перевода. Пожертвования
необязательны.

## Существующие проекты и предложения

Существующие приложения могут использовать официальный
[сценарий аудита и управляемой миграции](docs/EXISTING-PROJECT-SUPPORT.md).
Генераторы CLI требуют проверенного совместимого проекта; управляемое
обновление остаётся ограниченным файлами, принадлежащими CLI. Незапланированные
предложения о плагинах и исследования миграции смотрите в
[решениях по предложениям](docs/PROPOSALS.md).

## Воспроизводимые источники шаблонов

Каждый поддерживаемый шаблон привязан к полному коммиту в реестре CLI.
Создание скачивает именно этот объект, проверяет его SHA и записывает
репозиторий, запрошенную ссылку и разрешённый коммит в
`.fsd/template.json`. Пробные запуски показывают закреплённый источник.
Возврат к движущейся ветке запрещён. Обновление шаблона требует
проверенного изменения реестра и нового артефакта CLI; диапазоны версий
зависимостей по-прежнему нуждаются в собственной проверке лок-файла и
рантайма. Старые сгенерированные проекты и манифесты владения остаются
действительными без этого необязательного файла провенанса.

### Проверка источников шаблонов

Из репозитория CLI команда `npm run smoke:templates` скачивает каждый
зарегистрированный неизменяемый коммит дважды, проверяет записанный
провенанс и сравнивает полное байтовое дерево исходников.
Перед выпуском обновления CLI объедините сопутствующие PR шаблонов и
убедитесь, что закреплённые коммиты остаются доступными; перепривязывайте
закрепления после squash/rebase-слияний.
Проверки безопасности и сборки отделены от проверки идентичности источника.

## Политика работы с Git

Git и Conventional Commits остаются частью настройки. Pre-commit-проверки
охватывают staged-пробелы и пробелы в рабочем дереве; полные сборки
выполняются в CI. Установите `FSD_PRE_COMMIT_LINT=1`, чтобы запускать линт
при коммите, или `FSD_PRE_PUSH_CHECKS=1`, чтобы запускать линт и сборку при
пуше. Для намеренного экстренного обхода Husky поддерживает
`HUSKY=0 git commit ...`; CI остаётся обязательным контролем качества, и
сбои всё равно должны быть устранены.

Авто-PR и маркировка PR необязательны. Шаблон React хранит проверенные
примеры в `.github/optional-workflows/`; скопируйте выбранный файл в
`.github/workflows/`, чтобы включить его. Авто-PR выполняется вручную
(`workflow_dispatch`) и требует прав репозитория на создание PR. Для
маркировщика нужны `.github/labeler.yml`, метки `documentation`, `source`,
`ci` и права Actions на применение меток.
Не включайте автоматизацию до настройки её прав и меток.

## Кандидатские улучшения генераторов

Нет в npm 2.6.1: нативные пакетные срезы, сохранение сегментов только со
структурой при пользовательских корнях и локальная проверка проекта
`check --architecture` через Steiger.
Точный синтаксис, откат и границы смотрите в документе о
[рабочих процессах генераторов](docs/GENERATOR-WORKFLOWS.md). Флаг `--root`
требует `--segments`; он не переписывает конфигурацию маршрутов и алиасов
фреймворка.
