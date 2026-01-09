import { type CustomGoal } from "./SchedulePopup";

export interface DashboardProps {
    username: string;
    initialProfile: UserProfile | null;
    initialMaterials: any[] | null;
    initialCurriculum: CurriculumInput[] | null;
    initialTrendBriefing: any | null;
    initialHabitInsights?: any | null;
}

export interface UserProfile {
    job: string;
    goal: string;
    level: string;
    schedule?: {
        wakeUp: string;
        workStart: string;
        workEnd: string;
        sleep: string;
    };
    customGoals?: CustomGoal[];
    interests?: string[];
}

export interface CurriculumItem {
    title: string;
    subtitle: string;
    icon: string;
}

export type CurriculumInput =
    | CurriculumItem
    | { curriculum_data: CurriculumItem[] }
    | { curriculum: CurriculumItem[] };

export const isCurriculumItem = (value: CurriculumInput): value is CurriculumItem => {
    return (
        typeof value === "object" &&
        value !== null &&
        "title" in value &&
        "subtitle" in value &&
        "icon" in value
    );
};

export interface DailyGoals {
    wakeUp: boolean;
    learning: number;
    exercise: boolean;
    trendBriefing: number;
    customGoals: Record<string, boolean>;
}

export interface UserSettings {
    wakeUpTime: string;
    exerciseEnabled: boolean;
}
