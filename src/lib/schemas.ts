/**
 * Zod validation schemas for all POST/PUT API routes.
 *
 * Usage:
 *   import { loginSchema, validateBody } from '@/lib/schemas';
 *   const v = validateBody(loginSchema, body);
 *   if (!v.success) return v.response;
 *   const { email, password } = v.data;
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';

// ============================================
// Common field schemas
// ============================================

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
export const emailSchema = z.string().email().max(254);

// ============================================
// Validation helper
// ============================================

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown):
    { success: true; data: T } | { success: false; response: NextResponse } {
    const result = schema.safeParse(body);
    if (!result.success) {
        return {
            success: false,
            response: NextResponse.json(
                { error: 'Invalid request', details: result.error.flatten().fieldErrors },
                { status: 400 },
            ),
        };
    }
    return { success: true, data: result.data };
}

// ============================================
// Auth schemas
// ============================================

// POST /api/auth/login
export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1).max(200),
});

// POST /api/auth/register
export const registerSchema = z.object({
    email: emailSchema,
    password: z.string().min(8).max(200),
    name: z.string().min(1).max(100),
});

// POST /api/auth/signup (web)
export const signupSchema = z.object({
    name: z.string().min(1).max(100),
    username: z.string().min(1).max(50),
    email: emailSchema,
    password: z.string().min(8).max(200),
});

// POST /api/auth/oauth-login
export const oauthLoginSchema = z.object({
    provider: z.string().min(1).max(50),
    email: emailSchema,
    name: z.string().max(100).optional(),
    image: z.string().max(2000).optional(),
    providerId: z.string().max(500).optional(),
});

// ============================================
// User account schemas
// ============================================

// DELETE /api/user/account
export const accountDeleteSchema = z.object({
    password: z.string().min(1).max(200),
});

// PUT /api/user/account
export const accountUpdateSchema = z.object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
});

// POST /api/user/profile (full replace)
export const profileReplaceSchema = z.object({
    profile: z.record(z.unknown()),
});

// ============================================
// AI Chat schema
// ============================================

// POST /api/ai-chat
export const aiChatSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(50000),
    })).min(1).max(100),
    context: z.any().optional(),
});

// ============================================
// Schedule schemas
// ============================================

// POST /api/schedules
export const scheduleCreateSchema = z.object({
    text: z.string().min(1).max(500),
    startTime: z.string().min(1),
    endTime: z.string().optional(),
    date: dateSchema.optional(),
    specificDate: dateSchema.optional(),
    color: z.string().max(50).optional(),
});

// PUT /api/schedules/[id]
export const scheduleEditSchema = z.object({
    text: z.string().min(1).max(500).optional(),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional().nullable(),
    completed: z.boolean().optional(),
});

// POST /api/user/schedule/add
export const scheduleAddSchema = z.object({
    text: z.string().min(1).max(500),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    color: z.string().max(50).optional(),
    specificDate: dateSchema.optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    findAvailableSlot: z.boolean().optional(),
    estimatedDuration: z.string().max(100).optional(),
    location: z.string().max(500).optional(),
    memo: z.string().max(2000).optional(),
    linkedGoalId: z.string().max(200).optional(),
    linkedGoalType: z.string().max(50).optional(),
});

// POST /api/user/schedule/modify
export const scheduleModifySchema = z.object({
    scheduleId: z.string().max(200).optional(),
    originalText: z.string().max(500).optional(),
    originalTime: timeSchema.optional(),
    newText: z.string().min(1).max(500).optional(),
    newStartTime: timeSchema.optional(),
    newEndTime: timeSchema.optional(),
    newLocation: z.string().max(500).optional(),
    newMemo: z.string().max(2000).optional(),
});

// POST /api/user/schedule/delete
export const scheduleDeleteSchema = z.object({
    scheduleId: z.string().max(200).optional(),
    text: z.string().max(500).optional(),
    startTime: timeSchema.optional(),
    isRepeating: z.boolean().optional(),
    specificDate: dateSchema.optional(),
});

// POST /api/user/schedule/update (complete/skip toggle)
export const scheduleUpdateSchema = z.object({
    scheduleId: z.string().min(1).max(200),
    completed: z.boolean().optional(),
    skipped: z.boolean().optional(),
});

// ============================================
// Goals schemas
// ============================================

// POST /api/user/goals
export const dailyGoalsSchema = z.object({
    date: dateSchema,
    completed_goals: z.array(z.unknown()).optional(),
    read_trends: z.array(z.unknown()).optional(),
});

// POST /api/user/long-term-goals
export const longTermGoalSchema = z.object({
    goal: z.object({
        id: z.string().max(200).optional(),
        type: z.enum(['weekly', 'monthly', 'yearly']),
        title: z.string().max(500).optional(),
        description: z.string().max(2000).optional(),
        category: z.string().max(100).optional(),
        targetDate: z.string().optional(),
        progress: z.number().min(0).max(100).optional(),
        milestones: z.array(z.object({
            id: z.string(),
            title: z.string(),
            completed: z.boolean(),
        })).optional(),
        completed: z.boolean().optional(),
    }),
    action: z.enum(['add', 'update', 'delete', 'complete', 'updateProgress', 'resetWeekly']),
});

// ============================================
// Event & activity schemas
// ============================================

// POST /api/user/events/log
export const eventLogSchema = z.object({
    eventType: z.string().min(1).max(100),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
});

// POST /api/user/mode-events
export const modeEventSchema = z.object({
    eventType: z.enum([
        'focus_start', 'focus_end', 'focus_interrupted',
        'sleep_start', 'sleep_end',
    ]),
    metadata: z.record(z.unknown()).optional(),
});

// POST /api/user/activity-log
export const activityLogSchema = z.object({
    activityType: z.string().min(1).max(100),
    metadata: z.record(z.unknown()).optional(),
});

// ============================================
// Chat history schema
// ============================================

// POST /api/user/chat-history
export const chatHistorySchema = z.object({
    date: dateSchema,
    messages: z.array(z.object({
        id: z.string(),
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
        timestamp: z.string(),
    })).min(1),
    title: z.string().max(200).optional(),
});

// ============================================
// Reminder schema
// ============================================

// POST /api/user/reminder/add
export const reminderAddSchema = z.object({
    targetTime: timeSchema,
    message: z.string().min(1).max(1000),
    relatedSchedule: z.string().max(500).optional().nullable(),
    specificDate: dateSchema.optional(),
});

// ============================================
// Schedule feedback schema
// ============================================

// POST /api/user/schedule-feedback
export const scheduleFeedbackSchema = z.object({
    goalId: z.string().max(200).optional(),
    goalText: z.string().max(500).optional(),
    feedback: z.string().max(100).optional(),
    memo: z.string().max(2000).optional(),
    followUpTask: z.string().max(500).optional(),
    timestamp: z.string().optional(),
});

// ============================================
// Learning save schema
// ============================================

// POST /api/user/learning/save
export const learningSaveSchema = z.object({
    content: z.string().min(1).max(5000),
    category: z.enum(['insight', 'skill', 'reflection', 'goal_progress']).optional(),
    relatedGoal: z.string().max(500).optional().nullable(),
    tags: z.array(z.string().max(100)).optional(),
});

// ============================================
// Material rate schema
// ============================================

// POST /api/material/rate
export const materialRateSchema = z.object({
    materialId: z.string().min(1).max(200),
    rating: z.enum(['poor', 'good']),
});

// ============================================
// Focus session schema
// ============================================

// POST /api/user/focus-stats
export const focusSessionSchema = z.object({
    duration: z.number().int().min(1).max(480), // minutes
    pomodoroCount: z.number().int().min(0).max(50).optional(),
    interruptions: z.number().int().min(0).max(100).optional(),
    category: z.string().max(50).optional(),
    note: z.string().max(500).optional(),
});

// Mood check-in schema
export const moodCheckInSchema = z.object({
    mood: z.number().int().min(1).max(5),
    energy: z.number().int().min(1).max(5),
    note: z.string().max(500).optional(),
});

// ============================================
// Routine template schemas
// ============================================

// POST /api/user/routine-templates (apply template)
export const templateApplySchema = z.object({
    templateId: z.string().min(1).max(100),
    targetDate: dateSchema.optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
});

// POST /api/user/routine-templates/generate (AI generate)
export const templateGenerateSchema = z.object({
    preferences: z.object({
        wakeUpTime: timeSchema.optional(),
        sleepTime: timeSchema.optional(),
        workHours: z.string().max(50).optional(),
        priorities: z.array(z.string().max(100)).max(5).optional(),
        lifestyle: z.string().max(200).optional(),
    }),
});

// ============================================
// Health data schema
// ============================================

// POST /api/user/health-data
export const healthDataSchema = z.object({
    date: dateSchema,
    steps: z.number().int().min(0).max(200000).optional(),
    sleepMinutes: z.number().int().min(0).max(1440).optional(),
    sleepQuality: z.number().min(0).max(100).optional(),
    activeMinutes: z.number().int().min(0).max(1440).optional(),
    heartRateAvg: z.number().int().min(30).max(250).optional(),
    caloriesBurned: z.number().int().min(0).max(20000).optional(),
    source: z.enum(['healthkit', 'google_fit', 'manual']).optional(),
});
