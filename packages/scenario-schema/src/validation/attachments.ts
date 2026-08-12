import type {
  AttachmentSource,
  ContactAttachment,
  LinkAttachment,
  LocationAttachment,
  MediaAttachment,
  MediaAttachmentKind,
  ScenarioAttachment,
} from '../index.js';

import type { ValidationIssues, ValidationPath } from './issues.js';
import { reportInvalidType, reportInvalidValue } from './issues.js';
import { createOptionalProperty } from './optional-properties.js';
import { readNumberInRange } from './readers.js';
import { isRecord, validateKnownKeys } from './records.js';
import {
  readNonEmptyString,
  readOptionalNonEmptyString,
} from './text-readers.js';

const safeExternalUrlProtocols = new Set(['https:', 'http:']);
const safeLinkProtocols = new Set(['https:', 'http:', 'mailto:', 'tel:']);

export function parseOptionalAttachments(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
): readonly ScenarioAttachment[] | null {
  const property = value[key];

  if (property === undefined) {
    return null;
  }

  if (!Array.isArray(property) || property.length === 0) {
    reportInvalidType(
      issues,
      [...path, key],
      `"${key}" must be a non-empty array of attachments.`,
    );
    return null;
  }

  const attachments: ScenarioAttachment[] = [];

  for (const [index, attachmentValue] of property.entries()) {
    const attachment = parseAttachment(
      attachmentValue,
      [...path, key, index],
      issues,
    );

    if (attachment) {
      attachments.push(attachment);
    }
  }

  return attachments.length === property.length ? attachments : null;
}

function parseAttachment(
  value: unknown,
  path: ValidationPath,
  issues: ValidationIssues,
): ScenarioAttachment | null {
  if (!isRecord(value)) {
    reportInvalidType(issues, path, 'Each attachment must be an object.');
    return null;
  }

  if (value.kind === 'contact') {
    return parseContactAttachment(value, path, issues);
  }

  if (value.kind === 'link') {
    return parseLinkAttachment(value, path, issues);
  }

  if (value.kind === 'location') {
    return parseLocationAttachment(value, path, issues);
  }

  if (isMediaAttachmentKind(value.kind)) {
    return parseMediaAttachment(value, path, issues);
  }

  reportInvalidValue(
    issues,
    [...path, 'kind'],
    'Attachment kind is not supported.',
  );
  return null;
}

function parseContactAttachment(
  value: Record<string, unknown>,
  path: ValidationPath,
  issues: ValidationIssues,
): ContactAttachment | null {
  validateKnownKeys(
    value,
    ['firstName', 'kind', 'lastName', 'phoneNumber'],
    path,
    issues,
  );
  const firstName = readNonEmptyString(value, 'firstName', path, issues);
  const lastName = readOptionalNonEmptyString(value, 'lastName', path, issues);
  const phoneNumber = readNonEmptyString(value, 'phoneNumber', path, issues);

  if (!firstName || !phoneNumber) {
    return null;
  }

  return {
    firstName,
    kind: 'contact',
    ...createOptionalProperty('lastName', lastName),
    phoneNumber,
  };
}

function parseLinkAttachment(
  value: Record<string, unknown>,
  path: ValidationPath,
  issues: ValidationIssues,
): LinkAttachment | null {
  validateKnownKeys(value, ['kind', 'label', 'url'], path, issues);
  const label = readOptionalNonEmptyString(value, 'label', path, issues);
  const url = readSafeUrl(value, 'url', path, issues, safeLinkProtocols);

  if (!url) {
    return null;
  }

  return {
    kind: 'link',
    ...createOptionalProperty('label', label),
    url,
  };
}

function parseLocationAttachment(
  value: Record<string, unknown>,
  path: ValidationPath,
  issues: ValidationIssues,
): LocationAttachment | null {
  validateKnownKeys(
    value,
    ['address', 'kind', 'latitude', 'longitude', 'title'],
    path,
    issues,
  );
  const address = readOptionalNonEmptyString(value, 'address', path, issues);
  const latitude = readNumberInRange(value, 'latitude', -90, 90, path, issues);
  const longitude = readNumberInRange(
    value,
    'longitude',
    -180,
    180,
    path,
    issues,
  );
  const title = readOptionalNonEmptyString(value, 'title', path, issues);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    ...createOptionalProperty('address', address),
    kind: 'location',
    latitude,
    longitude,
    ...createOptionalProperty('title', title),
  };
}

function parseMediaAttachment(
  value: Record<string, unknown>,
  path: ValidationPath,
  issues: ValidationIssues,
): MediaAttachment | null {
  validateKnownKeys(value, ['caption', 'kind', 'source'], path, issues);
  const caption = readOptionalNonEmptyString(value, 'caption', path, issues);
  const source = parseAttachmentSource(
    value.source,
    [...path, 'source'],
    issues,
  );

  if (!isMediaAttachmentKind(value.kind) || !source) {
    return null;
  }

  return {
    ...createOptionalProperty('caption', caption),
    kind: value.kind,
    source,
  };
}

function parseAttachmentSource(
  value: unknown,
  path: ValidationPath,
  issues: ValidationIssues,
): AttachmentSource | null {
  if (!isRecord(value)) {
    reportInvalidType(issues, path, 'Attachment source must be an object.');
    return null;
  }

  if (value.kind === 'asset') {
    validateKnownKeys(value, ['assetId', 'kind'], path, issues);
    const assetId = readNonEmptyString(value, 'assetId', path, issues);

    return assetId ? { assetId, kind: 'asset' } : null;
  }

  if (value.kind === 'external_url') {
    validateKnownKeys(value, ['kind', 'url'], path, issues);
    const url = readSafeUrl(
      value,
      'url',
      path,
      issues,
      safeExternalUrlProtocols,
    );

    return url ? { kind: 'external_url', url } : null;
  }

  reportInvalidValue(
    issues,
    [...path, 'kind'],
    'Attachment source kind is not supported.',
  );
  return null;
}

function isMediaAttachmentKind(value: unknown): value is MediaAttachmentKind {
  return (
    value === 'animation' ||
    value === 'audio' ||
    value === 'document' ||
    value === 'photo' ||
    value === 'video' ||
    value === 'voice'
  );
}

function readSafeUrl(
  value: Record<string, unknown>,
  key: string,
  path: ValidationPath,
  issues: ValidationIssues,
  allowedProtocols: ReadonlySet<string>,
): string | null {
  const property = value[key];

  if (typeof property !== 'string' || property.trim().length === 0) {
    reportInvalidValue(
      issues,
      [...path, key],
      `"${key}" must be a supported absolute URL.`,
    );
    return null;
  }

  try {
    const url = new URL(property);

    if (allowedProtocols.has(url.protocol)) {
      return property;
    }
  } catch {
    // The error below intentionally does not expose parser details.
  }

  reportInvalidValue(
    issues,
    [...path, key],
    `"${key}" must be a supported absolute URL.`,
  );
  return null;
}
