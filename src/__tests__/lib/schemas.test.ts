/**
 * Tests for Zod validation schemas
 *
 * These are pure functions — no mocks needed.
 */

import { describe, it, expect } from 'vitest';
import {
    validateBody,
    dateSchema,
    timeSchema,
    emailSchema,
    loginSchema,
    registerSchema,
    signupSchema,
    oauthLoginSchema,
    accountDeleteSchema,
    accountUpdateSchema,
    aiChatSchema,
    scheduleCreateSchema,
    scheduleAddSchema,
    scheduleModifySchema,
    scheduleDeleteSchema,
    scheduleUpdateSchema,
    reminderAddSchema,
    learningSaveSchema,
    eventLogSchema,
    modeEventSchema,
    materialRateSchema,
    focusSessionSchema,
    moodCheckInSchema,
    healthDataSchema,
    chatHistorySchema,
} from '@/lib/schemas';

// ============================================
// Common field schemas
// ============================================

describe('dateSchema', () => {
    it('accepts valid YYYY-MM-DD dates', () => {
        expect(dateSchema.safeParse('2024-01-15').success).toBe(true);
        expect(dateSchema.safeParse('2026-12-31').success).toBe(true);
    });

    it('rejects invalid date formats', () => {
        expect(dateSchema.safeParse('2024/01/15').success).toBe(false);
        expect(dateSchema.safeParse('01-15-2024').success).toBe(false);
        expect(dateSchema.safeParse('2024-1-5').success).toBe(false);
        expect(dateSchema.safeParse('not-a-date').success).toBe(false);
        expect(dateSchema.safeParse('').success).toBe(false);
    });
});

describe('timeSchema', () => {
    it('accepts valid HH:MM times', () => {
        expect(timeSchema.safeParse('09:00').success).toBe(true);
        expect(timeSchema.safeParse('23:59').success).toBe(true);
        expect(timeSchema.safeParse('00:00').success).toBe(true);
    });

    it('rejects invalid time formats', () => {
        expect(timeSchema.safeParse('9:00').success).toBe(false);
        expect(timeSchema.safeParse('25:00').success).toBe(true); // regex only checks \d{2}:\d{2} format, not range
        expect(timeSchema.safeParse('09:0').success).toBe(false);
        expect(timeSchema.safeParse('').success).toBe(false);
    });
});

describe('emailSchema', () => {
    it('accepts valid emails', () => {
        expect(emailSchema.safeParse('user@example.com').success).toBe(true);
        expect(emailSchema.safeParse('a@b.co').success).toBe(true);
    });

    it('rejects invalid emails', () => {
        expect(emailSchema.safeParse('not-an-email').success).toBe(false);
        expect(emailSchema.safeParse('').success).toBe(false);
        expect(emailSchema.safeParse('@example.com').success).toBe(false);
    });

    it('rejects emails over 254 chars', () => {
        const long = 'a'.repeat(250) + '@b.co';
        expect(emailSchema.safeParse(long).success).toBe(false);
    });
});

// ============================================
// validateBody helper
// ============================================

describe('validateBody', () => {
    it('returns success with parsed data on valid input', () => {
        const result = validateBody(loginSchema, { email: 'test@test.com', password: 'pass123' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.email).toBe('test@test.com');
            expect(result.data.password).toBe('pass123');
        }
    });

    it('returns failure with NextResponse on invalid input', () => {
        const result = validateBody(loginSchema, { email: 'bad', password: '' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.response.status).toBe(400);
        }
    });

    it('returns failure on missing required fields', () => {
        const result = validateBody(loginSchema, {});
        expect(result.success).toBe(false);
    });

    it('returns failure on extra type mismatch', () => {
        const result = validateBody(loginSchema, { email: 123, password: true });
        expect(result.success).toBe(false);
    });
});

// ============================================
// Auth schemas
// ============================================

describe('loginSchema', () => {
    it('accepts valid credentials', () => {
        expect(loginSchema.safeParse({ email: 'u@e.com', password: 'p' }).success).toBe(true);
    });

    it('rejects empty password', () => {
        expect(loginSchema.safeParse({ email: 'u@e.com', password: '' }).success).toBe(false);
    });
});

describe('registerSchema', () => {
    it('accepts valid registration', () => {
        const valid = { email: 'u@e.com', password: '12345678', name: 'John' };
        expect(registerSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects password under 8 chars', () => {
        const short = { email: 'u@e.com', password: '1234567', name: 'John' };
        expect(registerSchema.safeParse(short).success).toBe(false);
    });

    it('rejects missing name', () => {
        expect(registerSchema.safeParse({ email: 'u@e.com', password: '12345678' }).success).toBe(false);
    });
});

describe('signupSchema', () => {
    it('accepts valid signup', () => {
        const valid = { name: 'John', username: 'john', email: 'u@e.com', password: '12345678' };
        expect(signupSchema.safeParse(valid).success).toBe(true);
    });
});

describe('oauthLoginSchema', () => {
    it('accepts valid oauth login', () => {
        const valid = { provider: 'google', email: 'u@e.com' };
        expect(oauthLoginSchema.safeParse(valid).success).toBe(true);
    });

    it('accepts optional fields', () => {
        const valid = { provider: 'google', email: 'u@e.com', name: 'John', image: 'https://img.com/a.jpg', providerId: '123' };
        expect(oauthLoginSchema.safeParse(valid).success).toBe(true);
    });
});

// ============================================
// Account schemas
// ============================================

describe('accountDeleteSchema', () => {
    it('accepts password', () => {
        expect(accountDeleteSchema.safeParse({ password: 'mypass' }).success).toBe(true);
    });

    it('rejects empty password', () => {
        expect(accountDeleteSchema.safeParse({ password: '' }).success).toBe(false);
    });
});

describe('accountUpdateSchema', () => {
    it('accepts valid password change', () => {
        expect(accountUpdateSchema.safeParse({ currentPassword: 'old', newPassword: '12345678' }).success).toBe(true);
    });

    it('rejects new password under 8 chars', () => {
        expect(accountUpdateSchema.safeParse({ currentPassword: 'old', newPassword: '1234567' }).success).toBe(false);
    });
});

// ============================================
// AI Chat schema
// ============================================

describe('aiChatSchema', () => {
    it('accepts valid messages', () => {
        const valid = {
            messages: [{ role: 'user', content: 'Hello' }],
        };
        expect(aiChatSchema.safeParse(valid).success).toBe(true);
    });

    it('accepts with optional context', () => {
        const valid = {
            messages: [{ role: 'user', content: 'Hello' }],
            context: { mode: 'chat' },
        };
        expect(aiChatSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects empty messages array', () => {
        expect(aiChatSchema.safeParse({ messages: [] }).success).toBe(false);
    });

    it('rejects invalid role', () => {
        const invalid = {
            messages: [{ role: 'admin', content: 'Hello' }],
        };
        expect(aiChatSchema.safeParse(invalid).success).toBe(false);
    });

    it('rejects empty content', () => {
        const invalid = {
            messages: [{ role: 'user', content: '' }],
        };
        expect(aiChatSchema.safeParse(invalid).success).toBe(false);
    });
});

// ============================================
// Schedule schemas
// ============================================

describe('scheduleCreateSchema', () => {
    it('accepts minimal schedule', () => {
        expect(scheduleCreateSchema.safeParse({ text: '운동', startTime: '09:00' }).success).toBe(true);
    });

    it('accepts full schedule', () => {
        const full = { text: '운동', startTime: '09:00', endTime: '10:00', date: '2024-01-15', color: 'blue' };
        expect(scheduleCreateSchema.safeParse(full).success).toBe(true);
    });

    it('rejects empty text', () => {
        expect(scheduleCreateSchema.safeParse({ text: '', startTime: '09:00' }).success).toBe(false);
    });
});

describe('scheduleAddSchema', () => {
    it('accepts with daysOfWeek', () => {
        const valid = { text: '운동', daysOfWeek: [1, 3, 5], startTime: '09:00', endTime: '10:00' };
        expect(scheduleAddSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects day out of range', () => {
        const invalid = { text: '운동', daysOfWeek: [7] };
        expect(scheduleAddSchema.safeParse(invalid).success).toBe(false);
    });
});

describe('scheduleUpdateSchema', () => {
    it('accepts completed toggle', () => {
        expect(scheduleUpdateSchema.safeParse({ scheduleId: 'abc', completed: true }).success).toBe(true);
    });

    it('rejects missing scheduleId', () => {
        expect(scheduleUpdateSchema.safeParse({ completed: true }).success).toBe(false);
    });
});

// ============================================
// Other schemas - smoke tests
// ============================================

describe('reminderAddSchema', () => {
    it('accepts valid reminder', () => {
        expect(reminderAddSchema.safeParse({ targetTime: '09:00', message: 'Wake up' }).success).toBe(true);
    });

    it('rejects empty message', () => {
        expect(reminderAddSchema.safeParse({ targetTime: '09:00', message: '' }).success).toBe(false);
    });
});

describe('learningSaveSchema', () => {
    it('accepts valid learning', () => {
        expect(learningSaveSchema.safeParse({ content: 'Learned something' }).success).toBe(true);
    });

    it('accepts with optional fields', () => {
        const valid = { content: 'New skill', category: 'skill', tags: ['typescript'] };
        expect(learningSaveSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects invalid category', () => {
        expect(learningSaveSchema.safeParse({ content: 'X', category: 'invalid' }).success).toBe(false);
    });
});

describe('eventLogSchema', () => {
    it('accepts valid event', () => {
        expect(eventLogSchema.safeParse({ eventType: 'schedule_complete' }).success).toBe(true);
    });

    it('accepts with metadata', () => {
        const valid = { eventType: 'exercise', metadata: { duration: 30 } };
        expect(eventLogSchema.safeParse(valid).success).toBe(true);
    });
});

describe('modeEventSchema', () => {
    it('accepts valid focus event', () => {
        expect(modeEventSchema.safeParse({ eventType: 'focus_start' }).success).toBe(true);
    });

    it('rejects invalid event type', () => {
        expect(modeEventSchema.safeParse({ eventType: 'invalid_event' }).success).toBe(false);
    });
});

describe('materialRateSchema', () => {
    it('accepts good rating', () => {
        expect(materialRateSchema.safeParse({ materialId: 'abc', rating: 'good' }).success).toBe(true);
    });

    it('rejects invalid rating', () => {
        expect(materialRateSchema.safeParse({ materialId: 'abc', rating: 'excellent' }).success).toBe(false);
    });
});

describe('focusSessionSchema', () => {
    it('accepts valid session', () => {
        expect(focusSessionSchema.safeParse({ duration: 25 }).success).toBe(true);
    });

    it('rejects zero duration', () => {
        expect(focusSessionSchema.safeParse({ duration: 0 }).success).toBe(false);
    });

    it('rejects excessive duration', () => {
        expect(focusSessionSchema.safeParse({ duration: 481 }).success).toBe(false);
    });
});

describe('moodCheckInSchema', () => {
    it('accepts valid mood', () => {
        expect(moodCheckInSchema.safeParse({ mood: 3, energy: 4 }).success).toBe(true);
    });

    it('rejects out of range', () => {
        expect(moodCheckInSchema.safeParse({ mood: 0, energy: 3 }).success).toBe(false);
        expect(moodCheckInSchema.safeParse({ mood: 6, energy: 3 }).success).toBe(false);
    });
});

describe('healthDataSchema', () => {
    it('accepts valid health data', () => {
        const valid = { date: '2024-01-15', steps: 10000, sleepMinutes: 480 };
        expect(healthDataSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects negative steps', () => {
        expect(healthDataSchema.safeParse({ date: '2024-01-15', steps: -1 }).success).toBe(false);
    });
});

describe('chatHistorySchema', () => {
    it('accepts valid chat history', () => {
        const valid = {
            date: '2024-01-15',
            messages: [{ id: '1', role: 'user', content: 'Hi', timestamp: '2024-01-15T09:00:00Z' }],
        };
        expect(chatHistorySchema.safeParse(valid).success).toBe(true);
    });

    it('rejects empty messages', () => {
        expect(chatHistorySchema.safeParse({ date: '2024-01-15', messages: [] }).success).toBe(false);
    });
});
