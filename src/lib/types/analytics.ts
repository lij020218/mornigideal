/**
 * Analytics & Event Log Type Definitions
 */

export interface ActivityEventLog {
    id?: string;
    user_email?: string;
    email?: string;
    event_type: string;
    start_at?: string;
    created_at?: string;
    occurred_at?: string;
    payload?: Record<string, unknown>;
    metadata?: {
        duration?: number;
        durationMinutes?: number;
        category?: string;
        startTime?: string;
        interruptCount?: number;
        scheduleText?: string;
        [key: string]: unknown;
    };
}

export type QueryParameter = string | number | boolean | null | string[];

export interface AggregatedEventRow {
    user_email: string;
    event_date: string;
    completed_tasks: number;
    total_tasks: number;
    workout_count: number;
    sleep_hours?: number;
}

export interface DailyFeatureRow {
    user_email: string;
    date: string;
    total_tasks: number;
    completed_tasks: number;
    workout_count: number;
    sleep_hours?: number;
    schedule_density: 'high' | 'medium' | 'low';
}
