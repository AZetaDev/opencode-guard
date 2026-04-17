import type { GuardAction } from "../config/constants.js";

export interface OperationRequest {
  command: string;
  targetPath: string;
}

export interface GuardDecision {
  action: GuardAction;
  reason: string;
  matchedRuleId: string | null;
}
