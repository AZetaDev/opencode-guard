import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import * as path from "node:path";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";

import {
  GuardConfigError,
  GuardPathError,
  canonicalizeTargetPath,
  evaluateOperation,
  loadGuardConfig,
  prepareOperationRequest,
} from "../dist/index.js";

async function withTempDir(run) {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "opencode-guard-"));

  try {
    await run(temporaryDirectory);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

test("loadGuardConfig parses valid JSONC config", async () => {
  await withTempDir(async (tempDir) => {
    const configPath = path.join(tempDir, ".opencode-guard.jsonc");

    await writeFile(
      configPath,
      `{
        // comments are allowed
        "version": 1,
        "defaultAction": "deny",
        "symlinkPolicy": "deny",
        "rules": [
          {
            "id": "allow-docs-read",
            "action": "allow",
            "command": "read",
            "pathPrefix": "/workspace/docs"
          }
        ]
      }`,
      "utf8",
    );

    const loadedConfig = await loadGuardConfig(tempDir);

    assert.equal(loadedConfig.config.defaultAction, "deny");
    assert.equal(loadedConfig.config.symlinkPolicy, "deny");
    assert.equal(loadedConfig.config.rules.length, 1);
    assert.equal(loadedConfig.configPath, configPath);
  });
});

test("loadGuardConfig rejects unexpected config properties", async () => {
  await withTempDir(async (tempDir) => {
    await writeFile(
      path.join(tempDir, ".opencode-guard.jsonc"),
      JSON.stringify({
        version: 1,
        defaultAction: "deny",
        symlinkPolicy: "deny",
        rules: [],
        extra: true,
      }),
      "utf8",
    );

    await assert.rejects(
      () => loadGuardConfig(tempDir),
      (error) => {
        assert.ok(error instanceof GuardConfigError);
        assert.match(error.message, /Invalid \.opencode-guard\.jsonc\./);
        assert.ok(error.issues.some((issue) => issue.includes("$.extra: Unexpected property.")));
        return true;
      },
    );
  });
});

test("canonicalizeTargetPath rejects workspace escape paths", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    await mkdir(workspaceRoot);

    await assert.rejects(
      () =>
        canonicalizeTargetPath({
          workspaceRoot,
          targetPath: "../outside.txt",
          symlinkPolicy: "deny",
        }),
      (error) => {
        assert.ok(error instanceof GuardPathError);
        assert.match(error.message, /escapes the workspace root/);
        return true;
      },
    );
  });
});

test("canonicalizeTargetPath rejects symlink targets", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    const realDirectory = path.join(workspaceRoot, "real");
    const realFile = path.join(realDirectory, "allowed.txt");
    const symlinkPath = path.join(workspaceRoot, "linked.txt");

    await mkdir(realDirectory, { recursive: true });
    await writeFile(realFile, "safe", "utf8");
    await symlink(realFile, symlinkPath);

    await assert.rejects(
      () =>
        canonicalizeTargetPath({
          workspaceRoot,
          targetPath: symlinkPath,
          symlinkPolicy: "deny",
        }),
      (error) => {
        assert.ok(error instanceof GuardPathError);
        assert.match(error.message, /Symlink access is denied/);
        return true;
      },
    );
  });
});

test("prepareOperationRequest and evaluateOperation allow matching canonical targets", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    const docsDirectory = path.join(workspaceRoot, "docs");
    const targetFile = path.join(docsDirectory, "guide.md");

    await mkdir(docsDirectory, { recursive: true });
    await writeFile(targetFile, "# guide", "utf8");
    await writeFile(
      path.join(workspaceRoot, ".opencode-guard.jsonc"),
      `{
        "version": 1,
        "defaultAction": "deny",
        "symlinkPolicy": "deny",
        "rules": [
          {
            "id": "allow-docs-read",
            "action": "allow",
            "command": "read",
            "pathPrefix": "${docsDirectory.replaceAll("\\", "\\\\")}"
          }
        ]
      }`,
      "utf8",
    );

    const loadedConfig = await loadGuardConfig(workspaceRoot);
    const preparedRequest = await prepareOperationRequest({
      loadedConfig,
      request: {
        command: "read",
        targetPath: "./docs/guide.md",
        workspaceRoot,
      },
    });
    const decision = evaluateOperation(loadedConfig.config, preparedRequest);
    const loadedFileContents = await readFile(targetFile, "utf8");

    assert.equal(preparedRequest.canonicalTargetPath, targetFile);
    assert.equal(preparedRequest.targetPathExists, true);
    assert.equal(loadedFileContents, "# guide");
    assert.equal(decision.action, "allow");
    assert.equal(decision.matchedRuleId, "allow-docs-read");
  });
});
