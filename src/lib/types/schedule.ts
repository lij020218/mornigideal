/**
 * Schedule & Goal Type Definitions
 *
 * customGoals (JSONB profile 내 일정/습관 데이터) 공통 타입
 */

export interface CustomGoal {
    id?: string;
    text: string;
    content?: string;
    startTime?: string;
    endTime?: string;
    specificDate?: string;
    daysOfWeek?: number[];
    color?: string;
    location?: string;
    memo?: string;
    completed?: boolean;
    skipped?: boolean;
    createdAt?: string;
    startDate?: string;
    endDate?: string;
    linkedGoalId?: string;
    linkedGoalType?: 'weekly' | 'monthly' | 'yearly';
    workMode?: 'focus' | 'research' | 'brainstorm' | 'light' | null;
}

export interface LongTermGoal {
    id?: string;
    title: string;
    progress: number;
    completed?: boolean;
    category?: string;
    createdAt?: string;
    milestones?: Array<{ text: string; done: boolean }>;
}

export interface LongTermGoals {
    weekly?: LongTermGoal[];
    monthly?: LongTermGoal[];
    yearly?: LongTermGoal[];
}

export interface GoalContext {
    type: 'weekly' | 'monthly' | 'yearly';
    title: string;
    progress?: number;
    category?: string;
}
