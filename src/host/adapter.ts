import type { LoadedGuardConfig, ValidationIssue } from "../config/types.js";
import { GuardConfigError, loadGuardConfig } from "../config/load.js";
import { evaluateOperation } from "../core/evaluate.js";
import { GuardPathError } from "../core/paths.js";
import { GuardRequestError, prepareOperationRequest } from "../core/request.js";
import { DEFAULT_ACTION } from "../config/constants.js";
import {
  classifyTargetPathKind,
  createConfigAuditContext,
  createInputAuditContext,
  createLoadedAuditContext,
  createReportedDecision,
  createSuccessAuditContext,
} from "./reporting.js";
import { HOST_FAILURE_STAGE, HOST_REASON_CODE, type EvaluateHostOperationOptions, type HostEvaluationResult, type HostOperationInput } from "./types.js";

const HOST_INPUT_KEYS = {
  COMMAND: "command",
  TARGET_PATH: "targetPath",
  WORKSPACE_ROOT: "workspaceRoot",
} as const;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateNonEmptyString(value: unknown, path: string, issues: ValidationIssue[]): string | null {
  if (typeof value !== "string") {
    issues.push({ path, message: "Expected a string." });
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    issues.push({ path, message: "Expected a non-empty string." });
    return null;
  }

  return normalizedValue;
}

function denyResult(
  reason: string,
  reasonCode: HostEvaluationResult["reasonCode"],
  failureStage: HostEvaluationResult["failureStage"],
  context: Parameters<typeof createReportedDecision>[3],
): HostEvaluationResult {
  return createReportedDecision(
    {
      action: DEFAULT_ACTION.DENY,
      reason,
      matchedRuleId: null,
    },
    reasonCode,
    failureStage,
    context,
  );
}

function parseHostOperationInput(input: unknown): HostOperationInput | ValidationIssue[] {
  if (!isObjectRecord(input)) {
    return [{ path: "$", message: "Expected an object." }];
  }

  const issues: ValidationIssue[] = [];
  const actualKeys = Object.keys(input);
  const expectedKeys = Object.values(HOST_INPUT_KEYS);
  const expectedKeySet = new Set<string>(expectedKeys);

  for (const key of actualKeys) {
    if (!expectedKeySet.has(key)) {
      issues.push({ path: `$.${key}`, message: "Unexpected property." });
    }
  }

  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      issues.push({ path: `$.${key}`, message: "Missing required property." });
    }
  }

  const command = validateNonEmptyString(input.command, "$.command", issues);
  const targetPath = validateNonEmptyString(input.targetPath, "$.targetPath", issues);
  const workspaceRoot = validateNonEmptyString(input.workspaceRoot, "$.workspaceRoot", issues);

  if (issues.length > 0 || command === null || targetPath === null || workspaceRoot === null) {
    return issues;
  }

  return {
    command,
    targetPath,
    workspaceRoot,
  };
}

function inputIssuesToReason(issues: ValidationIssue[]): string {
  return `Host request rejected: ${issues.map((issue) => `${issue.path} ${issue.message}`).join(" ")}`;
}

function configFailureReason(_error: GuardConfigError): string {
  return "Configuration could not be loaded safely; failing closed.";
}

function requestFailureReason(error: GuardRequestError): string {
  return `Host request rejected during normalization: ${error.message}`;
}

function pathFailureReason(error: GuardPathError): string {
  return `Target path rejected during canonicalization: ${error.message}`;
}

async function prepareLoadedRequest(loadedConfig: LoadedGuardConfig, input: HostOperationInput) {
  return prepareOperationRequest({
    loadedConfig,
    request: input,
  });
}

export async function evaluateHostOperation(options: EvaluateHostOperationOptions): Promise<HostEvaluationResult> {
  const parsedInput = parseHostOperationInput(options.input);
  const inputTargetPathKind = isObjectRecord(options.input) ? classifyTargetPathKind(options.input.targetPath) : classifyTargetPathKind(undefined);
  const inputCommand = isObjectRecord(options.input) && typeof options.input.command === "string" ? options.input.command.trim() : null;

  if (Array.isArray(parsedInput)) {
    return denyResult(
      inputIssuesToReason(parsedInput),
      HOST_REASON_CODE.DENY_HOST_INPUT,
      HOST_FAILURE_STAGE.INPUT,
      createInputAuditContext(inputCommand, inputTargetPathKind),
    );
  }

  let loadedConfig: LoadedGuardConfig;

  try {
    loadedConfig = await loadGuardConfig(options.configDirectory);
  } catch (error) {
    if (error instanceof GuardConfigError) {
      return denyResult(
        configFailureReason(error),
        HOST_REASON_CODE.DENY_CONFIG_LOAD,
        HOST_FAILURE_STAGE.CONFIG,
        createConfigAuditContext(parsedInput.command, inputTargetPathKind),
      );
    }

    return denyResult(
      "Internal adapter error before policy evaluation.",
      HOST_REASON_CODE.DENY_INTERNAL,
      HOST_FAILURE_STAGE.INTERNAL,
      createConfigAuditContext(parsedInput.command, inputTargetPathKind),
    );
  }

  try {
    const preparedRequest = await prepareLoadedRequest(loadedConfig, parsedInput);
    const decision = evaluateOperation(loadedConfig.config, preparedRequest);
    const reasonCode = decision.action === DEFAULT_ACTION.ALLOW ? HOST_REASON_CODE.ALLOW_RULE_MATCH : HOST_REASON_CODE.DENY_POLICY_DEFAULT;

    return createReportedDecision(
      decision,
      reasonCode,
      HOST_FAILURE_STAGE.NONE,
      createSuccessAuditContext(parsedInput.command, inputTargetPathKind, preparedRequest.targetPathExists, loadedConfig.configPath),
    );
  } catch (error) {
    if (error instanceof GuardPathError) {
      return denyResult(
        pathFailureReason(error),
        HOST_REASON_CODE.DENY_PATH_POLICY,
        HOST_FAILURE_STAGE.PATH,
        createLoadedAuditContext(parsedInput.command, inputTargetPathKind, loadedConfig.configPath),
      );
    }

    if (error instanceof GuardRequestError) {
      return denyResult(
        requestFailureReason(error),
        HOST_REASON_CODE.DENY_REQUEST_NORMALIZATION,
        HOST_FAILURE_STAGE.REQUEST,
        createLoadedAuditContext(parsedInput.command, inputTargetPathKind, loadedConfig.configPath),
      );
    }

    return denyResult(
      "Internal adapter error during guarded evaluation.",
      HOST_REASON_CODE.DENY_INTERNAL,
      HOST_FAILURE_STAGE.INTERNAL,
      createLoadedAuditContext(parsedInput.command, inputTargetPathKind, loadedConfig.configPath),
    );
  }
}
