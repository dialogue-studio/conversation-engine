import type { ScenarioNode } from '../index.js';

import { parseOptionalAttachments } from './attachments.js';
import type { ValidationIssues, ValidationPath } from './issues.js';
import { reportInvalidType } from './issues.js';
import { readNodeKind, readStringArray } from './readers.js';
import { isRecord, validateKnownKeys } from './records.js';
import {
  readNonEmptyString,
  readOptionalMessageFormat,
  readOptionalNonEmptyString,
} from './text-readers.js';
import { parseOptionalButtonLayout, parseTransitions } from './transitions.js';

export function parseNode(
  value: unknown,
  path: ValidationPath,
  issues: ValidationIssues,
): ScenarioNode | null {
  if (!isRecord(value)) {
    reportInvalidType(issues, path, 'Each node must be an object.');
    return null;
  }

  validateKnownKeys(
    value,
    [
      'attachments',
      'buttonLayout',
      'completesObjectiveIds',
      'id',
      'kind',
      'message',
      'messageFormat',
      'speaker',
      'title',
      'transitions',
    ],
    path,
    issues,
  );
  const attachments = parseOptionalAttachments(
    value,
    'attachments',
    path,
    issues,
  );
  const buttonLayout = parseOptionalButtonLayout(
    value,
    'buttonLayout',
    path,
    issues,
  );
  const completesObjectiveIds = readStringArray(
    value,
    'completesObjectiveIds',
    path,
    issues,
  );
  const id = readNonEmptyString(value, 'id', path, issues);
  const kind = readNodeKind(value, 'kind', path, issues);
  const message = readNonEmptyString(value, 'message', path, issues);
  const messageFormat = readOptionalMessageFormat(
    value,
    'messageFormat',
    path,
    issues,
  );
  const speaker = readOptionalNonEmptyString(value, 'speaker', path, issues);
  const title = readNonEmptyString(value, 'title', path, issues);
  const transitions = parseTransitions(
    value.transitions,
    [...path, 'transitions'],
    issues,
  );

  if (
    (value.attachments !== undefined && !attachments) ||
    (value.buttonLayout !== undefined && !buttonLayout) ||
    !completesObjectiveIds ||
    !id ||
    !kind ||
    !message ||
    (value.messageFormat !== undefined && !messageFormat) ||
    !title ||
    !transitions
  ) {
    return null;
  }

  return {
    ...(attachments ? { attachments } : {}),
    ...(buttonLayout ? { buttonLayout } : {}),
    completesObjectiveIds,
    id,
    kind,
    message,
    ...(messageFormat ? { messageFormat } : {}),
    ...(speaker ? { speaker } : {}),
    title,
    transitions,
  };
}
