import type { EvaluateHostOperationOptions, HostEvaluationResult } from "../host/types.js";

export const OPENCODE_FILE_TOOL = {
  READ: "read",
  WRITE: "write",
  EDIT: "edit",
} as const;

export type OpenCodeFileTool = (typeof OPENCODE_FILE_TOOL)[keyof typeof OPENCODE_FILE_TOOL];

export interface OpenCodeSessionEnvelope {
  workspaceRoot: string;
}

export interface OpenCodeToolEnvelope {
  name: string;
  input: unknown;
}

export interface OpenCodeRuntimeEnvelope {
  session: OpenCodeSessionEnvelope;
  tool: OpenCodeToolEnvelope;
}

export interface EvaluateOpenCodeToolCallOptions {
  configDirectory: EvaluateHostOperationOptions["configDirectory"];
  envelope: unknown;
}

export interface OpenCodeToolCallMapping {
  command: OpenCodeFileTool;
  targetPath: string;
  workspaceRoot: string;
}

export interface OpenCodeEvaluationResult extends HostEvaluationResult {
  runtime: "opencode";
  mappedToolName: string | null;
}
