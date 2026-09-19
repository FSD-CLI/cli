import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  configureProject,
  normalizeProjectConfig,
} from "../bin/project-config.mjs";
import { generateSlice, loadProjectConfig } from "../bin/generator.mjs";

function createFixture() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-test-"));
  fs.mkdirSync(path.join(fixture, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(fixture, "package.json"),
    `${JSON.stringify({
      dependencies: {
        react: "^19.0.0",
        axios: "old",
        zustand: "old",
        "@tanstack/react-query": "old",
      },
    })}\n`
  );
  fs.writeFileSync(path.join(fixture, "package-lock.json"), "{}\n");
  fs.writeFileSync(path.join(fixture, "bun.lock"), "");
  return fixture;
}

test("project configuration installs only the selected stack", () => {
  const fixture = createFixture();

  try {
    const config = normalizeProjectConfig("react-vite", {
      packageManager: "pnpm",
      apiClient: "fetch",
      serverState: "none",
      clientState: "redux",
      forms: "none",
    });

    configureProject(fixture, config);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(fixture, "package.json"), "utf8")
    );
    assert.equal(packageJson.dependencies.axios, undefined);
    assert.equal(packageJson.dependencies.zustand, undefined);
    assert.equal(packageJson.dependencies["@tanstack/react-query"], undefined);
    assert.ok(packageJson.dependencies["@reduxjs/toolkit"]);
    assert.ok(packageJson.dependencies["react-redux"]);
    assert.equal(fs.existsSync(path.join(fixture, "src/app/store.ts")), false);
    assert.equal(
      fs.existsSync(path.join(fixture, "src/app/providers/store.ts")),
      true
    );
    assert.equal(fs.existsSync(path.join(fixture, "package-lock.json")), false);
    assert.equal(fs.existsSync(path.join(fixture, "bun.lock")), false);
    assert.match(
      fs.readFileSync(path.join(fixture, "src/shared/api/client.ts"), "utf8"),
      /export const apiClient/
    );
    const generatedStack = fs.readFileSync(
      path.join(fixture, "src/shared/config/fsd-stack.ts"),
      "utf8"
    );
    assert.match(generatedStack, /frameworkLabel: "React \+ Vite",/);
    assert.match(generatedStack, /packageManager: "pnpm",/);
    assert.match(generatedStack, /dev: "pnpm dev",/);
    assert.doesNotMatch(generatedStack, /"frameworkLabel":/);
    assert.deepEqual(loadProjectConfig(fixture), config);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("Yarn projects establish an isolated node-modules workspace", () => {
  const fixture = createFixture();

  try {
    const config = normalizeProjectConfig("react-vite", {
      packageManager: "yarn",
    });
    configureProject(fixture, config);

    assert.equal(
      fs.readFileSync(path.join(fixture, ".yarnrc.yml"), "utf8"),
      "nodeLinker: node-modules\n"
    );
    assert.equal(fs.readFileSync(path.join(fixture, "yarn.lock"), "utf8"), "");

    configureProject(fixture, { ...config, packageManager: "npm" });
    assert.equal(fs.existsSync(path.join(fixture, ".yarnrc.yml")), false);
    assert.equal(fs.existsSync(path.join(fixture, "yarn.lock")), false);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("feature generator reads the saved stack without additional choices", () => {
  const fixture = createFixture();

  try {
    const config = normalizeProjectConfig("nextjs");
    configureProject(fixture, config);
    const files = generateSlice({
      cwd: fixture,
      type: "feature",
      name: "profile",
      config: loadProjectConfig(fixture),
      force: false,
    });

    assert.ok(files.includes("src/features/profile/api/profile.query.ts"));
    assert.ok(files.includes("src/features/profile/model/profile.store.ts"));
    assert.ok(files.includes("src/features/profile/ui/profile-view.tsx"));
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("auth generator creates the complete flow and working mutation submissions", () => {
  const fixture = createFixture();

  try {
    const config = normalizeProjectConfig("nextjs", { clientState: "redux" });
    configureProject(fixture, config);
    const files = generateSlice({
      cwd: fixture,
      type: "feature",
      name: "auth",
      config: loadProjectConfig(fixture),
      force: false,
    });

    assert.ok(files.includes("src/features/auth/ui/login-form.tsx"));
    assert.ok(files.includes("src/features/auth/ui/register-form.tsx"));
    assert.ok(files.includes("src/features/auth/ui/forgot-password-form.tsx"));
    assert.ok(files.includes("src/features/auth/ui/reset-password-form.tsx"));
    assert.ok(files.includes("src/features/auth/ui/verify-code-form.tsx"));
    assert.ok(files.includes("src/features/auth/model/login.schema.ts"));

    const loginApi = fs.readFileSync(
      path.join(fixture, "src/features/auth/api/login.api.ts"),
      "utf8"
    );
    const loginForm = fs.readFileSync(
      path.join(fixture, "src/features/auth/ui/login-form.tsx"),
      "utf8"
    );
    assert.match(loginApi, /AuthSession.*auth\.types/);
    assert.match(loginForm, /^"use client";/);
    assert.match(loginForm, /useForm<LoginFormValues>/);
    assert.match(loginForm, /zodResolver\(loginSchema\)/);
    assert.match(loginForm, /loginMutation\.mutate/);
    const store = fs.readFileSync(
      path.join(fixture, "src/app/providers/store.ts"),
      "utf8"
    );
    assert.match(store, /import \{ authReducer \} from "@\/features\/auth"/);
    assert.match(store, /auth: authReducer/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("forms can be generated without a server-state dependency", () => {
  const fixture = createFixture();

  try {
    const config = normalizeProjectConfig("nextjs", {
      serverState: "none",
      clientState: "none",
    });
    configureProject(fixture, config);
    const files = generateSlice({
      cwd: fixture,
      type: "feature",
      name: "auth",
      config: loadProjectConfig(fixture),
      force: false,
    });

    assert.ok(files.includes("src/features/auth/model/login.types.ts"));
    assert.ok(files.includes("src/features/auth/model/login.schema.ts"));
    const loginForm = fs.readFileSync(
      path.join(fixture, "src/features/auth/ui/login-form.tsx"),
      "utf8"
    );
    assert.doesNotMatch(loginForm, /@tanstack\/react-query|loginMutation/);
    assert.match(loginForm, /useForm<LoginFormValues>/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("Vue projects receive framework-native dependencies, providers, and generators", () => {
  const fixture = createFixture();

  try {
    const config = normalizeProjectConfig("vue-vite");
    configureProject(fixture, config);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(fixture, "package.json"), "utf8")
    );
    assert.equal(packageJson.dependencies.zustand, undefined);
    assert.equal(packageJson.dependencies["@tanstack/react-query"], undefined);
    assert.ok(packageJson.dependencies.pinia);
    assert.ok(packageJson.dependencies["@tanstack/vue-query"]);
    assert.ok(packageJson.dependencies["vee-validate"]);
    assert.equal(packageJson.dependencies.zod, "^3.25.76");

    const providers = fs.readFileSync(
      path.join(fixture, "src/app/providers/index.ts"),
      "utf8"
    );
    assert.match(providers, /createPinia/);
    assert.match(providers, /VueQueryPlugin/);
    assert.equal(
      fs.existsSync(path.join(fixture, "src/app/providers/AppProviders.tsx")),
      false
    );

    const files = generateSlice({
      cwd: fixture,
      type: "feature",
      name: "auth",
      config: loadProjectConfig(fixture),
      force: false,
    });
    assert.ok(files.includes("src/features/auth/ui/LoginForm.vue"));
    assert.ok(files.includes("src/features/auth/ui/VerifyCodeForm.vue"));
    assert.ok(files.includes("src/features/auth/model/auth.store.ts"));
    assert.ok(files.includes("src/features/auth/api/auth.query.ts"));

    const loginForm = fs.readFileSync(
      path.join(fixture, "src/features/auth/ui/LoginForm.vue"),
      "utf8"
    );
    const publicApi = fs.readFileSync(
      path.join(fixture, "src/features/auth/index.ts"),
      "utf8"
    );
    assert.match(loginForm, /useForm<LoginCredentials>/);
    assert.match(loginForm, /useLoginMutation/);
    assert.match(publicApi, /default as LoginForm/);
    assert.doesNotMatch(loginForm, /use client/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("SvelteKit projects receive native dependencies, providers, stores, forms, and routes", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-sveltekit-test-"));

  try {
    fs.mkdirSync(path.join(fixture, "src/routes"), { recursive: true });
    fs.writeFileSync(
      path.join(fixture, "package.json"),
      `${JSON.stringify({
        dependencies: {
          "@sveltejs/kit": "^2.70.3",
          svelte: "^5.57.1",
          axios: "old",
        },
      })}\n`
    );

    const config = normalizeProjectConfig("sveltekit");
    configureProject(fixture, config);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(fixture, "package.json"), "utf8")
    );
    assert.equal(packageJson.dependencies.axios, undefined);
    assert.ok(packageJson.dependencies["@tanstack/svelte-query"]);
    assert.ok(packageJson.dependencies["sveltekit-superforms"]);
    assert.equal(packageJson.dependencies.zod, "^4.6.5");

    const provider = fs.readFileSync(
      path.join(fixture, "src/app/providers/query/QueryProvider.svelte"),
      "utf8"
    );
    assert.match(provider, /QueryClientProvider/);
    assert.match(provider, /\$props\(\)/);

    const apiClient = fs.readFileSync(
      path.join(fixture, "src/shared/api/client.ts"),
      "utf8"
    );
    assert.match(apiClient, /\$env\/dynamic\/public/);
    assert.match(apiClient, /PUBLIC_API_BASE/);
    assert.match(apiClient, /fetcher: Fetcher = fetch/);

    const authFiles = generateSlice({
      cwd: fixture,
      type: "feature",
      name: "auth",
      config: loadProjectConfig(fixture),
      force: false,
    });
    assert.ok(authFiles.includes("src/features/auth/ui/LoginForm.svelte"));
    assert.ok(authFiles.includes("src/features/auth/ui/VerifyCodeForm.svelte"));
    assert.ok(authFiles.includes("src/features/auth/model/auth.store.ts"));
    assert.ok(authFiles.includes("src/features/auth/api/auth.query.ts"));
    assert.ok(authFiles.includes("src/features/auth/model/login.schema.ts"));

    const loginForm = fs.readFileSync(
      path.join(fixture, "src/features/auth/ui/LoginForm.svelte"),
      "utf8"
    );
    const publicApi = fs.readFileSync(
      path.join(fixture, "src/features/auth/index.ts"),
      "utf8"
    );
    assert.match(loginForm, /superForm/);
    assert.match(loginForm, /zod4Client/);
    assert.match(loginForm, /use:enhance/);
    assert.match(publicApi, /default as LoginForm/);

    const pageFiles = generateSlice({
      cwd: fixture,
      type: "page",
      name: "account",
      config: loadProjectConfig(fixture),
      force: false,
    });
    assert.ok(pageFiles.includes("src/pages/account/ui/AccountPage.svelte"));
    assert.ok(pageFiles.includes("src/routes/account/+page.svelte"));

    configureProject(fixture, {
      ...config,
      serverState: "none",
      clientState: "none",
      forms: "none",
    });
    const passthroughProvider = fs.readFileSync(
      path.join(fixture, "src/app/providers/query/QueryProvider.svelte"),
      "utf8"
    );
    assert.doesNotMatch(passthroughProvider, /@tanstack\/svelte-query/);
    assert.match(passthroughProvider, /@render children/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("Nuxt projects receive modules, SSR providers, runtime API clients, and app-root generators", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "fsd-cli-nuxt-test-"));

  try {
    fs.mkdirSync(path.join(fixture, "app/app/routes"), { recursive: true });
    fs.writeFileSync(
      path.join(fixture, "package.json"),
      `${JSON.stringify({
        dependencies: {
          nuxt: "^4.5.2",
          vue: "^3.5.42",
          "vue-router": "^5.3.1",
          axios: "old",
        },
      })}\n`
    );
    fs.writeFileSync(
      path.join(fixture, "nuxt.config.ts"),
      `export default defineNuxtConfig({\n  modules: [\n    "@nuxt/eslint",\n    // fsd-cli:modules:start\n    // fsd-cli:modules:end\n  ],\n});\n`
    );

    const config = normalizeProjectConfig("nuxt");
    configureProject(fixture, config);

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(fixture, "package.json"), "utf8")
    );
    assert.equal(packageJson.dependencies.axios, undefined);
    assert.ok(packageJson.dependencies["@pinia/nuxt"]);
    assert.ok(packageJson.dependencies["@tanstack/vue-query"]);
    assert.ok(packageJson.dependencies["@vee-validate/nuxt"]);
    assert.ok(packageJson.dependencies["vue-router"]);

    const nuxtConfig = fs.readFileSync(
      path.join(fixture, "nuxt.config.ts"),
      "utf8"
    );
    assert.match(nuxtConfig, /"@nuxt\/eslint"/);
    assert.match(nuxtConfig, /'@pinia\/nuxt'/);
    assert.match(nuxtConfig, /'@vee-validate\/nuxt'/);
    assert.equal(
      fs.existsSync(path.join(fixture, "app/plugins/vue-query.ts")),
      true
    );

    const apiClient = fs.readFileSync(
      path.join(fixture, "app/shared/api/client.ts"),
      "utf8"
    );
    assert.match(apiClient, /useRuntimeConfig\(\)/);
    assert.match(apiClient, /\$fetch<T>/);
    assert.equal(
      fs.existsSync(path.join(fixture, "app/shared/config/fsd-stack.ts")),
      true
    );

    const files = generateSlice({
      cwd: fixture,
      type: "page",
      name: "account",
      config: loadProjectConfig(fixture),
      force: false,
    });
    assert.ok(files.includes("app/pages/account/ui/AccountPage.vue"));
    assert.ok(files.includes("app/app/routes/account.vue"));

    configureProject(fixture, {
      ...config,
      serverState: "none",
      clientState: "none",
      forms: "none",
    });
    assert.equal(
      fs.existsSync(path.join(fixture, "app/plugins/vue-query.ts")),
      false
    );
    const strippedNuxtConfig = fs.readFileSync(
      path.join(fixture, "nuxt.config.ts"),
      "utf8"
    );
    assert.doesNotMatch(strippedNuxtConfig, /'@pinia\/nuxt'/);
    assert.doesNotMatch(strippedNuxtConfig, /'@vee-validate\/nuxt'/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
