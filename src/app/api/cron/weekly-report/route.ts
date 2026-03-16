import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyReport, generateWeeklyReportNarrative, type WeeklyReportData } from "@/lib/weeklyReportGenerator";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { withCron } from "@/lib/api-handler";
import { withCronLogging } from '@/lib/cron-logger';
import { logger } from "@/lib/logger";
import { saveProactiveNotification } from "@/lib/proactiveNotificationService";
import { sendPushNotification } from "@/lib/pushService";
import { appendChatMessage } from "@/lib/chatHistoryService";

/**
 * Weekly Report Cron Job
 *
 * Vercel Cron: 매주 일요일 저녁 9시 KST 실행 (UTC 12시)
 */

export const GET = withCron(withCronLogging('weekly-report', async (_request: NextRequest) => {
    // Get all users (paginated to avoid memory issues)
    const BATCH_SIZE = 50;
    let offset = 0;
    let allUsers: { email: string; profile: any }[] = [];

    while (true) {
        const { data: batch, error } = await supabaseAdmin
            .from('users')
            .select('email, profile')
            .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
            logger.error('[Cron Weekly Report] Failed to fetch users:', error);
            return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
        }
        if (!batch || batch.length === 0) break;
        allUsers = allUsers.concat(batch);
        if (batch.length < BATCH_SIZE) break;
        offset += BATCH_SIZE;
    }

    const results: any[] = [];
    let successCount = 0;
    let errorCount = 0;

    // Process users in parallel batches of 5
    const CONCURRENCY = 5;
    for (let i = 0; i < allUsers.length; i += CONCURRENCY) {
        const batch = allUsers.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
            batch.map(async (user) => {
                const reportData = await generateWeeklyReport(user.email);
                const targetWeekNumber = reportData.period.weekNumber;

                // 해당 주차의 리포트가 이미 존재하는지 확인
                const { data: existingReport } = await supabaseAdmin
                    .from('user_events')
                    .select('id')
                    .eq('user_email', user.email)
                    .eq('event_type', 'weekly_report_generated')
                    .eq('metadata->>week_number', targetWeekNumber.toString())
                    .limit(1)
                    .maybeSingle();

                if (existingReport) {
                    return { email: user.email, success: true, week: targetWeekNumber, skipped: true };
                }

                const narrative = await generateWeeklyReportNarrative(reportData, user.profile || {});

                await supabaseAdmin.from('user_events').insert({
                    id: `weekly-report-${user.email}-week${targetWeekNumber}-${Date.now()}`,
                    user_email: user.email,
                    event_type: 'weekly_report_generated',
                    start_at: new Date().toISOString(),
                    metadata: {
                        week_number: targetWeekNumber,
                        period_start: reportData.period.start,
                        period_end: reportData.period.end,
                        completion_rate: reportData.scheduleAnalysis.completionRate,
                        total_read: reportData.trendBriefingAnalysis.totalRead,
                        narrative,
                        report_data: reportData,
                    },
                });

                // 채팅 메시지로 주간 리포트 전체 내용 전송
                const chatMessage = formatWeeklyReportChat(reportData, narrative, user.profile);

                const notification = {
                    id: `weekly-card-news-${targetWeekNumber}`,
                    type: 'weekly_review' as const,
                    priority: 'medium' as const,
                    title: '📊 주간 리포트',
                    message: chatMessage,
                };

                await saveProactiveNotification(user.email, notification);

                const rate = reportData.scheduleAnalysis.completionRate;
                await sendPushNotification(user.email, {
                    title: notification.title,
                    body: `${targetWeekNumber}주차 주간 리포트가 도착했어요! 완료율 ${rate}%`,
                    data: {
                        notificationId: notification.id,
                        type: notification.type,
                        deepLink: 'fieri://chat',
                    },
                }).catch(() => {});

                // 채팅 히스토리에 전체 리포트 저장
                appendChatMessage(user.email, {
                    id: `weekly-report-chat-${targetWeekNumber}-${Date.now()}`,
                    role: 'assistant',
                    content: chatMessage,
                    timestamp: new Date().toISOString(),
                    type: 'proactive',
                }).catch(() => {});

                return { email: user.email, success: true, week: targetWeekNumber, skipped: false };
            })
        );

        for (const result of batchResults) {
            if (result.status === 'fulfilled') {
                results.push(result.value);
                successCount++;
            } else {
                const email = batch[batchResults.indexOf(result)]?.email || 'unknown';
                logger.error(`[Cron Weekly Report] Failed for ${email}:`, result.reason);
                results.push({ email, success: false, error: result.reason?.message });
                errorCount++;
            }
        }
    }

    return NextResponse.json({
        success: true,
        summary: {
            total: allUsers.length,
            success: successCount,
            errors: errorCount,
        },
        results,
    });
}));

// POST도 지원 (Vercel Cron)
export const POST = withCron(async (request: NextRequest) => {
    return GET(request);
});

/**
 * 주간 리포트를 채팅 메시지 형식으로 포맷
 */
function formatWeeklyReportChat(
    report: WeeklyReportData,
    narrative: string | null,
    profile: any,
): string {
    const userName = profile?.name || '사용자';
    const { scheduleAnalysis: sa, focusAnalysis: fa, sleepAnalysis: sl, growthMetrics: gm, comparisonWithLastWeek: cmp, insights } = report;

    const parts: string[] = [];

    // 헤더
    const periodStart = report.period.start.slice(5).replace('-', '/');
    const periodEnd = report.period.end.slice(5).replace('-', '/');
    parts.push(`📊 ${userName}님의 ${report.period.weekNumber}주차 주간 리포트\n${periodStart} ~ ${periodEnd}`);

    // AI 코멘트
    if (narrative) {
        parts.push(narrative);
    }

    // 일정 성과
    const rateEmoji = sa.completionRate >= 80 ? '🎉' : sa.completionRate >= 50 ? '💪' : '📈';
    let scheduleSection = `━━━ ${rateEmoji} 일정 성과 ━━━\n`;
    scheduleSection += `완료율: ${sa.completionRate}% (${sa.completedSchedules}/${sa.totalSchedules}개)`;
    if (cmp.completionRateChange !== 0) {
        const arrow = cmp.completionRateChange > 0 ? '↑' : '↓';
        scheduleSection += ` ${arrow}${Math.abs(cmp.completionRateChange)}%`;
    }
    scheduleSection += `\n최고 요일: ${sa.mostProductiveDay} | 일평균: ${sa.avgSchedulesPerDay}개`;
    parts.push(scheduleSection);

    // 카테고리 밸런스
    const cats = sa.categoryBreakdown;
    const totalCat = Object.values(cats).reduce((a, b) => a + b, 0);
    if (totalCat > 0) {
        const catEntries = [
            { name: '업무', count: cats.work, bar: '🔵' },
            { name: '학습', count: cats.learning, bar: '🟣' },
            { name: '운동', count: cats.exercise, bar: '🔴' },
            { name: '웰빙', count: cats.wellness, bar: '🟢' },
            { name: '사교', count: cats.social, bar: '🟡' },
            { name: '취미', count: cats.hobby, bar: '🟠' },
            { name: '생활', count: cats.routine, bar: '🔘' },
            { name: '재정', count: cats.finance, bar: '💰' },
            { name: '기타', count: cats.other, bar: '⚪' },
        ].filter(c => c.count > 0);

        let catSection = '━━━ ⚖️ 활동 밸런스 ━━━\n';
        catSection += catEntries
            .map(c => {
                const pct = Math.round((c.count / totalCat) * 100);
                const blocks = Math.max(1, Math.round(pct / 10));
                return `${c.bar} ${c.name}: ${'█'.repeat(blocks)} ${c.count}개 (${pct}%)`;
            })
            .join('\n');
        parts.push(catSection);
    }

    // 집중 & 수면
    if (fa.totalFocusMinutes > 0 || sl.totalSleepMinutes > 0) {
        let wellnessSection = '━━━ 🧘 집중 & 수면 ━━━\n';
        if (fa.totalFocusMinutes > 0) {
            const focusHours = Math.floor(fa.totalFocusMinutes / 60);
            const focusMins = fa.totalFocusMinutes % 60;
            const focusTime = focusHours > 0 ? `${focusHours}시간 ${focusMins}분` : `${focusMins}분`;
            wellnessSection += `🎯 집중: ${focusTime} (${fa.focusSessions}세션, 평균 ${fa.avgSessionMinutes}분)`;
            if (fa.totalInterruptions > 0) wellnessSection += ` | 중단 ${fa.totalInterruptions}회`;
            wellnessSection += '\n';
        }
        if (sl.totalSleepMinutes > 0) {
            const avgHrs = sl.avgSleepHours.toFixed(1);
            const quality = sl.avgSleepHours >= 7 ? '충분해요 😊' : sl.avgSleepHours >= 5.5 ? '보통이에요 😐' : '부족해요 😴';
            wellnessSection += `😴 수면: 평균 ${avgHrs}시간 (${sl.sleepSessions}일) — ${quality}`;
        }
        parts.push(wellnessSection.trimEnd());
    }

    // 성장 지표
    if (gm.consistencyScore > 0) {
        let growthSection = '━━━ 🌱 성장 지표 ━━━\n';
        growthSection += `꾸준함 점수: ${gm.consistencyScore}/100`;
        if (gm.newHabitsFormed > 0) growthSection += ` | 새 습관: ${gm.newHabitsFormed}개`;
        if (gm.timeInvested > 0) {
            const hrs = Math.floor(gm.timeInvested / 60);
            const mins = gm.timeInvested % 60;
            growthSection += `\n투자 시간: ${hrs > 0 ? `${hrs}시간 ` : ''}${mins}분`;
        }
        parts.push(growthSection);
    }

    // 잘한 점 & 개선점
    if (insights.achievements.length > 0 || insights.improvements.length > 0) {
        let insightSection = '';
        if (insights.achievements.length > 0) {
            insightSection += '✅ 잘한 점\n';
            insightSection += insights.achievements.slice(0, 3).map(a => `  • ${a}`).join('\n');
        }
        if (insights.improvements.length > 0) {
            if (insightSection) insightSection += '\n\n';
            insightSection += '💡 개선할 점\n';
            insightSection += insights.improvements.slice(0, 3).map(i => `  • ${i}`).join('\n');
        }
        parts.push(insightSection);
    }

    // 추천
    if (insights.recommendations.length > 0) {
        let recSection = '━━━ 📋 다음 주 추천 ━━━\n';
        recSection += insights.recommendations.slice(0, 3).map(r => `  • ${r}`).join('\n');
        parts.push(recSection);
    }

    // 마무리
    parts.push('이번 주도 수고하셨어요! 다음 주도 함께 달려봐요 🚀');

    return parts.join('\n\n');
}
