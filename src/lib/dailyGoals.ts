// Daily Goals Utility Functions

interface DailyGoals {
    wakeUp: boolean;
    learning: number;
    exercise: boolean;
    trendBriefing: number;
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
        learning: 0,
        exercise: false,
        trendBriefing: 0,
        customGoals: {},
    };
}

function getTodayString(): string {
    // Return YYYY-MM-DD for consistency with API
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export function getDailyGoals(): DailyGoals {
    if (typeof window === "undefined") return getDefaultGoals();

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultGoals();

    try {
        const { date, goals }: StoredGoals = JSON.parse(stored);

        // Reset if it's a new day
        if (date !== getTodayString()) {
            // Archive yesterday's goals before resetting
            localStorage.setItem("previous_daily_goals", JSON.stringify({
                date: date,
                goals: goals
            }));

            localStorage.removeItem(STORAGE_KEY);
            return getDefaultGoals();
        }
        // Merge with default goals to ensure all fields exist (migration)
        return { ...getDefaultGoals(), ...goals };
    } catch {
        return getDefaultGoals();
    }
}

export function getPreviousDailyGoals(): DailyGoals | null {
    if (typeof window === "undefined") return null;

    const stored = localStorage.getItem("previous_daily_goals");
    if (!stored) return null;

    try {
        const { goals } = JSON.parse(stored);
        return goals;
    } catch {
        return null;
    }
}

async function syncToApi(goals: DailyGoals) {
    try {
        const completed_goals: string[] = [];
        if (goals.wakeUp) completed_goals.push('wakeUp');
        if (goals.exercise) completed_goals.push('exercise');
        // Add custom goals
        Object.entries(goals.customGoals).forEach(([id, completed]) => {
            if (completed) completed_goals.push(id);
        });

        // We assume learning and trendBriefing are tracked by counts, 
        // but daily_goals API expects completed_goals array. 
        // We can add virtual items like 'learning_1', 'learning_2' etc if we want detailed tracking,
        // or just rely on the fact that we are mainly interested in 'completion rate' which is vague.
        // For now let's just push everything.

        await fetch('/api/user/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: getTodayString(),
                completed_goals
                // read_trends logic is separate in this file? No, it's not here.
            })
        });
    } catch (e) {
        console.warn('Failed to sync goals to API', e);
    }
}

export function saveDailyGoals(goals: DailyGoals): void {
    if (typeof window === "undefined") return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: getTodayString(),
        goals,
    }));

    // Fire and forget sync
    syncToApi(goals).catch(err => console.error("Sync error:", err));
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
