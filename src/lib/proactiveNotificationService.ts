/**
 * Proactive Notification Service
 *
 * 사용자에게 선제적으로 알림을 보내는 서비스
 * - 일정 시작 전 미리 알림 (10분, 20분 전)
 * - 아침 긴급 알림 (미완료 작업, 오늘 중요 일정)
 * - 컨텍스트 기반 추천
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { TIMING, THRESHOLDS, LIMITS, DAILY_ROUTINE_KEYWORDS, IMPORTANT_SCHEDULE_KEYWORDS, FOCUS_KEYWORDS, EXERCISE_KEYWORDS, DAY_NAMES_KR } from '@/lib/constants';
import type { CustomGoal, LongTermGoal, ChatMessage, MemoryRow, UserProfile, ImportantEvent } from '@/lib/types';
import { kvGet } from '@/lib/kv-store';
import { isProOrAbove, type UserPlanType } from '@/lib/user-plan';
import { logger } from '@/lib/logger';
import { getChatDate } from '@/lib/scheduleUtils';

export interface ProactiveNotification {
    id: string;
    type: 'schedule_reminder' | 'morning_briefing' | 'trend_briefing' | 'urgent_alert' | 'context_suggestion' | 'goal_nudge' | 'memory_suggestion' | 'pattern_reminder' | 'lifestyle_recommend' | 'schedule_prep' | 'mood_reminder' | 'burnout_warning' | 'focus_streak' | 'health_insight' | 'github_streak' | 'schedule_overload' | 'weekly_goal_deadline' | 'routine_break' | 'inactive_return' | 'learning_reminder' | 'energy_boost' | 'daily_wrap' | 'weekly_review';
    priority: 'high' | 'medium' | 'low';
    title: string;
    message: string;
    actionType?: string;
    actionPayload?: Record<string, unknown>;
    expiresAt?: Date;
    /** 채팅 내 표시 순서 (낮을수록 먼저 표시, 시간순) */
    displayOrder?: number;
}

/** 알림 타입별 논리적 시간 순서 (낮을수록 먼저 표시) */
export const TYPE_DISPLAY_ORDER: Record<string, number> = {
    // 아침 (6-12시)
    morning_briefing: 10,
    trend_briefing: 15,
    mood_reminder: 20,
    schedule_prep: 30,
    schedule_reminder: 35,
    urgent_alert: 40,
    // 오전~오후
    context_suggestion: 50,
    memory_suggestion: 55,
    pattern_reminder: 60,
    goal_nudge: 65,
    lifestyle_recommend: 70,
    learning_reminder: 75,
    focus_streak: 80,
    health_insight: 85,
    github_streak: 90,
    burnout_warning: 95,
    energy_boost: 100,
    // 오후~저녁
    schedule_overload: 110,
    weekly_goal_deadline: 115,
    routine_break: 120,
    inactive_return: 125,
    // 저녁
    daily_wrap: 200,
    weekly_review: 210,
};

export interface UserContext {
    userEmail: string;
    currentTime: Date;
    todaySchedules: CustomGoal[];
    uncompletedGoals: CustomGoal[];
    userProfile: UserProfile;
    planType?: UserPlanType;
    recentActivity?: CustomGoal[];
    // 메모리 기반 컨텍스트
    userMemory?: {
        preferences?: {
            communicationStyle?: string;
            motivationTriggers?: string[];
            productivityPeaks?: string[];
        };
        patterns?: {
            commonRequests?: string[];
            frequentTopics?: string[];
            timePreferences?: Record<string, string>;
        };
        importantEvents?: Array<{
            date: string;
            event: string;
            category: string;
        }>;
    };
    recurringPatterns?: Array<{
        dayOfWeek: number;
        activity: string;
        time?: string;
        lastOccurrence?: string;
    }>;
    allCustomGoals?: CustomGoal[];
}

/**
 * 선제적 알림 생성 - 현재 컨텍스트 기반
 */
export async function generateProactiveNotifications(context: UserContext): Promise<ProactiveNotification[]> {
    const notifications: ProactiveNotification[] = [];
    const { currentTime, todaySchedules, uncompletedGoals, userProfile } = context;

    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;


    // 0. 중요 일정 사전 준비 (2-3시간 전)
    try {
        const { detectPrepWorthy, generatePrep, formatPrepNotification } = await import('@/lib/schedulePrepService');
        const prepWorthy = detectPrepWorthy(todaySchedules, currentTime);
        for (const schedule of prepWorthy) {
            const prep = await generatePrep(schedule, context.userEmail);
            notifications.push(formatPrepNotification(prep) as ProactiveNotification);
        }
        if (prepWorthy.length > 0) {
        }
    } catch (e) {
        logger.error('[ProactiveNotif] Schedule prep failed:', e instanceof Error ? e.message : e);
    }

    // 1. 일정 시작 전 미리 알림 (10분, 20분 전)
    const upcomingScheduleNotifications = getUpcomingScheduleNotifications(
        todaySchedules,
        currentTime,
        currentTimeStr
    );
    notifications.push(...upcomingScheduleNotifications);

    // 2. 아침 시간대 (6:00-12:00) 브리핑 - 오전 중으로 확대
    if (currentHour >= TIMING.MORNING_START && currentHour < TIMING.MORNING_END) {
        const morningNotifications = getMorningBriefingNotifications(
            context
        );
        notifications.push(...morningNotifications);
    }

    // 2.5 오전 11시 이후 일정 미등록 시 권유
    if (currentHour >= 11 && currentHour < TIMING.EVENING_START && todaySchedules.length === 0) {
        const userName = userProfile?.name || '';
        const greeting = userName ? `${userName}님, ` : '';
        notifications.push({
            id: `no-schedule-nudge-${getChatDate()}`,
            type: 'context_suggestion',
            priority: 'low',
            title: '📅 오늘 일정이 비어있어요',
            message: `${greeting}오늘은 아직 등록된 일정이 없어요. 간단한 할 일이라도 추가해보면 하루가 더 알차질 거예요!`,
            actionType: 'open_add_schedule',
        });
    }

    // 2.6 어제 미완료 작업 알림 - 아침 이외 시간에도 표시 (오전 중 미확인 시)
    // 오후에도 미완료 작업이 있으면 알림 표시
    if (currentHour >= TIMING.MORNING_END && currentHour < TIMING.EVENING_START && uncompletedGoals.length > 0) {
        const goalNames = uncompletedGoals.map(g => g.text).slice(0, 5);
        const goalList = goalNames.map(n => `• ${n}`).join('\n');
        const extra = uncompletedGoals.length > 5 ? `\n외 ${uncompletedGoals.length - 5}개` : '';
        notifications.push({
            id: `uncompleted-afternoon-${getChatDate()}`,
            type: 'urgent_alert',
            priority: 'medium',
            title: '📋 어제 미완료 작업',
            message: `어제 완료하지 못한 작업이 ${uncompletedGoals.length}개 있어요:\n${goalList}${extra}\n\n오늘 처리할까요?`,
            actionType: 'view_uncompleted',
            actionPayload: { goals: uncompletedGoals }
        });
    }

    // 3. 저녁 시간대 (20:00-22:00) 내일 준비 알림
    if (currentHour >= TIMING.EVENING_START && currentHour < TIMING.EVENING_END) {
        const eveningNotifications = getEveningPrepNotifications(
            context
        );
        notifications.push(...eveningNotifications);
    }

    // 3.5 저녁 마무리 알림 (21시) — 오늘 활동 요약 + 피드백 + 내일 일정 + 일정 생성 권유
    if (currentHour === TIMING.EVENING_CHECK_HOUR) {
        const completedCount = todaySchedules.filter(s => s.completed).length;
        const totalCount = todaySchedules.length;
        const skippedCount = todaySchedules.filter(s => s.skipped).length;
        const incompleteSchedules = todaySchedules.filter(s => !s.completed && !s.skipped);
        const completedSchedules = todaySchedules.filter(s => s.completed);
        const rate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        const userName = context.userProfile?.name || '사용자';

        let message = `${userName}님, 오늘 하루 수고 많으셨어요.\n`;

        // ─── 1. 오늘 활동 요약 ───
        message += '\n━━━ 📊 오늘 활동 요약 ━━━\n';
        if (totalCount > 0) {
            message += `전체 ${totalCount}개 일정 중 ${completedCount}개 완료 (달성률 ${rate}%)`;
            if (skippedCount > 0) message += `, ${skippedCount}개 건너뜀`;
            message += '\n';

            if (completedSchedules.length > 0) {
                message += '\n✅ 완료:\n';
                completedSchedules.slice(0, 6).forEach(s => {
                    message += `  • ${s.text}${s.startTime ? ` (${s.startTime})` : ''}\n`;
                });
                if (completedSchedules.length > 6) message += `  ...외 ${completedSchedules.length - 6}개\n`;
            }

            if (incompleteSchedules.length > 0) {
                message += '\n⏳ 미완료:\n';
                incompleteSchedules.slice(0, 4).forEach(s => {
                    message += `  • ${s.text}\n`;
                });
                if (incompleteSchedules.length > 4) message += `  ...외 ${incompleteSchedules.length - 4}개\n`;
            }
        } else {
            message += '오늘은 등록된 일정이 없었어요.\n';
        }

        // ─── 2. 피드백 ───
        message += '\n━━━ 💬 피드백 ━━━\n';
        if (totalCount === 0) {
            message += '일정이 없는 날도 괜찮아요. 쉬는 것도 중요하니까요.\n내일은 간단한 일정부터 시작해보는 건 어떨까요?\n';
        } else if (rate >= 90) {
            message += `${completedCount}개 모두 해내다니 대단해요! 🎉\n이 페이스를 유지하면 목표 달성이 눈앞이에요.\n`;
        } else if (rate >= 70) {
            message += `${completedCount}개나 완료하셨네요, 잘하고 계세요! 💪\n`;
            if (incompleteSchedules.length > 0) {
                message += `남은 "${incompleteSchedules[0].text}"은(는) 내일 이어서 해도 괜찮아요.\n`;
            }
        } else if (rate >= 40) {
            message += '오늘 쉽지 않은 하루였나 봐요.\n';
            message += '그래도 절반 가까이 해낸 건 충분히 의미 있어요.\n';
            if (incompleteSchedules.length > 0) {
                message += `내일 "${incompleteSchedules[0].text}" 부터 다시 시작해보면 어떨까요?\n`;
            }
        } else if (totalCount > 0) {
            message += '바쁘거나 컨디션이 안 좋은 날도 있는 거예요. 🤗\n';
            message += '오늘 하루를 보낸 것만으로도 충분해요.\n';
            message += '내일은 일정을 조금 가볍게 잡아보는 게 어떨까요?\n';
        }

        // ─── 3. 내일 일정 미리보기 ───
        const tomorrow = new Date(currentTime);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
        const tomorrowDayOfWeek = tomorrow.getDay();
        const tomorrowDayName = DAY_NAMES_KR[tomorrowDayOfWeek];

        const allGoals = context.allCustomGoals || [];
        const tomorrowSchedules = allGoals.filter((goal: CustomGoal) => {
            if (goal.specificDate === tomorrowStr) return true;
            if (goal.daysOfWeek?.includes(tomorrowDayOfWeek) && !goal.specificDate) return true;
            return false;
        });

        message += `\n━━━ 📅 내일 (${tomorrowDayName}요일) ━━━\n`;
        if (tomorrowSchedules.length > 0) {
            const sorted = [...tomorrowSchedules].sort((a, b) =>
                (a.startTime || '99:99').localeCompare(b.startTime || '99:99')
            );
            message += `예정된 일정 ${sorted.length}개:\n`;
            sorted.slice(0, 6).forEach(s => {
                const time = s.startTime ? `${s.startTime}` : '';
                message += `  • ${time ? time + ' ' : ''}${s.text}\n`;
            });
            if (sorted.length > 6) message += `  ...외 ${sorted.length - 6}개\n`;

            const firstSchedule = sorted[0];
            if (firstSchedule.startTime) {
                message += `\n💡 내일 첫 일정이 ${firstSchedule.startTime}에 "${firstSchedule.text}"이에요.\n충분한 수면 취하시고 여유 있게 준비하세요!\n`;
            }
        } else {
            message += '아직 등록된 일정이 없어요.\n';
            message += '✨ 내일 하루를 미리 계획하면 훨씬 알차게 보낼 수 있어요!\n';
            message += '간단한 일정이라도 추가해보세요.\n';
        }

        // ─── 4. 마무리 ───
        message += '\n오늘도 수고하셨어요. 편안한 밤 되세요 🌙';

        notifications.push({
            id: `evening-check-${getChatDate()}`,
            type: 'daily_wrap',
            priority: 'medium',
            title: '🌙 하루 마무리',
            message: message.trim(),
            actionType: tomorrowSchedules.length === 0 ? 'open_add_schedule_tomorrow' : undefined,
            actionPayload: tomorrowSchedules.length === 0 ? { tomorrowDate: tomorrowStr } : undefined,
        });
    }

    // 4. 목표 nudge - 오랫동안 미완료된 목표
    const goalNudges = getGoalNudgeNotifications(uncompletedGoals);
    notifications.push(...goalNudges);

    // 5. 메모리 기반 선제적 알림 - "먼저 물어보는 AI"
    if (context.userMemory || context.recurringPatterns?.length) {
        const memoryNotifications = getMemoryBasedNotifications(context);
        notifications.push(...memoryNotifications);
    }

    // 6. 반복 일정 전환 제안
    const recurringNotifications = getRecurringConversionNotifications(context);
    notifications.push(...recurringNotifications);
    if (recurringNotifications.length > 0) {
    }

    // 7. 주말/연휴/기념일 맛집·여행 추천
    const lifestyleNotifications = getLifestyleRecommendNotifications(context);
    notifications.push(...lifestyleNotifications);
    if (lifestyleNotifications.length > 0) {
    }

    // 9. 패턴 기반 제안 ("목요일 운동 자주 건너뛰시네요")
    const patternSuggestions = getSkippedPatternSuggestions(context);
    notifications.push(...patternSuggestions);
    if (patternSuggestions.length > 0) {
    }

    // 10. 메모리 서피싱 — 과거 일정/이벤트 후속 확인
    try {
        const memorySurfacing = await getMemorySurfacingNotifications(context);
        notifications.push(...memorySurfacing);
        if (memorySurfacing.length > 0) {
        }
    } catch (e) {
        logger.error('[ProactiveNotif] Memory surfacing failed:', e instanceof Error ? e.message : e);
    }

    // 8. 컨텍스트 융합 신호 기반 알림 (critical/warning만)
    try {
        const { fuseContext } = await import('@/lib/contextFusionService');
        const fused = await fuseContext(context.userEmail);
        for (const signal of fused.signals) {
            if (signal.severity === 'critical' || signal.severity === 'warning') {
                const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
                notifications.push({
                    id: `fusion-${signal.type}-${todayStr}`,
                    type: 'context_suggestion',
                    priority: signal.severity === 'critical' ? 'high' : 'medium',
                    title: signal.severity === 'critical' ? '🔴 긴급 알림' : '🟡 주의 알림',
                    message: signal.message,
                });
            }
        }
        if (fused.signals.length > 0) {
        }
    } catch (e) {
        logger.error('[ProactiveNotif] Context fusion failed:', e instanceof Error ? e.message : e);
    }

    // ============================================================
    // 신규 13가지 선제적 알림
    // ============================================================

    // 11. 기분 체크인 리마인더
    try {
        const moodReminders = await getMoodCheckInReminderNotification(context);
        notifications.push(...moodReminders);
    } catch (e) {
        logger.error('[ProactiveNotif] Mood reminder failed:', e instanceof Error ? e.message : e);
    }

    // 12. 번아웃 경고 (Pro+)
    try {
        const burnoutWarnings = await getBurnoutWarningNotification(context);
        notifications.push(...burnoutWarnings);
    } catch (e) {
        logger.error('[ProactiveNotif] Burnout warning failed:', e instanceof Error ? e.message : e);
    }

    // 13. 집중 스트릭 축하/격려
    try {
        const focusStreaks = await getFocusStreakNotification(context);
        notifications.push(...focusStreaks);
    } catch (e) {
        logger.error('[ProactiveNotif] Focus streak failed:', e instanceof Error ? e.message : e);
    }

    // 14. 건강 데이터 인사이트 (Pro+)
    try {
        const healthInsights = await getHealthInsightNotification(context);
        notifications.push(...healthInsights);
    } catch (e) {
        logger.error('[ProactiveNotif] Health insight failed:', e instanceof Error ? e.message : e);
    }

    // 15. GitHub 커밋 스트릭 (Max)
    try {
        const githubStreaks = await getGitHubStreakNotification(context);
        notifications.push(...githubStreaks);
    } catch (e) {
        logger.error('[ProactiveNotif] GitHub streak failed:', e instanceof Error ? e.message : e);
    }

    // 16. 일정 과밀 경고
    const scheduleOverloads = getScheduleOverloadNotification(context);
    notifications.push(...scheduleOverloads);

    // 17. 주간 목표 마감 임박
    const weeklyDeadlines = getWeeklyGoalDeadlineNotification(context);
    notifications.push(...weeklyDeadlines);

    // 18. 루틴 깨짐 감지
    const routineBreaks = getRoutineBreakNotification(context);
    notifications.push(...routineBreaks);

    // 19. 장기 비활성 복귀 유도
    try {
        const inactiveReturns = await getInactiveReturnNotification(context);
        notifications.push(...inactiveReturns);
    } catch (e) {
        logger.error('[ProactiveNotif] Inactive return failed:', e instanceof Error ? e.message : e);
    }

    // 20. 학습 리마인더
    const learningReminders = getLearningReminderNotification(context);
    notifications.push(...learningReminders);

    // 21. 점심 후 에너지 부스트
    try {
        const energyBoosts = await getPostLunchBoostNotification(context);
        notifications.push(...energyBoosts);
    } catch (e) {
        logger.error('[ProactiveNotif] Energy boost failed:', e instanceof Error ? e.message : e);
    }

    // 22. 퇴근 전 하루 마감
    const dailyWraps = getPreDepartureWrapNotification(context);
    notifications.push(...dailyWraps);

    // 23. 주간 회고 유도 (Pro+)
    try {
        const weeklyReviews = await getWeeklyReviewNotification(context);
        notifications.push(...weeklyReviews);
    } catch (e) {
        logger.error('[ProactiveNotif] Weekly review failed:', e instanceof Error ? e.message : e);
    }

    // 24. 트렌드 브리핑 미독 추천 (10시, 14시, 18시)
    try {
        const trendReminder = await getTrendBriefingReminderNotification(context);
        notifications.push(...trendReminder);
    } catch (e) {
        logger.error('[ProactiveNotif] Trend briefing reminder failed:', e instanceof Error ? e.message : e);
    }

    // displayOrder 부여 후 시간순 정렬
    for (const n of notifications) {
        n.displayOrder = TYPE_DISPLAY_ORDER[n.type] ?? 150;
    }
    notifications.sort((a, b) => (a.displayOrder ?? 150) - (b.displayOrder ?? 150));

    return notifications;
}

/**
 * 다가오는 일정 알림 생성
 */
function getUpcomingScheduleNotifications(
    schedules: CustomGoal[],
    currentTime: Date,
    currentTimeStr: string
): ProactiveNotification[] {
    const notifications: ProactiveNotification[] = [];

    schedules.forEach(schedule => {
        if (!schedule.startTime) return;

        const [scheduleHour, scheduleMin] = schedule.startTime.split(':').map(Number);
        const scheduleTime = new Date(currentTime);
        scheduleTime.setHours(scheduleHour, scheduleMin, 0, 0);

        const diffMinutes = Math.round((scheduleTime.getTime() - currentTime.getTime()) / (1000 * 60));

        // 10분 전 알림 (8~12분 범위)
        if (diffMinutes >= 8 && diffMinutes <= 12) {
            notifications.push({
                id: `schedule-10min-${schedule.id}`,
                type: 'schedule_reminder',
                priority: 'high',
                title: '⏰ 10분 후 일정',
                message: `"${schedule.text}" 일정이 곧 시작됩니다.`,
                expiresAt: scheduleTime,
            });
        }

        // 20분 전 알림 (18~22분 범위, 중요 일정)
        if (diffMinutes >= 18 && diffMinutes <= 22 && isImportantSchedule(schedule.text)) {
            notifications.push({
                id: `schedule-20min-${schedule.id}`,
                type: 'schedule_reminder',
                priority: 'medium',
                title: '📅 20분 후 중요 일정',
                message: `"${schedule.text}" 일정이 20분 후에 시작됩니다. 준비하세요!`,
                expiresAt: scheduleTime,
            });
        }

        // 일정 시작 알림 (집중 대상이면 집중 모드 버튼 포함)
        if (diffMinutes >= 0 && diffMinutes <= 2 && !schedule.completed) {
            const focusEligible = isFocusEligible(schedule.text);

            if (focusEligible) {
                let focusMinutes = 45;
                if (schedule.endTime) {
                    const [endH, endM] = schedule.endTime.split(':').map(Number);
                    focusMinutes = (endH * 60 + endM) - (scheduleHour * 60 + scheduleMin);
                    if (focusMinutes <= 0) focusMinutes = 45;
                }

                notifications.push({
                    id: `schedule-start-${schedule.id}`,
                    type: 'schedule_reminder',
                    priority: 'high',
                    title: '📋 일정 시작',
                    message: `"${schedule.text}" 시간이에요!\n집중 모드를 켜고 몰입해보세요.`,
                    actionType: 'start_focus_mode',
                    actionPayload: {
                        scheduleId: schedule.id,
                        scheduleText: schedule.text,
                        focusDuration: focusMinutes,
                    },
                    expiresAt: new Date(scheduleTime.getTime() + 5 * 60 * 1000),
                });
            } else {
                notifications.push({
                    id: `schedule-start-${schedule.id}`,
                    type: 'schedule_reminder',
                    priority: 'high',
                    title: '📋 일정 시작',
                    message: `"${schedule.text}" 일정이 시작되었습니다.`,
                    expiresAt: new Date(scheduleTime.getTime() + 5 * 60 * 1000),
                });
            }
        }
    });

    return notifications;
}

/**
 * 집중 모드 대상 일정 판별 (업무/학습/운동 키워드)
 */
function isFocusEligible(text: string): boolean {
    const lower = text.toLowerCase();
    return [...FOCUS_KEYWORDS, ...EXERCISE_KEYWORDS].some(kw => lower.includes(kw));
}

/**
 * 아침 브리핑 알림 생성
 */
function getMorningBriefingNotifications(context: UserContext): ProactiveNotification[] {
    const notifications: ProactiveNotification[] = [];
    const { todaySchedules, uncompletedGoals } = context;

    // 오늘 일정이 있고 아직 아침 브리핑을 보지 않았다면
    if (todaySchedules.length > 0) {
        const importantSchedules = todaySchedules.filter(s => isImportantSchedule(s.text));

        if (importantSchedules.length > 0) {
            const scheduleList = importantSchedules.slice(0, 3)
                .map(s => `• ${s.startTime}: ${s.text}`)
                .join('\n');

            notifications.push({
                id: `morning-briefing-${getChatDate()}`,
                type: 'morning_briefing',
                priority: 'high',
                title: '☀️ 좋은 아침이에요!',
                message: `오늘 중요한 일정 ${importantSchedules.length}개가 있어요:\n${scheduleList}`,
                actionType: 'open_briefing',
                actionPayload: { type: 'morning' }
            });
        }
    }

    // 어제 미완료 작업이 있다면
    if (uncompletedGoals.length > 0) {
        const goalNames = uncompletedGoals.map(g => g.text).slice(0, 5);
        const goalList = goalNames.map(n => `• ${n}`).join('\n');
        const extra = uncompletedGoals.length > 5 ? `\n외 ${uncompletedGoals.length - 5}개` : '';
        notifications.push({
            id: `uncompleted-reminder-${getChatDate()}`,
            type: 'urgent_alert',
            priority: 'medium',
            title: '📋 어제 미완료 작업',
            message: `어제 완료하지 못한 작업이 ${uncompletedGoals.length}개 있어요:\n${goalList}${extra}\n\n오늘 처리할까요?`,
            actionType: 'view_uncompleted',
            actionPayload: { goals: uncompletedGoals }
        });
    }

    return notifications;
}

/**
 * 저녁 준비 알림 생성
 */
function getEveningPrepNotifications(context: UserContext): ProactiveNotification[] {
    const notifications: ProactiveNotification[] = [];
    const { userProfile } = context;

    // 내일 첫 일정 확인 (만약 API에서 내일 일정도 가져올 수 있다면)
    // 현재는 취침 시간 알림만
    const sleepTime = userProfile?.schedule?.sleep;
    if (sleepTime) {
        const [sleepHour] = sleepTime.split(':').map(Number);
        const currentHour = context.currentTime.getHours();

        // 취침 1시간 전
        if (currentHour === sleepHour - 1) {
            notifications.push({
                id: `sleep-prep-${getChatDate()}`,
                type: 'context_suggestion',
                priority: 'low',
                title: '🌙 취침 준비 시간',
                message: '설정한 취침 시간 1시간 전이에요. 서서히 하루를 마무리해보세요.',
                actionType: 'start_wind_down'
            });
        }
    }

    return notifications;
}

/**
 * 목표 nudge 알림 생성
 */
function getGoalNudgeNotifications(uncompletedGoals: CustomGoal[]): ProactiveNotification[] {
    const notifications: ProactiveNotification[] = [];

    // 3일 이상 미완료된 목표
    const staleGoals = uncompletedGoals.filter(goal => {
        if (!goal.createdAt) return false;
        const daysSinceCreated = Math.floor(
            (Date.now() - new Date(goal.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceCreated >= THRESHOLDS.STALE_GOAL_DAYS;
    });

    if (staleGoals.length > 0) {
        notifications.push({
            id: `goal-nudge-${getChatDate()}`,
            type: 'goal_nudge',
            priority: 'low',
            title: '🎯 잊지 않으셨죠?',
            message: `"${staleGoals[0].text || staleGoals[0].content}" 목표가 아직 진행 중이에요. 오늘 시간을 내볼까요?`,
            actionType: 'view_goal',
            actionPayload: { goalId: staleGoals[0].id }
        });
    }

    return notifications;
}

/**
 * 메모리 기반 알림 생성 - "먼저 물어보는 AI"
 */
function getMemoryBasedNotifications(context: UserContext): ProactiveNotification[] {
    const notifications: ProactiveNotification[] = [];
    const { currentTime, userMemory, recurringPatterns, todaySchedules, userProfile } = context;

    const currentHour = currentTime.getHours();
    const dayOfWeek = currentTime.getDay();
    const todayStr = currentTime.toISOString().split('T')[0];

    // 1. 반복 패턴 기반 알림 (예: "매주 목요일 뉴스레터")
    // 매일 반복되는 기본 활동은 제외 (기상, 취침, 식사 등)

    if (recurringPatterns && recurringPatterns.length > 0) {
        recurringPatterns.forEach(pattern => {
            if (pattern.dayOfWeek === dayOfWeek) {
                // 매일 반복되는 기본 활동은 스킵
                const activityLower = pattern.activity.toLowerCase();
                const isDailyRoutine = DAILY_ROUTINE_KEYWORDS.some(keyword =>
                    activityLower.includes(keyword)
                );
                if (isDailyRoutine) return;

                // 주 1-2회 하는 특별 활동만 알림
                notifications.push({
                    id: `pattern-${pattern.activity}-${todayStr}`,
                    type: 'pattern_reminder',
                    priority: 'medium',
                    title: '📅 정기 일정 알림',
                    message: `오늘은 "${pattern.activity}" 하시는 날이에요. ${pattern.time ? `보통 ${pattern.time}에 하시죠?` : ''} 준비가 필요하시면 말씀해주세요!`,
                    actionType: 'assist_pattern',
                    actionPayload: { pattern }
                });
            }
        });
    }

    // 2. 생산성 피크 시간 활용 제안
    if (userMemory?.preferences?.productivityPeaks?.length) {
        const peaks = userMemory.preferences.productivityPeaks;
        // 현재 시간이 생산성 피크 시간대인지 확인
        const isPeakTime = peaks.some(peak => {
            const peakLower = peak.toLowerCase();
            if (peakLower.includes('오전') && currentHour >= 9 && currentHour < 12) return true;
            if (peakLower.includes('아침') && currentHour >= 6 && currentHour < 10) return true;
            if (peakLower.includes('오후') && currentHour >= 14 && currentHour < 18) return true;
            return false;
        });

        // 피크 시간에 중요 일정이 없으면 제안
        const hasImportantScheduleNow = todaySchedules.some((s: CustomGoal) => {
            if (!s.startTime) return false;
            const [h] = s.startTime.split(':').map(Number);
            return Math.abs(h - currentHour) <= 1 && isImportantSchedule(s.text);
        });

        if (isPeakTime && !hasImportantScheduleNow && currentHour >= 9 && currentHour <= 11) {
            notifications.push({
                id: `productivity-peak-${todayStr}-${currentHour}`,
                type: 'memory_suggestion',
                priority: 'low',
                title: '⚡ 집중하기 좋은 시간',
                message: '지금이 집중력이 높은 시간대예요. 중요한 작업을 진행해보시는 건 어떨까요?',
                actionType: 'suggest_focus_task',
                actionPayload: { peakTime: true }
            });
        }
    }

    // 3. 중요 이벤트 리마인더 (기념일, 마감일 등)
    if (userMemory?.importantEvents?.length) {
        userMemory.importantEvents.forEach(event => {
            // 이벤트 날짜가 오늘 또는 내일인 경우
            const eventDate = new Date(event.date);
            const diffDays = Math.ceil((eventDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                notifications.push({
                    id: `event-today-${event.date}-${event.event.substring(0, 10)}`,
                    type: 'memory_suggestion',
                    priority: 'high',
                    title: '📌 오늘의 중요 이벤트',
                    message: `오늘은 "${event.event}" 날이에요!`,
                    actionType: 'view_event',
                    actionPayload: { event }
                });
            } else if (diffDays === 1) {
                notifications.push({
                    id: `event-tomorrow-${event.date}-${event.event.substring(0, 10)}`,
                    type: 'memory_suggestion',
                    priority: 'medium',
                    title: '📆 내일 중요 이벤트',
                    message: `내일은 "${event.event}" 날이에요. 준비하실 것이 있으신가요?`,
                    actionType: 'prepare_event',
                    actionPayload: { event }
                });
            }
        });
    }

    // 4. 자주 하는 요청 기반 선제적 제안
    // 이 기능은 아침 인사에서 이미 처리하므로 중복 알림 제거
    // (아침 브리핑은 메인 페이지 로드 시 자동 생성됨)

    // 5. 시간대별 선호 활동 제안
    if (userMemory?.patterns?.timePreferences) {
        const timePrefs = userMemory.patterns.timePreferences;
        let currentPeriod = '';
        if (currentHour >= 6 && currentHour < 12) currentPeriod = '아침';
        else if (currentHour >= 12 && currentHour < 18) currentPeriod = '오후';
        else if (currentHour >= 18 && currentHour < 22) currentPeriod = '저녁';

        const preferredActivity = timePrefs[currentPeriod];
        if (preferredActivity && currentHour % 3 === 0) { // 3시간마다 한 번만
            notifications.push({
                id: `time-pref-${todayStr}-${currentPeriod}`,
                type: 'memory_suggestion',
                priority: 'low',
                title: `✨ ${currentPeriod} 활동 제안`,
                message: `${currentPeriod}에는 보통 "${preferredActivity}" 하시는 것 같은데, 오늘도 계획이 있으신가요?`,
                actionType: 'suggest_activity',
                actionPayload: { activity: preferredActivity, period: currentPeriod }
            });
        }
    }

    return notifications;
}

/**
 * 반복 패턴 감지 - 일정 데이터에서 패턴 추출
 */
function detectRecurringPatterns(customGoals: CustomGoal[]): Array<{
    dayOfWeek: number;
    activity: string;
    time?: string;
    lastOccurrence?: string;
}> {
    const patterns: Array<{
        dayOfWeek: number;
        activity: string;
        time?: string;
        lastOccurrence?: string;
    }> = [];

    // 매일 반복되는 기본 활동은 패턴에서 제외

    // daysOfWeek가 있는 반복 일정을 패턴으로 변환
    // 단, 매일 반복(5일 이상) 또는 기본 활동은 제외
    customGoals.forEach((goal) => {
        if (goal.daysOfWeek && goal.daysOfWeek.length > 0 && goal.daysOfWeek.length <= THRESHOLDS.MAX_RECURRING_DAYS) {
            // 기본 활동 제외
            const activityLower = (goal.text || '').toLowerCase();
            const isDailyRoutine = DAILY_ROUTINE_KEYWORDS.some(keyword =>
                activityLower.includes(keyword)
            );
            if (isDailyRoutine) return;

            goal.daysOfWeek.forEach((day: number) => {
                patterns.push({
                    dayOfWeek: day,
                    activity: goal.text,
                    time: goal.startTime,
                });
            });
        }
    });

    return patterns;
}

/**
 * 일회성 일정 중 반복 후보 감지
 * 같은 텍스트 + 같은 요일 + 비슷한 시간(±30분)에 2회 이상 등록된 일정 찾기
 */
interface RecurringCandidate {
    text: string;
    dayOfWeek: number;
    startTime: string;
    scheduleIds: string[];
    occurrences: number;
    color?: string;
}

function normalizeScheduleText(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, '');
}

function getTimeSlot(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const slot = Math.floor(m / 30) * 30;
    return `${String(h).padStart(2, '0')}:${String(slot).padStart(2, '0')}`;
}

function detectOneTimeRecurringCandidates(customGoals: CustomGoal[]): RecurringCandidate[] {
    // 일회성 일정만 필터 (specificDate 있고 daysOfWeek 없음)
    const oneTimeGoals = customGoals.filter((g) =>
        g.specificDate && (!g.daysOfWeek || g.daysOfWeek.length === 0) && g.startTime
    );

    // 이미 존재하는 반복 일정 텍스트 수집 (중복 제안 방지)
    const existingRecurringTexts = new Set(
        customGoals
            .filter((g) => g.daysOfWeek && g.daysOfWeek.length > 0)
            .map((g) => normalizeScheduleText(g.text))
    );

    // 그룹핑: normalizedText + dayOfWeek + timeSlot
    const groups = new Map<string, { goals: CustomGoal[]; text: string; dayOfWeek: number; startTime: string; color?: string }>();

    oneTimeGoals.forEach((goal) => {
        const normalized = normalizeScheduleText(goal.text);
        // 이미 반복 일정이 있으면 스킵
        if (existingRecurringTexts.has(normalized)) return;

        const dayOfWeek = new Date(goal.specificDate + 'T00:00:00').getDay();
        const timeSlot = getTimeSlot(goal.startTime!);
        const key = `${normalized}|${dayOfWeek}|${timeSlot}`;

        if (!groups.has(key)) {
            groups.set(key, {
                goals: [],
                text: goal.text,
                dayOfWeek,
                startTime: goal.startTime!,
                color: goal.color,
            });
        }
        groups.get(key)!.goals.push(goal);
    });

    // 2회 이상인 그룹을 후보로 반환
    const candidates: RecurringCandidate[] = [];
    groups.forEach((group) => {
        if (group.goals.length >= THRESHOLDS.MIN_RECURRING_OCCURRENCES) {
            // 가장 최근 일정의 시간 사용
            const sorted = group.goals.sort((a, b) =>
                (b.specificDate ?? '').localeCompare(a.specificDate ?? '')
            );
            candidates.push({
                text: group.text,
                dayOfWeek: group.dayOfWeek,
                startTime: sorted[0].startTime ?? '',
                scheduleIds: group.goals.map((g) => g.id).filter((id): id is string => id !== undefined),
                occurrences: group.goals.length,
                color: group.color,
            });
        }
    });

    return candidates;
}

/**
 * 연속 일자 반복 후보 감지
 * 같은 텍스트 + 비슷한 시간(±30분)에 3일 연속 등록된 일정 찾기
 */
interface ConsecutiveCandidate {
    text: string;
    startTime: string;
    consecutiveDates: string[];
    scheduleIds: string[];
    daysOfWeek: number[];
    color?: string;
}

function detectConsecutiveDayCandidates(customGoals: CustomGoal[]): ConsecutiveCandidate[] {
    const oneTimeGoals = customGoals.filter((g) =>
        g.specificDate && (!g.daysOfWeek || g.daysOfWeek.length === 0) && g.startTime
    );

    const existingRecurringTexts = new Set(
        customGoals
            .filter((g) => g.daysOfWeek && g.daysOfWeek.length > 0)
            .map((g) => normalizeScheduleText(g.text))
    );

    // 그룹핑: normalizedText + timeSlot (요일 무관)
    const groups = new Map<string, { goals: CustomGoal[]; text: string; color?: string }>();

    oneTimeGoals.forEach((goal) => {
        const normalized = normalizeScheduleText(goal.text);
        if (existingRecurringTexts.has(normalized)) return;

        const timeSlot = getTimeSlot(goal.startTime!);
        const key = `${normalized}|${timeSlot}`;

        if (!groups.has(key)) {
            groups.set(key, { goals: [], text: goal.text, color: goal.color });
        }
        groups.get(key)!.goals.push(goal);
    });

    const candidates: ConsecutiveCandidate[] = [];

    groups.forEach((group) => {
        if (group.goals.length < 3) return;

        // 날짜 정렬
        const sorted = group.goals
            .filter((g) => g.specificDate)
            .sort((a, b) => a.specificDate!.localeCompare(b.specificDate!));

        // 연속 시퀀스 찾기
        let streak: CustomGoal[] = [sorted[0]];
        let bestStreak: CustomGoal[] = [];

        for (let i = 1; i < sorted.length; i++) {
            const prevDate = new Date(sorted[i - 1].specificDate + 'T00:00:00');
            const currDate = new Date(sorted[i].specificDate + 'T00:00:00');
            const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                streak.push(sorted[i]);
            } else {
                if (streak.length > bestStreak.length) bestStreak = streak;
                streak = [sorted[i]];
            }
        }
        if (streak.length > bestStreak.length) bestStreak = streak;

        if (bestStreak.length >= 3) {
            const dates = bestStreak.map((g) => g.specificDate!);
            const daysOfWeek = [...new Set(dates.map((d) => new Date(d + 'T00:00:00').getDay()))].sort();

            candidates.push({
                text: group.text,
                startTime: bestStreak[bestStreak.length - 1].startTime ?? '',
                consecutiveDates: dates,
                scheduleIds: bestStreak.map((g) => g.id).filter((id): id is string => id !== undefined),
                daysOfWeek: daysOfWeek.length >= 5 ? [0, 1, 2, 3, 4, 5, 6] : daysOfWeek,
                color: group.color,
            });
        }
    });

    return candidates;
}

function getRecurringConversionNotifications(context: UserContext): ProactiveNotification[] {
    const notifications: ProactiveNotification[] = [];
    const customGoals = context.allCustomGoals || [];

    if (customGoals.length === 0) return notifications;

    // 1) 연속 일자 후보 (3일 연속 → 매일 반복 제안)
    const consecutiveCandidates = detectConsecutiveDayCandidates(customGoals);
    const consecutiveScheduleIds = new Set<string>();

    consecutiveCandidates.forEach((candidate) => {
        const normalized = normalizeScheduleText(candidate.text);
        const firstDate = candidate.consecutiveDates[0];
        const lastDate = candidate.consecutiveDates[candidate.consecutiveDates.length - 1];
        const shortFirst = firstDate.slice(5).replace('-', '/');
        const shortLast = lastDate.slice(5).replace('-', '/');

        candidate.scheduleIds.forEach((id) => consecutiveScheduleIds.add(id));

        notifications.push({
            id: `recurring-daily-${normalized}`,
            type: 'context_suggestion',
            priority: 'medium',
            title: '🔄 반복 일정 제안',
            message: `"${candidate.text}" 일정을 ${candidate.consecutiveDates.length}일 연속(${shortFirst}~${shortLast}) 같은 시간(${candidate.startTime})에 등록하셨어요. 매일 반복 일정으로 설정할까요?`,
            actionType: 'convert_to_recurring_daily',
            actionPayload: {
                text: candidate.text,
                daysOfWeek: candidate.daysOfWeek,
                startTime: candidate.startTime,
                scheduleIds: candidate.scheduleIds,
                color: candidate.color,
            },
        });
    });

    // 2) 같은 요일 후보 (기존 로직, 연속 일자에 이미 포함된 일정은 제외)
    const candidates = detectOneTimeRecurringCandidates(customGoals);

    candidates.forEach((candidate) => {
        // 연속 일자 후보에 이미 포함된 일정이면 스킵
        if (candidate.scheduleIds.some((id) => consecutiveScheduleIds.has(id))) return;

        const dayName = DAY_NAMES_KR[candidate.dayOfWeek];
        const normalized = normalizeScheduleText(candidate.text);

        notifications.push({
            id: `recurring-suggest-${normalized}-${candidate.dayOfWeek}`,
            type: 'context_suggestion',
            priority: 'medium',
            title: '🔄 반복 일정 제안',
            message: `"${candidate.text}" 일정을 매주 ${dayName}요일 ${candidate.startTime}에 ${candidate.occurrences}회 등록하셨어요. 매주 반복 일정으로 설정할까요?`,
            actionType: 'convert_to_recurring',
            actionPayload: {
                text: candidate.text,
                dayOfWeek: candidate.dayOfWeek,
                startTime: candidate.startTime,
                scheduleIds: candidate.scheduleIds,
                color: candidate.color,
            },
        });
    });

    return notifications;
}

// ============================================================
// 주말/공휴일/기념일 맛집·여행 추천 (에스컬레이션 리마인더)
// ============================================================

/**
 * 한국 공휴일 (고정 날짜) — 매년 반복
 * 음력 기반 명절(설/추석)은 연도별로 다르므로 별도 테이블 사용
 */
const KOREAN_FIXED_HOLIDAYS: Record<string, string> = {
    '01-01': '신정',
    '03-01': '삼일절',
    '05-05': '어린이날',
    '06-06': '현충일',
    '08-15': '광복절',
    '10-03': '개천절',
    '10-09': '한글날',
    '12-25': '크리스마스',
};

/**
 * 음력 기반 공휴일 (연도별 양력 변환) — 2025~2027
 * 설날(음력 1/1) 전후 1일, 추석(음력 8/15) 전후 1일, 부처님오신날(음력 4/8)
 */
const KOREAN_LUNAR_HOLIDAYS: Record<string, Record<string, string>> = {
    '2025': {
        '01-28': '설날 연휴', '01-29': '설날', '01-30': '설날 연휴',
        '05-05': '부처님오신날',
        '10-05': '추석 연휴', '10-06': '추석', '10-07': '추석 연휴',
    },
    '2026': {
        '02-16': '설날 연휴', '02-17': '설날', '02-18': '설날 연휴',
        '05-24': '부처님오신날',
        '09-24': '추석 연휴', '09-25': '추석', '09-26': '추석 연휴',
    },
    '2027': {
        '02-06': '설날 연휴', '02-07': '설날', '02-08': '설날 연휴',
        '05-13': '부처님오신날',
        '10-14': '추석 연휴', '10-15': '추석', '10-16': '추석 연휴',
    },
};

interface HolidayInfo {
    date: string;       // YYYY-MM-DD
    name: string;
    isLongWeekend: boolean;  // 3일 이상 연휴
    daysUntil: number;
}

/**
 * 특정 날짜가 공휴일인지 확인
 */
function getHolidayName(dateStr: string): string | null {
    const mmdd = dateStr.substring(5); // MM-DD
    const year = dateStr.substring(0, 4);

    if (KOREAN_FIXED_HOLIDAYS[mmdd]) return KOREAN_FIXED_HOLIDAYS[mmdd];
    if (KOREAN_LUNAR_HOLIDAYS[year]?.[mmdd]) return KOREAN_LUNAR_HOLIDAYS[year][mmdd];
    return null;
}

/**
 * 특정 날짜가 주말인지 확인
 */
function isWeekend(dateStr: string): boolean {
    const d = new Date(dateStr + 'T00:00:00+09:00');
    const day = d.getDay();
    return day === 0 || day === 6;
}

/**
 * 다가오는 연휴/주말 감지 (최대 8일 앞까지 스캔)
 */
function getUpcomingBreaks(todayStr: string): HolidayInfo[] {
    const breaks: HolidayInfo[] = [];
    const today = new Date(todayStr + 'T00:00:00+09:00');

    for (let offset = 0; offset <= 8; offset++) {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const holidayName = getHolidayName(ds);
        const weekend = isWeekend(ds);

        if (holidayName || weekend) {
            // 연속 휴일 길이 계산
            let streak = 1;
            for (let i = 1; i <= 5; i++) {
                const next = new Date(d);
                next.setDate(next.getDate() + i);
                const ns = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
                if (getHolidayName(ns) || isWeekend(ns)) streak++;
                else break;
            }

            // 이미 같은 연휴 블록으로 등록된 것 중복 방지
            const alreadyAdded = breaks.some(b =>
                Math.abs(new Date(b.date + 'T00:00:00+09:00').getTime() - d.getTime()) < 86400000 * 2
                && b.isLongWeekend === (streak >= 3)
            );
            if (alreadyAdded) continue;

            breaks.push({
                date: ds,
                name: holidayName || (d.getDay() === 0 ? '일요일' : '토요일'),
                isLongWeekend: streak >= 3,
                daysUntil: offset,
            });
        }
    }

    return breaks;
}

/**
 * 주말/연휴/기념일 맛집·여행 추천 알림 생성
 *
 * 에스컬레이션 전략:
 * - 연휴/기념일: 7일 전 → (반응 없으면) 2일 전 → 당일
 * - 주말: 금요일(1일 전)
 *
 * dismiss 여부는 route.ts의 user_preferences에서 확인하며,
 * 여기서는 각 시점의 알림을 고유 ID로 생성한다.
 */
function getLifestyleRecommendNotifications(context: UserContext): ProactiveNotification[] {
    const notifications: ProactiveNotification[] = [];
    const { currentTime, userProfile, userMemory } = context;

    const currentHour = currentTime.getHours();
    // 오전 8-11시에만 생성 (하루 1번)
    if (currentHour < TIMING.LIFESTYLE_NOTIF_START || currentHour >= TIMING.LIFESTYLE_NOTIF_END) return notifications;

    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
    const breaks = getUpcomingBreaks(todayStr);

    // 사용자 관심사 기반 추천 타입 결정
    const interests = userProfile?.interests || [];
    const hasTravel = interests.some((i: string) => ['travel', 'health', 'selfdev'].includes(i));
    const hasFood = interests.some((i: string) => ['food', 'cooking'].includes(i));

    for (const brk of breaks) {
        const isLong = brk.isLongWeekend;
        const daysUntil = brk.daysUntil;
        const breakKey = brk.date.replace(/-/g, '');

        // === 연휴 (3일+) 또는 공휴일: 7일전 → 2일전 → 당일 ===
        if (isLong || getHolidayName(brk.date)) {
            if (daysUntil === 7) {
                notifications.push({
                    id: `lifestyle-7d-${breakKey}`,
                    type: 'lifestyle_recommend',
                    priority: 'low',
                    title: '🗓️ 다가오는 연휴',
                    message: `${brk.name}${isLong ? ' 연휴' : ''}가 일주일 앞으로 다가왔어요! ${
                        hasTravel ? '여행 계획을 세워볼까요?' : '맛집이나 나들이를 계획해볼까요?'
                    }`,
                    actionType: 'lifestyle_suggest',
                    actionPayload: { breakDate: brk.date, breakName: brk.name, phase: 'early', isLong },
                });
            } else if (daysUntil === 2) {
                notifications.push({
                    id: `lifestyle-2d-${breakKey}`,
                    type: 'lifestyle_recommend',
                    priority: 'medium',
                    title: `🍽️ ${brk.name} 준비`,
                    message: `${brk.name}이(가) 이틀 뒤예요! ${
                        isLong
                            ? '숙소나 식당 예약은 하셨나요? 추천해드릴까요?'
                            : '맛집이나 카페를 찾아볼까요?'
                    }`,
                    actionType: 'lifestyle_suggest',
                    actionPayload: { breakDate: brk.date, breakName: brk.name, phase: 'mid', isLong },
                });
            } else if (daysUntil === 0) {
                notifications.push({
                    id: `lifestyle-0d-${breakKey}`,
                    type: 'lifestyle_recommend',
                    priority: 'medium',
                    title: `🎉 ${brk.name}`,
                    message: `오늘은 ${brk.name}이에요! ${
                        isLong
                            ? '연휴 잘 보내고 계신가요? 근처 맛집이나 즐길 거리를 추천해드릴까요?'
                            : '특별한 계획이 있으신가요? 맛집이나 카페를 추천해드릴까요?'
                    }`,
                    actionType: 'lifestyle_suggest',
                    actionPayload: { breakDate: brk.date, breakName: brk.name, phase: 'day_of', isLong },
                });
            }
        }

        // === 일반 주말: 금요일(1일 전)에만 ===
        if (!getHolidayName(brk.date) && !isLong) {
            if (daysUntil === 1 && currentTime.getDay() === 5) {
                // 금요일에 "내일 주말" 알림 (토요일 기준으로 1개만)
                if (brk.name === '토요일') {
                    notifications.push({
                        id: `lifestyle-weekend-${breakKey}`,
                        type: 'lifestyle_recommend',
                        priority: 'low',
                        title: '🌟 즐거운 주말!',
                        message: '주말이 다가왔어요! 맛집이나 나들이 장소를 추천해드릴까요?',
                        actionType: 'lifestyle_suggest',
                        actionPayload: { breakDate: brk.date, breakName: '주말', phase: 'friday', isLong: false },
                    });
                }
            }
        }
    }

    // === 기념일 (userMemory에서 감지) ===
    if (userMemory?.importantEvents?.length) {
        for (const event of userMemory.importantEvents) {
            if (!event.date || !event.category) continue;
            // 기념일/생일 등 라이프스타일 관련 이벤트만
            const isLifestyleEvent = ['anniversary', 'birthday', 'celebration', '기념일', '생일', '결혼기념일'].some(
                k => event.category.toLowerCase().includes(k) || event.event.toLowerCase().includes(k)
            );
            if (!isLifestyleEvent) continue;

            const eventDate = new Date(event.date + 'T00:00:00+09:00');
            const diffDays = Math.ceil((eventDate.getTime() - currentTime.getTime()) / 86400000);
            const eventKey = event.date.replace(/-/g, '') + '_' + event.event.substring(0, 6).replace(/\s/g, '');

            if (diffDays === 7) {
                notifications.push({
                    id: `lifestyle-anniv-7d-${eventKey}`,
                    type: 'lifestyle_recommend',
                    priority: 'low',
                    title: `💝 ${event.event} D-7`,
                    message: `일주일 뒤 "${event.event}"이에요! 레스토랑이나 선물을 미리 준비해볼까요?`,
                    actionType: 'lifestyle_suggest',
                    actionPayload: { breakDate: event.date, breakName: event.event, phase: 'early', isAnniversary: true },
                });
            } else if (diffDays === 2) {
                notifications.push({
                    id: `lifestyle-anniv-2d-${eventKey}`,
                    type: 'lifestyle_recommend',
                    priority: 'medium',
                    title: `💝 ${event.event} D-2`,
                    message: `"${event.event}"이(가) 이틀 뒤예요! 예약이나 준비는 완료하셨나요?`,
                    actionType: 'lifestyle_suggest',
                    actionPayload: { breakDate: event.date, breakName: event.event, phase: 'mid', isAnniversary: true },
                });
            } else if (diffDays === 0) {
                notifications.push({
                    id: `lifestyle-anniv-0d-${eventKey}`,
                    type: 'lifestyle_recommend',
                    priority: 'high',
                    title: `🎂 ${event.event}`,
                    message: `오늘은 "${event.event}" 날이에요! 특별한 하루 보내세요. 근처 맛집을 찾아볼까요?`,
                    actionType: 'lifestyle_suggest',
                    actionPayload: { breakDate: event.date, breakName: event.event, phase: 'day_of', isAnniversary: true },
                });
            }
        }
    }

    return notifications;
}

/**
 * 중요 일정인지 확인
 */
export function isImportantSchedule(text: string): boolean {
    const lowerText = text.toLowerCase();
    return IMPORTANT_SCHEDULE_KEYWORDS.some(keyword =>
        lowerText.includes(keyword.toLowerCase())
    );
}

// ============================================================
// 메모리 서피싱 — 과거 일정에 대한 후속 질문
// ============================================================

/**
 * 최근 2-7일 전 중요 일정을 찾아 후속 질문 생성
 * "지난주 치과 예약은 잘 다녀오셨나요?"
 */
async function getMemorySurfacingNotifications(context: UserContext): Promise<ProactiveNotification[]> {
    const notifications: ProactiveNotification[] = [];
    const currentTime = context.currentTime;
    const currentHour = currentTime.getHours();

    // 아침/오전에만 (7-11시)
    if (currentHour < TIMING.MEMORY_SURFACING_START || currentHour > TIMING.MEMORY_SURFACING_END) return notifications;

    const customGoals = context.allCustomGoals || [];
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    // 과거 일정 키워드: 후속 확인이 의미 있는 일정
    const FOLLOWUP_KEYWORDS: Array<{ keywords: string[]; question: string }> = [
        { keywords: ['치과', '병원', '진료', '검진', '안과', '피부과'], question: '진료 결과는 괜찮으셨나요?' },
        { keywords: ['면접', '인터뷰'], question: '면접 결과는 어떠셨나요?' },
        { keywords: ['시험', '테스트', '자격증'], question: '시험은 잘 보셨나요?' },
        { keywords: ['발표', '프레젠테이션', 'PT'], question: '발표는 잘 되셨나요?' },
        { keywords: ['여행', '휴가'], question: '여행은 즐거우셨나요?' },
        { keywords: ['이사', '입주'], question: '새 곳에 잘 정착하셨나요?' },
        { keywords: ['생일', '기념일', '결혼'], question: '좋은 시간 보내셨나요?' },
    ];

    // 2-7일 전 일정 검색
    for (let daysAgo = 2; daysAgo <= 7; daysAgo++) {
        const pastDate = new Date(currentTime);
        pastDate.setDate(pastDate.getDate() - daysAgo);
        const pastDateStr = `${pastDate.getFullYear()}-${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}`;
        const pastDayOfWeek = pastDate.getDay();

        const pastSchedules = customGoals.filter((g) => {
            if (g.specificDate === pastDateStr) return true;
            if (g.daysOfWeek?.includes(pastDayOfWeek) && !g.specificDate) return false; // 매주 반복은 제외
            return false;
        });

        for (const schedule of pastSchedules) {
            const text = (schedule.text || '').toLowerCase();

            for (const { keywords, question } of FOLLOWUP_KEYWORDS) {
                if (keywords.some(kw => text.includes(kw))) {
                    const dayLabel = daysAgo === 2 ? '그저께' : daysAgo <= 4 ? `${daysAgo}일 전` : '지난주';

                    notifications.push({
                        id: `memory-surface-${schedule.id || text.substring(0, 10)}-${todayStr}`,
                        type: 'memory_suggestion',
                        priority: 'low',
                        title: '💭 후속 확인',
                        message: `${dayLabel} "${schedule.text}" 일정이 있었죠. ${question}`,
                        actionType: 'memory_followup',
                        actionPayload: {
                            scheduleName: schedule.text,
                            scheduleDate: pastDateStr,
                            daysAgo,
                        },
                    });

                    // 한 일정에서 하나만 생성
                    break;
                }
            }
        }
    }

    // 최대 1개만
    return notifications.slice(0, LIMITS.MEMORY_SURFACE);
}

// ============================================================
// 패턴 기반 건너뛰기 감지 — "목요일 운동 자주 건너뛰시네요"
// ============================================================

/**
 * 반복 일정의 완료/건너뛰기 패턴을 분석하여 제안 생성
 * 최근 4주간 반복 일정의 요일별 완료율을 비교
 */
function getSkippedPatternSuggestions(context: UserContext): ProactiveNotification[] {
    const notifications: ProactiveNotification[] = [];
    const customGoals = context.allCustomGoals || [];
    const currentTime = context.currentTime;
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    // 아침/오전 시간대에만 표시 (6-11시)
    if (currentTime.getHours() < TIMING.SKIPPED_PATTERN_START || currentTime.getHours() > TIMING.SKIPPED_PATTERN_END) return notifications;

    // 반복 일정만 추출 (daysOfWeek가 있는 것)
    const recurringGoals = customGoals.filter((g) =>
        g.daysOfWeek && g.daysOfWeek.length > 0 && g.daysOfWeek.length <= THRESHOLDS.MAX_RECURRING_DAYS + 1
    );

    // 매일 하는 루틴은 제외
    const ROUTINE_KEYWORDS = DAILY_ROUTINE_KEYWORDS;

    // 일회성 일정들에서 완료/건너뛰기 이력 분석
    // specificDate가 있는 일정에서 같은 텍스트의 completed/skipped 패턴 확인
    const oneTimeGoals = customGoals.filter((g) => g.specificDate);

    // 4주 전 날짜
    const fourWeeksAgo = new Date(currentTime);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksAgoStr = `${fourWeeksAgo.getFullYear()}-${String(fourWeeksAgo.getMonth() + 1).padStart(2, '0')}-${String(fourWeeksAgo.getDate()).padStart(2, '0')}`;

    for (const goal of recurringGoals) {
        const activityLower = (goal.text || '').toLowerCase();
        if (ROUTINE_KEYWORDS.some(kw => activityLower.includes(kw))) continue;

        // 이 반복 일정이 오늘 요일에 해당하는지
        const todayDayOfWeek = currentTime.getDay();
        if (!goal.daysOfWeek?.includes(todayDayOfWeek)) continue;

        // 최근 4주간 같은 텍스트의 일회성 인스턴스 찾기
        const normalizedText = (goal.text || '').trim().toLowerCase();
        const recentInstances = oneTimeGoals.filter((g) => {
            if (!g.specificDate || g.specificDate < fourWeeksAgoStr) return false;
            if (g.specificDate >= todayStr) return false;
            const gDay = new Date(g.specificDate + 'T00:00:00').getDay();
            if (!goal.daysOfWeek?.includes(gDay)) return false;
            return (g.text || '').trim().toLowerCase() === normalizedText;
        });

        if (recentInstances.length < THRESHOLDS.MIN_PATTERN_DATA_POINTS) continue; // 데이터 부족

        const skippedCount = recentInstances.filter((g) => g.skipped === true || (!g.completed && !g.skipped)).length;
        const completedCount = recentInstances.filter((g) => g.completed === true).length;
        const total = recentInstances.length;
        const skipRate = skippedCount / total;

        // 50% 이상 건너뛰면 패턴 감지
        if (skipRate >= THRESHOLDS.PATTERN_SKIP_RATE && skippedCount >= 2) {
            const dayName = DAY_NAMES_KR[todayDayOfWeek];

            let message: string;
            let suggestion: string;

            if (skipRate >= THRESHOLDS.PATTERN_HIGH_SKIP_RATE) {
                message = `최근 4주간 ${dayName}요일 "${goal.text}" 일정을 ${skippedCount}/${total}회 건너뛰셨어요.`;
                suggestion = '다른 요일로 변경하거나, 시간을 조정해볼까요?';
            } else {
                message = `${dayName}요일 "${goal.text}" 일정 완료율이 ${Math.round((completedCount / total) * 100)}%예요.`;
                suggestion = '오늘은 꼭 해보시는 건 어떨까요?';
            }

            notifications.push({
                id: `skip-pattern-${normalizedText.replace(/\s/g, '')}-${todayDayOfWeek}-${todayStr}`,
                type: 'pattern_reminder',
                priority: 'medium',
                title: '📊 패턴 인사이트',
                message: `${message} ${suggestion}`,
                actionType: 'adjust_schedule',
                actionPayload: {
                    goalText: goal.text,
                    dayOfWeek: todayDayOfWeek,
                    skipRate: Math.round(skipRate * 100),
                    completedCount,
                    skippedCount,
                    total,
                },
            });
        }
    }

    // 최대 2개만 반환
    return notifications.slice(0, LIMITS.SKIPPED_SUGGESTIONS);
}

// ============================================================
// 신규 13가지 알림 생성 함수들
// ============================================================

/**
 * 1. 기분 체크인 리마인더
 * 기상 일정 직후 (없으면 오전 9시) ~ 22시, 오늘 기분 기록이 없으면 리마인드
 */
async function getMoodCheckInReminderNotification(context: UserContext): Promise<ProactiveNotification[]> {
    const { currentTime, userEmail, todaySchedules } = context;
    const currentHour = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();

    if (currentHour >= TIMING.MOOD_REMINDER_END) return [];

    // 기상 일정에서 시작 시간 추출
    const wakeSchedule = todaySchedules.find(s =>
        s.text === '기상' || s.text === 'wake' || s.text.includes('기상')
    );

    let moodStartHour: number = TIMING.MOOD_REMINDER_DEFAULT_HOUR;
    let moodStartMinute = 0;

    if (wakeSchedule?.startTime) {
        // startTime 형식: "HH:MM"
        const [h, m] = wakeSchedule.startTime.split(':').map(Number);
        if (!isNaN(h)) {
            moodStartHour = h;
            moodStartMinute = m || 0;
        }
    }

    // 현재 시간이 기상 시간 이전이면 아직 표시 안 함
    if (currentHour < moodStartHour || (currentHour === moodStartHour && currentMinutes < moodStartMinute)) {
        return [];
    }

    const monthKey = `mood_checkins_${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}`;
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    try {
        const moodData = await kvGet<any[]>(userEmail, monthKey);
        if (Array.isArray(moodData) && moodData.some(c => c.date === todayStr)) {
            return []; // 오늘 이미 기록함
        }
    } catch {
        return [];
    }

    return [{
        id: `mood-reminder-${todayStr}`,
        type: 'mood_reminder',
        priority: 'low',
        title: '😊 오늘 기분은 어떠세요?',
        message: '오늘 아직 기분을 기록하지 않으셨어요. 잠깐 체크인 해볼까요?',
        actionType: 'open_mood_checkin',
    }];
}

/**
 * 2. 번아웃 경고 (Pro+ 전용)
 * 최근 3일간 기분≤2, 에너지≤2 → 번아웃 위험
 */
async function getBurnoutWarningNotification(context: UserContext): Promise<ProactiveNotification[]> {
    const { currentTime, userEmail, planType } = context;
    const currentHour = currentTime.getHours();
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    // 오전에만 표시
    if (currentHour < TIMING.MORNING_START || currentHour >= TIMING.MORNING_END) return [];

    // Pro+ 전용
    const isPro = planType ? (planType === 'pro' || planType === 'max') : await isProOrAbove(userEmail);
    if (!isPro) return [];

    try {
        const monthKey = `mood_checkins_${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}`;
        const moodData = await kvGet<any[]>(userEmail, monthKey);
        if (!Array.isArray(moodData) || moodData.length === 0) return [];

        // 이전 달 데이터도 필요할 수 있음
        const lookbackDate = new Date(currentTime);
        lookbackDate.setDate(lookbackDate.getDate() - THRESHOLDS.BURNOUT_LOOKBACK_DAYS);
        const lookbackStr = `${lookbackDate.getFullYear()}-${String(lookbackDate.getMonth() + 1).padStart(2, '0')}-${String(lookbackDate.getDate()).padStart(2, '0')}`;

        let allCheckins = [...moodData];
        // 이전 달 데이터 병합 (월 경계 처리)
        if (lookbackDate.getMonth() !== currentTime.getMonth()) {
            const prevMonthKey = `mood_checkins_${lookbackDate.getFullYear()}-${String(lookbackDate.getMonth() + 1).padStart(2, '0')}`;
            const prevData = await kvGet<any[]>(userEmail, prevMonthKey);
            if (Array.isArray(prevData)) allCheckins = [...prevData, ...allCheckins];
        }

        const recentCheckins = allCheckins.filter(c => c.date >= lookbackStr && c.date <= todayStr);
        if (recentCheckins.length < 2) return []; // 데이터 부족

        const avgMood = recentCheckins.reduce((s, c) => s + (c.mood || 3), 0) / recentCheckins.length;
        const avgEnergy = recentCheckins.reduce((s, c) => s + (c.energy || 3), 0) / recentCheckins.length;

        if (avgMood <= THRESHOLDS.BURNOUT_MOOD && avgEnergy <= THRESHOLDS.BURNOUT_ENERGY) {
            return [{
                id: `burnout-warning-${todayStr}`,
                type: 'burnout_warning',
                priority: 'high',
                title: '🔴 번아웃 위험 감지',
                message: `최근 ${THRESHOLDS.BURNOUT_LOOKBACK_DAYS}일간 기분과 에너지가 낮은 상태예요. 충분한 휴식이 필요할 수 있어요. 오늘은 일정을 줄이고 자기 돌봄에 집중해보세요.`,
                actionType: 'view_mood_patterns',
            }];
        }
    } catch {
        // 에러 시 조용히 무시
    }

    return [];
}

/**
 * 3. 집중 스트릭 축하/격려
 * 3/5/7/14/30일 연속 달성 축하 또는 2일+ 미사용 시 격려
 */
async function getFocusStreakNotification(context: UserContext): Promise<ProactiveNotification[]> {
    const { currentTime, userEmail } = context;
    const currentHour = currentTime.getHours();
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    // 오전에만
    if (currentHour < TIMING.MORNING_START || currentHour >= TIMING.MORNING_END) return [];

    try {
        // 최근 30일 집중 세션 데이터 수집
        const focusDates = new Set<string>();
        const now = currentTime;
        const months = new Set<string>();
        for (let i = 0; i < 31; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            months.add(`focus_sessions_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        for (const monthKey of months) {
            const sessions = await kvGet<any[]>(userEmail, monthKey);
            if (Array.isArray(sessions)) {
                sessions.forEach(s => { if (s.date) focusDates.add(s.date); });
            }
        }

        if (focusDates.size === 0) return [];

        // 스트릭 계산 (어제부터 역순)
        let streak = 0;
        const checkDate = new Date(currentTime);
        // 오늘 집중했으면 오늘부터, 아니면 어제부터
        if (focusDates.has(todayStr)) {
            for (let i = 0; i < 60; i++) {
                const d = new Date(checkDate);
                d.setDate(d.getDate() - i);
                const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if (focusDates.has(ds)) streak++;
                else break;
            }
        } else {
            // 어제부터 계산
            for (let i = 1; i < 60; i++) {
                const d = new Date(checkDate);
                d.setDate(d.getDate() - i);
                const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if (focusDates.has(ds)) streak++;
                else break;
            }
        }

        // 마일스톤 달성 축하
        const milestones = THRESHOLDS.FOCUS_STREAK_MILESTONES as readonly number[];
        if (milestones.includes(streak)) {
            return [{
                id: `focus-streak-${streak}-${todayStr}`,
                type: 'focus_streak',
                priority: 'medium',
                title: '🔥 집중 스트릭 달성!',
                message: `${streak}일 연속 집중 모드를 사용하셨어요! 대단해요! 오늘도 이어가볼까요?`,
                actionType: 'start_focus',
                actionPayload: { streak },
            }];
        }

        // 2일+ 미사용 시 격려
        if (!focusDates.has(todayStr)) {
            let daysSinceLast = 0;
            for (let i = 1; i <= 30; i++) {
                const d = new Date(checkDate);
                d.setDate(d.getDate() - i);
                const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if (focusDates.has(ds)) { daysSinceLast = i; break; }
            }

            if (daysSinceLast >= THRESHOLDS.FOCUS_INACTIVE_DAYS) {
                return [{
                    id: `focus-encourage-${todayStr}`,
                    type: 'focus_streak',
                    priority: 'low',
                    title: '⏱️ 집중 모드가 그리워요',
                    message: `${daysSinceLast}일째 집중 모드를 사용하지 않으셨어요. 짧은 25분 세션으로 다시 시작해볼까요?`,
                    actionType: 'start_focus',
                    actionPayload: { daysSinceLast },
                }];
            }
        }
    } catch {
        // 에러 시 조용히 무시
    }

    return [];
}

/**
 * 4. 건강 데이터 인사이트 알림 (Pro+ 전용)
 * 수면 < 6시간 2일 연속 등
 */
async function getHealthInsightNotification(context: UserContext): Promise<ProactiveNotification[]> {
    const { currentTime, userEmail, planType } = context;
    const currentHour = currentTime.getHours();
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    // 오전에만
    if (currentHour < TIMING.MORNING_START || currentHour >= TIMING.MORNING_END) return [];

    // Pro+ 전용
    const isPro = planType ? (planType === 'pro' || planType === 'max') : await isProOrAbove(userEmail);
    if (!isPro) return [];

    try {
        // 최근 3일 건강 데이터 조회
        let lowSleepDays = 0;
        for (let i = 1; i <= THRESHOLDS.HEALTH_LOW_SLEEP_CONSECUTIVE + 1; i++) {
            const d = new Date(currentTime);
            d.setDate(d.getDate() - i);
            const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const healthData = await kvGet<any>(userEmail, `health_data_${ds}`);
            if (healthData?.sleepHours && healthData.sleepHours < THRESHOLDS.HEALTH_LOW_SLEEP_HOURS) {
                lowSleepDays++;
            }
        }

        if (lowSleepDays >= THRESHOLDS.HEALTH_LOW_SLEEP_CONSECUTIVE) {
            return [{
                id: `health-sleep-${todayStr}`,
                type: 'health_insight',
                priority: 'high',
                title: '😴 수면 부족 감지',
                message: `최근 ${lowSleepDays}일 연속 수면이 ${THRESHOLDS.HEALTH_LOW_SLEEP_HOURS}시간 미만이에요. 충분한 수면은 생산성의 기본이에요. 오늘은 일찍 쉬어보세요.`,
                actionType: 'view_health_data',
            }];
        }
    } catch {
        // 건강 데이터 연동 안 된 경우 무시
    }

    return [];
}

/**
 * 5. GitHub 커밋 스트릭 위험 (Max 전용)
 * 오후 8시+, 오늘 커밋 없음 → 스트릭 끊김 경고
 */
async function getGitHubStreakNotification(context: UserContext): Promise<ProactiveNotification[]> {
    const { currentTime, userEmail, planType } = context;
    const currentHour = currentTime.getHours();
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    if (currentHour < TIMING.GITHUB_STREAK_START || currentHour >= TIMING.GITHUB_STREAK_END) return [];

    // Pro 이상 전용
    const isPro = planType ? (planType === 'pro' || planType === 'max') : await isProOrAbove(userEmail);
    if (!isPro) return [];

    try {
        const { isGitHubLinked, getContributionStats } = await import('@/lib/githubService');
        if (!(await isGitHubLinked(userEmail))) return [];

        const stats = await getContributionStats(userEmail);
        if (!stats || stats.currentStreak === 0) return [];

        // 오늘 커밋이 없고 현재 스트릭이 있으면 경고
        const { getRecentCommits } = await import('@/lib/githubService');
        const recentCommits = await getRecentCommits(userEmail, 5);
        const hasTodayCommit = recentCommits.some(c => c.date?.startsWith(todayStr));

        if (!hasTodayCommit && stats.currentStreak >= 2) {
            return [{
                id: `github-streak-${todayStr}`,
                type: 'github_streak',
                priority: 'medium',
                title: '🟢 GitHub 스트릭 위험!',
                message: `${stats.currentStreak}일 연속 커밋 중인데, 오늘 아직 커밋이 없어요. 스트릭을 이어가세요!`,
                actionType: 'view_github_activity',
                actionPayload: { currentStreak: stats.currentStreak },
            }];
        }
    } catch {
        // GitHub 연동 안 된 경우 무시
    }

    return [];
}

/**
 * 6. 일정 과밀 경고
 * 내일 일정 6개+ 또는 빈 시간 < 2시간
 */
function getScheduleOverloadNotification(context: UserContext): ProactiveNotification[] {
    const { currentTime, allCustomGoals, userProfile } = context;
    const currentHour = currentTime.getHours();

    // 저녁에만 (내일 일정 확인)
    if (currentHour < TIMING.EVENING_START || currentHour >= TIMING.EVENING_END) return [];

    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    const tomorrowDayOfWeek = tomorrow.getDay();

    const customGoals = allCustomGoals || [];
    const tomorrowSchedules = customGoals.filter((goal: CustomGoal) => {
        if (goal.specificDate === tomorrowStr) return true;
        if (goal.daysOfWeek?.includes(tomorrowDayOfWeek) && !goal.specificDate) return true;
        return false;
    });

    if (tomorrowSchedules.length >= THRESHOLDS.SCHEDULE_OVERLOAD_COUNT) {
        return [{
            id: `overload-${tomorrowStr}`,
            type: 'schedule_overload',
            priority: 'medium',
            title: '📋 내일 일정이 빡빡해요',
            message: `내일 일정이 ${tomorrowSchedules.length}개 예정되어 있어요. 우선순위를 정리하거나 일부를 미루는 것을 고려해보세요.`,
            actionType: 'view_tomorrow_schedule',
            actionPayload: { date: tomorrowStr, count: tomorrowSchedules.length },
        }];
    }

    // 빈 시간 계산 (startTime/endTime이 있는 일정만)
    const timedSchedules = tomorrowSchedules.filter((s: CustomGoal) => s.startTime && s.endTime);
    if (timedSchedules.length >= 4) {
        let totalScheduledMinutes = 0;
        timedSchedules.forEach((s: CustomGoal) => {
            const [sh, sm] = (s.startTime || '09:00').split(':').map(Number);
            const [eh, em] = (s.endTime || '10:00').split(':').map(Number);
            totalScheduledMinutes += (eh * 60 + em) - (sh * 60 + sm);
        });

        const wakeHours = 14; // 대략적 활동 시간
        const freeHours = wakeHours - (totalScheduledMinutes / 60);

        if (freeHours < THRESHOLDS.SCHEDULE_MIN_FREE_HOURS) {
            return [{
                id: `overload-free-${tomorrowStr}`,
                type: 'schedule_overload',
                priority: 'high',
                title: '⚠️ 내일 여유 시간 부족',
                message: `내일 빈 시간이 약 ${Math.round(freeHours)}시간밖에 없어요. 일정을 조정하거나 충분한 휴식 시간을 확보하세요.`,
                actionType: 'view_tomorrow_schedule',
                actionPayload: { date: tomorrowStr, freeHours: Math.round(freeHours) },
            }];
        }
    }

    return [];
}

/**
 * 7. 주간 목표 마감 임박
 * 금요일 + 진행률 < 50%
 */
function getWeeklyGoalDeadlineNotification(context: UserContext): ProactiveNotification[] {
    const { currentTime, userProfile } = context;
    const dayOfWeek = currentTime.getDay();
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    // 금요일만 (5 = Friday)
    if (dayOfWeek !== 5) return [];
    // 오전에만
    if (currentTime.getHours() < TIMING.MORNING_START || currentTime.getHours() >= TIMING.MORNING_END) return [];

    const longTermGoals = userProfile?.longTermGoals || {};
    const weeklyGoals = (longTermGoals.weekly || []) as LongTermGoal[];
    const activeWeekly = weeklyGoals.filter(g => !g.completed);

    if (activeWeekly.length === 0) return [];

    const lowProgressGoals = activeWeekly.filter(g => (g.progress || 0) < THRESHOLDS.WEEKLY_GOAL_LOW_PROGRESS);

    if (lowProgressGoals.length > 0) {
        const goalNames = lowProgressGoals.slice(0, 2).map(g => `"${g.title}"`).join(', ');
        const avgProgress = Math.round(lowProgressGoals.reduce((s, g) => s + (g.progress || 0), 0) / lowProgressGoals.length);

        return [{
            id: `weekly-deadline-${todayStr}`,
            type: 'weekly_goal_deadline',
            priority: 'high',
            title: '🎯 주간 목표 마감 임박',
            message: `이번 주가 곧 끝나는데, ${goalNames} 목표가 아직 ${avgProgress}% 진행이에요. 주말 전에 집중해볼까요?`,
            actionType: 'view_weekly_goals',
            actionPayload: { goals: lowProgressGoals.map(g => ({ title: g.title, progress: g.progress })) },
        }];
    }

    return [];
}

/**
 * 8. 루틴 깨짐 감지
 * 이번 주 완료율 < 40% (평소 70%+)
 */
function getRoutineBreakNotification(context: UserContext): ProactiveNotification[] {
    const { currentTime, allCustomGoals } = context;
    const dayOfWeek = currentTime.getDay();
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    // 수요일 이후에만 (주 중반부터 패턴 감지 의미 있음)
    if (dayOfWeek < 3) return [];
    // 오전에만
    if (currentTime.getHours() < TIMING.MORNING_START || currentTime.getHours() >= TIMING.MORNING_END) return [];

    const customGoals = allCustomGoals || [];

    // 이번 주 월요일 계산
    const monday = new Date(currentTime);
    monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
    const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;

    // 이번 주 일회성 일정 (specificDate 기반)
    const thisWeekGoals = customGoals.filter((g: CustomGoal) =>
        g.specificDate && g.specificDate >= mondayStr && g.specificDate <= todayStr
    );

    if (thisWeekGoals.length < 5) return []; // 데이터 부족

    const completedCount = thisWeekGoals.filter((g: CustomGoal) => g.completed).length;
    const currentRate = completedCount / thisWeekGoals.length;

    // 지난 2주간 완료율 계산
    const twoWeeksAgo = new Date(monday);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoStr = `${twoWeeksAgo.getFullYear()}-${String(twoWeeksAgo.getMonth() + 1).padStart(2, '0')}-${String(twoWeeksAgo.getDate()).padStart(2, '0')}`;

    const prevWeeksGoals = customGoals.filter((g: CustomGoal) =>
        g.specificDate && g.specificDate >= twoWeeksAgoStr && g.specificDate < mondayStr
    );

    if (prevWeeksGoals.length < 5) return []; // 과거 데이터 부족

    const prevCompleted = prevWeeksGoals.filter((g: CustomGoal) => g.completed).length;
    const usualRate = prevCompleted / prevWeeksGoals.length;

    if (currentRate < THRESHOLDS.ROUTINE_BREAK_CURRENT && usualRate >= THRESHOLDS.ROUTINE_BREAK_USUAL) {
        return [{
            id: `routine-break-${todayStr}`,
            type: 'routine_break',
            priority: 'medium',
            title: '📉 루틴이 흔들리고 있어요',
            message: `이번 주 일정 완료율이 ${Math.round(currentRate * 100)}%로 평소(${Math.round(usualRate * 100)}%)보다 많이 낮아요. 무리하고 계신 건 아닌지, 일정을 조정해볼까요?`,
            actionType: 'view_weekly_stats',
            actionPayload: { currentRate: Math.round(currentRate * 100), usualRate: Math.round(usualRate * 100) },
        }];
    }

    return [];
}

/**
 * 9. 장기 비활성 복귀 유도
 * 3일+ 미접속
 */
async function getInactiveReturnNotification(context: UserContext): Promise<ProactiveNotification[]> {
    const { currentTime, userEmail } = context;
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    try {
        // user_states에서 마지막 활동 시간 조회
        const { data: state } = await supabaseAdmin
            .from('user_states')
            .select('state_updated_at')
            .eq('user_email', userEmail)
            .maybeSingle();

        if (!state?.state_updated_at) return [];

        const lastActive = new Date(state.state_updated_at);
        const daysSinceActive = Math.floor((currentTime.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceActive >= THRESHOLDS.INACTIVE_DAYS) {
            return [{
                id: `inactive-return-${todayStr}`,
                type: 'inactive_return',
                priority: 'medium',
                title: '👋 다시 돌아오셨군요!',
                message: `${daysSinceActive}일 만이에요! 그동안 밀린 일정을 정리하고, 이번 주 목표를 다시 세워볼까요?`,
                actionType: 'open_dashboard',
                actionPayload: { daysSinceActive },
            }];
        }
    } catch {
        // 무시
    }

    return [];
}

/**
 * 10. 학습 리마인더
 * 3일+ 학습 목표 진도 없음
 */
function getLearningReminderNotification(context: UserContext): ProactiveNotification[] {
    const { currentTime, userProfile } = context;
    const currentHour = currentTime.getHours();
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    // 오후에만
    if (currentHour < 14 || currentHour >= 20) return [];

    const longTermGoals = userProfile?.longTermGoals || {};
    const allGoals = [
        ...(longTermGoals.weekly || []),
        ...(longTermGoals.monthly || []),
    ] as LongTermGoal[];

    // 학습 관련 목표 필터
    const learningKeywords = ['학습', '공부', '독서', '강의', '코딩', '영어', '자격증', '수업', 'study', 'learn', 'read'];
    const learningGoals = allGoals.filter(g =>
        !g.completed &&
        learningKeywords.some(kw => (g.title || '').toLowerCase().includes(kw))
    );

    if (learningGoals.length === 0) return [];

    // 진행률이 낮은 학습 목표
    const staleGoals = learningGoals.filter(g => (g.progress || 0) < 30);

    if (staleGoals.length > 0) {
        const goal = staleGoals[0];
        return [{
            id: `learning-reminder-${todayStr}`,
            type: 'learning_reminder',
            priority: 'low',
            title: '📚 학습 목표를 잊지 마세요',
            message: `"${goal.title}" 목표가 ${goal.progress || 0}%에서 멈춰 있어요. 오늘 10분만 투자해볼까요?`,
            actionType: 'view_learning_goal',
            actionPayload: { goalTitle: goal.title, progress: goal.progress },
        }];
    }

    return [];
}

/**
 * 11. 점심 후 에너지 부스트
 * 13-14시, 에너지 낮음
 */
async function getPostLunchBoostNotification(context: UserContext): Promise<ProactiveNotification[]> {
    const { currentTime, userEmail } = context;
    const currentHour = currentTime.getHours();
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    if (currentHour < TIMING.ENERGY_BOOST_START || currentHour >= TIMING.ENERGY_BOOST_END) return [];

    try {
        // user_states에서 현재 에너지 레벨 조회
        const { data: state } = await supabaseAdmin
            .from('user_states')
            .select('energy_level')
            .eq('user_email', userEmail)
            .maybeSingle();

        // 에너지 레벨이 40 이하 (1-5 스케일에서 2에 해당)
        if (state?.energy_level && state.energy_level <= 40) {
            return [{
                id: `energy-boost-${todayStr}`,
                type: 'energy_boost',
                priority: 'low',
                title: '☕ 에너지 충전 시간!',
                message: '점심 후 에너지가 낮아진 것 같아요. 5분 스트레칭이나 짧은 산책으로 리프레시 해보세요!',
                actionType: 'suggest_break',
            }];
        }
    } catch {
        // 무시
    }

    return [];
}

/**
 * 12. 퇴근 전 하루 마감
 * 17-18시, 미완료 일정 정리
 */
function getPreDepartureWrapNotification(context: UserContext): ProactiveNotification[] {
    const { currentTime, todaySchedules } = context;
    const currentHour = currentTime.getHours();
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    if (currentHour < TIMING.DAILY_WRAP_START || currentHour >= TIMING.DAILY_WRAP_END) return [];

    // 오늘 일정 중 미완료 항목
    const incompleteSchedules = todaySchedules.filter((s: CustomGoal) => !s.completed && !s.skipped);

    if (incompleteSchedules.length === 0) return [];

    // 시간이 지난 일정만 (현재 시간 이전 startTime)
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`;
    const pastIncomplete = incompleteSchedules.filter((s: CustomGoal) =>
        s.startTime && s.startTime < currentTimeStr
    );

    if (pastIncomplete.length > 0) {
        return [{
            id: `daily-wrap-${todayStr}`,
            type: 'daily_wrap',
            priority: 'medium',
            title: '📝 하루 마감 정리',
            message: `오늘 아직 완료하지 못한 일정이 ${pastIncomplete.length}개 있어요. 완료 체크하거나 내일로 미룰까요?`,
            actionType: 'view_incomplete_today',
            actionPayload: { count: pastIncomplete.length },
        }];
    }

    return [];
}

/**
 * 13. 주간 회고 유도 (Pro+ 전용)
 * 일요일 저녁 19-21시
 */
async function getWeeklyReviewNotification(context: UserContext): Promise<ProactiveNotification[]> {
    const { currentTime, userEmail, userProfile, planType } = context;
    const dayOfWeek = currentTime.getDay();
    const currentHour = currentTime.getHours();
    const todayStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;

    // 일요일만 (0 = Sunday)
    if (dayOfWeek !== 0) return [];
    if (currentHour < TIMING.WEEKLY_REVIEW_START || currentHour >= TIMING.WEEKLY_REVIEW_END) return [];

    // Pro+ 전용
    const isPro = planType ? (planType === 'pro' || planType === 'max') : await isProOrAbove(userEmail);
    if (!isPro) return [];

    const longTermGoals = userProfile?.longTermGoals || {};
    const weeklyGoals = (longTermGoals.weekly || []) as LongTermGoal[];
    const activeWeekly = weeklyGoals.filter(g => !g.completed);
    const avgProgress = activeWeekly.length > 0
        ? Math.round(activeWeekly.reduce((s, g) => s + (g.progress || 0), 0) / activeWeekly.length)
        : 0;

    return [{
        id: `weekly-review-${todayStr}`,
        type: 'weekly_review',
        priority: 'medium',
        title: '📊 한 주를 돌아보세요',
        message: activeWeekly.length > 0
            ? `이번 주 목표 평균 진행률은 ${avgProgress}%예요. 잠시 시간을 내어 한 주를 돌아보고, 다음 주를 계획해보세요.`
            : '이번 한 주 어떠셨나요? 잠시 시간을 내어 돌아보고, 다음 주 목표를 세워보세요.',
        actionType: 'open_weekly_review',
        actionPayload: { avgProgress, activeGoalCount: activeWeekly.length },
    }];
}

/**
 * DB에 알림 저장 (jarvis_notifications 테이블 사용)
 */
export async function saveProactiveNotification(
    userEmail: string,
    notification: ProactiveNotification
): Promise<boolean> {
    try {
        // 중복 방지: 같은 notification_ref_id가 오늘 이미 저장되어 있으면 스킵
        const now = new Date();
        const todayStart = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        todayStart.setHours(0, 0, 0, 0);
        // KST → UTC로 변환 (KST는 UTC+9)
        const todayStartUTC = new Date(todayStart.getTime() - 9 * 60 * 60 * 1000);

        const { data: existing } = await supabaseAdmin
            .from('jarvis_notifications')
            .select('id')
            .eq('user_email', userEmail)
            .gte('created_at', todayStartUTC.toISOString())
            .contains('action_payload', { notification_ref_id: notification.id })
            .limit(1);

        if (existing && existing.length > 0) {
            return true; // 이미 저장됨
        }

        const { error } = await supabaseAdmin
            .from('jarvis_notifications')
            .insert({
                user_email: userEmail,
                type: notification.type,
                message: `**${notification.title}**\n\n${notification.message}`,
                action_type: notification.actionType,
                action_payload: {
                    ...notification.actionPayload,
                    notification_ref_id: notification.id,
                },
                created_at: now.toISOString()
            });

        if (error) {
            logger.error('[ProactiveNotification] Failed to save:', error);
            return false;
        }

        return true;
    } catch (error) {
        logger.error('[ProactiveNotification] Exception:', error);
        return false;
    }
}

/**
 * 사용자 컨텍스트 수집
 */
export async function getUserContext(userEmail: string): Promise<UserContext | null> {
    try {
        // KST 기준으로 현재 시간 계산
        const now = new Date();
        const kstTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const todayStr = `${kstTime.getFullYear()}-${String(kstTime.getMonth() + 1).padStart(2, '0')}-${String(kstTime.getDate()).padStart(2, '0')}`;
        const dayOfWeek = kstTime.getDay();


        // 사용자 프로필 가져오기
        const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('id, profile')
            .eq('email', userEmail)
            .maybeSingle();

        if (userError || !userData) {
            logger.error('[ProactiveNotification] User not found:', userError);
            return null;
        }

        const profile = userData.profile || {};
        const customGoals = profile.customGoals || [];


        // 오늘 일정 필터링
        const todaySchedules = customGoals.filter((goal: CustomGoal) => {
            if (goal.specificDate === todayStr) return true;
            if (goal.daysOfWeek?.includes(dayOfWeek)) {
                if (goal.startDate && todayStr < goal.startDate) return false;
                if (goal.endDate && todayStr > goal.endDate) return false;
                return true;
            }
            return false;
        });


        // 어제 날짜 계산 (KST)
        const yesterday = new Date(kstTime);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        const yesterdayDayOfWeek = yesterday.getDay();


        // 어제 일정이었던 customGoals 중 미완료 항목 찾기
        const uncompletedGoals = customGoals.filter((goal: CustomGoal) => {
            // 어제 일정이었는지 확인
            const wasScheduledYesterday =
                goal.specificDate === yesterdayStr ||
                (goal.daysOfWeek?.includes(yesterdayDayOfWeek) && !goal.specificDate);

            if (!wasScheduledYesterday) return false;

            // 완료되지 않은 항목만
            // completed 필드가 없거나 false인 경우 미완료로 간주
            const isCompleted = goal.completed === true;


            return !isCompleted;
        });


        // 메모리 데이터 가져오기 (user_memory 테이블은 user_id UUID 기반)
        let userMemory = null;
        try {
            const { data: memoryRows } = await supabaseAdmin
                .from('user_memory')
                .select('content_type, content, metadata')
                .eq('user_id', userData.id)
                .order('created_at', { ascending: false })
                .limit(LIMITS.MEMORY_QUERY);

            if (memoryRows && memoryRows.length > 0) {
                // 메모리 행들을 구조화된 형태로 변환
                const preferences: Record<string, unknown> = {};
                const patterns: Record<string, unknown> = {};
                for (const row of memoryRows) {
                    if (row.content_type === 'pattern') {
                        patterns[row.metadata?.key || 'unknown'] = row.content;
                    } else {
                        preferences[row.content_type] = row.content;
                    }
                }
                userMemory = { preferences, patterns };
            }
        } catch (memoryError) {
            logger.error('[ProactiveNotif] Memory data fetch failed:', memoryError instanceof Error ? memoryError.message : memoryError);
        }

        // 반복 패턴 감지
        const recurringPatterns = detectRecurringPatterns(customGoals);

        return {
            userEmail,
            currentTime: kstTime,
            todaySchedules,
            uncompletedGoals,
            userProfile: profile,
            userMemory: userMemory || undefined,
            recurringPatterns,
            allCustomGoals: customGoals,
        };
    } catch (error) {
        logger.error('[ProactiveNotification] Failed to get user context:', error);
        return null;
    }
}

/**
 * 24. 트렌드 브리핑 미독 추천 알림
 * 10시, 14시, 18시에 오늘 읽지 않은 브리핑 중 하나를 추천
 */
async function getTrendBriefingReminderNotification(context: UserContext): Promise<ProactiveNotification[]> {
    const { currentTime, userEmail } = context;
    const hour = currentTime.getHours();

    // 10시, 14시, 18시에만 알림
    if (hour !== 10 && hour !== 14 && hour !== 18) return [];

    const today = currentTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    // trends_cache에서 오늘 브리핑 조회
    const { data, error } = await supabaseAdmin
        .from('trends_cache')
        .select('trends')
        .eq('email', userEmail)
        .eq('date', today)
        .maybeSingle();

    if (error || !data?.trends || !Array.isArray(data.trends) || data.trends.length === 0) return [];

    const allTrends = data.trends as Array<{ id: string; title: string; category?: string }>;

    // 읽은 브리핑 ID 조회
    const readIds = await kvGet<string[]>(userEmail, `read_trend_ids_${today}`) || [];

    // 읽지 않은 브리핑만 필터
    const unread = allTrends.filter(t => !readIds.includes(t.id));
    if (unread.length === 0) return [];

    // 시간대별 다른 브리핑 추천 (안 읽은 것 중에서 돌아가며)
    const slotIndex = hour === 10 ? 0 : hour === 14 ? 1 : 2;
    const pick = unread[slotIndex % unread.length];

    return [{
        id: `trend-reminder-${today}-${hour}`,
        type: 'context_suggestion',
        priority: 'low',
        title: '📰 트렌드 브리핑 추천',
        message: `"${pick.title}" — 잠깐 읽어보시겠어요?`,
        actionType: 'open_trend_briefing',
        actionPayload: { briefingId: pick.id, title: pick.title },
    }];
}
