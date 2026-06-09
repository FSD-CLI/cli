import fs from "fs";
import path from "path";
import prompts from "prompts";
import chalk from "chalk";

const ALLOWED_TYPES = ["feature", "entity", "widget", "page"];

const FEATURE_TOOLS = [
  {
    title: "API: Axios + React Query",
    value: "react-query",
  },
  {
    title: "Local State: Zustand",
    value: "zustand",
  },
  {
    title: "Global State: Redux Toolkit",
    value: "redux",
  },
  {
    title: "UI only",
    value: "ui-only",
  },
];

const AUTH_MODULES = [
  {
    title: "Login",
    value: "login",
  },
  {
    title: "Register",
    value: "register",
  },
  {
    title: "Forgot Password Flow",
    value: "forgot-password",
  },
];

const LAYER_DIRS = {
  feature: "features",
  entity: "entities",
  widget: "widgets",
  page: "pages",
};

const onCancel = {
  onCancel() {
    console.log();
    console.log(chalk.yellow("  Cancelled."));
    console.log();
    process.exit(0);
  },
};

export function parseGenerateArgs(args) {
  const generateIndex = args.findIndex((arg) => arg === "--generate" || arg === "-g");

  if (generateIndex === -1) {
    return { shouldGenerate: false };
  }

  const values = args
    .slice(generateIndex + 1)
    .filter((arg) => !arg.startsWith("-"));

  return {
    shouldGenerate: true,
    type: values[0],
    name: values[1],
    force: args.includes("--force"),
  };
}

export async function runGenerator(options) {
  try {
    validateGenerateOptions(options);

    const normalizedName = toKebabCase(options.name);
    const config = await resolveGeneratorConfig(options.type, normalizedName);
    const createdFiles = generateSlice({
      cwd: process.cwd(),
      type: options.type,
      name: normalizedName,
      config,
      force: options.force,
    });

    printSuccess(createdFiles);
  } catch (err) {
    console.log(chalk.red(`  Error: ${err.message}`));
    process.exit(1);
  }
}

function validateGenerateOptions({ type, name }) {
  if (!type || !name) {
    throw new Error(
      "Usage: create-fsd-architecture --generate <type> <name> [--force]"
    );
  }

  if (!ALLOWED_TYPES.includes(type)) {
    throw new Error(
      `Invalid type "${type}". Allowed types: ${ALLOWED_TYPES.join(", ")}.`
    );
  }

  if (!toKebabCase(name)) {
    throw new Error("Slice name must contain at least one letter or number.");
  }
}

async function resolveGeneratorConfig(type, name) {
  if (type !== "feature") {
    return {};
  }

  const { tool } = await prompts(
    {
      type: "select",
      name: "tool",
      message: "What will this feature use?",
      choices: FEATURE_TOOLS,
    },
    onCancel
  );

  if (!tool) {
    throw new Error("Feature tool selection is required.");
  }

  if (name !== "auth") {
    return { tool };
  }

  const { modules } = await prompts(
    {
      type: "multiselect",
      name: "modules",
      message: "Which auth modules do you need?",
      choices: AUTH_MODULES,
      min: 1,
      hint: "- Space to select. Enter to submit.",
    },
    onCancel
  );

  if (!modules?.length) {
    throw new Error("Select at least one auth module.");
  }

  return { tool, modules };
}

function generateSlice({ cwd, type, name, config, force }) {
  const layerDir = LAYER_DIRS[type];
  const baseDir = fs.existsSync(path.join(cwd, "src"))
    ? path.join(cwd, "src", layerDir)
    : path.join(cwd, layerDir);
  const sliceDir = path.join(baseDir, name);

  if (fs.existsSync(sliceDir) && !force) {
    throw new Error(
      `Slice "${path.relative(cwd, sliceDir)}" already exists. Re-run with --force to overwrite it.`
    );
  }

  if (force) {
    fs.rmSync(sliceDir, { recursive: true, force: true });
  }

  const files = createFilePlan(type, name, config);
  const publicExports = files
    .filter((file) => file.public)
    .map((file) => exportLine(file.path));

  files.push({
    path: "index.ts",
    content: `${publicExports.join("\n")}\n`,
    public: false,
  });

  for (const file of files) {
    const filePath = path.join(sliceDir, file.path);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, file.content);
  }

  return files.map((file) => path.relative(cwd, path.join(sliceDir, file.path)));
}

function createFilePlan(type, name, config) {
  if (type === "feature") {
    return name === "auth"
      ? createAuthFeatureFiles(config.tool, config.modules)
      : createGenericFeatureFiles(name, config.tool);
  }

  if (type === "entity") {
    return createEntityFiles(name);
  }

  if (type === "widget") {
    return createWidgetFiles(name);
  }

  return createPageFiles(name);
}

function createAuthFeatureFiles(tool, modules) {
  const files = [];
  const expandedModules = expandAuthModules(modules);

  if (tool === "react-query") {
    files.push(
      ...modules.flatMap((module) => authApiFiles[module] ?? []),
      ...modules.flatMap((module) => authTypeFiles[module] ?? []),
      file("api/auth.query.ts", authQueryContent(modules), true),
      file("lib/auth.keys.ts", authKeysContent(), true),
      file("model/auth.types.ts", authTypesContent(), true)
    );
  }

  if (tool === "zustand") {
    files.push(
      file("model/auth.store.ts", authStoreContent(), true),
      file("model/auth.types.ts", authTypesContent(), true),
      file("lib/auth.helpers.ts", authHelpersContent(), true)
    );
  }

  if (tool === "redux") {
    files.push(
      file("model/auth.slice.ts", authSliceContent(), true),
      file("model/auth.selectors.ts", authSelectorsContent(), true),
      file("model/auth.types.ts", authTypesContent(), true)
    );
  }

  files.push(
    ...expandedModules.map((module) =>
      file(`ui/${module}-form.tsx`, authFormContent(module, tool), true)
    )
  );

  return files;
}

const authApiFiles = {
  login: [
    file("api/login.api.ts", authApiContent("login", "LoginCredentials", "AuthSession"), false),
  ],
  register: [
    file("api/register.api.ts", authApiContent("register", "RegisterPayload", "AuthSession"), false),
  ],
  "forgot-password": [
    file(
      "api/forgot-password.api.ts",
      authApiContent("forgotPassword", "ForgotPasswordPayload", "ForgotPasswordResult"),
      false
    ),
    file(
      "api/reset-password.api.ts",
      authApiContent("resetPassword", "ResetPasswordPayload", "ResetPasswordResult"),
      false
    ),
    file(
      "api/verify-code.api.ts",
      authApiContent("verifyCode", "VerifyCodePayload", "VerifyCodeResult"),
      false
    ),
  ],
};

const authTypeFiles = {
  login: [file("model/login.types.ts", loginTypesContent(), true)],
  register: [file("model/register.types.ts", registerTypesContent(), true)],
  "forgot-password": [
    file("model/forgot-password.types.ts", forgotPasswordTypesContent(), true),
    file("model/reset-password.types.ts", resetPasswordTypesContent(), true),
    file("model/verify-code.types.ts", verifyCodeTypesContent(), true),
  ],
};

function createGenericFeatureFiles(name, tool) {
  const pascalName = toPascalCase(name);
  const camelName = toCamelCase(name);
  const viewFile = file(
    `ui/${name}-view.tsx`,
    viewContent(`${pascalName}View`, `${pascalName} feature`),
    true
  );

  if (tool === "react-query") {
    return [
      file(`api/${name}.api.ts`, genericApiContent(name, camelName, pascalName), false),
      file(`api/${name}.query.ts`, genericQueryContent(name, camelName, pascalName), true),
      file(`model/${name}.types.ts`, genericTypesContent(pascalName), true),
      file(`lib/${name}.keys.ts`, keysContent(camelName, name), true),
      viewFile,
    ];
  }

  if (tool === "zustand") {
    return [
      file(`model/${name}.store.ts`, storeContent(camelName, pascalName), true),
      file(`model/${name}.types.ts`, genericTypesContent(pascalName), true),
      file(`lib/${name}.helpers.ts`, helpersContent(camelName, pascalName), true),
      viewFile,
    ];
  }

  if (tool === "redux") {
    return [
      file(`model/${name}.slice.ts`, sliceContent(camelName, pascalName), true),
      file(`model/${name}.selectors.ts`, selectorsContent(camelName, pascalName), true),
      file(`model/${name}.types.ts`, genericTypesContent(pascalName), true),
      viewFile,
    ];
  }

  return [viewFile];
}

function createEntityFiles(name) {
  const pascalName = toPascalCase(name);

  return [
    file(`model/${name}.types.ts`, entityTypesContent(pascalName), true),
    file(`ui/${name}-card.tsx`, entityCardContent(name, pascalName), true),
  ];
}

function createWidgetFiles(name) {
  return [
    file(`ui/${name}.tsx`, viewContent(toPascalCase(name), `${toTitle(name)} widget`), true),
  ];
}

function createPageFiles(name) {
  return [
    file(
      `ui/${name}-page.tsx`,
      viewContent(`${toPascalCase(name)}Page`, `${toTitle(name)} page`),
      true
    ),
  ];
}

function file(pathname, content, isPublic) {
  return {
    path: pathname,
    content,
    public: isPublic,
  };
}

function exportLine(filePath) {
  return `export * from "./${filePath.replace(/\.(tsx|ts)$/, "")}";`;
}

function expandAuthModules(modules) {
  return modules.flatMap((module) =>
    module === "forgot-password"
      ? ["forgot-password", "reset-password", "verify-code"]
      : [module]
  );
}

function authQueryContent(modules) {
  const imports = [
    'import { useMutation } from "@tanstack/react-query";',
    ...modules.flatMap((module) => authQueryImports[module] ?? []),
    "",
  ];
  const hooks = modules.flatMap((module) => authQueryHooks[module] ?? []);

  return `${imports.join("\n")}\n${hooks.join("\n\n")}\n`;
}

const authQueryImports = {
  login: ['import { login } from "./login.api";'],
  register: ['import { register } from "./register.api";'],
  "forgot-password": [
    'import { forgotPassword } from "./forgot-password.api";',
    'import { resetPassword } from "./reset-password.api";',
    'import { verifyCode } from "./verify-code.api";',
  ],
};

const authQueryHooks = {
  login: [
    `export function useLoginMutation() {
  return useMutation({
    mutationFn: login,
  });
}`,
  ],
  register: [
    `export function useRegisterMutation() {
  return useMutation({
    mutationFn: register,
  });
}`,
  ],
  "forgot-password": [
    `export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: forgotPassword,
  });
}`,
    `export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: resetPassword,
  });
}`,
    `export function useVerifyCodeMutation() {
  return useMutation({
    mutationFn: verifyCode,
  });
}`,
  ],
};

function authApiContent(functionName, payloadType, resultType) {
  return `import { apiClient } from "@/shared/api";
import type { ${payloadType}, ${resultType} } from "../model/${modelFileName(payloadType)}";

export async function ${functionName}(payload: ${payloadType}) {
  const { data } = await apiClient.post<${resultType}>("/auth/${toKebabCase(functionName)}", payload);

  return data;
}
`;
}

function modelFileName(typeName) {
  if (typeName.startsWith("Login")) return "login.types";
  if (typeName.startsWith("Register")) return "register.types";
  if (typeName.startsWith("Forgot")) return "forgot-password.types";
  if (typeName.startsWith("Reset")) return "reset-password.types";
  return "verify-code.types";
}

function authKeysContent() {
  return `export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
};
`;
}

function authTypesContent() {
  return `export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
};

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
};
`;
}

function loginTypesContent() {
  return `export type LoginCredentials = {
  email: string;
  password: string;
};

export type LoginFormValues = LoginCredentials;
`;
}

function registerTypesContent() {
  return `export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type RegisterFormValues = RegisterPayload;
`;
}

function forgotPasswordTypesContent() {
  return `export type ForgotPasswordPayload = {
  email: string;
};

export type ForgotPasswordResult = {
  message: string;
};

export type ForgotPasswordFormValues = ForgotPasswordPayload;
`;
}

function resetPasswordTypesContent() {
  return `export type ResetPasswordPayload = {
  email: string;
  code: string;
  password: string;
  passwordConfirmation: string;
};

export type ResetPasswordResult = {
  message: string;
};

export type ResetPasswordFormValues = ResetPasswordPayload;
`;
}

function verifyCodeTypesContent() {
  return `export type VerifyCodePayload = {
  email: string;
  code: string;
};

export type VerifyCodeResult = {
  isValid: boolean;
};

export type VerifyCodeFormValues = VerifyCodePayload;
`;
}

function authStoreContent() {
  return `import { create } from "zustand";
import type { AuthSession, AuthState, AuthUser } from "./auth.types";

type AuthActions = {
  setSession: (session: AuthSession) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
};

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
};

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  ...initialState,
  setSession: (session) =>
    set({
      user: session.user,
      accessToken: session.accessToken,
      isAuthenticated: true,
    }),
  setUser: (user) => set({ user, isAuthenticated: Boolean(user) }),
  logout: () => set(initialState),
}));
`;
}

function authHelpersContent() {
  return `import type { AuthState } from "../model/auth.types";

export function getAuthHeader(state: AuthState) {
  return state.accessToken ? { Authorization: \`Bearer \${state.accessToken}\` } : {};
}

export function isLoggedIn(state: AuthState) {
  return state.isAuthenticated && Boolean(state.user);
}
`;
}

function authSliceContent() {
  return `import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthSession, AuthState, AuthUser } from "./auth.types";

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setSession: (state, action: PayloadAction<AuthSession>) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.isAuthenticated = true;
    },
    setUser: (state, action: PayloadAction<AuthUser | null>) => {
      state.user = action.payload;
      state.isAuthenticated = Boolean(action.payload);
    },
    logout: () => initialState,
  },
});

export const { setSession, setUser, logout } = authSlice.actions;
export const authReducer = authSlice.reducer;
`;
}

function authSelectorsContent() {
  return `import type { AuthState } from "./auth.types";

type RootState = {
  auth: AuthState;
};

export const selectAuth = (state: RootState) => state.auth;
export const selectAuthUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
`;
}

function authFormContent(module, tool) {
  const componentName = `${toPascalCase(module)}Form`;
  const hookName = authMutationHookNames[module];
  const hookImport =
    tool === "react-query" && hookName
      ? `import { ${hookName} } from "../api/auth.query";\n`
      : "";
  const mutationLine =
    tool === "react-query" && hookName
      ? `  const ${toCamelCase(module)}Mutation = ${hookName}();\n`
      : "";
  const submitHandler =
    tool === "react-query" && hookName
      ? `  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    onSubmit?.(event);
  }\n`
      : `  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    onSubmit?.(event);
  }\n`;
  const busyProp =
    tool === "react-query" && hookName
      ? ` aria-busy={${toCamelCase(module)}Mutation.isPending}`
      : "";
  const disabledProp =
    tool === "react-query" && hookName
      ? ` disabled={${toCamelCase(module)}Mutation.isPending}`
      : "";
  const fields = authFormFields[module] ?? [];

  return `import type { FormEvent } from "react";
${hookImport}
type ${componentName}Props = {
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
};

export function ${componentName}({ onSubmit }: ${componentName}Props) {
${mutationLine}${submitHandler}
  return (
    <form onSubmit={handleSubmit} className="${module}-form"${busyProp}>
${fields
  .map(
    (field) => `      <label>
        ${field.label}
        <input name="${field.name}" type="${field.type}" autoComplete="${field.autoComplete}" />
      </label>`
  )
  .join("\n")}
      <button type="submit"${disabledProp}>${authSubmitLabels[module]}</button>
    </form>
  );
}
`;
}

const authMutationHookNames = {
  login: "useLoginMutation",
  register: "useRegisterMutation",
  "forgot-password": "useForgotPasswordMutation",
  "reset-password": "useResetPasswordMutation",
  "verify-code": "useVerifyCodeMutation",
};

const authFormFields = {
  login: [
    { label: "Email", name: "email", type: "email", autoComplete: "email" },
    { label: "Password", name: "password", type: "password", autoComplete: "current-password" },
  ],
  register: [
    { label: "Name", name: "name", type: "text", autoComplete: "name" },
    { label: "Email", name: "email", type: "email", autoComplete: "email" },
    { label: "Password", name: "password", type: "password", autoComplete: "new-password" },
  ],
  "forgot-password": [
    { label: "Email", name: "email", type: "email", autoComplete: "email" },
  ],
  "reset-password": [
    { label: "Email", name: "email", type: "email", autoComplete: "email" },
    { label: "Verification code", name: "code", type: "text", autoComplete: "one-time-code" },
    { label: "New password", name: "password", type: "password", autoComplete: "new-password" },
    {
      label: "Confirm password",
      name: "passwordConfirmation",
      type: "password",
      autoComplete: "new-password",
    },
  ],
  "verify-code": [
    { label: "Email", name: "email", type: "email", autoComplete: "email" },
    { label: "Verification code", name: "code", type: "text", autoComplete: "one-time-code" },
  ],
};

const authSubmitLabels = {
  login: "Log in",
  register: "Create account",
  "forgot-password": "Send reset code",
  "reset-password": "Reset password",
  "verify-code": "Verify code",
};

function genericApiContent(name, camelName, pascalName) {
  return `import { apiClient } from "@/shared/api";
import type { ${pascalName} } from "../model/${name}.types";

export async function get${pascalName}() {
  const { data } = await apiClient.get<${pascalName}>("/${name}");

  return data;
}

export async function update${pascalName}(payload: Partial<${pascalName}>) {
  const { data } = await apiClient.patch<${pascalName}>("/${name}", payload);

  return data;
}

export const ${camelName}Api = {
  get${pascalName},
  update${pascalName},
};
`;
}

function genericQueryContent(name, camelName, pascalName) {
  return `import { useMutation, useQuery } from "@tanstack/react-query";
import { ${camelName}Keys } from "../lib/${name}.keys";
import { get${pascalName}, update${pascalName} } from "./${name}.api";

export function use${pascalName}Query() {
  return useQuery({
    queryKey: ${camelName}Keys.detail(),
    queryFn: get${pascalName},
  });
}

export function useUpdate${pascalName}Mutation() {
  return useMutation({
    mutationFn: update${pascalName},
  });
}
`;
}

function genericTypesContent(pascalName) {
  return `export type ${pascalName} = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ${pascalName}Status = "idle" | "loading" | "success" | "error";
`;
}

function keysContent(camelName, name) {
  return `export const ${camelName}Keys = {
  all: ["${name}"] as const,
  detail: () => [...${camelName}Keys.all, "detail"] as const,
};
`;
}

function storeContent(camelName, pascalName) {
  return `import { create } from "zustand";
import type { ${pascalName}, ${pascalName}Status } from "./${toKebabCase(pascalName)}.types";

type ${pascalName}State = {
  item: ${pascalName} | null;
  status: ${pascalName}Status;
  setItem: (item: ${pascalName} | null) => void;
  setStatus: (status: ${pascalName}Status) => void;
  reset: () => void;
};

const initialState = {
  item: null,
  status: "idle" as ${pascalName}Status,
};

export const use${pascalName}Store = create<${pascalName}State>((set) => ({
  ...initialState,
  setItem: (item) => set({ item }),
  setStatus: (status) => set({ status }),
  reset: () => set(initialState),
}));
`;
}

function helpersContent(camelName, pascalName) {
  return `import type { ${pascalName} } from "../model/${toKebabCase(pascalName)}.types";

export function has${pascalName}(item: ${pascalName} | null): item is ${pascalName} {
  return Boolean(item);
}

export function get${pascalName}Label(item: ${pascalName}) {
  return item.name;
}
`;
}

function sliceContent(camelName, pascalName) {
  return `import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ${pascalName}, ${pascalName}Status } from "./${toKebabCase(pascalName)}.types";

export type ${pascalName}State = {
  item: ${pascalName} | null;
  status: ${pascalName}Status;
};

const initialState: ${pascalName}State = {
  item: null,
  status: "idle",
};

export const ${camelName}Slice = createSlice({
  name: "${camelName}",
  initialState,
  reducers: {
    set${pascalName}: (state, action: PayloadAction<${pascalName} | null>) => {
      state.item = action.payload;
    },
    set${pascalName}Status: (state, action: PayloadAction<${pascalName}Status>) => {
      state.status = action.payload;
    },
    reset${pascalName}: () => initialState,
  },
});

export const { set${pascalName}, set${pascalName}Status, reset${pascalName} } = ${camelName}Slice.actions;
export const ${camelName}Reducer = ${camelName}Slice.reducer;
`;
}

function selectorsContent(camelName, pascalName) {
  return `type RootState = {
  ${camelName}: import("./${toKebabCase(pascalName)}.slice").${pascalName}State;
};

export const select${pascalName}State = (state: RootState) => state.${camelName};
export const select${pascalName} = (state: RootState) => state.${camelName}.item;
export const select${pascalName}Status = (state: RootState) => state.${camelName}.status;
`;
}

function viewContent(componentName, title) {
  return `type ${componentName}Props = {
  title?: string;
};

export function ${componentName}({ title = "${title}" }: ${componentName}Props) {
  return (
    <section>
      <h2>{title}</h2>
    </section>
  );
}
`;
}

function entityTypesContent(pascalName) {
  return `export type ${pascalName} = {
  id: string;
  name: string;
  description?: string;
};
`;
}

function entityCardContent(name, pascalName) {
  return `import type { ${pascalName} } from "../model/${name}.types";

type ${pascalName}CardProps = {
  ${toCamelCase(name)}: ${pascalName};
};

export function ${pascalName}Card({ ${toCamelCase(name)} }: ${pascalName}CardProps) {
  return (
    <article>
      <h3>{${toCamelCase(name)}.name}</h3>
      {${toCamelCase(name)}.description ? <p>{${toCamelCase(name)}.description}</p> : null}
    </article>
  );
}
`;
}

function toKebabCase(value) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function toPascalCase(value) {
  return toKebabCase(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toCamelCase(value) {
  const pascal = toPascalCase(value);

  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toTitle(value) {
  return toKebabCase(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function printSuccess(files) {
  console.log();
  console.log(chalk.green.bold("  Slice generated successfully!"));
  console.log();
  console.log(chalk.bold.white("  Created files:"));

  for (const filePath of files) {
    console.log(`    ${chalk.cyan("-")} ${filePath}`);
  }

  console.log();
}
