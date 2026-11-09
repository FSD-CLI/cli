# create-fsd-architecture

Crea proyectos iniciales de frontend con una estructura completa de
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

- Documentación: https://fsdcli.me
- GitHub: https://github.com/FSD-CLI/cli
- English version: [README.md](./README.md)

## Alcance de la validación

Los proyectos generados son puntos de partida. Que el CLI o las comprobaciones de las plantillas pasen no certifica la seguridad propia de la aplicación, la autenticación, el comportamiento en tiempo de ejecución ni el despliegue en producción. Consulta el [estado actual de la versión](docs/RELEASE-STATUS.md) para ver la evidencia y las combinaciones sin probar.

## Documentación del repositorio

La plantilla independiente de Angular tiene un contrato de configuración inspeccionable en el código fuente del CLI (`check`, `doctor`, `config`). La creación de proyectos Angular, la generación de slices y las actualizaciones gestionadas no están disponibles; las cinco plantillas estables siguientes son los frameworks admitidos para crear proyectos.

- [Registro de cambios](./docs/CHANGELOG.md)
- [Arquitectura de actualizaciones seguras](./docs/UPGRADE-ARCHITECTURE.md)
- [Esquema de la documentación pública](./docs/PUBLIC-DOCUMENTATION-OUTLINE.md)
- [Política de seguridad](./SECURITY.md)

## Inicio rápido

```bash
npx create-fsd-architecture@latest my-app
```

O instálalo una vez y usa el comando corto `fsd` (el mismo CLI):

```bash
npm install -g create-fsd-architecture
fsd create my-app
fsd generate entity product   # o: fsd g entity product
fsd check
```

## 🤖 AI Agent Skill (Beta)

Enseña a Codex, Claude Code, Cursor y otros agentes de código compatibles con Agent Skills a traducir las peticiones de creación de proyectos en lenguaje natural a comandos verificados de FSD CLI:

```bash
npx skills add FSD-CLI/create-fsd-architecture --skill fsd-cli
```

El skill está disponible actualmente como `v1.0.0-beta.1`. Sus comandos y su flujo de instalación están verificados, pero el comportamiento del agente puede variar según las herramientas y las estructuras de proyecto existentes. Revisa los cambios generados antes de confirmarlos.

El skill inspecciona el proyecto y usa el CLI para el trabajo estructural admitido en lugar de recrear manualmente carpetas equivalentes. Por ejemplo:

- «Crea una funcionalidad de carrito».
- «Añade una entidad de producto».
- «Crea una página de pago».
- «Crea un nuevo proyecto Next.js con Feature-Sliced Design».

El skill está deliberadamente orientado a la ejecución. Usa la [documentación oficial de Feature-Sliced Design](https://feature-sliced.design/) para la metodología; usa el [repositorio independiente de la Agent Skill de `create-fsd-architecture`](https://github.com/FSD-CLI/create-fsd-architecture) para los comandos reales de esta herramienta, el comportamiento de los frameworks, las reglas de seguridad y las limitaciones conocidas.

El flujo interactivo selecciona el framework, el cliente de API, el estado del servidor, el estado del cliente, la pila de formularios, el gestor de paquetes, la instalación de dependencias y el inicio opcional del servidor de desarrollo.

Para CI, demostraciones y automatización local repetible:

```bash
npx create-fsd-architecture@latest my-app \
  --framework react-vite \
  --yes \
  --no-install \
  --no-start
```

## Comandos

```bash
# Muestra todas las opciones
npx create-fsd-architecture@latest --help

# Muestra la versión instalada del CLI
npx create-fsd-architecture@latest --version

# Descubre las plantillas estables y planificadas
npx create-fsd-architecture@latest --list-templates

# Genera dentro de un proyecto existente
npx create-fsd-architecture@latest --generate feature auth
npx create-fsd-architecture@latest -g entity product

# Widgets de diseño listos para usar y primitivas compartidas (2.7.0)
npx create-fsd-architecture@latest -g widget navbar sidebar footer bottom-bar
npx create-fsd-architecture@latest -g shared ui button input label card
npx create-fsd-architecture@latest -g shared api
npx create-fsd-architecture@latest -g page home about consult

# Previsualiza la creación o la generación sin escribir archivos
npx create-fsd-architecture@latest my-app --framework vue-vite --yes --dry-run
npx create-fsd-architecture@latest -g page settings --dry-run

# Inspecciona un proyecto FSD existente
npx create-fsd-architecture@latest check
npx create-fsd-architecture@latest doctor
npx create-fsd-architecture@latest config

# Inspecciona o migra de forma segura las herramientas propias del CLI en un proyecto existente
npx create-fsd-architecture@latest upgrade --dry-run
npx create-fsd-architecture@latest upgrade --check
npx create-fsd-architecture@latest upgrade --yes --no-install
```

Opciones de creación:

| Opción | Propósito |
| --- | --- |
| `-f, --framework <id>` | Omite la pregunta del framework |
| `-y, --yes` | Acepta los valores predeterminados del framework sin preguntas; requiere un nombre de proyecto y `--framework` |
| `--package-manager <id>` | Selecciona npm, pnpm, Yarn o Bun de forma no interactiva |
| `--package-name <name>` | Establece el nombre del paquete npm independientemente del nombre de la carpeta; el nombre debe poder publicarse en npm |
| `--api-client <id>` | Selecciona Axios o Fetch nativo |
| `--server-state <id>` | Anula la elección de estado del servidor del framework |
| `--client-state <id>` | Anula la elección de estado del cliente del framework |
| `--forms <id>` | Anula la elección de formularios del framework |
| `--no-install` | No instala dependencias |
| `--no-start` | No inicia el servidor de desarrollo |
| `--dry-run` | Imprime el plan completo sin cambiar archivos |
| `--force` | Reemplaza un destino existente; lo restaura si la clonación, la configuración o la instalación fallan |

## Actualizaciones seguras

`upgrade` solo hace evolucionar las herramientas que el CLI puede demostrar que son suyas. Nunca vuelve a generar un proyecto desde cero ni reescribe funcionalidades, entidades, widgets, páginas, componentes, estilos, implementaciones de rutas, archivos de entorno, secretos, scripts personalizados ni dependencias no relacionadas.

```bash
# Inspecciona el plan completo. Siempre es de solo lectura.
npx create-fsd-architecture@latest upgrade --dry-run

# Comprobación de estado para CI. Siempre es no interactiva y de solo lectura.
npx create-fsd-architecture@latest upgrade --check

# Aplica solo un plan sin conflictos y sin preguntar.
npx create-fsd-architecture@latest upgrade --yes

# Aplica los cambios de código y configuración sin instalar dependencias.
npx create-fsd-architecture@latest upgrade --yes --no-install

# Aplica después de aceptar explícitamente el riesgo de un árbol de trabajo de Git con cambios sin confirmar.
npx create-fsd-architecture@latest upgrade --allow-dirty
```

El comando localiza la raíz de proyecto fiable más cercana desde directorios anidados, y luego imprime la raíz seleccionada, la ruta de migración, cada acción de creación, actualización, conservación, conflicto y trabajo manual, y las validaciones. `--dry-run` y `--check` no crean copias de seguridad, manifiestos, registros, lockfiles ni archivos temporales de proyecto.

Los proyectos nuevos contienen `.fsd/manifest.json`, un manifiesto de propiedad escrito de forma atómica. Registra hashes SHA-256 solo de los archivos propios del CLI, las regiones marcadas y entradas concretas de dependencias gestionadas. No contiene valores de entorno, secretos ni datos de `node_modules`. Un archivo rastreado modificado o una marca cambiada es un conflicto, no un permiso de sobrescritura. No existe intencionadamente ningún modo `--force` ni `--adopt` ciego para las actualizaciones.

Los proyectos creados antes del manifiesto usan el modo heredado conservador. El CLI adopta solo firmas publicadas exactas para los artefactos generados, las dependencias gestionadas y las regiones marcadas de Nuxt. Las rutas gestionadas que falten, sean personalizadas o ambiguas se notifican como `CONFLICT` o `MANUAL`; resuélvelas antes de reintentarlo. El código de aplicación fuera de las superficies propias del CLI permanece intacto byte a byte.

De forma predeterminada, una aplicación se rechaza en un árbol de trabajo de Git con cambios sin confirmar. `--dry-run` y `--check` siguen estando disponibles. `--allow-dirty` imprime una advertencia y usa la copia de seguridad interna de los archivos afectados; el comando nunca restablece, guarda en stash, confirma, cambia de rama ni modifica de ningún otro modo el estado de Git. Los proyectos sin Git son compatibles.

Antes de escribir, upgrade guarda una instantánea de cada archivo normal afectado en `.fsd/backups/`. Las escrituras usan archivos temporales hermanos y renombrado atómico, conservan los permisos de los hooks, rechazan recorridos de ruta y rutas gestionadas con enlaces simbólicos, y revierten en orden inverso si hay un error. La copia de seguridad se conserva después de una actualización fallida y se imprime su ubicación. Si la instalación de dependencias falló, se restauran las rutas de código y configuración, el manifiesto y los lockfiles; ejecuta el comando `install` del gestor de paquetes seleccionado para restaurar `node_modules`.

Códigos de salida de `upgrade --check`, estables para CI:

| Código | Significado |
| --- | --- |
| `0` | El proyecto está actualizado |
| `2` | Hay una actualización sin conflictos disponible |
| `3` | Los conflictos o el trabajo manual bloquean la actualización |
| `4` | El estado del proyecto o la configuración no son compatibles o no son válidos |

La primera versión con estado gestionado admite proyectos limpios con firmas coincidentes de las pilas probadas de React + Vite, Next.js, Vue + Vite, Nuxt y SvelteKit con npm, pnpm, Yarn o Bun. Instala el manifiesto de propiedad, refuerza los hooks verificados de Husky heredados y añade la política de compilación de pnpm propia del CLI solo cuando la ruta aún no existe. Actualmente no se declara ninguna migración de versiones de dependencias; el instalador solo se ejecuta cuando una migración futura cambie las dependencias gestionadas. Consulta [la arquitectura de actualizaciones](./docs/UPGRADE-ARCHITECTURE.md) para ver la tabla de compatibilidad exacta, la guía de recuperación y las reglas de extensión.

Para pnpm, usa **10.26 o una versión más reciente** (pnpm 11 también requiere Node 22+).
Los proyectos nuevos de pnpm reciben una lista `allowBuilds` específica del framework en `pnpm-workspace.yaml`. Solo las dependencias de compilación listadas pueden ejecutar scripts; los scripts no revisados hacen fallar la instalación en lugar de confiar en ellos silenciosamente. Una política de espacio de trabajo existente propia de una plantilla se conserva. Revisa las dependencias adicionales con `pnpm approve-builds`; no se cambia ninguna configuración global de aprobación. Consulta la [configuración de compilación de pnpm](https://github.com/pnpm/pnpm.io/blob/main/versioned_docs/version-10.x/settings.md#allowbuilds).

Si la instalación falla, el CLI termina con un código distinto de cero y revierte el destino. Para revisar la política del gestor de paquetes antes de instalar, crea el proyecto con `--no-install` y luego ejecuta el gestor seleccionado manualmente dentro del proyecto generado.

Tipos de generador:

- `feature`
- `entity`
- `widget`
- `page`

Los slices existentes están protegidos. Usa `--force` solo cuando quieras reemplazar un slice intencionadamente. Los generadores de páginas también registran rutas nativas del framework: React Router para React + Vite, Vue Router para Vue + Vite y archivos de ruta de App Router para Next.js. Las páginas de Nuxt y SvelteKit obtienen envoltorios finos de ruta basada en archivos sin convertir los slices de páginas de FSD en directorios de rutas.

## Plantillas

| ID de plantilla | Framework | Estado |
| --- | --- | --- |
| `react-vite` | React + Vite | Estable |
| `nextjs` | Next.js App Router | Estable |
| `vue-vite` | Vue + Vite | Estable |
| `nuxt` | Nuxt 4 | Estable |
| `sveltekit` | SvelteKit | Estable |

Los proyectos de Vue y Nuxt usan Pinia, TanStack Vue Query, VeeValidate y Zod a través de módulos nativos del framework, proveedores y generadores. Nuxt usa por defecto su cliente nativo `$fetch` e incluye hidratación SSR para Vue Query.

Los proyectos de SvelteKit usan runes de Svelte 5, TanStack Svelte Query, stores de Svelte, Superforms de SvelteKit y Zod 4. Usan por defecto Fetch nativo y usan `PUBLIC_API_BASE` para la configuración pública de la API en tiempo de ejecución.

## Arquitectura generada

```text
src/
├── app/          # Configuración de la app, proveedores, enrutado y estilos
├── pages/        # Composiciones a nivel de ruta
├── widgets/      # Bloques de UI grandes y reutilizables
├── features/     # Interacciones de usuario y acciones de negocio
├── entities/     # Entidades de negocio y sus representaciones
└── shared/       # API, recursos, configuración, utilidades, tipos y UI
```

Nuxt usa las mismas capas completas en su directorio oficial de código `app/`. Sus envoltorios de ruta basada en archivos están en `app/app/routes`, separados de la capa `app/pages` de FSD.

SvelteKit mantiene las capas en `src/` y reserva `src/routes` para los envoltorios finos de ruta basada en archivos. Como SvelteKit es dueño del alias `$app`, los proyectos generados usan `$fsd-app` para la capa app de FSD y alias específicos de capa como `$pages` y `$shared` en el resto.

Cada capa y sus segmentos principales existen desde el primer día. Los marcadores de posición de documentación mantienen presentes las carpetas de arquitectura vacías en los clones de Git.

## Configuración del proyecto

La pila seleccionada se guarda una vez en `fsd.config.json`. Los generadores leen este archivo automáticamente y no vuelven a pedir al desarrollador que elija la pila.

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

Generar `feature auth` crea juntos los flujos de inicio de sesión, registro, contraseña olvidada, restablecimiento de contraseña y código de verificación. Con la pila predeterminada también genera componentes tipados de React Hook Form, esquemas de Zod, mutaciones de React Query y la integración con el estado del cliente seleccionado.

### Adaptador opcional de Supabase Auth (candidato)

`-g feature auth --auth-provider supabase` genera un adaptador oficial del SDK de navegador con normalización de sesión, registro con confirmación obligatoria y gestión de OTP de recuperación. Es trabajo candidato y no está disponible en la versión 2.6.1 publicada en npm. Instala el SDK y configura un cliente de navegador con claves públicas; la autorización SSR y RLS necesitan una integración de aplicación independiente y aceptación del backend. Consulta [el contrato completo](docs/AUTH-SUPABASE-CONTRACT.md).

## Arquitectura principal en 2.2

El tiempo de ejecución del CLI está dividido en límites estables:

```text
bin/
├── cli/                  # Análisis de argumentos y salida de terminal
├── commands/             # Flujos de trabajo orientados al usuario
├── core/
│   ├── frameworks/       # Adaptadores específicos del tiempo de ejecución
│   ├── capability-matrix.mjs
│   ├── template-registry.mjs
│   ├── package-managers.mjs
│   └── project-lifecycle.mjs
└── generators/           # Bloques de construcción reutilizables del generador
```

- El registro de plantillas es la única fuente de verdad para la identidad de las plantillas, el repositorio y el estado de la versión.
- La matriz de capacidades evita combinaciones no válidas de pilas entre frameworks.
- Los adaptadores de framework son dueños de las variables de entorno y del comportamiento de los componentes de cliente.
- El ciclo de vida del proyecto es dueño de la clonación, la configuración, Git, Husky, Commitlint y el comportamiento de instalación.
- El punto de entrada del CLI solo analiza y enruta los comandos.

Esta separación permite que React, Next.js, Vue, Nuxt y SvelteKit compartan un mismo ciclo de vida del CLI manteniendo proveedores nativos del framework y componentes generados.

## Requisitos

- Node.js 22.12.0 o posterior para el CLI
- Node.js 22.22.2 o posterior para los proyectos generados de Nuxt y SvelteKit

El mínimo del tiempo de ejecución del CLI, los mínimos por plantilla y las versiones admitidas de gestores de paquetes están verificados en [docs/RUNTIME-REQUIREMENTS.md](./docs/RUNTIME-REQUIREMENTS.md). El comando `doctor` los aplica e informa de la versión exacta requerida cuando el tiempo de ejecución local no coincide.

## Desarrollo

```bash
npm install
npm test
npm run check
```

## Lanzamientos

La publicación en npm es un paso manual solo para mantenedores. Publicar una etiqueta de versión ejecuta las comprobaciones de lanzamiento y crea una GitHub Release, pero nunca publica en npm.

## Licencia

MIT

## Apoya a FSD CLI

Si este proyecto te ayuda, puedes apoyar opcionalmente su desarrollo:

- [GitHub Sponsors](https://github.com/sponsors/ashrafmo-1?frequency=one-time&sponsor=ashrafmo-1)
- [Buy Me a Coffee](https://buymeacoffee.com/ashrafqopiah)
- **InstaPay (Egipto):** `ashrafmo-1`

Para InstaPay, usa el nombre de usuario exactamente como se muestra y verifica los datos del destinatario en la app antes de confirmar una transferencia. Las donaciones son opcionales.

## Proyectos existentes y propuestas

Las aplicaciones existentes pueden usar el [flujo oficial de auditoría y migración guiada](docs/EXISTING-PROJECT-SUPPORT.md). Los generadores del CLI requieren un proyecto compatible verificado; la actualización gestionada sigue limitada a los archivos propios del CLI. Consulta las [decisiones de propuestas](docs/PROPOSALS.md) para ver las propuestas no programadas de complementos y la investigación de migración.

## Fuentes reproducibles de plantillas

Cada plantilla admitida está vinculada a un commit completo en el registro del CLI. La creación descarga ese objeto exacto, verifica su SHA y registra el repositorio, la referencia solicitada y el commit resuelto en `.fsd/template.json`. Las simulaciones muestran la fuente fijada. No se permite ninguna vuelta a una rama cambiante. Actualizar una plantilla requiere un cambio revisado en el registro y un nuevo artefacto del CLI; los rangos de versiones de dependencias siguen necesitando su propia verificación de lockfile y tiempo de ejecución. Los proyectos generados antiguos y los manifiestos de propiedad siguen siendo válidos sin este archivo de procedencia opcional.

### Verificación de la fuente de las plantillas

Desde el repositorio del CLI, `npm run smoke:templates` descarga cada commit inmutable registrado dos veces, comprueba la procedencia registrada y compara el árbol completo de fuentes byte a byte. Antes de publicar una actualización del CLI, fusiona sus PRs acompañantes de plantillas y verifica que los commits fijados sigan disponibles; vuelve a vincular los pins después de fusiones con squash o rebase. Las comprobaciones de seguridad y compilación son independientes de la verificación de identidad de la fuente.

## Política de flujo de trabajo con Git

Git y Conventional Commits siguen formando parte de la configuración. Las comprobaciones previas al commit revisan los espacios en blanco del área de preparación y del árbol de trabajo; las compilaciones completas se ejecutan en CI. Establece `FSD_PRE_COMMIT_LINT=1` para ejecutar lint al confirmar o `FSD_PRE_PUSH_CHECKS=1` para ejecutar lint y compilación al enviar. Para una omisión de emergencia intencionada, Husky admite `HUSKY=0 git commit ...`; CI sigue siendo la puerta de calidad obligatoria y los fallos deben resolverse igualmente.

La auto-PR y el etiquetado de PR son opcionales. La plantilla de React mantiene ejemplos revisados en `.github/optional-workflows/`; copia el archivo elegido a `.github/workflows/` para activarlo. La auto-PR es manual (`workflow_dispatch`) y necesita permiso en el repositorio para crear PRs. El etiquetador necesita `.github/labeler.yml`, las etiquetas `documentation`, `source`, `ci` y permiso de Actions para aplicar etiquetas. No actives la automatización antes de configurar sus permisos y etiquetas.

## Mejoras candidatas del generador

No están en npm 2.6.1: slices por lotes nativos, conservación de segmentos solo de estructura con raíces personalizadas, y `check --architecture` local de proyecto mediante Steiger. Consulta los [flujos de trabajo del generador](docs/GENERATOR-WORKFLOWS.md) para ver la sintaxis exacta, la reversión y los límites. `--root` requiere `--segments`; no reescribe la configuración de rutas ni de alias del framework.
