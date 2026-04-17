import type { GuardDecision } from "../core/types.js";

export const HOST_FAILURE_STAGE = {
  NONE: "none",
  INPUT: "input",
  CONFIG: "config",
  REQUEST: "request",
  PATH: "path",
  INTERNAL: "internal",
} as const;

export type HostFailureStage = (typeof HOST_FAILURE_STAGE)[keyof typeof HOST_FAILURE_STAGE];

export interface HostOperationInput {
  command: string;
  targetPath: string;
  workspaceRoot: string;
}

export interface EvaluateHostOperationOptions {
  configDirectory: string;
  input: unknown;
}

export interface HostEvaluationResult {
  decision: GuardDecision;
  failureStage: HostFailureStage;
  configPath: string | null;
}
