import { supabaseAdmin } from "@/lib/supabase-admin";
import { analyzeSchedulePatterns, SchedulePattern } from "@/lib/schedule-pattern-analyzer";

/**
 * User Context Service
 *
 * AI 없이 사용자의 제약, 선호, 패턴을 집계하여
 * 구조화된 컨텍스트를 생성하는 서비스
 */

export interface UserContext {
    constraints: {
        blockedTimes: Array<{ day: string; start: string; end: string }>;
        workoutRestrictions: {
            maxIntensity?: string;
            injuries?: string[];
            avoidTypes?: string[];
        };
        travelTimes: Record<string, number>;
        notificationLimits: {
            maxPerDay?: number;
            quietHours?: string[];
        };
    };
    preferences: {
        workoutTypes: string[];
        workoutFrequency: number;
        workoutDuration: number;
        chronotype: string;
        timeSlots: string[];
        learningFormat: string[];
        focusDuration: number;
        workLifeBalance: string;
    };
    features: {
        thisWeekWorkoutCount: number;
        avgSleepHours: number | null;
        recentScheduleDensity: string;
        successRateByTimeblock: Record<string, number>;
        mostProductiveTime: string | null;
        workoutCompletionRate: number;
    };
    profile: {
        job: string;
        goal: string;
        customGoals?: any[];
    };
    recentActivities: Array<{
        type: string;
        title: string;
        completedAt: string;
    }>;
    schedulePattern: SchedulePattern; // 일정 패턴 분석 결과
}

/**
 * 사용자 컨텍스트 생성
 */
export async function generateUserContext(userEmail: string): Promise<UserContext> {

    const supabase = supabaseAdmin;

    // 1. 제약 조회 (테이블 없으면 null)
    const { data: constraintsData, error: constraintsError } = await supabase
        .from('user_constraints')
        .select('*')
        .eq('user_email', userEmail)
        .maybeSingle();
    if (constraintsError) console.error('[Context] user_constraints error:', constraintsError.code);
    const constraints = constraintsData;

    // 2. 선호 조회 (테이블 없으면 null)
    const { data: preferencesData, error: preferencesError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_email', userEmail)
        .maybeSingle();
    if (preferencesError) console.error('[Context] user_preferences error:', preferencesError.code);
    const preferences = preferencesData;

    // 3. 프로필 조회 (users 테이블에서 - 이미 존재하는 테이블)
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('profile')
        .eq('email', userEmail)
        .maybeSingle();
    if (userError) console.error('[Context] users query error:', userError.code);
    const profile = userData?.profile || {};


    // 4. 이번 주 운동 횟수
    const thisWeekStart = getMonday(new Date());
    const { data: workoutEvents } = await supabase
        .from('user_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_email', userEmail)
        .eq('event_type', 'workout_completed')
        .gte('start_at', thisWeekStart.toISOString());
    const thisWeekWorkoutCount = workoutEvents?.length || 0;

    // 5. 최근 7일 평균 수면 (테이블이 없으면 null)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: sleepEvents } = await supabase
        .from('user_events')
        .select('metadata')
        .eq('user_email', userEmail)
        .eq('event_type', 'sleep_logged')
        .gte('created_at', sevenDaysAgo.toISOString());

    let avgSleepHours = null;
    if (sleepEvents && sleepEvents.length > 0) {
        const totalHours = sleepEvents.reduce((sum: number, event: any) => {
            return sum + (parseFloat(event.metadata?.hours) || 0);
        }, 0);
        avgSleepHours = totalHours / sleepEvents.length;
    }

    // 6. 시간블록별 성공률 조회 (테이블이 없으면 빈 객체)
    const { data: successRates } = await supabase
        .from('timeblock_success_rate')
        .select('*')
        .eq('user_email', userEmail)
        .gt('success_rate', 0)
        .order('success_rate', { ascending: false })
        .limit(20);

    const successRateByTimeblock: Record<string, number> = {};
    (successRates || []).forEach((row: any) => {
        const key = `${row.day_of_week}_${row.time_block}_${row.activity_type}`;
        successRateByTimeblock[key] = parseFloat(row.success_rate);
    });

    // 7. 최근 완료한 활동 (테이블이 없으면 빈 배열)
    const { data: recentEventsData } = await supabase
        .from('user_events')
        .select('event_type, metadata, start_at')
        .eq('user_email', userEmail)
        .in('event_type', ['workout_completed', 'task_done', 'schedule_added'])
        .gte('start_at', sevenDaysAgo.toISOString())
        .order('start_at', { ascending: false })
        .limit(10);

    const recentActivities = (recentEventsData || []).map((row: any) => ({
        type: row.event_type,
        title: row.metadata?.activity || 'Unknown',
        completedAt: row.start_at,
    }));

    // 8. 운동 완료율 (최근 4주, 테이블이 없으면 0)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const { data: completedWorkouts } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_email', userEmail)
        .eq('event_type', 'workout_completed')
        .gte('start_at', fourWeeksAgo.toISOString());

    const { data: skippedWorkouts } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_email', userEmail)
        .eq('event_type', 'workout_skipped')
        .gte('start_at', fourWeeksAgo.toISOString());

    const completed = completedWorkouts?.length || 0;
    const skipped = skippedWorkouts?.length || 0;
    const workoutCompletionRate = completed + skipped > 0 ? completed / (completed + skipped) : 0;

    // 9. 일정 패턴 분석
    const schedulePattern = await analyzeSchedulePatterns(userEmail);

    // 10. 컨텍스트 조립
    const context: UserContext = {
        constraints: {
            blockedTimes: constraints?.blocked_time_ranges || [],
            workoutRestrictions: constraints?.workout_restrictions || {},
            travelTimes: constraints?.travel_times || {},
            notificationLimits: constraints?.notification_limits || {},
        },
        preferences: {
            workoutTypes: preferences?.preferred_workout_types || [],
            workoutFrequency: preferences?.workout_frequency_goal || 3,
            workoutDuration: preferences?.preferred_workout_duration || 30,
            chronotype: preferences?.chronotype || 'neutral',
            timeSlots: preferences?.preferred_time_slots || [],
            learningFormat: preferences?.preferred_learning_format || [],
            focusDuration: preferences?.focus_duration || 25,
            workLifeBalance: preferences?.work_life_balance_mode || 'balanced',
        },
        features: {
            thisWeekWorkoutCount,
            avgSleepHours,
            recentScheduleDensity: 'medium', // TODO: 실제 계산
            successRateByTimeblock,
            mostProductiveTime: getMostProductiveTime(successRateByTimeblock),
            workoutCompletionRate,
        },
        profile: {
            job: profile.job || '',
            goal: profile.goal || '',
            customGoals: profile.customGoals || [],
        },
        recentActivities,
        schedulePattern,
    };



    return context;
}

/**
 * 컨텍스트 캐싱 (1시간 TTL)
 */
export async function getCachedOrGenerateContext(userEmail: string): Promise<UserContext> {
    try {
        // 캐시 확인
        const { data: cached } = await supabaseAdmin
            .from('user_context_cache')
            .select('context_data, expires_at')
            .eq('user_email', userEmail)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

        if (cached?.context_data) {
            return cached.context_data;
        }
    } catch {
        // Cache table may not exist yet — fall through to generate
    }

    // 캐시 없으면 생성
    const context = await generateUserContext(userEmail);

    try {
        // 캐시 저장 (1시간 TTL)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        await supabaseAdmin
            .from('user_context_cache')
            .upsert({
                user_email: userEmail,
                context_data: context,
                expires_at: expiresAt.toISOString(),
                generated_at: new Date().toISOString(),
            }, { onConflict: 'user_email' });
    } catch {
        // Cache write failure is non-critical
    }

    return context;
}

// Helper functions
function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function getMostProductiveTime(successRates: Record<string, number>): string | null {
    if (Object.keys(successRates).length === 0) return null;

    let maxRate = 0;
    let bestTime = null;

    for (const [key, rate] of Object.entries(successRates)) {
        if (rate > maxRate) {
            maxRate = rate;
            bestTime = key;
        }
    }

    return bestTime;
}
