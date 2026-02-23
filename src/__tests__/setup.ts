/**
 * Vitest global setup
 *
 * - Sets default env vars for tests
 * - Mocks heavy external modules (supabase, openai)
 */

import { vi } from 'vitest';

// Provide dummy env vars so modules that read them at import time don't crash
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.CRON_SECRET = 'test-cron-secret';

// Mock supabase-admin to avoid real DB connections
vi.mock('@/lib/supabase-admin', () => {
    const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    return {
        supabaseAdmin: {
            from: mockFrom,
        },
    };
});

// Mock logger to suppress output during tests
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));
