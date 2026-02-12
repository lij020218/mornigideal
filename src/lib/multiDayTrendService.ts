/**
 * Multi-Day Trend Analysis Service
 *
 * 7-14일 행동 패턴 추적 및 트렌드 분석
 * - 매일 저녁 회고 시 상태 스냅샷 저장
 * - 이동평균, 선형회귀, 요일별 집계 (LLM 호출 없음)
 * - 번아웃 위험도 감지
 */

import { supabaseAdmin } from './supabase-admin';

// ============================================
// Types
// ============================================

export interface DailySnapshot {
    date: string;
    completion_rate: number;
    mood: string;
    stress_level: number;
    energy_level: number;
    focus_score: number;
    total_tasks: number;
    completed_tasks: number;
}

export interface TrendAnalysis {
    period: '7d' | '14d';
    completionTrend: 'improving' | 'stable' | 'declining';
    avgCompletionRate: number;
    moodPattern: string;
    stressDirection: 'rising' | 'stable' | 'falling';
    avgStress: number;
    bestDay: string;
    worstDay: string;
    burnoutRisk: 'low' | 'medium' | 'high';
    insights: string[];
}

// ============================================
// Save Snapshot (저녁 회고 시 호출)
// ============================================

export async function saveStateSnapshot(
    userEmail: string,
    overrides?: {
        completionRate?: number;
        mood?: string;
        totalTasks?: number;
        completedTasks?: number;
    }
): Promise<void> {
    try {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // state-updater에서 현재 상태 조회
        const { data: stateData } = await supabaseAdmin
            .from('user_states')
            .select('stress_level, energy_level, focus_window_score')
            .eq('user_email', userEmail)
            .maybeSingle();

        const snapshot = {
            user_email: userEmail,
            date: todayStr,
            completion_rate: overrides?.completionRate ?? 0,
            mood: overrides?.mood ?? 'neutral',
            stress_level: stateData?.stress_level ?? 0,
            energy_level: stateData?.energy_level ?? 50,
            focus_score: stateData?.focus_window_score ?? 50,
            total_tasks: overrides?.totalTasks ?? 0,
            completed_tasks: overrides?.completedTasks ?? 0,
        };

        const { error } = await supabaseAdmin
            .from('daily_state_snapshots')
            .upsert(snapshot, { onConflict: 'user_email,date' });

        if (error) {
            console.error('[MultiDayTrend] Failed to save snapshot:', error);
        } else {
        }
    } catch (error) {
        console.error('[MultiDayTrend] saveStateSnapshot error:', error);
    }
}

// ============================================
// Analyze Trends (순수 수학 계산)
// ============================================

export async function analyzeTrends(
    userEmail: string,
    period: '7d' | '14d' = '7d'
): Promise<TrendAnalysis | null> {
    const days = period === '7d' ? 7 : 14;

    const { data: snapshots, error } = await supabaseAdmin
        .from('daily_state_snapshots')
        .select('*')
        .eq('user_email', userEmail)
        .order('date', { ascending: false })
        .limit(days);

    if (error || !snapshots || snapshots.length < 3) {
        return null; // 최소 3일 데이터 필요
    }

    // 시간순 정렬 (오래된 것 먼저)
    const sorted = [...snapshots].reverse();

    // 평균 계산
    const avgCompletion = avg(sorted.map(s => Number(s.completion_rate) || 0));
    const avgStress = avg(sorted.map(s => Number(s.stress_level) || 0));

    // 선형회귀로 방향 판단
    const completionTrend = detectTrend(sorted.map(s => Number(s.completion_rate) || 0));
    const stressTrend = detectTrend(sorted.map(s => Number(s.stress_level) || 0));

    // 요일별 집계
    const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const dayStats: Record<number, { total: number; count: number }> = {};
    sorted.forEach(s => {
        const dayOfWeek = new Date(s.date).getDay();
        if (!dayStats[dayOfWeek]) dayStats[dayOfWeek] = { total: 0, count: 0 };
        dayStats[dayOfWeek].total += Number(s.completion_rate) || 0;
        dayStats[dayOfWeek].count++;
    });

    let bestDay = '데이터 부족';
    let worstDay = '데이터 부족';
    let bestAvg = -1;
    let worstAvg = 101;
    Object.entries(dayStats).forEach(([day, stat]) => {
        if (stat.count === 0) return;
        const dayAvg = stat.total / stat.count;
        if (dayAvg > bestAvg) { bestAvg = dayAvg; bestDay = DAY_NAMES[Number(day)]; }
        if (dayAvg < worstAvg) { worstAvg = dayAvg; worstDay = DAY_NAMES[Number(day)]; }
    });

    // 기분 패턴 분석
    const moodPattern = analyzeMoodPattern(sorted);

    // 번아웃 위험도
    const burnoutRisk = detectBurnoutRisk(sorted);

    // 인사이트 생성
    const insights = generateInsights(sorted, completionTrend, stressTrend, avgCompletion, avgStress, burnoutRisk);

    return {
        period,
        completionTrend: completionTrend === 'rising' ? 'improving' : completionTrend === 'falling' ? 'declining' : 'stable',
        avgCompletionRate: Math.round(avgCompletion),
        moodPattern,
        stressDirection: stressTrend,
        avgStress: Math.round(avgStress),
        bestDay,
        worstDay,
        burnoutRisk,
        insights,
    };
}

// ============================================
// AI 프롬프트용 마크다운 생성
// ============================================

export async function getTrendInsightsForAI(userEmail: string): Promise<string> {
    const trend = await analyzeTrends(userEmail, '7d');
    if (!trend) return '';

    const trendEmoji = trend.completionTrend === 'improving' ? '📈' :
                       trend.completionTrend === 'declining' ? '📉' : '➡️';
    const burnoutEmoji = trend.burnoutRisk === 'high' ? '🔴' :
                         trend.burnoutRisk === 'medium' ? '🟡' : '🟢';

    let markdown = `**최근 7일 트렌드:**\n`;
    markdown += `- 평균 완료율: ${trend.avgCompletionRate}% ${trendEmoji} (${trend.completionTrend === 'improving' ? '상승' : trend.completionTrend === 'declining' ? '하락' : '유지'})\n`;
    markdown += `- 스트레스: 평균 ${trend.avgStress} (${trend.stressDirection === 'rising' ? '상승 중' : trend.stressDirection === 'falling' ? '하락 중' : '안정'})\n`;
    markdown += `- 기분 패턴: ${trend.moodPattern}\n`;
    markdown += `- 번아웃 위험: ${burnoutEmoji} ${trend.burnoutRisk}\n`;
    markdown += `- 최고 요일: ${trend.bestDay} / 최저 요일: ${trend.worstDay}\n`;

    if (trend.insights.length > 0) {
        markdown += `\n**인사이트:**\n`;
        trend.insights.forEach(insight => {
            markdown += `- ${insight}\n`;
        });
    }

    return markdown;
}

// ============================================
// Helper Functions
// ============================================

function avg(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** 간단한 선형회귀 방향 감지 */
function detectTrend(values: number[]): 'rising' | 'stable' | 'falling' {
    if (values.length < 3) return 'stable';

    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = avg(values);

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
        numerator += (i - xMean) * (values[i] - yMean);
        denominator += (i - xMean) * (i - xMean);
    }

    if (denominator === 0) return 'stable';
    const slope = numerator / denominator;

    // 기울기 임계치: 일당 ±2 이상이면 유의미한 변화
    if (slope > 2) return 'rising';
    if (slope < -2) return 'falling';
    return 'stable';
}

function analyzeMoodPattern(snapshots: any[]): string {
    const moodCounts: Record<string, number> = {};
    snapshots.forEach(s => {
        const mood = s.mood || 'neutral';
        moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });

    const total = snapshots.length;
    const positiveRate = ((moodCounts['positive'] || 0) / total) * 100;
    const negativeRate = ((moodCounts['negative'] || 0) / total) * 100;

    if (positiveRate >= 60) return '대체로 긍정적';
    if (negativeRate >= 60) return '대체로 부정적';
    if (positiveRate >= 40 && negativeRate < 30) return '긍정-중립 반복';
    if (negativeRate >= 40 && positiveRate < 30) return '부정-중립 반복';
    return '혼합';
}

function detectBurnoutRisk(snapshots: any[]): 'low' | 'medium' | 'high' {
    // 최근 3일+ 연속으로 stress>70 + completion<50 → high
    let consecutiveBad = 0;
    for (let i = snapshots.length - 1; i >= 0; i--) {
        const stress = Number(snapshots[i].stress_level) || 0;
        const completion = Number(snapshots[i].completion_rate) || 0;
        if (stress > 70 && completion < 50) {
            consecutiveBad++;
        } else {
            break;
        }
    }

    if (consecutiveBad >= 3) return 'high';
    if (consecutiveBad >= 2) return 'medium';

    // 전체 기간에서 stress>70인 날이 50% 이상이면 medium
    const highStressDays = snapshots.filter(s => Number(s.stress_level) > 70).length;
    if (highStressDays / snapshots.length >= 0.5) return 'medium';

    return 'low';
}

function generateInsights(
    snapshots: any[],
    completionTrend: string,
    stressTrend: string,
    avgCompletion: number,
    avgStress: number,
    burnoutRisk: string
): string[] {
    const insights: string[] = [];

    if (completionTrend === 'falling' && avgCompletion < 50) {
        insights.push('완료율이 하락 추세입니다. 일정 수를 줄이거나 우선순위를 재정리해보세요.');
    }
    if (completionTrend === 'rising' && avgCompletion > 70) {
        insights.push('완료율이 꾸준히 상승 중입니다! 좋은 흐름을 유지하고 계세요.');
    }
    if (stressTrend === 'rising' && avgStress > 60) {
        insights.push('스트레스가 상승 추세입니다. 짧은 휴식이나 여가 시간을 확보해보세요.');
    }
    if (burnoutRisk === 'high') {
        insights.push('번아웃 위험이 높습니다. 오늘은 쉬어가는 하루를 보내보세요.');
    }

    // 주말 vs 주중 비교
    const weekdaySnaps = snapshots.filter(s => {
        const day = new Date(s.date).getDay();
        return day >= 1 && day <= 5;
    });
    const weekendSnaps = snapshots.filter(s => {
        const day = new Date(s.date).getDay();
        return day === 0 || day === 6;
    });

    if (weekdaySnaps.length > 0 && weekendSnaps.length > 0) {
        const weekdayAvg = avg(weekdaySnaps.map(s => Number(s.completion_rate) || 0));
        const weekendAvg = avg(weekendSnaps.map(s => Number(s.completion_rate) || 0));
        if (weekdayAvg - weekendAvg > 20) {
            insights.push('주말에 완료율이 크게 떨어집니다. 주말 일정을 가볍게 조정해보세요.');
        }
    }

    return insights;
}
