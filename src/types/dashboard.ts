export interface Schedule {
    id: string;
    text: string;
    startTime: string;
    endTime?: string;
    completed?: boolean;
    skipped?: boolean;
    color?: string;
    location?: string;
    memo?: string;
    workMode?: 'focus' | 'research' | 'brainstorm' | 'light' | null;
    linkedGoalId?: string;
    linkedGoalType?: "weekly" | "monthly" | "yearly";
}

export interface ChatAction {
    type:
        | "add_schedule"
        | "delete_schedule"
        | "update_schedule"
        | "open_briefing"
        | "add_weekly_goal"
        | "open_link"
        | "open_curriculum"
        | "web_search"
        | "show_goals"
        | "show_habits"
        | "show_analysis"
        | "set_reminder"
        | "save_learning"
        | "resolve_conflict";
    label: string;
    data: Record<string, any>;
}

export interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    actions?: ChatAction[];
}

export interface RecommendationCard {
    id: string;
    title: string;
    description: string;
    estimatedTime: string;
    icon: string;
    category: string;
    priority?: string;
    action?: () => void;
}

export type AppState = "idle" | "chatting" | "schedule-expanded";

export interface StreakData {
    schedule: { current: number; longest: number; todayCompleted: boolean };
    learning: { current: number };
    goals: { weeklyCompletedCount: number };
}
