/**
 * Tests for user-plan.ts
 *
 * Validates PLAN_DETAILS structure, type exports, and DB-dependent
 * functions (getUserPlan, canUseFeature, isMaxPlan, isProOrAbove)
 * with mocked Supabase.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    PLAN_DETAILS,
    getUserPlan,
    canUseFeature,
    isMaxPlan,
    isProOrAbove,
} from '@/lib/user-plan';
import type { UserPlanType, PlanFeatures } from '@/lib/user-plan';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// PLAN_DETAILS constant validation
// ---------------------------------------------------------------------------

describe('PLAN_DETAILS', () => {
    const planKeys: UserPlanType[] = ['free', 'pro', 'max'];

    it('contains exactly three plans: free, pro, max', () => {
        expect(Object.keys(PLAN_DETAILS)).toHaveLength(3);
        for (const key of planKeys) {
            expect(PLAN_DETAILS).toHaveProperty(key);
        }
    });

    it.each(planKeys)('"%s" plan has all required fields', (key) => {
        const plan = PLAN_DETAILS[key];
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('nameKo');
        expect(plan).toHaveProperty('price');
        expect(plan).toHaveProperty('monthlyPrice');
        expect(plan).toHaveProperty('dailyAiCallsLimit');
        expect(plan).toHaveProperty('features');
        expect(plan).toHaveProperty('highlights');
    });

    it.each(planKeys)('"%s" plan has correct field types', (key) => {
        const plan = PLAN_DETAILS[key];
        expect(typeof plan.name).toBe('string');
        expect(typeof plan.nameKo).toBe('string');
        expect(typeof plan.price).toBe('number');
        expect(typeof plan.monthlyPrice).toBe('string');
        expect(
            plan.dailyAiCallsLimit === null || typeof plan.dailyAiCallsLimit === 'number',
        ).toBe(true);
        expect(Array.isArray(plan.features)).toBe(true);
        expect(Array.isArray(plan.highlights)).toBe(true);
    });

    it('has correct display names', () => {
        expect(PLAN_DETAILS.free.name).toBe('Free');
        expect(PLAN_DETAILS.pro.name).toBe('Pro');
        expect(PLAN_DETAILS.max.name).toBe('Max');
    });

    it('has correct prices', () => {
        expect(PLAN_DETAILS.free.price).toBe(0);
        expect(PLAN_DETAILS.pro.price).toBe(6900);
        expect(PLAN_DETAILS.max.price).toBe(14900);
    });

    it('prices are in ascending order', () => {
        expect(PLAN_DETAILS.free.price).toBeLessThan(PLAN_DETAILS.pro.price);
        expect(PLAN_DETAILS.pro.price).toBeLessThan(PLAN_DETAILS.max.price);
    });

    it('has correct dailyAiCallsLimit values', () => {
        expect(PLAN_DETAILS.free.dailyAiCallsLimit).toBe(30);
        expect(PLAN_DETAILS.pro.dailyAiCallsLimit).toBe(100);
        expect(PLAN_DETAILS.max.dailyAiCallsLimit).toBeNull();
    });

    it('free plan has non-empty features and highlights', () => {
        expect(PLAN_DETAILS.free.features.length).toBeGreaterThan(0);
        expect(PLAN_DETAILS.free.highlights.length).toBeGreaterThan(0);
    });

    it('pro plan has non-empty features and highlights', () => {
        expect(PLAN_DETAILS.pro.features.length).toBeGreaterThan(0);
        expect(PLAN_DETAILS.pro.highlights.length).toBeGreaterThan(0);
    });

    it('max plan has non-empty features and highlights', () => {
        expect(PLAN_DETAILS.max.features.length).toBeGreaterThan(0);
        expect(PLAN_DETAILS.max.highlights.length).toBeGreaterThan(0);
    });

    it('all feature entries are non-empty strings', () => {
        for (const key of planKeys) {
            for (const feature of PLAN_DETAILS[key].features) {
                expect(typeof feature).toBe('string');
                expect(feature.length).toBeGreaterThan(0);
            }
        }
    });

    it('all highlight entries are non-empty strings', () => {
        for (const key of planKeys) {
            for (const highlight of PLAN_DETAILS[key].highlights) {
                expect(typeof highlight).toBe('string');
                expect(highlight.length).toBeGreaterThan(0);
            }
        }
    });
});

// ---------------------------------------------------------------------------
// Type exports (compile-time checks expressed as runtime assertions)
// ---------------------------------------------------------------------------

describe('Type exports', () => {
    it('UserPlanType accepts free, pro, max', () => {
        const plans: UserPlanType[] = ['free', 'pro', 'max'];
        expect(plans).toHaveLength(3);
    });

    it('PlanFeatures interface has expected boolean fields', () => {
        const features: PlanFeatures = {
            jarvis_memory: false,
            risk_alerts: false,
            smart_briefing: false,
            proactive_suggestions: true,
            mood_patterns: false,
            ai_templates: false,
            voice_journal: false,
            health_sync: false,
            github_sync: false,
        };
        for (const value of Object.values(features)) {
            expect(typeof value).toBe('boolean');
        }
    });
});

// ---------------------------------------------------------------------------
// DB-dependent functions (Supabase mock from setup.ts)
// ---------------------------------------------------------------------------

describe('getUserPlan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns DEFAULT_PLAN (free) when user is not found', async () => {
        // setup.ts mock already returns { data: null, error: null } for maybeSingle
        const plan = await getUserPlan('unknown@example.com');

        expect(plan.plan).toBe('free');
        expect(plan.isActive).toBe(true);
        expect(plan.dailyAiCallsLimit).toBe(30);
        expect(plan.memoryStorageMb).toBe(50);
        expect(plan.expiresAt).toBeNull();
    });

    it('DEFAULT_PLAN features disable premium features', async () => {
        const plan = await getUserPlan('nobody@example.com');

        expect(plan.features.jarvis_memory).toBe(false);
        expect(plan.features.risk_alerts).toBe(false);
        expect(plan.features.smart_briefing).toBe(false);
        expect(plan.features.github_sync).toBe(false);
    });

    it('DEFAULT_PLAN features enable free-tier features', async () => {
        const plan = await getUserPlan('nobody@example.com');

        expect(plan.features.proactive_suggestions).toBe(true);
    });

    it('calls supabaseAdmin.from with "users" table', async () => {
        await getUserPlan('test@example.com');

        const mockedFrom = vi.mocked(supabaseAdmin.from);
        expect(mockedFrom).toHaveBeenCalledWith('users');
    });
});

describe('canUseFeature', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true for proactive_suggestions on free plan (unknown user)', async () => {
        const result = await canUseFeature('unknown@example.com', 'proactive_suggestions');
        expect(result).toBe(true);
    });

    it('returns false for jarvis_memory on free plan (unknown user)', async () => {
        const result = await canUseFeature('unknown@example.com', 'jarvis_memory');
        expect(result).toBe(false);
    });

    it('returns false for risk_alerts on free plan (unknown user)', async () => {
        const result = await canUseFeature('unknown@example.com', 'risk_alerts');
        expect(result).toBe(false);
    });

    it('returns false for smart_briefing on free plan (unknown user)', async () => {
        const result = await canUseFeature('unknown@example.com', 'smart_briefing');
        expect(result).toBe(false);
    });

    it('returns false for github_sync on free plan (unknown user)', async () => {
        const result = await canUseFeature('unknown@example.com', 'github_sync');
        expect(result).toBe(false);
    });
});

describe('isMaxPlan', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false for unknown user (defaults to free plan)', async () => {
        const result = await isMaxPlan('unknown@example.com');
        expect(result).toBe(false);
    });
});

describe('isProOrAbove', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns false for unknown user (defaults to free plan)', async () => {
        const result = await isProOrAbove('unknown@example.com');
        expect(result).toBe(false);
    });
});
