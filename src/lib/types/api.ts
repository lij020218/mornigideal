/**
 * API Request/Response & Chat Type Definitions
 */

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ChatContext {
    schedules?: Array<{ text: string; startTime: string; completed?: boolean; skipped?: boolean }>;
    currentDate?: string;
    currentTime?: string;
    location?: { city?: string; latitude?: number; longitude?: number };
    goals?: Array<{ type: string; title: string; category?: string; progress?: number }>;
    learningCurriculums?: Array<{ title: string; currentModule?: string; progress?: number }>;
    trendBriefings?: Array<{ id: string; title?: string; name?: string; category?: string }>;
    pendingSchedule?: { title: string; description?: string; estimatedTime: string; category: string };
}

export interface ToolCallArgs {
    [key: string]: unknown;
}

export interface AddScheduleArgs {
    text: string;
    startTime: string;
    endTime?: string;
    specificDate?: string;
    daysOfWeek?: number[];
    color?: string;
    location?: string;
    memo?: string;
}

export interface DeleteScheduleArgs {
    text: string;
    startTime?: string;
}

export interface UpdateScheduleArgs {
    originalText: string;
    originalTime: string;
    newText?: string;
    newStartTime?: string;
    newEndTime?: string;
    newColor?: string;
}

export interface SuggestScheduleArgs {
    count?: number;
    focus?: 'rest' | 'productivity' | 'exercise' | 'learning' | 'balanced' | 'auto';
}

export interface CreateChecklistArgs {
    title: string;
    items?: string[];
    scheduleId?: string;
}

export interface PrepareScheduleArgs {
    scheduleText: string;
    startTime: string;
}

export interface SaveLearningArgs {
    category?: string;
    content: string;
}

export type FocusType = 'rest' | 'productivity' | 'exercise' | 'learning' | 'balanced';
