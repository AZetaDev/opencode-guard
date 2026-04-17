import type { GuardAction, SymlinkPolicy } from "../config/constants.js";

export interface OperationRequest {
  command: string;
  targetPath: string;
  workspaceRoot: string;
}

export interface PreparedOperationRequest {
  command: string;
  requestedTargetPath: string;
  canonicalTargetPath: string;
  workspaceRoot: string;
  targetPathExists: boolean;
  configPath: string;
  configDirectory: string;
  symlinkPolicy: SymlinkPolicy;
}

export interface GuardDecision {
  action: GuardAction;
  reason: string;
  matchedRuleId: string | null;
}
