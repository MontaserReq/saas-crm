import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('public registration commercial state', () => {
  it('requires an explicitly configured plan and creates the subscription inside the organization transaction', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../src/server/actions/auth.ts'), 'utf8');
    const transaction = source.match(/created = await prisma\.\$transaction\(async tx => \{([\s\S]*?)return \{ organization, department, user, state \};/);
    expect(transaction).toBeTruthy();
    expect(transaction![1]).toMatch(/signup_default_plan_slug/);
    expect(transaction![1]).toMatch(/if \(!defaultPlanSetting\?\.value\) throw/);
    expect(transaction![1]).toMatch(/tx\.platformSubscription\.create/);
    expect(transaction![1]).toMatch(/status: 'TRIAL'/);
    expect(transaction![1]).toMatch(/trialStartedAt/);
    expect(transaction![1]).toMatch(/trialEndsAt/);
  });
});
