import { DEFAULT_ACTION } from "../config/constants.js";
import type { GuardConfig } from "../config/types.js";
import type { GuardDecision, PreparedOperationRequest } from "./types.js";

function normalizeRequestValue(value: string): string {
  return value.trim();
}

function normalizePath(value: string): string {
  if (value === "/") {
    return value;
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function matchesPathPrefix(pathPrefix: string, targetPath: string): boolean {
  const normalizedPrefix = normalizePath(pathPrefix);
  const normalizedTargetPath = normalizePath(targetPath);

  return normalizedTargetPath === normalizedPrefix || normalizedTargetPath.startsWith(`${normalizedPrefix}/`);
}

export function evaluateOperation(config: GuardConfig, request: PreparedOperationRequest): GuardDecision {
  const normalizedCommand = normalizeRequestValue(request.command);
  const normalizedTargetPath = normalizePath(normalizeRequestValue(request.canonicalTargetPath));

  const matchedRule = config.rules.find((rule) => {
    return rule.command === normalizedCommand && matchesPathPrefix(rule.pathPrefix, normalizedTargetPath);
  });

  if (matchedRule) {
    return {
      action: matchedRule.action,
      reason: `Matched rule '${matchedRule.id}'.`,
      matchedRuleId: matchedRule.id,
    };
  }

  return {
    action: DEFAULT_ACTION.DENY,
    reason: "No matching rule; failing closed with default deny.",
    matchedRuleId: null,
  };
}
