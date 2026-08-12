/**
 * Creates an object fragment for a property that is present only when its
 * parsed value exists. Parsers use this instead of repeating conditional
 * object-spread expressions when assembling schema objects.
 */
export function createOptionalProperty<Key extends string, Value>(
  key: Key,
  value: Value | null | undefined,
): Partial<Record<Key, Value>> {
  if (value === null || value === undefined) {
    return {};
  }

  return { [key]: value } as Record<Key, Value>;
}
