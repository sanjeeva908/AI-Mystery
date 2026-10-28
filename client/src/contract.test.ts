import { describe, expect, it } from 'vitest';
import { createCaseSchema } from '@mystery/shared';

describe('create case form contract', () => {
  it('trims valid premises and applies safe defaults', () => {
    const parsed = createCaseSchema.parse({ premise: '  A moonstone goes missing after the gallery tour.  ' });
    expect(parsed.premise).toBe('A moonstone goes missing after the gallery tour.');
    expect(parsed.settings.difficulty).toBe('easy');
  });
  it('rejects short premises and oversized settings', () => {
    expect(createCaseSchema.safeParse({ premise: 'Too short' }).success).toBe(false);
    expect(createCaseSchema.safeParse({ premise: 'A moonstone goes missing after the gallery tour.', settings: { setting: 'x'.repeat(101) } }).success).toBe(false);
  });
});
