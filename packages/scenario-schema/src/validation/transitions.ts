import type { ButtonLayout, Transition } from '../index.js';

import type { ValidationIssues, ValidationPath } from './issues.js';
import { reportInvalidType } from './issues.js';
import {
  readIntegerInRange,
  readOptionalBoolean,
  readOptionalStringArray,
  readTransitionKind,
} from './readers.js';
import { createOptionalProperty } from './optional-properties.js';
import { isRecord, validateKnownKeys } from './records.js';
import { readNonEmptyString } from './text-readers.js';

const buttonLayoutKey = 'buttonLayout';
const buttonLayoutColumnsKey = 'columns';
const minimumButtonLayoutColumns = 1;
const maximumButtonLayoutColumns = 5;
const buttonLayoutKeys = [buttonLayoutColumnsKey];
const transitionFields = {
  actionId: 'actionId',
  hideWhenTargetVisited: 'hideWhenTargetVisited',
  kind: 'kind',
  label: 'label',
  requiresCompletedObjectiveIds: 'requiresCompletedObjectiveIds',
  targetNodeId: 'targetNodeId',
} as const;
const transitionKeys = Object.values(transitionFields);

interface ParsedTransitionProperties {
  readonly actionId: string | null;
  readonly hideWhenTargetVisited: boolean | null;
  readonly kind: Transition['kind'] | null;
  readonly label: string | null;
  readonly requiresCompletedObjectiveIds: readonly string[] | null;
  readonly targetNodeId: string | null;
}

interface ValidTransitionProperties {
  readonly actionId: string;
  readonly hideWhenTargetVisited: boolean | null;
  readonly kind: Transition['kind'];
  readonly label: string;
  readonly requiresCompletedObjectiveIds: readonly string[] | null;
  readonly targetNodeId: string;
}

export function parseOptionalButtonLayout(
  value: Record<string, unknown>,
  path: ValidationPath,
  issues: ValidationIssues,
): ButtonLayout | null {
  const buttonLayoutPath = [...path, buttonLayoutKey];
  const property = value[buttonLayoutKey];

  if (property === undefined) {
    return null;
  }

  if (!isRecord(property)) {
    reportInvalidButtonLayout(issues, buttonLayoutPath);
    return null;
  }

  validateKnownKeys(property, buttonLayoutKeys, buttonLayoutPath, issues);
  const columns = readIntegerInRange(
    property,
    buttonLayoutColumnsKey,
    minimumButtonLayoutColumns,
    maximumButtonLayoutColumns,
    buttonLayoutPath,
    issues,
  );

  return createButtonLayout(columns);
}

export function parseTransitions(
  value: unknown,
  path: ValidationPath,
  issues: ValidationIssues,
): readonly Transition[] | null {
  if (!Array.isArray(value)) {
    reportInvalidTransitions(issues, path);
    return null;
  }

  const transitionEntries = [...value.entries()];
  const parsedTransitions = transitionEntries.map((transitionEntry) =>
    parseTransitionEntry(transitionEntry, path, issues),
  );

  return collectValidTransitions(parsedTransitions);
}

function parseTransitionEntry(
  [index, value]: readonly [number, unknown],
  transitionPath: ValidationPath,
  issues: ValidationIssues,
): Transition | null {
  return parseTransition(value, [...transitionPath, index], issues);
}

function parseTransition(
  value: unknown,
  path: ValidationPath,
  issues: ValidationIssues,
): Transition | null {
  if (!isRecord(value)) {
    reportInvalidTransition(issues, path);
    return null;
  }

  validateKnownKeys(value, transitionKeys, path, issues);
  const properties = readTransitionProperties(value, path, issues);

  if (!isValidTransitionProperties(value, properties)) {
    return null;
  }

  return createTransition(properties);
}

function readTransitionProperties(
  value: Record<string, unknown>,
  path: ValidationPath,
  issues: ValidationIssues,
): ParsedTransitionProperties {
  return {
    actionId: readNonEmptyString(
      value,
      transitionFields.actionId,
      path,
      issues,
    ),
    hideWhenTargetVisited: readOptionalBoolean(
      value,
      transitionFields.hideWhenTargetVisited,
      path,
      issues,
    ),
    kind: readTransitionKind(value, transitionFields.kind, path, issues),
    label: readNonEmptyString(value, transitionFields.label, path, issues),
    requiresCompletedObjectiveIds: readOptionalStringArray(
      value,
      transitionFields.requiresCompletedObjectiveIds,
      path,
      issues,
    ),
    targetNodeId: readNonEmptyString(
      value,
      transitionFields.targetNodeId,
      path,
      issues,
    ),
  };
}

function isValidTransitionProperties(
  value: Record<string, unknown>,
  properties: ParsedTransitionProperties,
): properties is ValidTransitionProperties {
  return (
    hasRequiredTransitionProperties(properties) &&
    hasValidOptionalTransitionProperties(value, properties)
  );
}

function hasRequiredTransitionProperties(
  properties: ParsedTransitionProperties,
): properties is ValidTransitionProperties {
  return (
    properties.actionId !== null &&
    properties.kind !== null &&
    properties.label !== null &&
    properties.targetNodeId !== null
  );
}

function hasValidOptionalTransitionProperties(
  value: Record<string, unknown>,
  properties: ParsedTransitionProperties,
): boolean {
  return (
    hasValidOptionalProperty(
      value,
      transitionFields.hideWhenTargetVisited,
      properties.hideWhenTargetVisited,
    ) &&
    hasValidOptionalProperty(
      value,
      transitionFields.requiresCompletedObjectiveIds,
      properties.requiresCompletedObjectiveIds,
    )
  );
}

function hasValidOptionalProperty(
  value: Record<string, unknown>,
  key: string,
  parsedValue: boolean | readonly string[] | null,
): boolean {
  return value[key] === undefined || parsedValue !== null;
}

function createTransition(properties: ValidTransitionProperties): Transition {
  return {
    ...createOptionalProperty(
      transitionFields.hideWhenTargetVisited,
      getEnabledVisibilityFlag(properties.hideWhenTargetVisited),
    ),
    ...createOptionalProperty(
      transitionFields.requiresCompletedObjectiveIds,
      properties.requiresCompletedObjectiveIds,
    ),
    actionId: properties.actionId,
    kind: properties.kind,
    label: properties.label,
    targetNodeId: properties.targetNodeId,
  };
}

function getEnabledVisibilityFlag(value: boolean | null): true | null {
  return value === true ? value : null;
}

function createButtonLayout(columns: number | null): ButtonLayout | null {
  return columns === null ? null : { columns };
}

function collectValidTransitions(
  parsedTransitions: readonly (Transition | null)[],
): readonly Transition[] | null {
  return parsedTransitions.every(isTransition) ? parsedTransitions : null;
}

function isTransition(value: Transition | null): value is Transition {
  return value !== null;
}

function reportInvalidButtonLayout(
  issues: ValidationIssues,
  path: ValidationPath,
): void {
  reportInvalidType(issues, path, `"${buttonLayoutKey}" must be an object.`);
}

function reportInvalidTransitions(
  issues: ValidationIssues,
  path: ValidationPath,
): void {
  reportInvalidType(issues, path, 'Transitions must be an array.');
}

function reportInvalidTransition(
  issues: ValidationIssues,
  path: ValidationPath,
): void {
  reportInvalidType(issues, path, 'Each transition must be an object.');
}
