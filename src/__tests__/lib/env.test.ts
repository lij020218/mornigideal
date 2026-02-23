/**
 * Tests for env.ts validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('validateEnv', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Reset modules to re-import with fresh env
        vi.resetModules();
        // Set all required env vars
        process.env.OPENAI_API_KEY = 'test-key';
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-role';
        process.env.JWT_SECRET = 'test-jwt';
        process.env.CRON_SECRET = 'test-cron';
    });

    afterEach(() => {
        // Restore original env
        process.env = { ...originalEnv };
    });

    it('does not throw when all required vars are present', async () => {
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).not.toThrow();
    });

    it('throws when OPENAI_API_KEY is missing', async () => {
        delete process.env.OPENAI_API_KEY;
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).toThrow(/OPENAI_API_KEY/);
    });

    it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('accepts NEXTAUTH_SECRET as JWT_SECRET fallback', async () => {
        delete process.env.JWT_SECRET;
        process.env.NEXTAUTH_SECRET = 'test-nextauth';
        const { validateEnv } = await import('@/lib/env');
        expect(() => validateEnv()).not.toThrow();
    });
});
