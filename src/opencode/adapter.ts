import { DEFAULT_ACTION } from "../config/constants.js";
import { evaluateHostOperation } from "../host/adapter.js";
import { createInputAuditContext, createReportedDecision } from "../host/reporting.js";
import { classifyTargetPathKind } from "../host/reporting.js";
import { HOST_FAILURE_STAGE, HOST_REASON_CODE } from "../host/types.js";
import type { EvaluateOpenCodeToolCallOptions, OpenCodeEvaluationResult, OpenCodeFileTool, OpenCodeRuntimeEnvelope, OpenCodeToolCallMapping } from "./types.js";
import { OPENCODE_FILE_TOOL } from "./types.js";

const RUNTIME_NAME = "opencode" as const;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedFileTool(toolName: string): toolName is OpenCodeFileTool {
  return toolName === OPENCODE_FILE_TOOL.READ || toolName === OPENCODE_FILE_TOOL.WRITE || toolName === OPENCODE_FILE_TOOL.EDIT;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function parseOpenCodeRuntimeEnvelope(envelope: unknown): OpenCodeRuntimeEnvelope | null {
  if (!isObjectRecord(envelope) || !isObjectRecord(envelope.session) || !isObjectRecord(envelope.tool)) {
    return null;
  }

  const workspaceRoot = readNonEmptyString(envelope.session.workspaceRoot);
  const toolName = readNonEmptyString(envelope.tool.name);

  if (workspaceRoot === null || toolName === null) {
    return null;
  }

  return {
    session: { workspaceRoot },
    tool: {
      name: toolName,
      input: envelope.tool.input,
    },
  };
}

function mapOpenCodeToolInput(envelope: OpenCodeRuntimeEnvelope): OpenCodeToolCallMapping | null {
  if (!isSupportedFileTool(envelope.tool.name) || !isObjectRecord(envelope.tool.input)) {
    return null;
  }

  const filePath = readNonEmptyString(envelope.tool.input.filePath);

  if (filePath === null) {
    return null;
  }

  return {
    command: envelope.tool.name,
    targetPath: filePath,
    workspaceRoot: envelope.session.workspaceRoot,
  };
}

function denyRuntimeInput(mappedToolName: string | null, targetPath: unknown): OpenCodeEvaluationResult {
  const reportedDecision = createReportedDecision(
    {
      action: DEFAULT_ACTION.DENY,
      reason: "OpenCode runtime request could not be mapped to a guarded file operation.",
      matchedRuleId: null,
    },
    HOST_REASON_CODE.DENY_HOST_INPUT,
    HOST_FAILURE_STAGE.INPUT,
    createInputAuditContext(mappedToolName, classifyTargetPathKind(targetPath)),
  );

  return {
    ...reportedDecision,
    runtime: RUNTIME_NAME,
    mappedToolName,
  };
}

export async function evaluateOpenCodeToolCall(options: EvaluateOpenCodeToolCallOptions): Promise<OpenCodeEvaluationResult> {
  const parsedEnvelope = parseOpenCodeRuntimeEnvelope(options.envelope);

  if (parsedEnvelope === null) {
    return denyRuntimeInput(null, undefined);
  }

  const mappedCall = mapOpenCodeToolInput(parsedEnvelope);

  if (mappedCall === null) {
    const rawInput = isObjectRecord(parsedEnvelope.tool.input) ? parsedEnvelope.tool.input.filePath : undefined;
    return denyRuntimeInput(parsedEnvelope.tool.name, rawInput);
  }

  const result = await evaluateHostOperation({
    configDirectory: options.configDirectory,
    input: mappedCall,
  });

  return {
    ...result,
    runtime: RUNTIME_NAME,
    mappedToolName: mappedCall.command,
  };
}
