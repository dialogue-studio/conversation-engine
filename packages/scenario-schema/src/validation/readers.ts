import type { ScenarioNode, TransitionKind } from '../index.js';

import type { ValidationIssues, ValidationPath } from './issues.js';
import { reportInvalidType, reportInvalidValue } from './issues.js';

export function readBoolean(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): boolean | null {
  const property = value[key];

  if (typeof property === 'boolean') {
    return property;
  }

  reportInvalidType(issues, [...path, key], `"${key}" must be a boolean.`);
  return null;
}

export function readIntegerInRange(
  value: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
  path: ValidationPath,
  issues: ValidationIssues,
): number | null {
  const property = value[key];

  if (
    typeof property === 'number' &&
    Number.isSafeInteger(property) &&
    property >= minimum &&
    property <= maximum
  ) {
    return property;
  }

  reportInvalidValue(
    issues,
    [...path, key],
    `"${key}" must be an integer from ${String(minimum)} to ${String(maximum)}.`,
  );
  return null;
}

export function readLiteralOne(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): 1 | null {
  if (value[key] === 1) {
    return 1;
  }

  reportInvalidValue(issues, [...path, key], `"${key}" must be 1.`);
  return null;
}

export function readNodeKind(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): ScenarioNode['kind'] | null {
  const property = value[key];

  if (property === 'completion' || property === 'message') {
    return property;
  }

  reportInvalidValue(
    issues,
    [...path, key],
    `"${key}" must be "completion" or "message".`,
  );
  return null;
}

export function readNumberInRange(
  value: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
  path: ValidationPath,
  issues: ValidationIssues,
): number | null {
  const property = value[key];

  if (
    typeof property === 'number' &&
    Number.isFinite(property) &&
    property >= minimum &&
    property <= maximum
  ) {
    return property;
  }

  reportInvalidValue(
    issues,
    [...path, key],
    `"${key}" must be a number from ${String(minimum)} to ${String(maximum)}.`,
  );
  return null;
}

export function readOptionalBoolean(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): boolean | null {
  return value[key] === undefined
    ? null
    : readBoolean(value, key, path, issues);
}

export function readOptionalStringArray(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): readonly string[] | null {
  return value[key] === undefined
    ? null
    : readStringArray(value, key, path, issues);
}

export function readPositiveInteger(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): number | null {
  const property = value[key];

  if (
    typeof property === 'number' &&
    Number.isSafeInteger(property) &&
    property > 0
  ) {
    return property;
  }

  reportInvalidValue(
    issues,
    [...path, key],
    `"${key}" must be a positive integer.`,
  );
  return null;
}

export function readStringArray(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): readonly string[] | null {
  const property = value[key];

  if (!Array.isArray(property)) {
    reportInvalidType(
      issues,
      [...path, key],
      `"${key}" must be an array of non-empty strings.`,
    );
    return null;
  }

  const strings: string[] = [];

  for (const item of property) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      reportInvalidType(
        issues,
        [...path, key],
        `"${key}" must be an array of non-empty strings.`,
      );
      return null;
    }

    strings.push(item);
  }

  return strings;
}

export function readTransitionKind(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): TransitionKind | null {
  const property = value[key];

  if (
    property === 'choice' ||
    property === 'finish' ||
    property === 'hint' ||
    property === 'navigation'
  ) {
    return property;
  }

  reportInvalidValue(
    issues,
    [...path, key],
    `"${key}" must be a supported transition kind.`,
  );
  return null;
}
