/**
 * App Usage Tracking Library
 * 모바일 환경에서 앱 사용 시간을 추적하는 라이브러리
 *
 * 작동 원리:
 * 1. Page Visibility API를 사용하여 앱이 foreground/background 상태 감지
 * 2. localStorage에 세션 데이터 저장
 * 3. 일일/주간/월간 통계 제공
 */

export interface AppSession {
    appName: string;
    startTime: number;
    endTime?: number;
    duration?: number; // in milliseconds
    date: string; // YYYY-MM-DD format
}

export interface DailyStats {
    date: string;
    totalTime: number; // in milliseconds
    sessions: AppSession[];
    appBreakdown: Record<string, number>; // appName -> duration
}

export interface AppUsageGoal {
    appName: string;
    dailyLimitMinutes: number;
    enabled: boolean;
    color?: string;
}

const STORAGE_KEY = 'app_usage_sessions';
const GOALS_KEY = 'app_usage_goals';
const CURRENT_SESSION_KEY = 'app_usage_current_session';
const TRACKED_APPS_KEY = 'tracked_apps_list'; // Apps user wants to track

/**
 * Get today's date in YYYY-MM-DD format (KST)
 */
export function getTodayDate(): string {
    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return kst.toISOString().split('T')[0];
}

/**
 * Start tracking a session for an app
 */
export function startAppSession(appName: string): void {
    const session: AppSession = {
        appName,
        startTime: Date.now(),
        date: getTodayDate()
    };

    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
}

/**
 * End the current tracking session
 */
export function endAppSession(): void {
    const currentSessionStr = localStorage.getItem(CURRENT_SESSION_KEY);
    if (!currentSessionStr) return;

    try {
        const session: AppSession = JSON.parse(currentSessionStr);
        session.endTime = Date.now();
        session.duration = session.endTime - session.startTime;

        // Save to history
        const allSessions = getAllSessions();
        allSessions.push(session);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allSessions));

        // Clear current session
        localStorage.removeItem(CURRENT_SESSION_KEY);
    } catch (error) {
        console.error('Failed to end app session:', error);
    }
}

/**
 * Get all recorded sessions
 */
export function getAllSessions(): AppSession[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Failed to get sessions:', error);
        return [];
    }
}

/**
 * Get sessions for a specific date
 */
export function getSessionsForDate(date: string): AppSession[] {
    return getAllSessions().filter(session => session.date === date);
}

/**
 * Get daily statistics
 */
export function getDailyStats(date: string): DailyStats {
    const sessions = getSessionsForDate(date);
    const appBreakdown: Record<string, number> = {};
    let totalTime = 0;

    sessions.forEach(session => {
        if (session.duration) {
            totalTime += session.duration;
            appBreakdown[session.appName] = (appBreakdown[session.appName] || 0) + session.duration;
        }
    });

    return {
        date,
        totalTime,
        sessions,
        appBreakdown
    };
}

/**
 * Get weekly statistics (last 7 days)
 */
export function getWeeklyStats(): DailyStats[] {
    const stats: DailyStats[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        stats.push(getDailyStats(dateStr));
    }

    return stats;
}

/**
 * Format milliseconds to readable time string
 */
export function formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return `${hours}시간 ${remainingMinutes}분`;
    } else if (minutes > 0) {
        return `${minutes}분`;
    } else {
        return `${seconds}초`;
    }
}

/**
 * Get short format duration (for charts)
 */
export function formatDurationShort(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h`;
    } else {
        return `${minutes}m`;
    }
}

/**
 * Save usage goals
 */
export function saveAppGoals(goals: AppUsageGoal[]): void {
    localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

/**
 * Get usage goals
 */
export function getAppGoals(): AppUsageGoal[] {
    try {
        const stored = localStorage.getItem(GOALS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Failed to get app goals:', error);
        return [];
    }
}

/**
 * Check if daily limit is exceeded for an app
 */
export function isLimitExceeded(appName: string, date: string = getTodayDate()): boolean {
    const goals = getAppGoals();
    const goal = goals.find(g => g.appName === appName && g.enabled);

    if (!goal) return false;

    const stats = getDailyStats(date);
    const appUsage = stats.appBreakdown[appName] || 0;
    const appUsageMinutes = appUsage / 60000;

    return appUsageMinutes >= goal.dailyLimitMinutes;
}

/**
 * Get remaining time for an app today (in minutes)
 */
export function getRemainingTime(appName: string): number | null {
    const goals = getAppGoals();
    const goal = goals.find(g => g.appName === appName && g.enabled);

    if (!goal) return null;

    const stats = getDailyStats(getTodayDate());
    const appUsage = stats.appBreakdown[appName] || 0;
    const appUsageMinutes = appUsage / 60000;

    return Math.max(0, goal.dailyLimitMinutes - appUsageMinutes);
}

/**
 * Clear old data (keep last 30 days)
 */
export function cleanOldData(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const sessions = getAllSessions();
    const recentSessions = sessions.filter(session => session.date >= cutoffDateStr);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentSessions));
}

/**
 * Initialize tracking with Page Visibility API
 * Call this in your main App component
 */
export function initializeAppTracking(appName: string = 'fieri'): void {
    // Start session when app becomes visible
    const handleVisibilityChange = () => {
        if (document.hidden) {
            endAppSession();
        } else {
            startAppSession(appName);
        }
    };

    // Initial session
    if (!document.hidden) {
        startAppSession(appName);
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // End session on page unload
    window.addEventListener('beforeunload', endAppSession);

    // Clean old data on initialization (once per day)
    const lastCleanupKey = 'last_usage_cleanup';
    const lastCleanup = localStorage.getItem(lastCleanupKey);
    const today = getTodayDate();

    if (lastCleanup !== today) {
        cleanOldData();
        localStorage.setItem(lastCleanupKey, today);
    }
}

/**
 * Get usage percentage compared to goal
 */
export function getUsagePercentage(appName: string, date: string = getTodayDate()): number {
    const goals = getAppGoals();
    const goal = goals.find(g => g.appName === appName);

    if (!goal) return 0;

    const stats = getDailyStats(date);
    const appUsage = stats.appBreakdown[appName] || 0;
    const appUsageMinutes = appUsage / 60000;

    return Math.min(100, (appUsageMinutes / goal.dailyLimitMinutes) * 100);
}

/**
 * Export data as JSON for backup/analysis
 */
export function exportUsageData(): string {
    return JSON.stringify({
        sessions: getAllSessions(),
        goals: getAppGoals(),
        exportDate: new Date().toISOString()
    }, null, 2);
}

/**
 * Import data from JSON
 */
export function importUsageData(jsonData: string): boolean {
    try {
        const data = JSON.parse(jsonData);

        if (data.sessions) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.sessions));
        }

        if (data.goals) {
            localStorage.setItem(GOALS_KEY, JSON.stringify(data.goals));
        }

        return true;
    } catch (error) {
        console.error('Failed to import usage data:', error);
        return false;
    }
}

/**
 * Get yesterday's date in YYYY-MM-DD format (KST)
 */
export function getYesterdayDate(): string {
    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    kst.setDate(kst.getDate() - 1);
    return kst.toISOString().split('T')[0];
}

/**
 * Analyze yesterday's app usage for daily briefing
 */
export interface YesterdayUsageAnalysis {
    totalTime: number;
    hasData: boolean;
    topApps: Array<{ name: string; time: number; percentage: number }>;
    snsApps: Array<{ name: string; time: number }>;
    totalSnsTime: number;
    warning: string | null;
    recommendation: string | null;
}

const SNS_APPS = ['Instagram', 'TikTok', 'Twitter/X', 'Facebook', 'YouTube'];
const EXCESSIVE_SNS_THRESHOLD = 120; // 2시간 (분)

export function analyzeYesterdayUsage(): YesterdayUsageAnalysis {
    const yesterday = getYesterdayDate();
    const stats = getDailyStats(yesterday);

    if (!stats || stats.totalTime === 0) {
        return {
            totalTime: 0,
            hasData: false,
            topApps: [],
            snsApps: [],
            totalSnsTime: 0,
            warning: null,
            recommendation: null
        };
    }

    // Get top 3 apps
    const topApps = Object.entries(stats.appBreakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, time]) => ({
            name,
            time,
            percentage: (time / stats.totalTime) * 100
        }));

    // Filter SNS apps
    const snsApps = Object.entries(stats.appBreakdown)
        .filter(([name]) => SNS_APPS.includes(name))
        .map(([name, time]) => ({ name, time }))
        .sort((a, b) => b.time - a.time);

    const totalSnsTime = snsApps.reduce((sum, app) => sum + app.time, 0);
    const totalSnsMinutes = totalSnsTime / 60000;

    // Generate warning if excessive SNS usage
    let warning: string | null = null;
    let recommendation: string | null = null;

    if (totalSnsMinutes > EXCESSIVE_SNS_THRESHOLD) {
        const excessMinutes = Math.round(totalSnsMinutes - EXCESSIVE_SNS_THRESHOLD);
        warning = `어제 SNS에 ${formatDuration(totalSnsTime)}를 사용하셨습니다. 목표 시간을 ${excessMinutes}분 초과했습니다.`;

        const mostUsedSns = snsApps[0];
        if (mostUsedSns) {
            recommendation = `특히 ${mostUsedSns.name}에 ${formatDuration(mostUsedSns.time)}를 할애했습니다. 오늘은 학습 자료나 생산적인 콘텐츠에 더 많은 시간을 투자해보는 건 어떨까요?`;
        }
    } else if (totalSnsMinutes > 60) {
        warning = `어제 SNS에 ${formatDuration(totalSnsTime)}를 사용하셨습니다. 적절한 수준이지만, 더 줄일 수 있습니다.`;
        recommendation = `목표 달성을 위해 SNS 사용 시간을 하루 1시간 이내로 제한해보세요.`;
    }

    return {
        totalTime: stats.totalTime,
        hasData: true,
        topApps,
        snsApps,
        totalSnsTime,
        warning,
        recommendation
    };
}
