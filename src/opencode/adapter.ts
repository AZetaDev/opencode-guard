import { DEFAULT_ACTION } from "../config/constants.js";
import { evaluateHostOperation } from "../host/adapter.js";
import { createInputAuditContext, createReportedDecision } from "../host/reporting.js";
import { classifyTargetPathKind } from "../host/reporting.js";
import { HOST_FAILURE_STAGE, HOST_REASON_CODE } from "../host/types.js";
import type {
  EvaluateOpenCodeToolCallOptions,
  OpenCodeEditToolInput,
  OpenCodeEvaluationResult,
  OpenCodeFileTool,
  OpenCodeReadToolInput,
  OpenCodeRuntimeEnvelope,
  OpenCodeToolCallMapping,
  OpenCodeWriteToolInput,
} from "./types.js";
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);

  if (actualKeys.length !== expectedKeys.length) {
    return false;
  }

  return expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isOpenCodeReadToolInput(value: unknown): value is OpenCodeReadToolInput {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (!hasExactKeys(value, ["filePath"]) && !hasExactKeys(value, ["filePath", "offset"]) && !hasExactKeys(value, ["filePath", "limit"]) && !hasExactKeys(value, ["filePath", "offset", "limit"])) {
    return false;
  }

  if (readNonEmptyString(value.filePath) === null) {
    return false;
  }

  if (value.offset !== undefined && (!isFiniteNumber(value.offset) || value.offset < 1 || !Number.isInteger(value.offset))) {
    return false;
  }

  if (value.limit !== undefined && (!isFiniteNumber(value.limit) || value.limit < 1 || !Number.isInteger(value.limit))) {
    return false;
  }

  return true;
}

function isOpenCodeWriteToolInput(value: unknown): value is OpenCodeWriteToolInput {
  if (!isObjectRecord(value) || !hasExactKeys(value, ["filePath", "content"])) {
    return false;
  }

  return readNonEmptyString(value.filePath) !== null && typeof value.content === "string";
}

function isOpenCodeEditToolInput(value: unknown): value is OpenCodeEditToolInput {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (!hasExactKeys(value, ["filePath", "oldString", "newString"]) && !hasExactKeys(value, ["filePath", "oldString", "newString", "replaceAll"])) {
    return false;
  }

  if (readNonEmptyString(value.filePath) === null) {
    return false;
  }

  if (typeof value.oldString !== "string" || typeof value.newString !== "string") {
    return false;
  }

  if (value.replaceAll !== undefined && typeof value.replaceAll !== "boolean") {
    return false;
  }

  return true;
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
  if (!isSupportedFileTool(envelope.tool.name)) {
    return null;
  }

  if (envelope.tool.name === OPENCODE_FILE_TOOL.READ && isOpenCodeReadToolInput(envelope.tool.input)) {
    return {
      command: envelope.tool.name,
      targetPath: envelope.tool.input.filePath.trim(),
      workspaceRoot: envelope.session.workspaceRoot,
    };
  }

  if (envelope.tool.name === OPENCODE_FILE_TOOL.WRITE && isOpenCodeWriteToolInput(envelope.tool.input)) {
    return {
      command: envelope.tool.name,
      targetPath: envelope.tool.input.filePath.trim(),
      workspaceRoot: envelope.session.workspaceRoot,
    };
  }

  if (envelope.tool.name === OPENCODE_FILE_TOOL.EDIT && isOpenCodeEditToolInput(envelope.tool.input)) {
    return {
      command: envelope.tool.name,
      targetPath: envelope.tool.input.filePath.trim(),
      workspaceRoot: envelope.session.workspaceRoot,
    };
  }

  return null;
}

function readMappedTargetPath(toolInput: unknown): unknown {
  return isObjectRecord(toolInput) ? toolInput.filePath : undefined;
}

function readMappedToolName(envelope: OpenCodeRuntimeEnvelope | null): string | null {
  return envelope === null ? null : envelope.tool.name;
}

function denyUnmappableEnvelope(parsedEnvelope: OpenCodeRuntimeEnvelope | null): OpenCodeEvaluationResult {
  return denyRuntimeInput(readMappedToolName(parsedEnvelope), parsedEnvelope === null ? undefined : readMappedTargetPath(parsedEnvelope.tool.input));
}

function toOpenCodeResult(result: Awaited<ReturnType<typeof evaluateHostOperation>>, mappedToolName: string | null): OpenCodeEvaluationResult {
  return {
    ...result,
    runtime: RUNTIME_NAME,
    mappedToolName,
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
    return denyUnmappableEnvelope(null);
  }

  const mappedCall = mapOpenCodeToolInput(parsedEnvelope);

  if (mappedCall === null) {
    return denyUnmappableEnvelope(parsedEnvelope);
  }

  const result = await evaluateHostOperation({
    configDirectory: options.configDirectory,
    input: mappedCall,
  });

  return toOpenCodeResult(result, mappedCall.command);
}
