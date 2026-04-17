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

export const HOST_REASON_CODE = {
  ALLOW_RULE_MATCH: "allow_rule_match",
  DENY_POLICY_DEFAULT: "deny_policy_default",
  DENY_HOST_INPUT: "deny_host_input",
  DENY_CONFIG_LOAD: "deny_config_load",
  DENY_REQUEST_NORMALIZATION: "deny_request_normalization",
  DENY_PATH_POLICY: "deny_path_policy",
  DENY_INTERNAL: "deny_internal",
} as const;

export type HostReasonCode = (typeof HOST_REASON_CODE)[keyof typeof HOST_REASON_CODE];

export const AUDIT_TARGET_PATH_KIND = {
  UNKNOWN: "unknown",
  RELATIVE: "relative",
  ABSOLUTE: "absolute",
} as const;

export type AuditTargetPathKind = (typeof AUDIT_TARGET_PATH_KIND)[keyof typeof AUDIT_TARGET_PATH_KIND];

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
  hostMessage: string;
  reasonCode: HostReasonCode;
  failureStage: HostFailureStage;
  configPath: string | null;
  audit: HostAuditRecord;
}

export interface HostAuditRecord {
  action: GuardDecision["action"];
  failureStage: HostFailureStage;
  reasonCode: HostReasonCode;
  matchedRuleId: string | null;
  configLoaded: boolean;
  configPath: string | null;
  command: string | null;
  targetPathKind: AuditTargetPathKind;
  targetPathExists: boolean | null;
}
