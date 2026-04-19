import { evaluateHostOperation } from "../host/adapter.js";
import { OPENCODE_FILE_TOOL, type OpenCodeFileTool } from "../opencode/types.js";

export const GUARDED_TOOL = {
  READ: OPENCODE_FILE_TOOL.READ,
  WRITE: OPENCODE_FILE_TOOL.WRITE,
  EDIT: OPENCODE_FILE_TOOL.EDIT,
  PATCH: "patch",
  APPLY_PATCH: "apply_patch",
} as const;

export type GuardedTool = Exclude<(typeof GUARDED_TOOL)[keyof typeof GUARDED_TOOL], "apply_patch">;

const DEFAULT_GUARDED_TOOLS = [
  GUARDED_TOOL.READ,
  GUARDED_TOOL.WRITE,
  GUARDED_TOOL.EDIT,
] as const;

export interface OpencodeGuardPluginOptions {
  configDirectory?: string;
  workspaceRoot?: string;
  guardedTools?: GuardedTool[];
}

export interface PluginInputLike {
  directory: string;
}

export interface ToolExecuteBeforeInputLike {
  tool: string;
  sessionID: string;
  callID: string;
}

export interface ToolExecuteBeforeOutputLike {
  args: unknown;
}

export interface PermissionAskInputLike {
  type: string;
  pattern?: string | string[];
}

export interface PermissionAskOutputLike {
  status: "ask" | "deny" | "allow";
}

export interface PluginHooksLike {
  "tool.execute.before"?: (input: ToolExecuteBeforeInputLike, output: ToolExecuteBeforeOutputLike) => Promise<void>;
  "permission.ask"?: (input: PermissionAskInputLike, output: PermissionAskOutputLike) => Promise<void>;
}

function resolveGuardedTools(options?: OpencodeGuardPluginOptions): ReadonlySet<string> {
  const guardedTools = options?.guardedTools ?? [...DEFAULT_GUARDED_TOOLS];
  return new Set(guardedTools);
}

function resolveConfigDirectory(input: PluginInputLike, options?: OpencodeGuardPluginOptions): string {
  return options?.configDirectory?.trim() || input.directory;
}

function resolveWorkspaceRoot(input: PluginInputLike, options?: OpencodeGuardPluginOptions): string {
  return options?.workspaceRoot?.trim() || input.directory;
}

function isOpenCodeEnvelopeTool(tool: string): tool is OpenCodeFileTool {
  return tool === OPENCODE_FILE_TOOL.READ || tool === OPENCODE_FILE_TOOL.WRITE || tool === OPENCODE_FILE_TOOL.EDIT;
}

function readPermissionTargetPath(input: PermissionAskInputLike): string | null {
  if (typeof input.pattern === "string") {
    return input.pattern;
  }

  if (Array.isArray(input.pattern) && typeof input.pattern[0] === "string") {
    return input.pattern[0];
  }

  return null;
}

function readToolTargetPath(args: unknown): string | null {
  if (typeof args !== "object" || args === null) {
    return null;
  }

  const input = args as Record<string, unknown>;
  return typeof input.filePath === "string" ? input.filePath : null;
}

function extractApplyPatchTargets(args: unknown): string[] | null {
  if (typeof args !== "object" || args === null) {
    return null;
  }

  const input = args as Record<string, unknown>;

  if (typeof input.patchText !== "string") {
    return null;
  }

  const matches = [...input.patchText.matchAll(/^(?:\*\*\* Update File:|\*\*\* Add File:|\*\*\* Delete File:)\s+(.+)$/gm)];

  if (matches.length === 0) {
    return null;
  }

  const targets = matches
    .map((match) => match[1]?.trim() ?? "")
    .filter((target) => target.length > 0);

  if (targets.length !== matches.length) {
    return null;
  }

  return [...new Set(targets)];
}

async function evaluateGuardedTarget(
  configDirectory: string,
  workspaceRoot: string,
  command: string,
  targetPath: string,
): Promise<ReturnType<typeof evaluateHostOperation>> {
  return evaluateHostOperation({
    configDirectory,
    input: {
      command,
      targetPath,
      workspaceRoot,
    },
  });
}

export async function createOpencodeGuardPlugin(input: PluginInputLike, options?: OpencodeGuardPluginOptions): Promise<PluginHooksLike> {
  const guardedTools = resolveGuardedTools(options);
  const configDirectory = resolveConfigDirectory(input, options);
  const workspaceRoot = resolveWorkspaceRoot(input, options);

  return {
    "permission.ask": async (input, output) => {
      if (!guardedTools.has(input.type)) {
        return;
      }

      const targetPath = readPermissionTargetPath(input);

      if (targetPath === null) {
        output.status = "deny";
        return;
      }

      const result = await evaluateGuardedTarget(configDirectory, workspaceRoot, input.type, targetPath);

      if (result.decision.action === "deny") {
        output.status = "deny";
      }
    },
    "tool.execute.before": async (event, output) => {
      const isGuardedStandardTool = guardedTools.has(event.tool);
      const isGuardedApplyPatch = event.tool === GUARDED_TOOL.APPLY_PATCH && guardedTools.has(GUARDED_TOOL.PATCH);

      if (!isGuardedStandardTool && !isGuardedApplyPatch) {
        return;
      }

      if (isGuardedApplyPatch) {
        const targetPaths = extractApplyPatchTargets(output.args);

        if (targetPaths === null) {
          throw new Error("opencode-guard denied apply_patch: unsupported or ambiguous patch payload.");
        }

        for (const targetPath of targetPaths) {
          const result = await evaluateGuardedTarget(configDirectory, workspaceRoot, GUARDED_TOOL.PATCH, targetPath);

          if (result.decision.action === "deny") {
            throw new Error(`opencode-guard denied apply_patch: ${result.hostMessage}`);
          }
        }

        return;
      }

      if (!isOpenCodeEnvelopeTool(event.tool)) {
        return;
      }

      const targetPath = readToolTargetPath(output.args);

      if (targetPath === null) {
        throw new Error(`opencode-guard denied ${event.tool}: unsupported or ambiguous tool payload.`);
      }

      const result = await evaluateGuardedTarget(configDirectory, workspaceRoot, event.tool, targetPath);

      if (result.decision.action === "deny") {
        throw new Error(`opencode-guard denied ${event.tool}: ${result.hostMessage}`);
      }
    },
  };
}

export default createOpencodeGuardPlugin;
