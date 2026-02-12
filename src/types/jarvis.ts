/**
 * Jarvis Mode Type Definitions
 * AI 비서 시스템 (선제적 알림: 전 플랜 / Jarvis AI: Max 전용)
 */

// =============================================
// Enums
// =============================================

export enum InterventionLevel {
    L0_OBSERVE = 0,      // 관찰만 (로그)
    L1_SILENT_PREP = 1,  // 조용한 준비 (사용자에게 말 안 함)
    L2_SOFT = 2,         // 제안 알림
    L3_DIRECT = 3,       // 확인 후 실행
    L4_AUTO = 4          // 자동 실행 (옵트인 필요)
}

export enum EventType {
    // 일정 관련
    SCHEDULE_CREATED = 'schedule_created',
    SCHEDULE_UPDATED = 'schedule_updated',
    SCHEDULE_DELETED = 'schedule_deleted',
    SCHEDULE_COMPLETED = 'schedule_completed',
    SCHEDULE_SNOOZED = 'schedule_snoozed',
    SCHEDULE_MISSED = 'schedule_missed',

    // 앱 사용 관련
    APP_OPENED = 'app_opened',
    APP_CLOSED = 'app_closed',
    CHAT_MESSAGE_SENT = 'chat_message_sent',

    // 학습 관련
    LEARNING_SLIDE_VIEWED = 'learning_slide_viewed',
    LEARNING_COMPLETED = 'learning_completed',

    // 브리핑 관련
    BRIEFING_READ = 'briefing_read',

    // 목표 관련
    GOAL_CREATED = 'goal_created',
    GOAL_PROGRESS_UPDATED = 'goal_progress_updated',
    GOAL_COMPLETED = 'goal_completed'
}

export enum ActionType {
    // 준비 액션
    RESOURCE_PREP = 'resource_prep',           // 리소스 미리 준비
    CHECKLIST_CREATED = 'checklist_created',   // 체크리스트 생성

    // 알림 액션
    NOTIFICATION_SENT = 'notification_sent',   // 알림 전송
    REMINDER_SENT = 'reminder_sent',           // 리마인더

    // 일정 조정
    SCHEDULE_MOVED = 'schedule_moved',         // 일정 이동
    SCHEDULE_BUFFER_ADDED = 'buffer_added',    // 버퍼 추가
    SCHEDULE_SUGGESTED = 'schedule_suggested', // 일정 제안

    // 학습 관련
    LEARNING_SUGGESTED = 'learning_suggested'  // 학습 제안
}

export enum UserFeedback {
    ACCEPTED = 'accepted',       // 수락함
    IGNORED = 'ignored',         // 무시함
    DISMISSED = 'dismissed',     // 거부함
    AUTO_EXECUTED = 'auto_executed' // 자동 실행됨 (L4)
}

// =============================================
// Core Types
// =============================================

export interface UserState {
    id: string;
    userEmail: string;

    // 상태 점수 (0-100)
    energyLevel: number;
    stressLevel: number;
    focusWindowScore: number;
    routineDeviationScore: number;
    deadlinePressureScore: number;

    // 타임스탬프
    lastActiveAt: Date;
    lastInterventionAt?: Date;
    stateUpdatedAt: Date;

    createdAt: Date;
    updatedAt: Date;
}

export interface EventLog {
    id: string;
    userEmail: string;

    eventType: EventType;
    payload: Record<string, any>;

    source?: string;
    occurredAt: Date;

    createdAt: Date;
}

export interface InterventionLog {
    id: string;
    userEmail: string;

    interventionLevel: InterventionLevel;
    reasonCodes: string[];

    actionType: ActionType;
    actionPayload: Record<string, any>;

    userFeedback?: UserFeedback;
    outcomeScore?: number;

    intervenedAt: Date;
    feedbackAt?: Date;

    createdAt: Date;
}

export interface JarvisPreferences {
    id: string;
    userEmail: string;

    enabled: boolean;

    maxInterventionLevel: InterventionLevel;
    autoActionOptIn: boolean;

    notificationStyle: 'brief' | 'friendly' | 'jarvis_tone';
    quietHoursStart: number;
    quietHoursEnd: number;

    scheduleCoachingEnabled: boolean;
    routineMonitoringEnabled: boolean;
    resourcePreparationEnabled: boolean;

    interventionCooldownMinutes: number;

    createdAt: Date;
    updatedAt: Date;
}

// =============================================
// Helper Types
// =============================================

export interface InterventionDecision {
    shouldIntervene: boolean;
    level: InterventionLevel;
    reasonCodes: string[];
    score: number;
    message?: string;
}

export interface PreparedResource {
    type: 'checklist' | 'links' | 'briefing' | 'suggestion';
    title: string;
    content: any;
    relatedScheduleId?: string;
}

// =============================================
// Plan Configurations
// =============================================

export const PLAN_CONFIGS = {
    Free: {
        enabled: true,
        checkIntervalMinutes: 60,
        maxInterventionLevel: InterventionLevel.L2_SOFT,
        hasEventLogging: true,    // 이벤트 기록 (상태 계산용)
        hasLongTermMemory: false, // 장기 기억 RAG (Max 전용)
        aiCallsPerMonth: 50,
        features: {
            stateMonitoring: true,
            resourcePrep: false,
            autoExecution: false,
            reactLoop: true   // GPT-5-mini 2단계 제한 (저비용)
        }
    },
    Standard: {
        // 레거시 호환 — Free와 동일
        enabled: true,
        checkIntervalMinutes: 60,
        maxInterventionLevel: InterventionLevel.L2_SOFT,
        hasEventLogging: true,
        hasLongTermMemory: false,
        aiCallsPerMonth: 50,
        features: {
            stateMonitoring: true,
            resourcePrep: false,
            autoExecution: false,
            reactLoop: true
        }
    },
    Pro: {
        enabled: true,
        checkIntervalMinutes: 30,
        maxInterventionLevel: InterventionLevel.L2_SOFT,
        hasEventLogging: true,
        hasLongTermMemory: false,
        aiCallsPerMonth: 100,
        features: {
            stateMonitoring: true, // 전체
            resourcePrep: true,
            autoExecution: false,
            reactLoop: true
        }
    },
    Max: {
        enabled: true,
        checkIntervalMinutes: 10,
        maxInterventionLevel: InterventionLevel.L4_AUTO,
        hasEventLogging: true,
        hasLongTermMemory: true,
        aiCallsPerMonth: -1, // 무제한
        features: {
            stateMonitoring: true,
            resourcePrep: true,
            autoExecution: true,
            reactLoop: true
        }
    }
} as const;

export type PlanType = keyof typeof PLAN_CONFIGS;

// =============================================
// Constants
// =============================================

export const GUARDRAILS = {
    // 절대 확인 필요한 액션 (ActionType enum 값과 일치해야 함)
    REQUIRES_CONFIRMATION: [
        'schedule_moved',
        'buffer_added',
    ],

    // 민감 표현 금지 (자비스가 사용하면 안 되는 단어)
    FORBIDDEN_PATTERNS: [
        '진단', '병', '우울증', '불안장애', '정신질환',
        '치료', '약', '처방'
    ],

    // 기본 쿨다운 (ms)
    DEFAULT_COOLDOWN: 6 * 60 * 60 * 1000, // 6시간

    // 임계치
    THRESHOLDS: {
        HIGH_STRESS: 75,
        HIGH_ROUTINE_DEVIATION: 60,
        HIGH_DEADLINE_PRESSURE: 80,
        LOW_ENERGY: 30,
        INTERVENTION_SCORE: 75
    }
} as const;

// =============================================
// Reason Codes (개입 이유)
// =============================================

export const REASON_CODES = {
    // 루틴 관련
    ROUTINE_BREAK: 'routine_break',               // 루틴 붕괴
    CONSECUTIVE_SKIPS: 'consecutive_skips',       // 연속 스킵
    SLEEP_PATTERN_CHANGE: 'sleep_pattern_change', // 수면 패턴 변화

    // 일정 관련
    OVERBOOKED: 'overbooked',                     // 일정 과밀
    DEADLINE_SOON: 'deadline_soon',               // 마감 임박
    SCHEDULE_CONFLICT: 'schedule_conflict',       // 일정 충돌
    MISSING_BUFFER: 'missing_buffer',             // 버퍼 부족

    // 컨디션 관련
    HIGH_STRESS: 'high_stress',                   // 스트레스 높음
    LOW_ENERGY: 'low_energy',                     // 에너지 낮음
    FOCUS_DEGRADATION: 'focus_degradation',       // 집중력 저하

    // 기회 관련
    LEARNING_OPPORTUNITY: 'learning_opportunity', // 학습 기회
    GOAL_PROGRESS: 'goal_progress'               // 목표 진척 필요
} as const;
