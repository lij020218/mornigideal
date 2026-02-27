/**
 * Tests for constants.ts
 *
 * Validates constant values are within expected ranges.
 * Catches accidental modifications to critical thresholds.
 */

import { describe, it, expect } from 'vitest';
import { TIMING, THRESHOLDS, LIMITS, NOTIFICATION_COOLDOWNS } from '@/lib/constants';

describe('TIMING', () => {
    it('has valid morning window', () => {
        expect(TIMING.MORNING_START).toBeLessThan(TIMING.MORNING_END);
        expect(TIMING.MORNING_START).toBeGreaterThanOrEqual(0);
        expect(TIMING.MORNING_END).toBeLessThanOrEqual(24);
    });

    it('has valid evening window', () => {
        expect(TIMING.EVENING_START).toBeLessThan(TIMING.EVENING_END);
    });

    it('has valid sleep range', () => {
        expect(TIMING.SLEEP_IDEAL_MIN_HOURS).toBeLessThan(TIMING.SLEEP_IDEAL_MAX_HOURS);
        expect(TIMING.SLEEP_IDEAL_MIN_HOURS).toBeGreaterThan(0);
    });

    it('has valid schedule defaults', () => {
        expect(TIMING.SCHEDULE_DEFAULT_START).toBeLessThan(TIMING.SCHEDULE_DEFAULT_END);
    });
});

describe('THRESHOLDS', () => {
    it('has valid completion rate thresholds', () => {
        expect(THRESHOLDS.COMPLETION_LOW).toBeLessThan(THRESHOLDS.COMPLETION_HIGH);
        expect(THRESHOLDS.COMPLETION_LOW).toBeGreaterThan(0);
        expect(THRESHOLDS.COMPLETION_HIGH).toBeLessThanOrEqual(1);
    });

    it('has valid sleep consistency thresholds', () => {
        expect(THRESHOLDS.SLEEP_CONSISTENCY_LOW).toBeLessThan(THRESHOLDS.SLEEP_CONSISTENCY_HIGH);
    });

    it('has valid pattern skip rates', () => {
        expect(THRESHOLDS.PATTERN_SKIP_RATE).toBeLessThan(THRESHOLDS.PATTERN_HIGH_SKIP_RATE);
    });

    it('has focus streak milestones in ascending order', () => {
        const milestones = THRESHOLDS.FOCUS_STREAK_MILESTONES;
        for (let i = 1; i < milestones.length; i++) {
            expect(milestones[i]).toBeGreaterThan(milestones[i - 1]);
        }
    });
});

describe('LIMITS', () => {
    it('has positive limits', () => {
        for (const [key, value] of Object.entries(LIMITS)) {
            if (typeof value === 'number') {
                expect(value, `LIMITS.${key}`).toBeGreaterThan(0);
            } else if (typeof value === 'object' && value !== null) {
                for (const [subKey, subVal] of Object.entries(value)) {
                    expect(subVal, `LIMITS.${key}.${subKey}`).toBeGreaterThan(0);
                }
            }
        }
    });
});

describe('NOTIFICATION_COOLDOWNS', () => {
    it('has positive cooldown values', () => {
        for (const [key, value] of Object.entries(NOTIFICATION_COOLDOWNS)) {
            expect(value, `COOLDOWN.${key}`).toBeGreaterThan(0);
        }
    });

    it('has a default cooldown', () => {
        expect(NOTIFICATION_COOLDOWNS._default).toBeGreaterThan(0);
    });
});
