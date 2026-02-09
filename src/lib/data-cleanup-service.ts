import db from "@/lib/db";
import {
    DATA_RETENTION_POLICIES,
    EVENT_IMPORTANCE_SCORES,
    AGGREGATION_RULES,
    USER_DATA_LIMITS,
    DEDUPLICATION_RULES,
} from "./data-lifecycle-policy";

/**
 * 데이터 정리 서비스
 *
 * 기능:
 * 1. 오래된 데이터 삭제
 * 2. 중요도 기반 선택적 보관
 * 3. Raw 데이터 → 집계 데이터 변환
 * 4. 중복 데이터 제거
 * 5. 고아 레코드 정리
 */

export interface CleanupReport {
    executedAt: string;
    totalRecordsDeleted: number;
    totalRecordsAggregated: number;
    byTable: Record<string, { deleted: number; aggregated: number }>;
    errors: string[];
    executionTimeMs: number;
}

/**
 * 메인 정리 작업 실행
 */
export async function executeDataCleanup(userEmail?: string): Promise<CleanupReport> {
    const startTime = Date.now();
    const report: CleanupReport = {
        executedAt: new Date().toISOString(),
        totalRecordsDeleted: 0,
        totalRecordsAggregated: 0,
        byTable: {},
        errors: [],
        executionTimeMs: 0,
    };

    console.log(`[Data Cleanup] Starting cleanup${userEmail ? ` for user: ${userEmail}` : ' (all users)'}`);

    try {
        // 1. 만료된 캐시 삭제
        await cleanupExpiredCache(report, userEmail);

        // 2. 오래된 이벤트 집계 및 삭제
        await aggregateAndCleanupOldEvents(report, userEmail);

        // 3. 오래된 daily features 집계 및 삭제
        await aggregateAndCleanupDailyFeatures(report, userEmail);

        // 4. 중복 데이터 제거
        await deduplicateData(report, userEmail);

        // 5. 고아 레코드 정리
        await cleanupOrphanedRecords(report, userEmail);

        // 6. 사용자별 용량 제한 확인
        await enforceUserDataLimits(report, userEmail);

        // 7. user_memory (RAG) 정리
        await cleanupUserMemory(report, userEmail);

    } catch (error: any) {
        console.error('[Data Cleanup] Error:', error);
        report.errors.push(error.message);
    }

    report.executionTimeMs = Date.now() - startTime;
    console.log(`[Data Cleanup] Completed in ${report.executionTimeMs}ms:`, {
        deleted: report.totalRecordsDeleted,
        aggregated: report.totalRecordsAggregated,
        errors: report.errors.length,
    });

    return report;
}

/**
 * 1. 만료된 캐시 삭제
 */
async function cleanupExpiredCache(report: CleanupReport, userEmail?: string): Promise<void> {
    try {
        const policy = DATA_RETENTION_POLICIES.find(p => p.tableName === 'user_context_cache');
        if (!policy || policy.retentionDays < 0) return;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        let query = `
            DELETE FROM user_context_cache
            WHERE generated_at < $1
        `;
        const params: any[] = [cutoffDate.toISOString()];

        if (userEmail) {
            query += ` AND user_email = $2`;
            params.push(userEmail);
        }

        const result = await db.query(query, params);
        const deletedCount = result.rowCount || 0;

        report.byTable['user_context_cache'] = { deleted: deletedCount, aggregated: 0 };
        report.totalRecordsDeleted += deletedCount;

        console.log(`[Data Cleanup] Deleted ${deletedCount} expired cache entries`);
    } catch (error: any) {
        report.errors.push(`Cache cleanup failed: ${error.message}`);
    }
}

/**
 * 2. 오래된 이벤트 집계 및 삭제
 */
async function aggregateAndCleanupOldEvents(report: CleanupReport, userEmail?: string): Promise<void> {
    try {
        const policy = DATA_RETENTION_POLICIES.find(p => p.tableName === 'user_events');
        if (!policy || policy.retentionDays < 0) return;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        // 먼저 집계되지 않은 오래된 이벤트를 daily features로 집계
        if (policy.aggregateBeforeDelete) {
            const aggregated = await aggregateEventsToDaily(cutoffDate, userEmail);
            report.totalRecordsAggregated += aggregated;
            console.log(`[Data Cleanup] Aggregated ${aggregated} old events to daily features`);
        }

        // 중요도 기반 선택적 삭제
        // - 중요도 낮은 이벤트: 전체 삭제
        // - 중요도 높은 이벤트: 보관
        const lowImportanceTypes = Object.entries(EVENT_IMPORTANCE_SCORES)
            .filter(([_, score]) => score <= 5)
            .map(([type, _]) => type);

        let query = `
            DELETE FROM user_events
            WHERE created_at < $1
              AND event_type = ANY($2)
        `;
        const params: any[] = [cutoffDate.toISOString(), lowImportanceTypes];

        if (userEmail) {
            query += ` AND user_email = $3`;
            params.push(userEmail);
        }

        const result = await db.query(query, params);
        const deletedCount = result.rowCount || 0;

        report.byTable['user_events'] = { deleted: deletedCount, aggregated: 0 };
        report.totalRecordsDeleted += deletedCount;

        console.log(`[Data Cleanup] Deleted ${deletedCount} old low-importance events`);
    } catch (error: any) {
        report.errors.push(`Event cleanup failed: ${error.message}`);
    }
}

/**
 * 오래된 이벤트를 daily features로 집계
 */
async function aggregateEventsToDaily(cutoffDate: Date, userEmail?: string): Promise<number> {
    // 날짜별로 이벤트 집계
    let query = `
        SELECT
            user_email,
            DATE(start_at) as event_date,
            COUNT(*) FILTER (WHERE event_type LIKE '%_completed') as completed_tasks,
            COUNT(*) as total_tasks,
            COUNT(*) FILTER (WHERE event_type = 'workout_completed') as workout_count,
            AVG((metadata->>'hours')::float) FILTER (WHERE event_type = 'sleep_logged') as sleep_hours
        FROM user_events
        WHERE start_at < $1
          AND NOT EXISTS (
              SELECT 1 FROM user_features_daily
              WHERE user_features_daily.user_email = user_events.user_email
                AND user_features_daily.date = DATE(user_events.start_at)
          )
    `;
    const params: any[] = [cutoffDate.toISOString()];

    if (userEmail) {
        query += ` AND user_email = $2`;
        params.push(userEmail);
    }

    query += ` GROUP BY user_email, DATE(start_at)`;

    const result = await db.query(query, params);

    // 집계된 데이터를 user_features_daily에 삽입
    let insertedCount = 0;
    for (const row of result.rows) {
        const completionRate = row.total_tasks > 0
            ? row.completed_tasks / row.total_tasks
            : 0;

        const density = row.total_tasks >= 10 ? 'high'
            : row.total_tasks >= 5 ? 'medium'
            : 'low';

        try {
            await db.query(
                `INSERT INTO user_features_daily
                 (id, user_email, date, total_tasks, completed_tasks, workout_count, sleep_hours, schedule_density)
                 VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (user_email, date) DO NOTHING`,
                [
                    row.user_email,
                    row.event_date,
                    row.total_tasks,
                    row.completed_tasks,
                    row.workout_count,
                    row.sleep_hours,
                    density,
                ]
            );
            insertedCount++;
        } catch (error) {
            console.error('[Aggregation] Failed to insert daily feature:', error);
        }
    }

    return insertedCount;
}

/**
 * 3. 오래된 daily features 집계 및 삭제
 */
async function aggregateAndCleanupDailyFeatures(report: CleanupReport, userEmail?: string): Promise<void> {
    try {
        const policy = DATA_RETENTION_POLICIES.find(p => p.tableName === 'user_features_daily');
        if (!policy || policy.retentionDays < 0) return;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

        // 주간 집계로 변환
        if (policy.aggregateBeforeDelete) {
            const aggregated = await aggregateDailyToWeekly(cutoffDate, userEmail);
            report.totalRecordsAggregated += aggregated;
            console.log(`[Data Cleanup] Aggregated ${aggregated} daily features to weekly`);
        }

        // 오래된 daily features 삭제
        let query = `DELETE FROM user_features_daily WHERE date < $1`;
        const params: any[] = [cutoffDate.toISOString().split('T')[0]];

        if (userEmail) {
            query += ` AND user_email = $2`;
            params.push(userEmail);
        }

        const result = await db.query(query, params);
        const deletedCount = result.rowCount || 0;

        report.byTable['user_features_daily'] = {
            deleted: deletedCount,
            aggregated: report.totalRecordsAggregated,
        };
        report.totalRecordsDeleted += deletedCount;

        console.log(`[Data Cleanup] Deleted ${deletedCount} old daily features`);
    } catch (error: any) {
        report.errors.push(`Daily features cleanup failed: ${error.message}`);
    }
}

/**
 * Daily features를 weekly로 집계
 */
async function aggregateDailyToWeekly(cutoffDate: Date, userEmail?: string): Promise<number> {
    // 주별로 집계 (월요일 기준)
    let query = `
        SELECT
            user_email,
            DATE_TRUNC('week', date) as week_start,
            SUM(workout_count) as total_workouts,
            AVG(sleep_hours) as avg_sleep_hours,
            AVG(CASE WHEN total_tasks > 0 THEN completed_tasks::float / total_tasks ELSE 0 END) as workout_completion_rate
        FROM user_features_daily
        WHERE date < $1
          AND NOT EXISTS (
              SELECT 1 FROM user_features_weekly
              WHERE user_features_weekly.user_email = user_features_daily.user_email
                AND user_features_weekly.week_start = DATE_TRUNC('week', user_features_daily.date)
          )
    `;
    const params: any[] = [cutoffDate.toISOString().split('T')[0]];

    if (userEmail) {
        query += ` AND user_email = $2`;
        params.push(userEmail);
    }

    query += ` GROUP BY user_email, DATE_TRUNC('week', date)`;

    const result = await db.query(query, params);

    let insertedCount = 0;
    for (const row of result.rows) {
        try {
            await db.query(
                `INSERT INTO user_features_weekly
                 (id, user_email, week_start, total_workouts, avg_sleep_hours, workout_completion_rate)
                 VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
                 ON CONFLICT (user_email, week_start) DO NOTHING`,
                [
                    row.user_email,
                    row.week_start,
                    row.total_workouts,
                    row.avg_sleep_hours,
                    row.workout_completion_rate,
                ]
            );
            insertedCount++;
        } catch (error) {
            console.error('[Aggregation] Failed to insert weekly feature:', error);
        }
    }

    return insertedCount;
}

/**
 * 4. 중복 데이터 제거
 */
async function deduplicateData(report: CleanupReport, userEmail?: string): Promise<void> {
    try {
        // user_events 중복 제거
        const eventRule = DEDUPLICATION_RULES.user_events;
        let query = `
            DELETE FROM user_events a
            USING user_events b
            WHERE a.id < b.id
              AND a.user_email = b.user_email
              AND a.event_type = b.event_type
              AND ABS(EXTRACT(EPOCH FROM (a.start_at - b.start_at))) < $1
        `;
        const params: any[] = [eventRule.timeWindow];

        if (userEmail) {
            query += ` AND a.user_email = $2`;
            params.push(userEmail);
        }

        const result = await db.query(query, params);
        const deletedCount = result.rowCount || 0;

        if (!report.byTable['user_events']) {
            report.byTable['user_events'] = { deleted: 0, aggregated: 0 };
        }
        report.byTable['user_events'].deleted += deletedCount;
        report.totalRecordsDeleted += deletedCount;

        console.log(`[Data Cleanup] Removed ${deletedCount} duplicate events`);
    } catch (error: any) {
        report.errors.push(`Deduplication failed: ${error.message}`);
    }
}

/**
 * 5. 고아 레코드 정리
 */
async function cleanupOrphanedRecords(report: CleanupReport, userEmail?: string): Promise<void> {
    try {
        // users 테이블에 없는 사용자의 데이터 삭제
        const tables = [
            'user_events',
            'user_features_daily',
            'user_features_weekly',
            'user_constraints',
            'user_preferences',
            'timeblock_success_rate',
            'user_context_cache',
        ];

        for (const table of tables) {
            let query = `
                DELETE FROM ${table}
                WHERE NOT EXISTS (
                    SELECT 1 FROM users WHERE users.email = ${table}.user_email
                )
            `;

            if (userEmail) {
                query += ` AND user_email = $1`;
            }

            const result = await db.query(query, userEmail ? [userEmail] : []);
            const deletedCount = result.rowCount || 0;

            if (deletedCount > 0) {
                if (!report.byTable[table]) {
                    report.byTable[table] = { deleted: 0, aggregated: 0 };
                }
                report.byTable[table].deleted += deletedCount;
                report.totalRecordsDeleted += deletedCount;

                console.log(`[Data Cleanup] Removed ${deletedCount} orphaned records from ${table}`);
            }
        }
    } catch (error: any) {
        report.errors.push(`Orphaned records cleanup failed: ${error.message}`);
    }
}

/**
 * 6. 사용자별 용량 제한 확인 및 강제
 */
async function enforceUserDataLimits(report: CleanupReport, userEmail?: string): Promise<void> {
    try {
        // 각 사용자별 이벤트 수 확인
        let query = `
            SELECT user_email, COUNT(*) as event_count
            FROM user_events
        `;

        if (userEmail) {
            query += ` WHERE user_email = $1`;
        }

        query += ` GROUP BY user_email`;

        const result = await db.query(query, userEmail ? [userEmail] : []);

        for (const row of result.rows) {
            if (row.event_count > USER_DATA_LIMITS.maxEventsPerUser) {
                // 가장 오래되고 중요도 낮은 이벤트부터 삭제
                const excess = row.event_count - USER_DATA_LIMITS.maxEventsPerUser;

                const deleteResult = await db.query(
                    `DELETE FROM user_events
                     WHERE id IN (
                         SELECT id FROM user_events
                         WHERE user_email = $1
                         ORDER BY
                             COALESCE((SELECT score FROM (VALUES ${Object.entries(EVENT_IMPORTANCE_SCORES).map(([type, score]) => `('${type}', ${score})`).join(',')}) AS scores(type, score) WHERE scores.type = event_type), 0) ASC,
                             created_at ASC
                         LIMIT $2
                     )`,
                    [row.user_email, excess]
                );

                const deletedCount = deleteResult.rowCount || 0;
                console.log(`[Data Cleanup] Enforced limit for ${row.user_email}: deleted ${deletedCount} events`);

                if (!report.byTable['user_events']) {
                    report.byTable['user_events'] = { deleted: 0, aggregated: 0 };
                }
                report.byTable['user_events'].deleted += deletedCount;
                report.totalRecordsDeleted += deletedCount;
            }
        }
    } catch (error: any) {
        report.errors.push(`Data limit enforcement failed: ${error.message}`);
    }
}

/**
 * 7. user_memory (RAG) 정리
 * - 중복 content_hash 제거
 * - Free/Standard: 90일 이상 오래된 메모리 삭제
 * - 플랜별 용량 초과 시 오래된 것부터 삭제
 */
async function cleanupUserMemory(report: CleanupReport, userEmail?: string): Promise<void> {
    try {
        let totalDeleted = 0;

        // 1. content_hash NULL인 중복 제거 (같은 사용자, 같은 content)
        const dedupResult = await db.query(`
            DELETE FROM user_memory a
            USING user_memory b
            WHERE a.id < b.id
              AND a.user_id = b.user_id
              AND a.content = b.content
              ${userEmail ? `AND a.user_id = (SELECT id FROM users WHERE email = $1)` : ''}
        `, userEmail ? [userEmail] : []);
        totalDeleted += dedupResult.rowCount || 0;

        // 2. Free/Standard 사용자: 90일 이상 오래된 메모리 삭제
        const cutoff90Days = new Date();
        cutoff90Days.setDate(cutoff90Days.getDate() - 90);

        const ageResult = await db.query(`
            DELETE FROM user_memory
            WHERE created_at < $1
              AND user_id IN (
                  SELECT u.id FROM users u
                  LEFT JOIN user_subscriptions s ON u.id = s.user_id
                  WHERE COALESCE(s.plan, 'standard') IN ('standard')
                  ${userEmail ? `AND u.email = $2` : ''}
              )
        `, userEmail ? [cutoff90Days.toISOString(), userEmail] : [cutoff90Days.toISOString()]);
        totalDeleted += ageResult.rowCount || 0;

        // 3. 플랜별 용량 초과 사용자 정리 (오래된 것부터 삭제)
        const planLimits = [
            { plan: 'standard', limitMb: 50 },
            { plan: 'pro', limitMb: 100 },
            { plan: 'max', limitMb: 1000 },
        ];

        for (const { plan, limitMb } of planLimits) {
            const overLimitUsers = await db.query(`
                SELECT m.user_id,
                       SUM(octet_length(m.content) + octet_length(m.metadata::text) + 6144)::float / (1024 * 1024) AS size_mb
                FROM user_memory m
                JOIN user_subscriptions s ON m.user_id = s.user_id
                WHERE s.plan = $1
                ${userEmail ? `AND m.user_id = (SELECT id FROM users WHERE email = $2)` : ''}
                GROUP BY m.user_id
                HAVING SUM(octet_length(m.content) + octet_length(m.metadata::text) + 6144)::float / (1024 * 1024) > $${userEmail ? '3' : '2'}
            `, userEmail ? [plan, userEmail, limitMb] : [plan, limitMb]);

            for (const row of overLimitUsers.rows) {
                // 초과량에 해당하는 오래된 레코드 삭제
                const excessMb = row.size_mb - limitMb;
                const estimatedRowsToDelete = Math.ceil(excessMb / 0.007); // ~7KB per row

                const deleteResult = await db.query(`
                    DELETE FROM user_memory
                    WHERE id IN (
                        SELECT id FROM user_memory
                        WHERE user_id = $1
                        ORDER BY created_at ASC
                        LIMIT $2
                    )
                `, [row.user_id, estimatedRowsToDelete]);

                totalDeleted += deleteResult.rowCount || 0;
            }
        }

        report.byTable['user_memory'] = { deleted: totalDeleted, aggregated: 0 };
        report.totalRecordsDeleted += totalDeleted;

        if (totalDeleted > 0) {
            console.log(`[Data Cleanup] user_memory: deleted ${totalDeleted} records`);
        }
    } catch (error: any) {
        report.errors.push(`User memory cleanup failed: ${error.message}`);
    }
}

/**
 * 특정 사용자의 데이터 통계 조회
 */
export async function getUserDataStats(userEmail: string) {
    try {
        const stats: any = {};

        // 이벤트 수
        const eventsResult = await db.query(
            `SELECT COUNT(*) as count FROM user_events WHERE user_email = $1`,
            [userEmail]
        );
        stats.totalEvents = parseInt(eventsResult.rows[0]?.count || '0');

        // Daily features 수
        const dailyResult = await db.query(
            `SELECT COUNT(*) as count FROM user_features_daily WHERE user_email = $1`,
            [userEmail]
        );
        stats.totalDailyFeatures = parseInt(dailyResult.rows[0]?.count || '0');

        // Weekly features 수
        const weeklyResult = await db.query(
            `SELECT COUNT(*) as count FROM user_features_weekly WHERE user_email = $1`,
            [userEmail]
        );
        stats.totalWeeklyFeatures = parseInt(weeklyResult.rows[0]?.count || '0');

        // 가장 오래된/최신 데이터
        const rangeResult = await db.query(
            `SELECT
                MIN(created_at) as oldest,
                MAX(created_at) as newest
             FROM user_events
             WHERE user_email = $1`,
            [userEmail]
        );
        stats.dataRange = rangeResult.rows[0];

        // 용량 사용률
        stats.usagePercentage = {
            events: (stats.totalEvents / USER_DATA_LIMITS.maxEventsPerUser) * 100,
            daily: (stats.totalDailyFeatures / USER_DATA_LIMITS.maxDailyFeaturesPerUser) * 100,
            weekly: (stats.totalWeeklyFeatures / USER_DATA_LIMITS.maxWeeklyFeaturesPerUser) * 100,
        };

        return stats;
    } catch (error) {
        console.error('[Data Stats] Error:', error);
        return null;
    }
}
