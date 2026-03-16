import { supabaseAdmin } from "@/lib/supabase-admin";
import { MODELS } from "@/lib/models";
import type { CustomGoal, ActivityEventLog } from '@/lib/types';
import { logger } from '@/lib/logger';
import { kvGet } from '@/lib/kv-store';

/**
 * Weekly Report Generator
 *
 * 사용자의 지난 1주일간 활동을 분석하여 성장 중심의 주간 리포트 생성
 */

export interface WeeklyReportData {
    period: {
        start: string;
        end: string;
        weekNumber: number;
    };
    scheduleAnalysis: {
        totalSchedules: number;
        completedSchedules: number;
        completionRate: number;
        categoryBreakdown: {
            work: number;
            learning: number;
            exercise: number;
            wellness: number;
            social: number;
            hobby: number;
            routine: number;
            finance: number;
            other: number;
        };
        mostProductiveDay: string;
        leastProductiveDay: string;
        avgSchedulesPerDay: number;
    };
    trendBriefingAnalysis: {
        totalRead: number;
        avgReadPerDay: number;
        topCategories: Array<{ category: string; count: number }>;
        readingStreak: number;
    };
    // Focus Mode Analysis
    focusAnalysis: {
        totalFocusMinutes: number;
        focusSessions: number;
        avgSessionMinutes: number;
        totalInterruptions: number;
        mostFocusedDay: string;
    };
    // Sleep Analysis
    sleepAnalysis: {
        totalSleepMinutes: number;
        sleepSessions: number;
        avgSleepHours: number;
        earliestSleep: string;
        latestSleep: string;
        sleepConsistencyScore: number; // 0-100
    };
    growthMetrics: {
        newHabitsFormed: number;
        consistencyScore: number; // 0-100
        focusAreas: string[];
        timeInvested: number; // minutes
    };
    insights: {
        achievements: string[];
        improvements: string[];
        recommendations: string[];
    };
    comparisonWithLastWeek: {
        scheduleChange: number; // %
        completionRateChange: number; // %
        readingChange: number; // %
    };
}

/**
 * 가장 최근 완료된 주간(월~일)의 시작일과 종료일을 계산
 * 주간은 월요일 시작, 일요일 종료.
 * 일요일이면 그 주(월~일)가 이미 완료되었으므로 해당 주를 반환.
 * 월~토이면 지난 주(월~일)를 반환.
 * 예: 2/16(일) -> 2/10(월) ~ 2/16(일) 반환
 * 예: 2/17(월) -> 2/10(월) ~ 2/16(일) 반환
 */
function getLastCompletedWeek(date: Date): { start: Date; end: Date; weekNumber: number } {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ...

    // 일요일 21시 이후: 이번 주(월~일) 완료로 간주
    // 그 외: 지난 주(월~일) 반환
    const currentHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();

    let targetMonday: Date;
    let targetSunday: Date;
    if (dayOfWeek === 0 && currentHour >= 21) {
        // 일요일 21시 이후: 이번 주(월~일)
        targetMonday = new Date(d);
        targetMonday.setDate(d.getDate() - 6);
        targetSunday = new Date(d);
    } else {
        // 월~토, 또는 일요일 21시 이전: 지난 주
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const thisMonday = new Date(d);
        thisMonday.setDate(d.getDate() - daysToMonday);
        targetMonday = new Date(thisMonday);
        targetMonday.setDate(thisMonday.getDate() - 7);
        targetSunday = new Date(targetMonday);
        targetSunday.setDate(targetMonday.getDate() + 6);
    }

    targetSunday.setHours(23, 59, 59, 999);

    // ISO 8601 주차 계산 (월요일 시작, 1월 4일이 포함된 주가 Week 1)
    const target = new Date(targetMonday.valueOf());
    const dow = targetMonday.getDay();
    const diff = dow === 0 ? -3 : 4 - dow;
    target.setDate(targetMonday.getDate() + diff);
    const yearStart = new Date(target.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return { start: targetMonday, end: targetSunday, weekNumber };
}

/**
 * 특정 주간의 이전 주 계산 (비교용)
 */
function getPreviousWeek(weekStart: Date): { start: Date; end: Date } {
    const prevMonday = new Date(weekStart);
    prevMonday.setDate(weekStart.getDate() - 7);

    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    prevSunday.setHours(23, 59, 59, 999);

    return { start: prevMonday, end: prevSunday };
}

/**
 * 주간 리포트 생성
 * 항상 가장 최근 완료된 주간(월~일)의 데이터를 분석
 */
export async function generateWeeklyReport(userEmail: string): Promise<WeeklyReportData> {

    // 가장 최근 완료된 주간 (월~일) 계산 — KST 기준
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const lastWeek = getLastCompletedWeek(now);
    const oneWeekAgo = lastWeek.start;
    const weekEnd = lastWeek.end;

    // 비교용 지지난 주
    const prevWeek = getPreviousWeek(lastWeek.start);
    const twoWeeksAgo = prevWeek.start;
    const twoWeeksAgoEnd = prevWeek.end;


    // Get user profile
    const supabase = supabaseAdmin;
    const { data: userData } = await supabase
        .from('users')
        .select('profile')
        .eq('email', userEmail)
        .maybeSingle();

    const profile = userData?.profile || {};
    const customGoals = profile.customGoals || [];

    // 주간 날짜 목록 생성 (월~일, 7일)
    const getWeekDates = (weekStart: Date): { dateStr: string; dayOfWeek: number }[] => {
        const dates: { dateStr: string; dayOfWeek: number }[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            dates.push({ dateStr, dayOfWeek: d.getDay() });
        }
        return dates;
    };

    // 일정이 특정 주에 해당하는 횟수 계산 (반복 일정 포함)
    const getSchedulesForWeek = (goals: CustomGoal[], weekStart: Date, weekEnd: Date) => {
        const weekDates = getWeekDates(weekStart);
        const result: { goal: CustomGoal; date: string }[] = [];

        for (const goal of goals) {
            // specificDate 일정: 해당 주에 속하는지 확인
            if (goal.specificDate) {
                const goalDate = new Date(goal.specificDate);
                if (goalDate >= weekStart && goalDate <= weekEnd) {
                    result.push({ goal, date: goal.specificDate });
                }
            }
            // 반복 일정: daysOfWeek의 각 요일이 해당 주에 해당하면 추가
            else if (goal.daysOfWeek && goal.daysOfWeek.length > 0) {
                // startDate/endDate 범위 체크
                for (const wd of weekDates) {
                    if (!goal.daysOfWeek.includes(wd.dayOfWeek)) continue;
                    if (goal.startDate && wd.dateStr < goal.startDate) continue;
                    if (goal.endDate && wd.dateStr > goal.endDate) continue;
                    result.push({ goal, date: wd.dateStr });
                }
            }
        }
        return result;
    };

    // 1. Schedule Analysis (지난 주간 월~일 일정 분석)
    const lastWeekEntries = getSchedulesForWeek(customGoals, oneWeekAgo, weekEnd);
    const previousWeekEntries = getSchedulesForWeek(customGoals, twoWeeksAgo, twoWeeksAgoEnd);

    // 호환성 유지: lastWeekSchedules는 goal 배열 (중복 포함)
    const lastWeekSchedules = lastWeekEntries.map(e => e.goal);
    const previousWeekSchedules = previousWeekEntries.map(e => e.goal);

    const totalSchedules = lastWeekSchedules.length;
    const completedSchedules = lastWeekSchedules.filter((g: CustomGoal) => g.completed).length;
    const completionRate = totalSchedules > 0 ? Math.round((completedSchedules / totalSchedules) * 100) : 0;

    // Category breakdown (9개 카테고리)
    const categoryBreakdown = {
        work: 0,
        learning: 0,
        exercise: 0,
        wellness: 0,
        social: 0,
        hobby: 0,
        routine: 0,
        finance: 0,
        other: 0,
    };

    const WORK_KEYWORDS = ['업무', '회의', '미팅', '출근', '퇴근', '근무', '야근', 'work', '수업', '강의', '과제', '발표', '보고서', '프레젠테이션', '면접', '인터뷰', '세미나', '워크샵'];
    const LEARNING_KEYWORDS = ['학습', '공부', '읽기', '독서', '스터디', '코딩', '개발', '사이드프로젝트', '포트폴리오', 'study', 'learn', '논문', '리서치', '연구', '영어', '외국어', '자격증', '시험', '토익', '토플'];
    const EXERCISE_KEYWORDS = ['운동', '헬스', '요가', '러닝', '조깅', '필라테스', '수영', '등산', '산책', '스트레칭', '근력', '축구', '농구', '테니스', '배드민턴', '자전거', '걷기', 'workout', 'gym', '크로스핏', '복싱', '클라이밍', '골프', '볼링', '줄넘기', '러닝머신', '트레드밀'];
    const WELLNESS_KEYWORDS = ['명상', '휴식', '수면', '취침', '기상', '낮잠', '웰빙', '마사지', '사우나', '반신욕', 'wellness', 'rest', 'sleep', '스파', '테라피', '힐링', '심호흡', '마음챙김'];
    const SOCIAL_KEYWORDS = ['약속', '모임', '만남', '데이트', '친구', '가족', '동창', '회식', '파티', '생일', '결혼식', '돌잔치', '저녁약속', '점심약속', '술약속', '카페', '브런치'];
    const HOBBY_KEYWORDS = ['취미', '게임', '영화', '드라마', '넷플릭스', '음악', '기타연주', '기타레슨', '피아노', '드럼', '그림', '사진', '요리', '베이킹', '뜨개질', '원예', '캠핑', '여행', '낚시', '블로그', '유튜브', '콘서트', '전시', '공연', '미술관', '박물관'];
    const ROUTINE_KEYWORDS = ['청소', '빨래', '설거지', '장보기', '식사준비', '식단', '비타민', '약먹기', '병원', '치과', '안과', '세차', '정리정돈', '이사', '택배', '분리수거', '다림질'];
    const FINANCE_KEYWORDS = ['쇼핑', '구매', '결제', '은행', '송금', '저축', '투자', '주식', '가계부', '예산', '보험', '세금', '월급', '급여'];

    const categorizeSchedule = (text: string): keyof typeof categoryBreakdown => {
        const t = text.toLowerCase();
        if (WORK_KEYWORDS.some(k => t.includes(k))) return 'work';
        if (LEARNING_KEYWORDS.some(k => t.includes(k))) return 'learning';
        if (EXERCISE_KEYWORDS.some(k => t.includes(k))) return 'exercise';
        if (SOCIAL_KEYWORDS.some(k => t.includes(k))) return 'social';
        if (HOBBY_KEYWORDS.some(k => t.includes(k))) return 'hobby';
        if (WELLNESS_KEYWORDS.some(k => t.includes(k))) return 'wellness';
        if (ROUTINE_KEYWORDS.some(k => t.includes(k))) return 'routine';
        if (FINANCE_KEYWORDS.some(k => t.includes(k))) return 'finance';
        return 'other';
    };

    lastWeekSchedules.forEach((goal: CustomGoal) => {
        const category = categorizeSchedule(goal.text || '');
        categoryBreakdown[category]++;
    });

    // Day-by-day productivity
    const dayProductivity: Record<string, number> = {};
    lastWeekEntries.forEach(({ goal, date }) => {
        if (!dayProductivity[date]) dayProductivity[date] = 0;
        if (goal.completed) dayProductivity[date]++;
    });

    const sortedDays = Object.entries(dayProductivity).sort((a, b) => b[1] - a[1]);
    const mostProductiveDay = sortedDays[0]?.[0] || 'N/A';
    const leastProductiveDay = sortedDays[sortedDays.length - 1]?.[0] || 'N/A';
    const avgSchedulesPerDay = totalSchedules / 7;

    // 2. Trend Briefing Analysis — KV Store에서 날짜별 읽은 ID 조회
    let totalRead = 0;
    let readingStreak = 0;
    let currentStreak = 0;
    const readingDaysSet = new Set<string>();

    // 주간 날짜 순회 (월~일)
    for (let d = new Date(oneWeekAgo); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const readIds = await kvGet<string[]>(userEmail, `read_trend_ids_${dateStr}`);
        if (readIds && readIds.length > 0) {
            totalRead += readIds.length;
            readingDaysSet.add(dateStr);
            currentStreak++;
            if (currentStreak > readingStreak) readingStreak = currentStreak;
        } else {
            currentStreak = 0;
        }
    }

    const avgReadPerDay = totalRead / 7;

    // 카테고리별 분석은 KV에 카테고리 정보가 없으므로 trends_cache에서 조회
    const topCategories: Array<{ category: string; count: number }> = [];
    if (readingDaysSet.size > 0) {
        const dates = Array.from(readingDaysSet);
        const { data: cachedTrends } = await supabase
            .from('trends_cache')
            .select('trends, date')
            .eq('email', userEmail)
            .in('date', dates);

        if (cachedTrends) {
            const categoryCount: Record<string, number> = {};
            for (const row of cachedTrends) {
                const dateReadIds = await kvGet<string[]>(userEmail, `read_trend_ids_${row.date}`);
                if (!dateReadIds || !Array.isArray(row.trends)) continue;
                for (const trend of row.trends as any[]) {
                    if (dateReadIds.includes(trend.id)) {
                        const cat = trend.category || 'other';
                        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
                    }
                }
            }
            topCategories.push(
                ...Object.entries(categoryCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([category, count]) => ({ category, count }))
            );
        }
    }

    // 3. Focus Mode Analysis
    const { data: focusEvents } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_email', userEmail)
        .in('event_type', ['focus_start', 'focus_end', 'focus_interrupted'])
        .gte('created_at', oneWeekAgo.toISOString())
        .lte('created_at', weekEnd.toISOString());

    let totalFocusMinutes = 0;
    let focusSessions = 0;
    let totalInterruptions = 0;
    const focusDayMinutes: Record<string, number> = {};

    focusEvents?.filter((e: ActivityEventLog) => e.event_type === 'focus_end').forEach((event: ActivityEventLog) => {
        const duration = event.metadata?.duration || 0;
        const minutes = Math.floor(duration / 60);
        totalFocusMinutes += minutes;
        focusSessions++;

        if (event.metadata?.interruptCount) {
            totalInterruptions += event.metadata.interruptCount;
        }

        const day = new Date(event.created_at || event.start_at || '').toISOString().split('T')[0];
        focusDayMinutes[day] = (focusDayMinutes[day] || 0) + minutes;
    });

    const sortedFocusDays = Object.entries(focusDayMinutes).sort((a, b) => b[1] - a[1]);
    const mostFocusedDay = sortedFocusDays[0]?.[0] || 'N/A';
    const avgFocusSessionMinutes = focusSessions > 0 ? Math.round(totalFocusMinutes / focusSessions) : 0;

    // 4. Sleep Analysis
    const { data: sleepEvents } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_email', userEmail)
        .in('event_type', ['sleep_start', 'sleep_end'])
        .gte('created_at', oneWeekAgo.toISOString())
        .lte('created_at', weekEnd.toISOString());

    let totalSleepMinutes = 0;
    let sleepSessions = 0;
    const sleepTimes: string[] = [];

    sleepEvents?.filter((e: ActivityEventLog) => e.event_type === 'sleep_end').forEach((event: ActivityEventLog) => {
        const durationMinutes = event.metadata?.durationMinutes || 0;
        totalSleepMinutes += durationMinutes;
        sleepSessions++;

        if (event.metadata?.startTime) {
            const startTime = new Date(event.metadata.startTime);
            const timeStr = `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`;
            sleepTimes.push(timeStr);
        }
    });

    const avgSleepHours = sleepSessions > 0 ? totalSleepMinutes / sleepSessions / 60 : 0;
    const sortedSleepTimes = [...sleepTimes].sort();
    const earliestSleep = sortedSleepTimes[0] || 'N/A';
    const latestSleep = sortedSleepTimes[sortedSleepTimes.length - 1] || 'N/A';

    // Sleep consistency score (based on variance in sleep times)
    let sleepConsistencyScore = 0;
    if (sleepTimes.length >= 2) {
        const timeMinutes = sleepTimes.map(t => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        });
        const avg = timeMinutes.reduce((a, b) => a + b, 0) / timeMinutes.length;
        const variance = timeMinutes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / timeMinutes.length;
        const stdDev = Math.sqrt(variance);
        // Lower standard deviation = higher consistency
        sleepConsistencyScore = Math.max(0, Math.min(100, 100 - stdDev / 3));
    } else if (sleepTimes.length === 1) {
        sleepConsistencyScore = 50; // Not enough data
    }

    // 5. Growth Metrics
    const { data: allEvents } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_email', userEmail)
        .gte('start_at', oneWeekAgo.toISOString())
        .lte('start_at', weekEnd.toISOString());

    const workoutEvents = allEvents?.filter((e: ActivityEventLog) => e.event_type === 'workout_completed') || [];
    const learningEvents = allEvents?.filter((e: ActivityEventLog) => e.event_type === 'learning_completed') || [];

    const newHabitsFormed = workoutEvents.length >= 3 ? 1 : 0; // 주 3회 이상이면 습관으로 간주
    // Include focus and sleep data in consistency score
    const focusBonus = focusSessions >= 3 ? 10 : focusSessions * 3;
    const sleepBonus = sleepConsistencyScore / 10;
    const consistencyScore = Math.min(100, (completionRate + readingStreak * 10 + focusBonus + sleepBonus) / 3);

    const focusAreas: string[] = [];
    const catLabels: Record<string, string> = { work: '업무', learning: '학습', exercise: '운동', wellness: '웰빙', social: '사교', hobby: '취미', routine: '생활', finance: '재정' };
    const sorted = Object.entries(categoryBreakdown)
        .filter(([k]) => k !== 'other')
        .sort((a, b) => b[1] - a[1]);
    for (const [key, count] of sorted) {
        if (count > 0 && focusAreas.length < 4) focusAreas.push(catLabels[key] || key);
    }

    // Estimated time invested (duration sum)
    const timeInvested = lastWeekSchedules.reduce((sum: number, goal: CustomGoal) => {
        const duration = parseInt((goal as unknown as Record<string, string>).duration) || 60;
        return sum + duration;
    }, 0);

    // 4. Insights (성장 중심 인사이트)
    const achievements: string[] = [];
    const improvements: string[] = [];
    const recommendations: string[] = [];

    // Achievements
    if (completionRate >= 80) {
        achievements.push(`🎯 일정 완료율 ${completionRate.toFixed(1)}%! 훌륭한 실행력을 보여주셨어요.`);
    }
    if (totalRead >= 5) {
        achievements.push(`📚 이번 주 ${totalRead}개의 트렌드 브리핑을 읽으셨네요! 꾸준한 학습 태도가 인상적입니다.`);
    }
    if (categoryBreakdown.exercise >= 3) {
        achievements.push(`💪 주 ${categoryBreakdown.exercise}회 운동을 실천하셨어요! 건강한 습관이 자리잡고 있습니다.`);
    }
    if (readingStreak >= 5) {
        achievements.push(`🔥 ${readingStreak}일 연속 학습! 놀라운 일관성입니다.`);
    }
    // Focus mode achievements
    if (totalFocusMinutes >= 120) {
        achievements.push(`🎯 이번 주 ${Math.round(totalFocusMinutes / 60)}시간 집중! 대단한 집중력이에요.`);
    }
    if (focusSessions >= 5) {
        achievements.push(`⚡ ${focusSessions}번의 집중 세션을 완료했어요!`);
    }
    // Sleep achievements
    if (avgSleepHours >= 7 && avgSleepHours <= 9) {
        achievements.push(`😴 평균 수면 ${avgSleepHours.toFixed(1)}시간! 건강한 수면 패턴이에요.`);
    }
    if (sleepConsistencyScore >= 70) {
        achievements.push(`🌙 수면 규칙성 ${sleepConsistencyScore.toFixed(0)}점! 일정한 취침 시간을 유지하고 계세요.`);
    }

    // Improvements
    if (completionRate < 50) {
        improvements.push('일정 완료율이 낮습니다. 일정을 좀 더 현실적으로 조정해보세요.');
    }
    if (totalRead < 3) {
        improvements.push('트렌드 학습이 부족합니다. 하루 1개씩 브리핑을 읽는 습관을 만들어보세요.');
    }
    if (categoryBreakdown.exercise === 0) {
        improvements.push('이번 주 운동 일정이 없었어요. 건강을 위해 주 2-3회 운동을 추천드립니다.');
    }
    if (categoryBreakdown.wellness === 0) {
        improvements.push('휴식과 회복 시간이 부족합니다. 번아웃 예방을 위해 휴식 일정을 추가해보세요.');
    }
    // Focus mode improvements
    if (totalInterruptions > focusSessions * 2) {
        improvements.push(`집중 중 이탈이 ${totalInterruptions}회 있었어요. 방해 요소를 줄여보세요.`);
    }
    if (focusSessions === 0) {
        improvements.push('이번 주 집중 모드를 사용하지 않으셨어요. 집중이 필요한 작업에 활용해보세요!');
    }
    // Sleep improvements
    if (avgSleepHours < 6 && sleepSessions > 0) {
        improvements.push(`평균 수면 시간이 ${avgSleepHours.toFixed(1)}시간으로 부족해요. 7-8시간을 권장합니다.`);
    }
    if (sleepConsistencyScore < 50 && sleepSessions >= 3) {
        improvements.push('취침 시간이 불규칙해요. 일정한 시간에 잠자리에 들어보세요.');
    }

    // Recommendations
    const job = profile.job || '';
    const goal = profile.goal || '';

    if (categoryBreakdown.learning < 3) {
        recommendations.push(`${goal || '목표'}를 위해 주 3회 이상 학습 시간을 확보해보세요.`);
    }
    if (categoryBreakdown.work > totalSchedules * 0.7) {
        recommendations.push('업무 비중이 높습니다. 워라밸을 위해 개인 시간을 늘려보세요.');
    }
    if (topCategories.length > 0) {
        const topCat = topCategories[0].category;
        recommendations.push(`${topCat} 분야에 관심이 많으시네요! 관련 커뮤니티나 스터디 참여를 고려해보세요.`);
    }

    // 5. Comparison with last week
    const previousTotal = previousWeekSchedules.length;
    const previousCompleted = previousWeekSchedules.filter((g: CustomGoal) => g.completed).length;
    const previousCompletionRate = previousTotal > 0 ? Math.round((previousCompleted / previousTotal) * 100) : 0;

    // 지난주 트렌드 읽기 수 — KV Store에서 조회
    let previousRead = 0;
    for (let d = new Date(twoWeeksAgo); d <= twoWeeksAgoEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const readIds = await kvGet<string[]>(userEmail, `read_trend_ids_${dateStr}`);
        if (readIds) previousRead += readIds.length;
    }

    const scheduleChange = previousTotal > 0 ? ((totalSchedules - previousTotal) / previousTotal) * 100 : 0;
    const completionRateChange = previousCompletionRate > 0 ? completionRate - previousCompletionRate : 0;
    const readingChange = previousRead > 0 ? ((totalRead - previousRead) / previousRead) * 100 : 0;

    return {
        period: {
            start: oneWeekAgo.toISOString().split('T')[0],
            end: weekEnd.toISOString().split('T')[0],
            weekNumber: lastWeek.weekNumber,
        },
        scheduleAnalysis: {
            totalSchedules,
            completedSchedules,
            completionRate,
            categoryBreakdown,
            mostProductiveDay,
            leastProductiveDay,
            avgSchedulesPerDay,
        },
        trendBriefingAnalysis: {
            totalRead,
            avgReadPerDay,
            topCategories,
            readingStreak,
        },
        focusAnalysis: {
            totalFocusMinutes,
            focusSessions,
            avgSessionMinutes: avgFocusSessionMinutes,
            totalInterruptions,
            mostFocusedDay,
        },
        sleepAnalysis: {
            totalSleepMinutes,
            sleepSessions,
            avgSleepHours,
            earliestSleep,
            latestSleep,
            sleepConsistencyScore,
        },
        growthMetrics: {
            newHabitsFormed,
            consistencyScore,
            focusAreas,
            timeInvested,
        },
        insights: {
            achievements,
            improvements,
            recommendations,
        },
        comparisonWithLastWeek: {
            scheduleChange,
            completionRateChange,
            readingChange,
        },
    };
}

/**
 * AI를 사용하여 주간 리포트를 자연스러운 문장으로 변환
 */
export async function generateWeeklyReportNarrative(reportData: WeeklyReportData, userProfile: { job?: string; goal?: string }): Promise<string> {
    const { scheduleAnalysis, trendBriefingAnalysis, focusAnalysis, sleepAnalysis, growthMetrics, insights, comparisonWithLastWeek } = reportData;

    // 사용자의 실제 상황에 맞는 맞춤 조언을 위한 컨텍스트 구성
    const userJob = userProfile.job || '';
    const userGoal = userProfile.goal || '';
    const userContext = userJob && userGoal
        ? `이 사용자는 ${userJob}이며, "${userGoal}"을 목표로 하고 있습니다.`
        : userJob
            ? `이 사용자는 ${userJob}입니다.`
            : userGoal
                ? `이 사용자의 목표는 "${userGoal}"입니다.`
                : '';

    const prompt = `아래 데이터를 기반으로 사용자에게 도움이 되는 맞춤 코멘트를 작성해.

${userContext}

이번 주 데이터:
- 일정 ${scheduleAnalysis.completedSchedules}/${scheduleAnalysis.totalSchedules}개 완료 (${scheduleAnalysis.completionRate.toFixed(0)}%)
- 카테고리: 업무 ${scheduleAnalysis.categoryBreakdown.work}, 학습 ${scheduleAnalysis.categoryBreakdown.learning}, 운동 ${scheduleAnalysis.categoryBreakdown.exercise}, 웰빙 ${scheduleAnalysis.categoryBreakdown.wellness}, 사교 ${scheduleAnalysis.categoryBreakdown.social}, 취미 ${scheduleAnalysis.categoryBreakdown.hobby}, 생활 ${scheduleAnalysis.categoryBreakdown.routine}, 재정 ${scheduleAnalysis.categoryBreakdown.finance}
- 트렌드 브리핑 ${trendBriefingAnalysis.totalRead}개 읽음
- 집중 모드 ${focusAnalysis.focusSessions}회 (${Math.round(focusAnalysis.totalFocusMinutes)}분)
- 수면 평균 ${sleepAnalysis.avgSleepHours.toFixed(1)}시간
- 지난주 대비: 완료율 ${comparisonWithLastWeek.completionRateChange > 0 ? '+' : ''}${comparisonWithLastWeek.completionRateChange.toFixed(0)}%p

작성 규칙:
- 순수 텍스트만 (마크다운, 제목, 이모지, 리스트 기호 절대 금지)
- 3~4문장, 150자 이내
- 반말 금지, 존댓말 사용
- 이번 주 데이터에서 가장 눈에 띄는 점 1개와, 다음 주에 실천할 수 있는 구체적 제안 1개를 포함
- 사용자의 직업/목표와 연결지어 조언
- 뻔한 격려("수고하셨어요", "화이팅") 대신 실질적으로 도움이 되는 내용 위주`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: MODELS.GPT_5_MINI,
                messages: [
                    {
                        role: 'system',
                        content: '당신은 개인 일정 관리 앱의 AI 코치입니다. 사용자의 실제 데이터를 기반으로 짧고 실용적인 조언을 합니다. 마크다운, 이모지, 제목, 리스트 기호를 절대 사용하지 마세요. 순수 텍스트만 출력하세요.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 1,
                max_completion_tokens: 300,
            }),
        });

        if (!response.ok) {
            logger.error('[Weekly Report] OpenAI API failed:', response.status);
            return generateFallbackNarrative(reportData);
        }

        const data = await response.json();
        let narrative = data.choices[0].message.content || '';
        // Strip any markdown/emoji the model might still produce
        narrative = narrative
            .replace(/^#+\s*/gm, '')       // remove markdown headings
            .replace(/^[-*]\s+/gm, '')     // remove list markers
            .replace(/\*\*/g, '')          // remove bold markers
            .replace(/\n{2,}/g, ' ')       // collapse double newlines to space
            .trim();
        return narrative;
    } catch (error) {
        logger.error('[Weekly Report] Error generating narrative:', error);
        return generateFallbackNarrative(reportData);
    }
}

/**
 * AI 실패 시 폴백 리포트
 */
function generateFallbackNarrative(reportData: WeeklyReportData): string {
    const { scheduleAnalysis, trendBriefingAnalysis, insights } = reportData;

    const rate = scheduleAnalysis.completionRate.toFixed(0);
    const total = scheduleAnalysis.totalSchedules;
    const completed = scheduleAnalysis.completedSchedules;

    if (total === 0) {
        return '이번 주 등록된 일정이 없었어요. 다음 주에는 하루 1~2개씩 작은 일정부터 시작해보세요.';
    }

    const topImprovement = insights.improvements[0] || '';
    const cleanImprovement = topImprovement.replace(/[^\w\sㄱ-힣.,!?~%()0-9]/g, '').trim();

    return `이번 주 ${total}개 일정 중 ${completed}개를 완료해서 완료율 ${rate}%를 기록했어요.${cleanImprovement ? ` 다음 주에는 ${cleanImprovement}` : ' 이 페이스를 유지하면서 다음 주도 계획을 세워보세요.'}`;
}
