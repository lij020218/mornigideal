/**
 * Application-wide constants
 *
 * Replaces magic numbers scattered across lib files and routes.
 * Import individual groups as needed:
 *   import { TIMING, THRESHOLDS, LIMITS } from '@/lib/constants';
 */

// ============================================
// Time windows & scheduling defaults
// ============================================

export const TIMING = {
    /** Schedule reminder minutes before event (important) */
    REMINDER_EARLY_MIN: 20,
    /** Schedule reminder minutes before event (normal) */
    REMINDER_LATE_MIN: 10,

    /** Morning notification window start hour */
    MORNING_START: 6,
    /** Morning notification window end hour */
    MORNING_END: 12,
    /** Evening notification window start hour */
    EVENING_START: 20,
    /** Evening notification window end hour */
    EVENING_END: 22,
    /** Evening check-in hour */
    EVENING_CHECK_HOUR: 21,

    /** Default schedule start hour (for available-slot finder) */
    SCHEDULE_DEFAULT_START: 9,
    /** Default schedule end hour */
    SCHEDULE_DEFAULT_END: 22,

    /** Ideal minimum sleep duration (hours) */
    SLEEP_IDEAL_MIN_HOURS: 7,
    /** Ideal maximum sleep duration (hours) */
    SLEEP_IDEAL_MAX_HOURS: 9,

    /** Lifestyle notification window start hour */
    LIFESTYLE_NOTIF_START: 8,
    /** Lifestyle notification window end hour */
    LIFESTYLE_NOTIF_END: 12,

    /** Memory surfacing window start hour */
    MEMORY_SURFACING_START: 7,
    /** Memory surfacing window end hour */
    MEMORY_SURFACING_END: 11,

    /** Skipped pattern analysis window start hour */
    SKIPPED_PATTERN_START: 6,
    /** Skipped pattern analysis window end hour */
    SKIPPED_PATTERN_END: 11,

    /** Mood check-in reminder window start hour */
    MOOD_REMINDER_START: 14,
    /** Mood check-in reminder window end hour */
    MOOD_REMINDER_END: 20,

    /** Post-lunch energy boost window start hour */
    ENERGY_BOOST_START: 13,
    /** Post-lunch energy boost window end hour */
    ENERGY_BOOST_END: 14,

    /** Pre-departure daily wrap window start hour */
    DAILY_WRAP_START: 17,
    /** Pre-departure daily wrap window end hour */
    DAILY_WRAP_END: 18,

    /** Weekly review window start hour (Sunday evening) */
    WEEKLY_REVIEW_START: 19,
    /** Weekly review window end hour */
    WEEKLY_REVIEW_END: 21,

    /** GitHub streak reminder start hour */
    GITHUB_STREAK_START: 20,
    /** GitHub streak reminder end hour */
    GITHUB_STREAK_END: 23,
} as const;

// ============================================
// Analysis thresholds
// ============================================

export const THRESHOLDS = {
    /** Days before a goal is considered stale */
    STALE_GOAL_DAYS: 3,
    /** Skip rate to trigger pattern detection */
    PATTERN_SKIP_RATE: 0.5,
    /** High skip rate threshold */
    PATTERN_HIGH_SKIP_RATE: 0.75,
    /** WHO recommended weekly exercise minutes */
    WHO_WEEKLY_EXERCISE_MIN: 150,
    /** Minimum weekly workouts to meet goal */
    MIN_WEEKLY_WORKOUTS: 3,
    /** High completion rate */
    COMPLETION_HIGH: 0.8,
    /** Low completion rate */
    COMPLETION_LOW: 0.5,
    /** Sleep consistency threshold for "irregular" */
    SLEEP_CONSISTENCY_LOW: 70,
    /** Sleep consistency threshold for "excellent" */
    SLEEP_CONSISTENCY_HIGH: 80,
    /** Minimum recurring candidates before suggesting */
    MIN_RECURRING_OCCURRENCES: 2,
    /** Minimum data points for pattern analysis */
    MIN_PATTERN_DATA_POINTS: 2,
    /** Weeks to look back for skipped pattern analysis */
    PATTERN_LOOKBACK_WEEKS: 4,
    /** Max recurring days to qualify (exclude "매일") */
    MAX_RECURRING_DAYS: 3,
    /** Break scan range (days ahead) */
    BREAK_SCAN_DAYS: 8,

    /** Burnout warning: mood threshold (3 day avg) */
    BURNOUT_MOOD: 2,
    /** Burnout warning: energy threshold (3 day avg) */
    BURNOUT_ENERGY: 2,
    /** Burnout detection lookback days */
    BURNOUT_LOOKBACK_DAYS: 3,

    /** Schedule overload: max schedules per day */
    SCHEDULE_OVERLOAD_COUNT: 6,
    /** Schedule overload: min free hours in a day */
    SCHEDULE_MIN_FREE_HOURS: 2,

    /** Weekly goal deadline: progress below this on Friday triggers alert */
    WEEKLY_GOAL_LOW_PROGRESS: 50,

    /** Routine break: completion rate drop threshold (current week vs usual) */
    ROUTINE_BREAK_CURRENT: 0.4,
    /** Routine break: usual high completion rate */
    ROUTINE_BREAK_USUAL: 0.7,

    /** Inactive return: days since last activity */
    INACTIVE_DAYS: 3,

    /** Learning stale: days without progress */
    LEARNING_STALE_DAYS: 3,

    /** Focus streak milestones */
    FOCUS_STREAK_MILESTONES: [3, 5, 7, 14, 30],
    /** Focus streak inactive days to trigger encouragement */
    FOCUS_INACTIVE_DAYS: 2,

    /** Health: min sleep hours threshold */
    HEALTH_LOW_SLEEP_HOURS: 6,
    /** Health: consecutive low sleep days to trigger alert */
    HEALTH_LOW_SLEEP_CONSECUTIVE: 2,
} as const;

// ============================================
// Notification cooldowns (deduplication)
// ============================================

export const NOTIFICATION_COOLDOWNS: Record<string, number> = {
    /** Minutes between same-instance schedule reminders */
    schedule_reminder: 30,
    /** Minutes between morning briefings */
    morning_briefing: 720,  // 12 hours
    /** Minutes between goal nudges */
    goal_nudge: 1440,  // 24 hours
    /** Minutes between evening prep */
    evening_prep: 720,
    /** Minutes between mood check-in reminders */
    mood_reminder: 1440,
    /** Minutes between burnout warnings */
    burnout_warning: 1440,
    /** Minutes between focus streak celebrations */
    focus_streak: 720,
    /** Minutes between health insights */
    health_insight: 1440,
    /** Minutes between schedule overload warnings */
    schedule_overload: 360,  // 6 hours
    /** Minutes between routine break alerts */
    routine_break: 1440,
    /** Minutes between learning reminders */
    learning_reminder: 1440,
    /** Minutes between energy boost tips */
    energy_boost: 1440,
    /** Default cooldown for unlisted types */
    _default: 360,
} as const;

// ============================================
// Query & result limits
// ============================================

export const LIMITS = {
    /** Memory rows to fetch per user */
    MEMORY_QUERY: 20,
    /** Event log rows for AI chat context */
    EVENT_LOGS: 50,
    /** Risk alerts to show */
    RISK_ALERTS: 10,
    /** Memory surfacing results */
    MEMORY_SURFACE: 1,
    /** Top N results for analytics (categories, time slots) */
    TOP_RESULTS: 3,
    /** Activity log fetch cap */
    ACTIVITY_LOG: 500,
    /** Skipped pattern suggestions max */
    SKIPPED_SUGGESTIONS: 2,
    /** Schedule suggest default count */
    SUGGEST_COUNT: 3,
    /** Morning briefing important schedules to show */
    MORNING_BRIEFING_ITEMS: 3,
    /** Top wellness recommendations */
    WELLNESS_RECOMMENDATIONS: 5,
    /** Web search results */
    WEB_SEARCH_RESULTS: 5,
} as const;

// ============================================
// Keywords
// ============================================

/** Activities that repeat daily and should be excluded from pattern notifications */
export const DAILY_ROUTINE_KEYWORDS = [
    '기상', '취침', '잠', '식사', '아침', '점심', '저녁',
    '출근', '퇴근', '업무', '수업',
] as const;

/** Important schedule keywords for priority notifications */
export const IMPORTANT_SCHEDULE_KEYWORDS = [
    '회의', '미팅', 'meeting', '면접', '발표', '프레젠테이션',
    '마감', '데드라인', 'deadline', '시험', '테스트',
    '약속', '상담', '진료', '예약',
] as const;

/** Exercise-related keywords */
export const EXERCISE_KEYWORDS = [
    '운동', '헬스', '러닝', '조깅', '요가', '필라테스',
    '수영', '자전거', '걷기', 'workout', 'gym', 'running', 'exercise',
] as const;

/** Focus-worthy keywords (suggest focus mode) */
export const FOCUS_KEYWORDS = [
    '업무', '회의', '미팅', '개발', '코딩', '작업', '프로젝트',
    '공부', '학습', '강의', '수업', '시험', '과제', '리뷰',
    '독서', '읽기', '글쓰기', '보고서', '기획', '분석',
    'work', 'study', 'focus', 'coding', 'meeting', 'reading',
] as const;

/** Korean day names */
export const DAY_NAMES_KR = ['일', '월', '화', '수', '목', '금', '토'] as const;
