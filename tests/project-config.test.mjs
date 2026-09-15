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
    assert.deepEqual(loadProjectConfig(fixture), config);
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
