import type { LoadedGuardConfig } from "../config/types.js";
import { canonicalizeTargetPath } from "./paths.js";
import type { OperationRequest, PreparedOperationRequest } from "./types.js";

export class GuardRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardRequestError";
  }
}

export interface PrepareOperationRequestOptions {
  request: OperationRequest;
  loadedConfig: LoadedGuardConfig;
}

function normalizeCommand(command: string): string {
  const normalizedCommand = command.trim();

  if (normalizedCommand.length === 0) {
    throw new GuardRequestError("Command must be a non-empty string.");
  }

  return normalizedCommand;
}

function normalizeTargetPath(targetPath: string): string {
  const normalizedTargetPath = targetPath.trim();

  if (normalizedTargetPath.length === 0) {
    throw new GuardRequestError("Target path must be a non-empty string.");
  }

  return normalizedTargetPath;
}

export async function prepareOperationRequest(options: PrepareOperationRequestOptions): Promise<PreparedOperationRequest> {
  const requestCommand = normalizeCommand(options.request.command);
  const requestTargetPath = normalizeTargetPath(options.request.targetPath);
  const canonicalPathInfo = await canonicalizeTargetPath({
    workspaceRoot: options.request.workspaceRoot,
    targetPath: requestTargetPath,
    symlinkPolicy: options.loadedConfig.config.symlinkPolicy,
  });

  return {
    command: requestCommand,
    requestedTargetPath: requestTargetPath,
    canonicalTargetPath: canonicalPathInfo.canonicalTargetPath,
    workspaceRoot: canonicalPathInfo.workspaceRoot,
    targetPathExists: canonicalPathInfo.targetPathExists,
    configPath: options.loadedConfig.configPath,
    configDirectory: options.loadedConfig.configDirectory,
    symlinkPolicy: options.loadedConfig.config.symlinkPolicy,
  };
}
