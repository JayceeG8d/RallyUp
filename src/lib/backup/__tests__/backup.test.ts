import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const BackupTestSchema = z.object({
  version: z.number(),
  appName: z.literal('RallyUp'),
  players: z.array(z.any()),
  sessions: z.array(z.any()),
});

describe('Backup Validation', () => {
  it('validates a correct backup structure', () => {
    const validData = {
      version: 1,
      appName: 'RallyUp',
      players: [],
      sessions: [],
    };
    expect(() => BackupTestSchema.parse(validData)).not.toThrow();
  });

  it('rejects backup with invalid appName or structure', () => {
    const invalidData = {
      version: 1,
      appName: 'FakeApp',
      players: [],
      sessions: [],
    };
    expect(() => BackupTestSchema.parse(invalidData)).toThrow();
  });
});
