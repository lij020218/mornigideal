/**
 * User Profile & Memory Type Definitions
 */

import type { CustomGoal, LongTermGoals } from './schedule';

export interface UserProfile {
    plan?: string;
    customGoals?: CustomGoal[];
    longTermGoals?: LongTermGoals;
    job?: string;
    field?: string;
    major?: string;
    goal?: string;
    interests?: string[];
    experience?: string;
    level?: string;
    personaStyle?: string;
    schedule?: { sleep?: string; [key: string]: unknown };
    notificationSettings?: {
        enabled?: boolean;
        quietHoursStart?: number;
        quietHoursEnd?: number;
    };
    [key: string]: unknown;
}

export interface UserRow {
    id: string;
    email: string;
    name?: string;
    plan?: string;
    profile?: UserProfile;
    created_at?: string;
}

export interface UserMemory {
    preferences?: Record<string, string>;
    patterns?: Record<string, string>;
    importantEvents?: ImportantEvent[];
}

export interface ImportantEvent {
    date: string;
    event: string;
    category?: string;
}

export interface MemoryRow {
    id?: string;
    user_id?: string;
    content_type: string;
    content: string;
    metadata?: Record<string, unknown>;
    similarity?: number;
    created_at?: string;
}
