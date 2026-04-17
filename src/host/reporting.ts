import { DEFAULT_ACTION } from "../config/constants.js";
import type { GuardDecision } from "../core/types.js";
import {
  AUDIT_TARGET_PATH_KIND,
  HOST_FAILURE_STAGE,
  HOST_REASON_CODE,
  type AuditTargetPathKind,
  type HostAuditRecord,
  type HostFailureStage,
  type HostReasonCode,
} from "./types.js";

export interface AuditContext {
  command: string | null;
  targetPathKind: AuditTargetPathKind;
  targetPathExists: boolean | null;
  configLoaded: boolean;
  configPath: string | null;
}

export interface ReportedDecision {
  decision: GuardDecision;
  hostMessage: string;
  reasonCode: HostReasonCode;
  failureStage: HostFailureStage;
  configPath: string | null;
  audit: HostAuditRecord;
}

export function classifyTargetPathKind(targetPath: unknown): AuditTargetPathKind {
  if (typeof targetPath !== "string") {
    return AUDIT_TARGET_PATH_KIND.UNKNOWN;
  }

  const normalizedValue = targetPath.trim();

  if (normalizedValue.length === 0) {
    return AUDIT_TARGET_PATH_KIND.UNKNOWN;
  }

  return normalizedValue.startsWith("/") ? AUDIT_TARGET_PATH_KIND.ABSOLUTE : AUDIT_TARGET_PATH_KIND.RELATIVE;
}

function hostMessageFor(reasonCode: HostReasonCode, action: GuardDecision["action"]): string {
  if (action === DEFAULT_ACTION.ALLOW && reasonCode === HOST_REASON_CODE.ALLOW_RULE_MATCH) {
    return "Operation allowed by local security policy.";
  }

  switch (reasonCode) {
    case HOST_REASON_CODE.DENY_HOST_INPUT:
      return "Operation denied: invalid host request.";
    case HOST_REASON_CODE.DENY_CONFIG_LOAD:
      return "Operation denied: security policy unavailable.";
    case HOST_REASON_CODE.DENY_REQUEST_NORMALIZATION:
      return "Operation denied: request normalization failed.";
    case HOST_REASON_CODE.DENY_PATH_POLICY:
      return "Operation denied: target path rejected by security policy.";
    case HOST_REASON_CODE.DENY_INTERNAL:
      return "Operation denied: internal security guard error.";
    case HOST_REASON_CODE.DENY_POLICY_DEFAULT:
    default:
      return "Operation denied by local security policy.";
  }
}

function createAuditRecord(
  decision: GuardDecision,
  reasonCode: HostReasonCode,
  failureStage: HostFailureStage,
  context: AuditContext,
): HostAuditRecord {
  return {
    action: decision.action,
    failureStage,
    reasonCode,
    matchedRuleId: decision.matchedRuleId,
    configLoaded: context.configLoaded,
    configPath: context.configPath,
    command: context.command,
    targetPathKind: context.targetPathKind,
    targetPathExists: context.targetPathExists,
  };
}

export function createReportedDecision(
  decision: GuardDecision,
  reasonCode: HostReasonCode,
  failureStage: HostFailureStage,
  context: AuditContext,
): ReportedDecision {
  return {
    decision,
    hostMessage: hostMessageFor(reasonCode, decision.action),
    reasonCode,
    failureStage,
    configPath: context.configPath,
    audit: createAuditRecord(decision, reasonCode, failureStage, context),
  };
}

export function createDefaultAuditContext(): AuditContext {
  return {
    command: null,
    targetPathKind: AUDIT_TARGET_PATH_KIND.UNKNOWN,
    targetPathExists: null,
    configLoaded: false,
    configPath: null,
  };
}

export function createInputAuditContext(command: string | null, targetPathKind: AuditTargetPathKind): AuditContext {
  return {
    command,
    targetPathKind,
    targetPathExists: null,
    configLoaded: false,
    configPath: null,
  };
}

export function createSuccessAuditContext(command: string, targetPathKind: AuditTargetPathKind, targetPathExists: boolean, configPath: string): AuditContext {
  return {
    command,
    targetPathKind,
    targetPathExists,
    configLoaded: true,
    configPath,
  };
}

export function createConfigAuditContext(command: string, targetPathKind: AuditTargetPathKind): AuditContext {
  return {
    command,
    targetPathKind,
    targetPathExists: null,
    configLoaded: false,
    configPath: null,
  };
}

export function createLoadedAuditContext(command: string, targetPathKind: AuditTargetPathKind, configPath: string): AuditContext {
  return {
    command,
    targetPathKind,
    targetPathExists: null,
    configLoaded: true,
    configPath,
  };
}

export { AUDIT_TARGET_PATH_KIND, HOST_FAILURE_STAGE, HOST_REASON_CODE };
