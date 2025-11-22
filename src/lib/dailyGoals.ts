// Daily Goals Utility Functions

interface DailyGoals {
    wakeUp: boolean;
    trendReading: number;
    learning: number;
    exercise: boolean;
    customGoals: Record<string, boolean>;
}

interface StoredGoals {
    date: string;
    goals: DailyGoals;
}

const STORAGE_KEY = "daily_goals";

function getDefaultGoals(): DailyGoals {
    return {
        wakeUp: false,
        trendReading: 0,
        learning: 0,
        exercise: false,
        customGoals: {},
    };
}

function getTodayString(): string {
    return new Date().toDateString();
}

export function getDailyGoals(): DailyGoals {
    if (typeof window === "undefined") return getDefaultGoals();

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultGoals();

    try {
        const { date, goals }: StoredGoals = JSON.parse(stored);
        // Reset if it's a new day
        if (date !== getTodayString()) {
            localStorage.removeItem(STORAGE_KEY);
            return getDefaultGoals();
        }
        // Merge with default goals to ensure all fields exist (migration)
        return { ...getDefaultGoals(), ...goals };
    } catch {
        return getDefaultGoals();
    }
}

export function saveDailyGoals(goals: DailyGoals): void {
    if (typeof window === "undefined") return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: getTodayString(),
        goals,
    }));
}

export function incrementTrendReading(): number {
    const goals = getDailyGoals();
    // Track which trends have been read today to avoid double counting
    const readTrendsKey = `read_trends_${getTodayString()}`;
    const readTrends: string[] = JSON.parse(localStorage.getItem(readTrendsKey) || "[]");

    // Increment only if under 6 (reasonable max)
    if (goals.trendReading < 6) {
        goals.trendReading += 1;
        saveDailyGoals(goals);
    }

    return goals.trendReading;
}

export function markTrendAsRead(trendId: string): boolean {
    if (typeof window === "undefined") return false;

    const readTrendsKey = `read_trends_${getTodayString()}`;
    const readTrends: string[] = JSON.parse(localStorage.getItem(readTrendsKey) || "[]");

    // Already read this trend today
    if (readTrends.includes(trendId)) {
        return false;
    }

    // Mark as read
    readTrends.push(trendId);
    localStorage.setItem(readTrendsKey, JSON.stringify(readTrends));

    // Increment the reading count
    incrementTrendReading();
    return true;
}

export function incrementLearning(): number {
    const goals = getDailyGoals();

    // Increment only if under 5 (reasonable max)
    if (goals.learning < 5) {
        goals.learning += 1;
        saveDailyGoals(goals);
    }

    return goals.learning;
}

export function markLearningComplete(learningId: string): boolean {
    if (typeof window === "undefined") return false;

    const completedKey = `completed_learning_${getTodayString()}`;
    const completed: string[] = JSON.parse(localStorage.getItem(completedKey) || "[]");

    // Already completed this learning item today
    if (completed.includes(learningId)) {
        return false;
    }

    // Mark as completed
    completed.push(learningId);
    localStorage.setItem(completedKey, JSON.stringify(completed));

    // Increment the learning count
    incrementLearning();
    return true;
}

export function setWakeUpComplete(): void {
    const goals = getDailyGoals();
    goals.wakeUp = true;
    saveDailyGoals(goals);
}

export function setExerciseComplete(completed: boolean): void {
    const goals = getDailyGoals();
    goals.exercise = completed;
    saveDailyGoals(goals);
}
