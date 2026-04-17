import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import * as path from "node:path";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";

import {
  GuardConfigError,
  GuardPathError,
  canonicalizeTargetPath,
  evaluateHostOperation,
  evaluateOperation,
  HOST_FAILURE_STAGE,
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

test("evaluateHostOperation allows valid host input only after config load and request preparation", async () => {
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

    const result = await evaluateHostOperation({
      configDirectory: workspaceRoot,
      input: {
        command: "read",
        targetPath: "./docs/guide.md",
        workspaceRoot,
      },
    });

    assert.equal(result.decision.action, "allow");
    assert.equal(result.decision.matchedRuleId, "allow-docs-read");
    assert.equal(result.failureStage, HOST_FAILURE_STAGE.NONE);
    assert.equal(result.configPath, path.join(workspaceRoot, ".opencode-guard.jsonc"));
  });
});

test("evaluateHostOperation denies malformed raw host input before evaluation", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    await mkdir(workspaceRoot, { recursive: true });

    const result = await evaluateHostOperation({
      configDirectory: workspaceRoot,
      input: {
        command: "read",
        targetPath: "./docs/guide.md",
        workspaceRoot,
        extra: true,
      },
    });

    assert.equal(result.decision.action, "deny");
    assert.equal(result.failureStage, HOST_FAILURE_STAGE.INPUT);
    assert.equal(result.configPath, null);
    assert.match(result.decision.reason, /Unexpected property/);
  });
});

test("evaluateHostOperation denies missing config before policy execution", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    await mkdir(workspaceRoot, { recursive: true });

    const result = await evaluateHostOperation({
      configDirectory: workspaceRoot,
      input: {
        command: "read",
        targetPath: "./docs/guide.md",
        workspaceRoot,
      },
    });

    assert.equal(result.decision.action, "deny");
    assert.equal(result.failureStage, HOST_FAILURE_STAGE.CONFIG);
    assert.equal(result.configPath, null);
    assert.match(result.decision.reason, /Configuration could not be loaded safely/);
  });
});

test("evaluateHostOperation denies symlinked workspace roots through request preparation", async () => {
  await withTempDir(async (tempDir) => {
    const realWorkspaceRoot = path.join(tempDir, "workspace-real");
    const symlinkedWorkspaceRoot = path.join(tempDir, "workspace-link");
    const docsDirectory = path.join(realWorkspaceRoot, "docs");

    await mkdir(docsDirectory, { recursive: true });
    await writeFile(
      path.join(realWorkspaceRoot, ".opencode-guard.jsonc"),
      `{
        "version": 1,
        "defaultAction": "deny",
        "symlinkPolicy": "deny",
        "rules": []
      }`,
      "utf8",
    );
    await symlink(realWorkspaceRoot, symlinkedWorkspaceRoot);

    const result = await evaluateHostOperation({
      configDirectory: realWorkspaceRoot,
      input: {
        command: "read",
        targetPath: "./docs/guide.md",
        workspaceRoot: symlinkedWorkspaceRoot,
      },
    });

    assert.equal(result.decision.action, "deny");
    assert.equal(result.failureStage, HOST_FAILURE_STAGE.PATH);
    assert.equal(result.configPath, path.join(realWorkspaceRoot, ".opencode-guard.jsonc"));
    assert.match(result.decision.reason, /Workspace root must not be a symlinked path/);
  });
});

test("canonicalizeTargetPath preserves missing in-workspace targets as unresolved but safe", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    await mkdir(path.join(workspaceRoot, "docs"), { recursive: true });

    const result = await canonicalizeTargetPath({
      workspaceRoot,
      targetPath: "./docs/missing.md",
      symlinkPolicy: "deny",
    });

    assert.equal(result.workspaceRoot, workspaceRoot);
    assert.equal(result.canonicalTargetPath, path.join(workspaceRoot, "docs", "missing.md"));
    assert.equal(result.targetPathExists, false);
  });
});
