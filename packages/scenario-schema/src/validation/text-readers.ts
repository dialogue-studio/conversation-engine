import type { MessageFormat } from '../index.js';

import type { ValidationIssues, ValidationPath } from './issues.js';
import { reportInvalidType, reportInvalidValue } from './issues.js';

export function readNonEmptyString(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): string | null {
  const property = value[key];

  if (typeof property === 'string' && property.trim().length > 0) {
    return property;
  }

  reportInvalidValue(
    issues,
    [...path, key],
    `"${key}" must be a non-empty string.`,
  );
  return null;
}

export function readOptionalMessageFormat(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): MessageFormat | null {
  const property = value[key];

  if (property === undefined) {
    return null;
  }

  if (property === 'markdown' || property === 'plain') {
    return property;
  }

  reportInvalidValue(
    issues,
    [...path, key],
    `"${key}" must be "markdown" or "plain".`,
  );
  return null;
}

export function readOptionalNonEmptyString(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): string | null {
  const property = value[key];

  if (property === undefined) {
    return null;
  }

  if (typeof property === 'string' && property.trim().length > 0) {
    return property;
  }

  reportInvalidType(
    issues,
    [...path, key],
    `"${key}" must be a non-empty string.`,
  );
  return null;
}

export function readOptionalString(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): string | null {
  const property = value[key];

  if (property === undefined) {
    return null;
  }

  if (typeof property === 'string') {
    return property;
  }

  reportInvalidType(issues, [...path, key], `"${key}" must be a string.`);
  return null;
}
