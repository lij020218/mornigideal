/**
 * 데이터 생명주기 관리 정책
 *
 * 목적:
 * 1. 데이터베이스 크기 제어
 * 2. 성능 유지 (쿼리 속도)
 * 3. 비용 절감
 * 4. 개인정보 보호 (오래된 데이터 자동 삭제)
 */

export interface DataRetentionPolicy {
    tableName: string;
    retentionDays: number; // 보관 기간 (일)
    archiveBeforeDelete: boolean; // 삭제 전 아카이브 여부
    aggregateBeforeDelete: boolean; // 삭제 전 집계 데이터로 변환
    importance: 'critical' | 'high' | 'medium' | 'low';
    description: string;
}

/**
 * 테이블별 데이터 보관 정책
 */
export const DATA_RETENTION_POLICIES: DataRetentionPolicy[] = [
    // === RAW 이벤트 데이터 (짧은 보관) ===
    {
        tableName: 'user_events',
        retentionDays: 90, // 3개월
        archiveBeforeDelete: false,
        aggregateBeforeDelete: true, // features로 집계 후 삭제
        importance: 'high',
        description: '원본 이벤트 로그 - 3개월 후 집계 데이터로 변환 후 삭제',
    },

    // === 집계 데이터 (중간 보관) ===
    {
        tableName: 'user_features_daily',
        retentionDays: 365, // 1년
        archiveBeforeDelete: false,
        aggregateBeforeDelete: true, // weekly로 재집계 후 삭제
        importance: 'medium',
        description: '일간 집계 데이터 - 1년 후 주간 데이터로 재집계',
    },
    {
        tableName: 'user_features_weekly',
        retentionDays: 730, // 2년
        archiveBeforeDelete: false,
        aggregateBeforeDelete: false,
        importance: 'medium',
        description: '주간 집계 데이터 - 2년 후 삭제',
    },

    // === 성공률/패턴 데이터 (긴 보관) ===
    {
        tableName: 'timeblock_success_rate',
        retentionDays: -1, // 무제한 보관 (계속 업데이트)
        archiveBeforeDelete: false,
        aggregateBeforeDelete: false,
        importance: 'critical',
        description: '시간블록 성공률 - 계속 업데이트되므로 삭제하지 않음',
    },

    // === 캐시 데이터 (짧은 보관) ===
    {
        tableName: 'user_context_cache',
        retentionDays: 7, // 1주일
        archiveBeforeDelete: false,
        aggregateBeforeDelete: false,
        importance: 'low',
        description: '컨텍스트 캐시 - 1주일 이상 접속 안한 유저 캐시 삭제',
    },

    // === 사용자 설정 (영구 보관) ===
    {
        tableName: 'user_constraints',
        retentionDays: -1, // 영구 보관
        archiveBeforeDelete: false,
        aggregateBeforeDelete: false,
        importance: 'critical',
        description: '사용자 제약 조건 - 영구 보관',
    },
    {
        tableName: 'user_preferences',
        retentionDays: -1, // 영구 보관
        archiveBeforeDelete: false,
        aggregateBeforeDelete: false,
        importance: 'critical',
        description: '사용자 선호 설정 - 영구 보관',
    },
];

/**
 * 데이터 중요도별 처리 전략
 */
export const IMPORTANCE_STRATEGIES = {
    critical: {
        deleteThreshold: -1, // 삭제하지 않음
        backupRequired: true,
        alertOnDelete: true,
    },
    high: {
        deleteThreshold: 90, // 최소 90일 보관
        backupRequired: true,
        alertOnDelete: false,
    },
    medium: {
        deleteThreshold: 30, // 최소 30일 보관
        backupRequired: false,
        alertOnDelete: false,
    },
    low: {
        deleteThreshold: 7, // 최소 7일 보관
        backupRequired: false,
        alertOnDelete: false,
    },
};

/**
 * 이벤트 타입별 중요도
 * - 높을수록 오래 보관
 */
export const EVENT_IMPORTANCE_SCORES: Record<string, number> = {
    // 높은 중요도 (10점)
    'goal_achieved': 10,
    'milestone_reached': 10,
    'habit_formed': 10, // 21일 연속 완료 등

    // 중간 중요도 (7-8점)
    'workout_completed': 8,
    'learning_session_completed': 8,
    'sleep_logged': 7,
    'ai_suggestion_accepted': 7,

    // 낮은 중요도 (5점)
    'schedule_added': 5,
    'schedule_rescheduled': 5,
    'task_done': 5,

    // 매우 낮은 중요도 (3점)
    'workout_skipped': 3,
    'notification_dismissed': 3,
    'page_viewed': 2,
};

/**
 * 데이터 정리 우선순위
 * - 숫자가 높을수록 먼저 정리
 */
export const CLEANUP_PRIORITY = {
    expired_cache: 10, // 가장 먼저 정리
    old_low_importance_events: 8,
    aggregated_daily_data: 6,
    old_weekly_data: 4,
    orphaned_records: 9, // 참조되지 않는 고아 레코드
};

/**
 * 집계 데이터 생성 규칙
 */
export interface AggregationRule {
    sourceTable: string;
    targetTable: string;
    aggregationPeriod: 'daily' | 'weekly' | 'monthly';
    metrics: string[];
    retainRawData: boolean; // 집계 후 원본 데이터 유지 여부
}

export const AGGREGATION_RULES: AggregationRule[] = [
    {
        sourceTable: 'user_events',
        targetTable: 'user_features_daily',
        aggregationPeriod: 'daily',
        metrics: [
            'total_tasks',
            'completed_tasks',
            'workout_count',
            'sleep_hours',
            'schedule_density',
            'completion_rate',
        ],
        retainRawData: false, // 집계 후 90일 지난 raw 이벤트 삭제
    },
    {
        sourceTable: 'user_features_daily',
        targetTable: 'user_features_weekly',
        aggregationPeriod: 'weekly',
        metrics: [
            'total_workouts',
            'avg_sleep_hours',
            'workout_completion_rate',
            'most_productive_timeblock',
        ],
        retainRawData: false, // 집계 후 365일 지난 daily 삭제
    },
];

/**
 * 데이터 정리 실행 스케줄
 */
export const CLEANUP_SCHEDULE = {
    frequency: 'daily', // 매일 실행
    time: '03:00', // 새벽 3시 (사용자 적은 시간)
    batchSize: 1000, // 한 번에 처리할 레코드 수
    maxExecutionTime: 300000, // 최대 5분
};

/**
 * 사용자별 데이터 용량 제한
 */
export const USER_DATA_LIMITS = {
    maxEventsPerUser: 10000, // 사용자당 최대 이벤트 수
    maxDailyFeaturesPerUser: 365, // 최대 365일치 daily features
    maxWeeklyFeaturesPerUser: 104, // 최대 2년치 weekly features (52주 * 2)
    alertThreshold: 0.8, // 80% 도달 시 알림
};

/**
 * 중복 데이터 감지 규칙
 */
export const DEDUPLICATION_RULES = {
    user_events: {
        uniqueFields: ['user_email', 'event_type', 'start_at'],
        timeWindow: 60, // 60초 이내 동일 이벤트는 중복으로 간주
    },
    user_features_daily: {
        uniqueFields: ['user_email', 'date'],
        timeWindow: 0, // 완전 중복만 제거
    },
};
