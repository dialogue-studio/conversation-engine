import { describe, expect, it } from 'vitest';

import { getInitialNode } from './index.ts';

describe('getInitialNode', () => {
  it('returns the configured initial node', () => {
    const initialNode = {
      id: 'intro',
      message: 'Hello',
      transitions: [],
    } as const;

    expect(
      getInitialNode({
        id: 'example',
        initialNodeId: 'intro',
        nodes: { intro: initialNode },
        schemaVersion: 1,
      }),
    ).toBe(initialNode);
  });
});
