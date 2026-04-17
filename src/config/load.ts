import { readFile } from "node:fs/promises";
import * as path from "node:path";

import { CONFIG_FILENAME } from "./constants.js";
import type { LoadedGuardConfig } from "./types.js";
import { validateGuardConfig } from "./validate.js";

export class GuardConfigError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "GuardConfigError";
    this.issues = issues;
  }
}

function stripJsonComments(input: string): string {
  let output = "";
  let inString = false;
  let isEscaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const currentCharacter = input[index] ?? "";
    const nextCharacter = input[index + 1] ?? "";

    if (lineComment) {
      if (currentCharacter === "\n") {
        lineComment = false;
        output += currentCharacter;
      }

      continue;
    }

    if (blockComment) {
      if (currentCharacter === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }

      continue;
    }

    if (inString) {
      output += currentCharacter;

      if (isEscaped) {
        isEscaped = false;
        continue;
      }

      if (currentCharacter === "\\") {
        isEscaped = true;
        continue;
      }

      if (currentCharacter === '"') {
        inString = false;
      }

      continue;
    }

    if (currentCharacter === "/" && nextCharacter === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (currentCharacter === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    output += currentCharacter;

    if (currentCharacter === '"') {
      inString = true;
    }
  }

  if (inString || blockComment) {
    throw new GuardConfigError("Config file contains unterminated JSONC content.");
  }

  return output;
}

function parseJsonc(input: string): unknown {
  try {
    return JSON.parse(stripJsonComments(input));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse failure.";
    throw new GuardConfigError(`Failed to parse ${CONFIG_FILENAME}: ${message}`);
  }
}

export async function loadGuardConfig(configDirectory: string): Promise<LoadedGuardConfig> {
  const normalizedConfigDirectory = configDirectory.trim();

  if (normalizedConfigDirectory.length === 0) {
    throw new GuardConfigError("Config directory must be a non-empty path.");
  }

  const resolvedConfigDirectory = path.resolve(normalizedConfigDirectory);
  const configPath = path.join(resolvedConfigDirectory, CONFIG_FILENAME);
  let fileContent: string;

  try {
    fileContent = await readFile(configPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown file read failure.";
    throw new GuardConfigError(`Failed to read ${configPath}: ${message}`);
  }

  const parsedValue = parseJsonc(fileContent);
  const validationResult = validateGuardConfig(parsedValue);

  if (!validationResult.ok || validationResult.config === undefined) {
    const issues = validationResult.issues.map((issue) => `${issue.path}: ${issue.message}`);
    throw new GuardConfigError(`Invalid ${CONFIG_FILENAME}.`, issues);
  }

  return {
    config: validationResult.config,
    configPath,
    configDirectory: resolvedConfigDirectory,
  };
}
