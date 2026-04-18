import { evaluateOpenCodeToolCall } from "../opencode/adapter.js";
import { OPENCODE_FILE_TOOL, type OpenCodeFileTool } from "../opencode/types.js";

const DEFAULT_GUARDED_TOOLS = [
  OPENCODE_FILE_TOOL.READ,
  OPENCODE_FILE_TOOL.WRITE,
  OPENCODE_FILE_TOOL.EDIT,
] as const;

export interface OpencodeGuardPluginOptions {
  configDirectory?: string;
  workspaceRoot?: string;
  guardedTools?: OpenCodeFileTool[];
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

function readPermissionTargetPath(input: PermissionAskInputLike): string | null {
  if (typeof input.pattern === "string") {
    return input.pattern;
  }

  if (Array.isArray(input.pattern) && typeof input.pattern[0] === "string") {
    return input.pattern[0];
  }

  return null;
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

      const result = await evaluateOpenCodeToolCall({
        configDirectory,
        envelope: {
          session: {
            workspaceRoot,
          },
          tool: {
            name: input.type,
            input: {
              filePath: targetPath,
            },
          },
        },
      });

      if (result.decision.action === "deny") {
        output.status = "deny";
      }
    },
    "tool.execute.before": async (event, output) => {
      if (!guardedTools.has(event.tool)) {
        return;
      }

      const result = await evaluateOpenCodeToolCall({
        configDirectory,
        envelope: {
          session: {
            workspaceRoot,
          },
          tool: {
            name: event.tool,
            input: output.args,
          },
        },
      });

      if (result.decision.action === "deny") {
        throw new Error(`opencode-guard denied ${event.tool}: ${result.hostMessage}`);
      }
    },
  };
}

export default createOpencodeGuardPlugin;
