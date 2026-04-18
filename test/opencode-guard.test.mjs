import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import * as path from "node:path";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";

import {
  AUDIT_TARGET_PATH_KIND,
  GuardConfigError,
  GuardPathError,
  canonicalizeTargetPath,
  evaluateHostOperation,
  evaluateOpenCodeToolCall,
  evaluateOperation,
  HOST_FAILURE_STAGE,
  HOST_REASON_CODE,
  loadGuardConfig,
  OPENCODE_FILE_TOOL,
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
    assert.equal(result.hostMessage, "Operation allowed by local security policy.");
    assert.equal(result.reasonCode, HOST_REASON_CODE.ALLOW_RULE_MATCH);
    assert.equal(result.failureStage, HOST_FAILURE_STAGE.NONE);
    assert.equal(result.configPath, path.join(workspaceRoot, ".opencode-guard.jsonc"));
    assert.deepEqual(result.audit, {
      action: "allow",
      failureStage: HOST_FAILURE_STAGE.NONE,
      reasonCode: HOST_REASON_CODE.ALLOW_RULE_MATCH,
      matchedRuleId: "allow-docs-read",
      configLoaded: true,
      configPath: path.join(workspaceRoot, ".opencode-guard.jsonc"),
      command: "read",
      targetPathKind: AUDIT_TARGET_PATH_KIND.RELATIVE,
      targetPathExists: true,
    });
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
    assert.equal(result.hostMessage, "Operation denied: invalid host request.");
    assert.equal(result.reasonCode, HOST_REASON_CODE.DENY_HOST_INPUT);
    assert.equal(result.failureStage, HOST_FAILURE_STAGE.INPUT);
    assert.equal(result.configPath, null);
    assert.match(result.decision.reason, /Unexpected property/);
    assert.equal(result.audit.targetPathKind, AUDIT_TARGET_PATH_KIND.RELATIVE);
    assert.equal(result.audit.command, "read");
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
    assert.equal(result.hostMessage, "Operation denied: security policy unavailable.");
    assert.equal(result.reasonCode, HOST_REASON_CODE.DENY_CONFIG_LOAD);
    assert.equal(result.failureStage, HOST_FAILURE_STAGE.CONFIG);
    assert.equal(result.configPath, null);
    assert.match(result.decision.reason, /Configuration could not be loaded safely/);
    assert.equal(result.audit.configLoaded, false);
    assert.equal(result.audit.command, "read");
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
    assert.equal(result.hostMessage, "Operation denied: target path rejected by security policy.");
    assert.equal(result.reasonCode, HOST_REASON_CODE.DENY_PATH_POLICY);
    assert.equal(result.failureStage, HOST_FAILURE_STAGE.PATH);
    assert.equal(result.configPath, path.join(realWorkspaceRoot, ".opencode-guard.jsonc"));
    assert.match(result.decision.reason, /Workspace root must not be a symlinked path/);
    assert.equal(result.audit.targetPathExists, null);
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

test("evaluateHostOperation redacts default-deny host message and audit path details", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    const docsDirectory = path.join(workspaceRoot, "docs");
    const targetFile = path.join(docsDirectory, "secret.md");

    await mkdir(docsDirectory, { recursive: true });
    await writeFile(targetFile, "secret", "utf8");
    await writeFile(
      path.join(workspaceRoot, ".opencode-guard.jsonc"),
      `{
        "version": 1,
        "defaultAction": "deny",
        "symlinkPolicy": "deny",
        "rules": []
      }`,
      "utf8",
    );

    const result = await evaluateHostOperation({
      configDirectory: workspaceRoot,
      input: {
        command: "read",
        targetPath: "./docs/secret.md",
        workspaceRoot,
      },
    });

    assert.equal(result.decision.action, "deny");
    assert.equal(result.hostMessage, "Operation denied by local security policy.");
    assert.equal(result.reasonCode, HOST_REASON_CODE.DENY_POLICY_DEFAULT);
    assert.match(result.decision.reason, /No matching rule/);
    assert.ok(!result.hostMessage.includes("secret.md"));
    assert.equal("targetPath" in result.audit, false);
    assert.equal(result.audit.targetPathKind, AUDIT_TARGET_PATH_KIND.RELATIVE);
    assert.equal(result.audit.targetPathExists, true);
  });
});

test("canonicalizeTargetPath rejects absolute paths outside the workspace root", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    const outsidePath = path.join(tempDir, "outside.txt");

    await mkdir(workspaceRoot, { recursive: true });
    await writeFile(outsidePath, "outside", "utf8");

    await assert.rejects(
      () =>
        canonicalizeTargetPath({
          workspaceRoot,
          targetPath: outsidePath,
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

test("canonicalizeTargetPath rejects symlinked path segments", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    const realDirectory = path.join(workspaceRoot, "real");
    const symlinkDirectory = path.join(workspaceRoot, "docs");

    await mkdir(realDirectory, { recursive: true });
    await writeFile(path.join(realDirectory, "guide.md"), "guide", "utf8");
    await symlink(realDirectory, symlinkDirectory);

    await assert.rejects(
      () =>
        canonicalizeTargetPath({
          workspaceRoot,
          targetPath: path.join(symlinkDirectory, "guide.md"),
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

test("canonicalizeTargetPath rejects paths containing null bytes", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    await mkdir(workspaceRoot, { recursive: true });

    await assert.rejects(
      () =>
        canonicalizeTargetPath({
          workspaceRoot,
          targetPath: `./docs/unsafe\u0000name.md`,
          symlinkPolicy: "deny",
        }),
      (error) => {
        assert.ok(error instanceof GuardPathError);
        assert.match(error.message, /null byte/);
        return true;
      },
    );
  });
});

test("canonicalizeTargetPath normalizes redundant separators and dot segments inside workspace", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    const docsDirectory = path.join(workspaceRoot, "docs");
    const targetFile = path.join(docsDirectory, "guide.md");

    await mkdir(docsDirectory, { recursive: true });
    await writeFile(targetFile, "guide", "utf8");

    const result = await canonicalizeTargetPath({
      workspaceRoot,
      targetPath: "./docs//nested/../guide.md",
      symlinkPolicy: "deny",
    });

    assert.equal(result.canonicalTargetPath, targetFile);
    assert.equal(result.targetPathExists, true);
  });
});

test("canonicalizeTargetPath rejects backslash-separated target paths in this runtime", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    await mkdir(workspaceRoot, { recursive: true });

    await assert.rejects(
      () =>
        canonicalizeTargetPath({
          workspaceRoot,
          targetPath: ".\\docs\\guide.md",
          symlinkPolicy: "deny",
        }),
      (error) => {
        assert.ok(error instanceof GuardPathError);
        assert.match(error.message, /forward slashes/);
        return true;
      },
    );
  });
});

test("canonicalizeTargetPath rejects Windows-style absolute paths in this runtime", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    await mkdir(workspaceRoot, { recursive: true });

    await assert.rejects(
      () =>
        canonicalizeTargetPath({
          workspaceRoot,
          targetPath: "C:/Users/example/secret.txt",
          symlinkPolicy: "deny",
        }),
      (error) => {
        assert.ok(error instanceof GuardPathError);
        assert.match(error.message, /Windows-style absolute syntax/);
        return true;
      },
    );
  });
});

test("evaluateOpenCodeToolCall maps supported read calls through the guarded host path", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    const docsDirectory = path.join(workspaceRoot, "docs");
    const targetFile = path.join(docsDirectory, "guide.md");

    await mkdir(docsDirectory, { recursive: true });
    await writeFile(targetFile, "guide", "utf8");
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

    const result = await evaluateOpenCodeToolCall({
      configDirectory: workspaceRoot,
      envelope: {
        session: {
          workspaceRoot,
        },
        tool: {
          name: OPENCODE_FILE_TOOL.READ,
          input: {
            filePath: "./docs/guide.md",
          },
        },
      },
    });

    assert.equal(result.runtime, "opencode");
    assert.equal(result.mappedToolName, "read");
    assert.equal(result.decision.action, "allow");
    assert.equal(result.reasonCode, HOST_REASON_CODE.ALLOW_RULE_MATCH);
    assert.equal(result.hostMessage, "Operation allowed by local security policy.");
  });
});

test("evaluateOpenCodeToolCall maps supported write calls through the guarded host path", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    const docsDirectory = path.join(workspaceRoot, "docs");
    const targetFile = path.join(docsDirectory, "guide.md");

    await mkdir(docsDirectory, { recursive: true });
    await writeFile(
      path.join(workspaceRoot, ".opencode-guard.jsonc"),
      `{
        "version": 1,
        "defaultAction": "deny",
        "symlinkPolicy": "deny",
        "rules": [
          {
            "id": "allow-docs-write",
            "action": "allow",
            "command": "write",
            "pathPrefix": "${docsDirectory.replaceAll("\\", "\\\\")}"
          }
        ]
      }`,
      "utf8",
    );

    const result = await evaluateOpenCodeToolCall({
      configDirectory: workspaceRoot,
      envelope: {
        session: {
          workspaceRoot,
        },
        tool: {
          name: OPENCODE_FILE_TOOL.WRITE,
          input: {
            filePath: targetFile,
            content: "updated",
          },
        },
      },
    });

    assert.equal(result.mappedToolName, "write");
    assert.equal(result.decision.action, "allow");
    assert.equal(result.reasonCode, HOST_REASON_CODE.ALLOW_RULE_MATCH);
  });
});

test("evaluateOpenCodeToolCall maps supported edit calls through the guarded host path", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    const docsDirectory = path.join(workspaceRoot, "docs");
    const targetFile = path.join(docsDirectory, "guide.md");

    await mkdir(docsDirectory, { recursive: true });
    await writeFile(targetFile, "before", "utf8");
    await writeFile(
      path.join(workspaceRoot, ".opencode-guard.jsonc"),
      `{
        "version": 1,
        "defaultAction": "deny",
        "symlinkPolicy": "deny",
        "rules": [
          {
            "id": "allow-docs-edit",
            "action": "allow",
            "command": "edit",
            "pathPrefix": "${docsDirectory.replaceAll("\\", "\\\\")}"
          }
        ]
      }`,
      "utf8",
    );

    const result = await evaluateOpenCodeToolCall({
      configDirectory: workspaceRoot,
      envelope: {
        session: {
          workspaceRoot,
        },
        tool: {
          name: OPENCODE_FILE_TOOL.EDIT,
          input: {
            filePath: "./docs/guide.md",
            oldString: "before",
            newString: "after",
            replaceAll: false,
          },
        },
      },
    });

    assert.equal(result.mappedToolName, "edit");
    assert.equal(result.decision.action, "allow");
    assert.equal(result.reasonCode, HOST_REASON_CODE.ALLOW_RULE_MATCH);
  });
});

test("evaluateOpenCodeToolCall denies unsupported tool mapping before evaluation", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    await mkdir(workspaceRoot, { recursive: true });

    const result = await evaluateOpenCodeToolCall({
      configDirectory: workspaceRoot,
      envelope: {
        session: {
          workspaceRoot,
        },
        tool: {
          name: "bash",
          input: {
            command: "rm -rf /",
          },
        },
      },
    });

    assert.equal(result.runtime, "opencode");
    assert.equal(result.mappedToolName, "bash");
    assert.equal(result.decision.action, "deny");
    assert.equal(result.reasonCode, HOST_REASON_CODE.DENY_HOST_INPUT);
    assert.equal(result.failureStage, HOST_FAILURE_STAGE.INPUT);
    assert.equal(result.audit.command, "bash");
  });
});

test("evaluateOpenCodeToolCall denies supported tools with unexpected input keys", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    await mkdir(workspaceRoot, { recursive: true });

    const result = await evaluateOpenCodeToolCall({
      configDirectory: workspaceRoot,
      envelope: {
        session: {
          workspaceRoot,
        },
        tool: {
          name: OPENCODE_FILE_TOOL.READ,
          input: {
            filePath: "./docs/guide.md",
            command: "ignored",
          },
        },
      },
    });

    assert.equal(result.decision.action, "deny");
    assert.equal(result.reasonCode, HOST_REASON_CODE.DENY_HOST_INPUT);
    assert.equal(result.failureStage, HOST_FAILURE_STAGE.INPUT);
  });
});

test("evaluateOpenCodeToolCall denies supported tools with wrong input types", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    await mkdir(workspaceRoot, { recursive: true });

    const result = await evaluateOpenCodeToolCall({
      configDirectory: workspaceRoot,
      envelope: {
        session: {
          workspaceRoot,
        },
        tool: {
          name: OPENCODE_FILE_TOOL.EDIT,
          input: {
            filePath: "./docs/guide.md",
            oldString: "a",
            newString: "b",
            replaceAll: "yes",
          },
        },
      },
    });

    assert.equal(result.decision.action, "deny");
    assert.equal(result.reasonCode, HOST_REASON_CODE.DENY_HOST_INPUT);
    assert.equal(result.failureStage, HOST_FAILURE_STAGE.INPUT);
  });
});

test("canonicalizeTargetPath normalizes workspace roots with trailing slashes", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    const docsDirectory = path.join(workspaceRoot, "docs");
    const targetFile = path.join(docsDirectory, "guide.md");

    await mkdir(docsDirectory, { recursive: true });
    await writeFile(targetFile, "guide", "utf8");

    const result = await canonicalizeTargetPath({
      workspaceRoot: `${workspaceRoot}/`,
      targetPath: "./docs/guide.md",
      symlinkPolicy: "deny",
    });

    assert.equal(result.workspaceRoot, workspaceRoot);
    assert.equal(result.canonicalTargetPath, targetFile);
    assert.equal(result.targetPathExists, true);
  });
});

test("canonicalizeTargetPath rejects Windows-style workspace roots in this runtime", async () => {
  await withTempDir(async () => {
    await assert.rejects(
      () =>
        canonicalizeTargetPath({
          workspaceRoot: "C:/workspace/project",
          targetPath: "./docs/guide.md",
          symlinkPolicy: "deny",
        }),
      (error) => {
        assert.ok(error instanceof GuardPathError);
        assert.match(error.message, /Windows-style absolute syntax/);
        return true;
      },
    );
  });
});

test("evaluateOpenCodeToolCall denies malformed runtime envelopes fail-closed", async () => {
  await withTempDir(async (tempDir) => {
    const workspaceRoot = path.join(tempDir, "workspace");
    await mkdir(workspaceRoot, { recursive: true });

    const result = await evaluateOpenCodeToolCall({
      configDirectory: workspaceRoot,
      envelope: {
        tool: {
          name: "read",
          input: {
            filePath: "./docs/guide.md",
          },
        },
      },
    });

    assert.equal(result.runtime, "opencode");
    assert.equal(result.mappedToolName, null);
    assert.equal(result.decision.action, "deny");
    assert.equal(result.reasonCode, HOST_REASON_CODE.DENY_HOST_INPUT);
    assert.equal(result.audit.command, null);
    assert.equal(result.audit.targetPathKind, AUDIT_TARGET_PATH_KIND.UNKNOWN);
  });
});
