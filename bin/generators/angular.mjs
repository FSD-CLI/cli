// Angular family generator. Output follows the FSD-CLI/fsd-angular template:
// standalone OnPush components with signal inputs and built-in control flow,
// single-quoted Prettier style, kebab-case file names and @layer/* aliases.
// Server state uses TanStack Angular Query `inject*` helpers, client state an
// NgRx SignalStore, and forms are typed reactive forms validated with zod.
import { file, toCamelCase, toPascalCase, toTitle } from "./shared.mjs";
import { angularWidgetPresetContent, isWidgetPreset } from "./widget-presets.mjs";
import { angularPagePresetContent, isPagePreset } from "./page-presets.mjs";

const AUTH_FORMS = [
  {
    name: "login",
    payload: "LoginCredentials",
    result: "AuthSession",
    submit: "Log in",
    fields: [
      ["email", "Email", "email", "email"],
      ["password", "Password", "password", "current-password"],
    ],
  },
  {
    name: "register",
    payload: "RegisterPayload",
    result: "AuthSession",
    submit: "Create account",
    fields: [
      ["name", "Name", "text", "name"],
      ["email", "Email", "email", "email"],
      ["password", "Password", "password", "new-password"],
    ],
  },
  {
    name: "forgot-password",
    payload: "ForgotPasswordPayload",
    result: "AuthActionResult",
    submit: "Send reset code",
    fields: [["email", "Email", "email", "email"]],
  },
  {
    name: "reset-password",
    payload: "ResetPasswordPayload",
    result: "AuthActionResult",
    submit: "Reset password",
    fields: [
      ["token", "Reset token", "text", "one-time-code"],
      ["password", "New password", "password", "new-password"],
    ],
  },
  {
    name: "verify-code",
    payload: "VerifyCodePayload",
    result: "AuthActionResult",
    submit: "Verify code",
    fields: [
      ["email", "Email", "email", "email"],
      ["code", "Verification code", "text", "one-time-code"],
    ],
  },
];

const SUPABASE_RESET_FIELDS = [
  ["email", "Email", "email", "email"],
  ["code", "Recovery code", "text", "one-time-code"],
  ["password", "New password", "password", "new-password"],
  ["passwordConfirmation", "Confirm password", "password", "new-password"],
];

export function createAngularFilePlan(type, name, config) {
  if (type === "feature") {
    return name === "auth" ? createAuthFiles(config) : createFeatureFiles(name, config);
  }
  if (type === "entity") return createEntityFiles(name);
  if (type === "widget") return createWidgetFiles(name);
  return createPageFiles(name);
}

// Public files export their named symbol with a single-quoted re-export, so
// the generated slice index matches the template's Prettier style.
function angularFile(pathname, content, exportName) {
  const modulePath = pathname.replace(/\.ts$/, "");
  return {
    ...file(pathname, content, Boolean(exportName)),
    ...(exportName ? { exportLine: `export { ${exportName} } from './${modulePath}';` } : {}),
  };
}

function typesFile(pathname, content, names) {
  const modulePath = pathname.replace(/\.ts$/, "");
  return {
    ...file(pathname, content, true),
    exportLine: `export type { ${names.join(", ")} } from './${modulePath}';`,
  };
}

function createFeatureFiles(name, config) {
  const pascal = toPascalCase(name);
  const camel = toCamelCase(name);
  const files = [
    typesFile(`model/${name}.types.ts`, featureTypesContent(pascal), [pascal, `${pascal}Status`]),
    angularFile(
      `ui/${name}-view.ts`,
      viewComponent(`app-${name}-view`, `${pascal}View`, `${toTitle(name)} feature`),
      `${pascal}View`,
    ),
  ];
  if (config.serverState === "angular-query") {
    files.push(
      angularFile(`api/${name}.api.ts`, featureApiContent(name, pascal), null),
      angularFile(`lib/${name}.keys.ts`, keysContent(name, camel), `${camel}Keys`),
      {
        ...file(`api/${name}.query.ts`, featureQueryContent(name, camel, pascal), true),
        exportLine: `export { inject${pascal}Query, injectUpdate${pascal}Mutation } from './api/${name}.query';`,
      },
    );
  }
  if (config.clientState === "ngrx-signals") {
    files.push(angularFile(`model/${name}.store.ts`, featureStoreContent(name, pascal), `${pascal}Store`));
  }
  return files;
}

function createEntityFiles(name) {
  const pascal = toPascalCase(name);
  return [
    typesFile(`model/${name}.types.ts`, entityTypesContent(pascal), [pascal]),
    angularFile(`ui/${name}-card.ts`, entityCardContent(name, pascal), `${pascal}Card`),
  ];
}

function createWidgetFiles(name) {
  const pascal = toPascalCase(name);
  const content = isWidgetPreset(name)
    ? angularWidgetPresetContent(name)
    : viewComponent(`app-${name}`, pascal, `${toTitle(name)} widget`);
  return [angularFile(`ui/${name}.ts`, content, pascal)];
}

function createPageFiles(name) {
  const className = `${toPascalCase(name)}Page`;
  const content = isPagePreset(name)
    ? angularPagePresetContent(name)
    : viewComponent(`app-${name}-page`, className, `${toTitle(name)} page`);
  return [angularFile(`ui/${name}-page.ts`, content, className)];
}

function createAuthFiles(config) {
  const supabase = config.authProvider === "supabase";
  const forms = AUTH_FORMS.map((form) =>
    supabase && form.name === "reset-password" ? { ...form, fields: SUPABASE_RESET_FIELDS } : form,
  );
  const files = [
    typesFile("model/auth.types.ts", authTypesContent(supabase), [
      "AuthActionResult",
      "AuthSession",
      "AuthUser",
      "ForgotPasswordPayload",
      "LoginCredentials",
      "RegisterPayload",
      "ResetPasswordPayload",
      "VerifyCodePayload",
    ]),
  ];

  if (config.serverState === "angular-query") {
    files.push(
      ...forms.map((form) => angularFile(`api/${form.name}.api.ts`, authApiContent(form), null)),
      angularFile("lib/auth.keys.ts", authKeysContent(), "authKeys"),
      {
        ...file("api/auth.query.ts", authQueryContent(forms, supabase), true),
        exportLine: `export {\n${forms
          .map((form) => `  ${mutationName(form)},`)
          .join("\n")}\n} from './api/auth.query';`,
      },
    );
  }
  if (config.clientState === "ngrx-signals") {
    files.push(angularFile("model/auth.store.ts", authStoreContent(), "AuthStore"));
  }
  if (config.forms === "angular-forms-zod") {
    files.push(
      ...forms.map((form) =>
        angularFile(`model/${form.name}.schema.ts`, authSchemaContent(form), schemaName(form)),
      ),
    );
  }
  files.push(
    ...forms.map((form) =>
      angularFile(`ui/${form.name}-form.ts`, authFormContent(form, config), formClass(form)),
    ),
  );
  return files;
}

const schemaName = (form) => `${toCamelCase(form.name)}Schema`;
const formClass = (form) => `${toPascalCase(form.name)}Form`;
const mutationName = (form) => `inject${toPascalCase(form.name)}Mutation`;

function viewComponent(selector, className, title) {
  return `import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: '${selector}',
  template: \`
    <section>
      <h2>{{ title() }}</h2>
    </section>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ${className} {
  readonly title = input('${title}');
}
`;
}

function featureTypesContent(pascal) {
  return `export interface ${pascal} {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type ${pascal}Status = 'idle' | 'loading' | 'success' | 'error';
`;
}

function entityTypesContent(pascal) {
  return `export interface ${pascal} {
  id: string;
  name: string;
  description?: string;
}
`;
}

function entityCardContent(name, pascal) {
  const property = toCamelCase(name);
  return `import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { ${pascal} } from '../model/${name}.types';

@Component({
  selector: 'app-${name}-card',
  template: \`
    <article>
      <h3>{{ ${property}().name }}</h3>
      @if (${property}().description; as description) {
        <p>{{ description }}</p>
      }
    </article>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ${pascal}Card {
  readonly ${property} = input.required<${pascal}>();
}
`;
}

function featureApiContent(name, pascal) {
  return `import type { ApiClient } from '@shared/api';
import { lastValueFrom } from 'rxjs';
import type { ${pascal} } from '../model/${name}.types';

export function get${pascal}(api: ApiClient) {
  return lastValueFrom(api.get<${pascal}>('/${name}'));
}

export function update${pascal}(api: ApiClient, payload: Partial<${pascal}>) {
  return lastValueFrom(api.post<${pascal}, Partial<${pascal}>>('/${name}', payload));
}
`;
}

function featureQueryContent(name, camel, pascal) {
  return `import { inject } from '@angular/core';
import { ApiClient } from '@shared/api';
import { injectMutation, injectQuery } from '@tanstack/angular-query-experimental';
import { ${camel}Keys } from '../lib/${name}.keys';
import type { ${pascal} } from '../model/${name}.types';
import { get${pascal}, update${pascal} } from './${name}.api';

export function inject${pascal}Query() {
  const api = inject(ApiClient);
  return injectQuery(() => ({
    queryKey: ${camel}Keys.detail(),
    queryFn: () => get${pascal}(api),
  }));
}

export function injectUpdate${pascal}Mutation() {
  const api = inject(ApiClient);
  return injectMutation(() => ({
    mutationFn: (payload: Partial<${pascal}>) => update${pascal}(api, payload),
  }));
}
`;
}

function keysContent(name, camel) {
  return `export const ${camel}Keys = {
  all: ['${name}'] as const,
  detail: () => [...${camel}Keys.all, 'detail'] as const,
};
`;
}

function featureStoreContent(name, pascal) {
  return `import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type { ${pascal}, ${pascal}Status } from './${name}.types';

interface ${pascal}State {
  item: ${pascal} | null;
  status: ${pascal}Status;
}

const initialState: ${pascal}State = { item: null, status: 'idle' };

export const ${pascal}Store = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    setItem: (item: ${pascal}) => patchState(store, { item, status: 'success' }),
    setStatus: (status: ${pascal}Status) => patchState(store, { status }),
    reset: () => patchState(store, initialState),
  })),
);
`;
}

function authTypesContent(supabase) {
  const reset = supabase
    ? `export interface ResetPasswordPayload {
  email: string;
  code: string;
  password: string;
  passwordConfirmation: string;
}`
    : `export interface ResetPasswordPayload {
  token: string;
  password: string;
}`;
  return `export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

export interface AuthActionResult {
  message: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginCredentials {
  name: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

${reset}

export interface VerifyCodePayload {
  email: string;
  code: string;
}
`;
}

// The API files keep one exported function per form, named like the other
// families, so the opt-in Supabase adapter can replace them file by file.
function authApiContent(form) {
  const fn = toCamelCase(form.name);
  return `import type { ApiClient } from '@shared/api';
import { lastValueFrom } from 'rxjs';
import type { ${form.payload}, ${form.result} } from '../model/auth.types';

export function ${fn}(api: ApiClient, payload: ${form.payload}) {
  return lastValueFrom(api.post<${form.result}, ${form.payload}>('/auth/${form.name}', payload));
}
`;
}

function authQueryContent(forms, supabase) {
  const imports = forms.map((form) => `import { ${toCamelCase(form.name)} } from './${form.name}.api';`);
  const payloads = [...new Set(forms.map((form) => form.payload))].sort();
  const mutations = forms.map((form) => {
    const call = supabase
      ? `${toCamelCase(form.name)}(payload)`
      : `${toCamelCase(form.name)}(api, payload)`;
    const api = supabase ? "" : "  const api = inject(ApiClient);\n";
    return `export function ${mutationName(form)}() {
${api}  return injectMutation(() => ({
    mutationFn: (payload: ${form.payload}) => ${call},
  }));
}`;
  });
  const angularImports = supabase
    ? ""
    : "import { inject } from '@angular/core';\nimport { ApiClient } from '@shared/api';\n";
  return `${angularImports}import { injectMutation } from '@tanstack/angular-query-experimental';
import type {
${payloads.map((name) => `  ${name},`).join("\n")}
} from '../model/auth.types';
${imports.join("\n")}

${mutations.join("\n\n")}
`;
}

function authKeysContent() {
  return `export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
};
`;
}

function authStoreContent() {
  return `import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import type { AuthSession } from './auth.types';

interface AuthState {
  session: AuthSession | null;
}

const initialState: AuthState = { session: null };

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ session }) => ({
    user: computed(() => session()?.user ?? null),
    isAuthenticated: computed(() => session() !== null),
  })),
  withMethods((store) => ({
    setSession: (session: AuthSession) => patchState(store, { session }),
    clearSession: () => patchState(store, initialState),
  })),
);
`;
}

function authSchemaContent(form) {
  const fields = form.fields.map(([name, , type]) => {
    if (name === "password") {
      return `  ${name}: z.string().min(8, 'Password must contain at least 8 characters'),`;
    }
    if (name === "passwordConfirmation") {
      return `  ${name}: z.string().min(8, 'Confirm your new password'),`;
    }
    if (type === "email") return `  ${name}: z.email('Enter a valid email address'),`;
    if (name === "code") return `  ${name}: z.string().min(4, 'Enter the verification code'),`;
    return `  ${name}: z.string().min(1, '${toTitle(name)} is required'),`;
  });
  return `import { z } from 'zod';

export const ${schemaName(form)} = z.object({
${fields.join("\n")}
});
`;
}

// Typed reactive form: the controls are non-nullable strings, the zod schema
// is the single source of validation, and submit emits the parsed payload.
function authFormContent(form, config) {
  const withZod = config.forms === "angular-forms-zod";
  const withQuery = config.serverState === "angular-query";
  const className = formClass(form);
  const controls = form.fields
    .map(([name]) => `    ${name}: new FormControl('', { nonNullable: true }),`)
    .join("\n");
  const fields = form.fields
    .map(([name, label, type, autocomplete]) => {
      const id = `${form.name}-${name}`;
      const error = withZod
        ? `
        @if (errors().${name}?.[0]; as message) {
          <small id="${id}-error">{{ message }}</small>
        }`
        : "";
      return `      <div>
        <label for="${id}">${label}</label>
        <input
          id="${id}"
          type="${type}"
          autocomplete="${autocomplete}"
          formControlName="${name}"
        />${error}
      </div>`;
    })
    .join("\n");

  const imports = [
    `import { ChangeDetectionStrategy, Component, output${withZod ? ", signal" : ""} } from '@angular/core';`,
    "import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';",
    ...(withZod ? ["import { z } from 'zod';"] : []),
    ...(withQuery ? [`import { ${mutationName(form)} } from '../api/auth.query';`] : []),
    `import type { ${form.payload} } from '../model/auth.types';`,
    ...(withZod ? [`import { ${schemaName(form)} } from '../model/${form.name}.schema';`] : []),
  ];
  const members = [
    `  readonly submitted = output<${form.payload}>();`,
    ...(withQuery ? [`  readonly mutation = ${mutationName(form)}();`] : []),
    ...(withZod
      ? [`  readonly errors = signal<Partial<Record<keyof ${form.payload}, string[]>>>({});`]
      : []),
    `  readonly form = new FormGroup({
${controls}
  });`,
  ];
  const parse = withZod
    ? `    const result = ${schemaName(form)}.safeParse(this.form.getRawValue());
    if (!result.success) {
      this.errors.set(z.flattenError(result.error).fieldErrors);
      return;
    }
    this.errors.set({});
    const payload: ${form.payload} = result.data;`
    : `    const payload: ${form.payload} = this.form.getRawValue();`;
  const submitButton = withQuery
    ? `<button type="submit" [disabled]="mutation.isPending()">${form.submit}</button>`
    : `<button type="submit">${form.submit}</button>`;

  return `${imports.join("\n")}

@Component({
  selector: 'app-${form.name}-form',
  imports: [ReactiveFormsModule],
  template: \`
    <form class="${form.name}-form" [formGroup]="form" (ngSubmit)="submit()">
${fields}
      ${submitButton}
    </form>
  \`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ${className} {
${members.join("\n")}

  submit() {
${parse}
${withQuery ? "    this.mutation.mutate(payload);\n" : ""}    this.submitted.emit(payload);
  }
}
`;
}

/**
 * The Angular family generator, implementing the shared family generator
 * interface (see family-generators.mjs).
 */
export const angularFamilyGenerator = Object.freeze({
  family: "angular",
  createFilePlan: createAngularFilePlan,
});
