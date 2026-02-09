/**
 * Context Fusion Engine
 *
 * 날씨+일정+목표+기분+상태를 교차 분석하여
 * 규칙 기반 신호(Signal)와 제안(Suggestion)을 생성
 *
 * LLM 호출 없음 — 순수 규칙 엔진
 */

import { createClient } from '@supabase/supabase-js';
import { analyzeTrends } from '@/lib/multiDayTrendService';
import { isImportantSchedule } from '@/lib/proactiveNotificationService';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================
// Types
// ============================================

export interface ContextSignal {
    type: 'weather_schedule' | 'stress_deadline' | 'energy_schedule' | 'mood_goal' | 'trend_pattern';
    severity: 'info' | 'warning' | 'critical';
    message: string;
}

export interface FusedContext {
    signals: ContextSignal[];
    suggestions: string[];
    urgencyScore: number; // 0-100
}

interface WeatherData {
    temp: number;
    feels_like: number;
    condition: string;
    description: string;
    humidity: number;
    wind_speed: number;
}

interface ScheduleItem {
    id: string;
    text: string;
    startTime?: string;
    endTime?: string;
    completed?: boolean;
}

// ============================================
// Outdoor keywords for weather-schedule cross
// ============================================

const OUTDOOR_KEYWORDS = [
    '야외', '공원', '산책', '조깅', '러닝', '달리기', '등산', '하이킹',
    '자전거', '축구', '농구', '테니스', '골프', '캠핑', '피크닉',
    '바베큐', '놀이공원', '워터파크', '수영', '서핑', '낚시',
    '소풍', '나들이', '외출', '출장', '이사', '배달',
];

// ============================================
// Main Fusion Function
// ============================================

export async function fuseContext(userEmail: string): Promise<FusedContext> {
    const signals: ContextSignal[] = [];
    const suggestions: string[] = [];

    // 병렬로 데이터 수집
    const [weather, todaySchedules, userState, trends, profile] = await Promise.all([
        getWeatherData(),
        getTodaySchedules(userEmail),
        getUserState(userEmail),
        analyzeTrends(userEmail, '7d').catch(() => null),
        getUserProfile(userEmail),
    ]);

    const now = new Date();
    const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const currentHour = kstNow.getHours();
    const dayOfWeek = kstNow.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // ============================================
    // Rule 1: 비 예보 + 야외 일정
    // ============================================
    if (weather && (weather.condition === 'rain' || weather.condition === 'snow')) {
        const outdoorSchedules = todaySchedules.filter(s =>
            OUTDOOR_KEYWORDS.some(kw => (s.text || '').toLowerCase().includes(kw))
        );

        if (outdoorSchedules.length > 0) {
            signals.push({
                type: 'weather_schedule',
                severity: 'warning',
                message: `오늘 ${weather.description} 예보가 있어요. "${outdoorSchedules[0].text}" 일정에 우산을 챙기세요.`,
            });
            suggestions.push('야외 일정이 있는데 날씨가 좋지 않습니다. 실내 대안을 고려해보세요.');
        }
    }

    // ============================================
    // Rule 2: 폭염/한파 + 외출 일정
    // ============================================
    if (weather) {
        const isExtremeHeat = weather.temp >= 33;
        const isExtremeCold = weather.temp <= -10 || weather.feels_like <= -15;

        if (isExtremeHeat || isExtremeCold) {
            const outdoorSchedules = todaySchedules.filter(s =>
                OUTDOOR_KEYWORDS.some(kw => (s.text || '').toLowerCase().includes(kw))
            );

            if (outdoorSchedules.length > 0) {
                const weatherType = isExtremeHeat ? '폭염' : '한파';
                const advice = isExtremeHeat
                    ? '수분 보충을 잊지 마시고, 자외선 차단도 신경 써주세요.'
                    : '따뜻하게 입으시고, 핫팩 등을 준비하세요.';

                signals.push({
                    type: 'weather_schedule',
                    severity: 'warning',
                    message: `${weatherType} 주의보입니다. ${advice}`,
                });
                suggestions.push(`${weatherType} 시 야외 활동에 주의가 필요합니다.`);
            }
        }
    }

    // ============================================
    // Rule 3: 스트레스 높음 + 마감 임박
    // ============================================
    if (userState && userState.stress_level > 70) {
        const longTermGoals = profile?.longTermGoals || {};
        let upcomingDeadlines = 0;

        ['weekly', 'monthly', 'yearly'].forEach(type => {
            (longTermGoals[type] || []).forEach((g: any) => {
                if (g.dueDate && !g.completed) {
                    const daysUntil = Math.ceil(
                        (new Date(g.dueDate).getTime() - now.getTime()) / 86400000
                    );
                    if (daysUntil <= 3 && daysUntil >= 0) upcomingDeadlines++;
                }
            });
        });

        if (upcomingDeadlines > 0) {
            signals.push({
                type: 'stress_deadline',
                severity: 'critical',
                message: `스트레스 지수가 높고 ${upcomingDeadlines}개의 마감이 3일 이내입니다. 우선순위를 정리하고 쉬는 시간을 확보하세요.`,
            });
            suggestions.push('마감 임박 시 가장 중요한 1개에 집중하세요. 나머지는 조율 가능한지 확인해보세요.');
        }
    }

    // ============================================
    // Rule 4: 에너지 낮음 + 중요 일정 2시간 이내
    // ============================================
    if (userState && userState.energy_level < 30) {
        const upcomingImportant = todaySchedules.filter(s => {
            if (!s.startTime || !isImportantSchedule(s.text)) return false;
            const [h, m] = s.startTime.split(':').map(Number);
            const scheduleMinutes = h * 60 + m;
            const currentMinutes = currentHour * 60 + kstNow.getMinutes();
            const diff = scheduleMinutes - currentMinutes;
            return diff > 0 && diff <= 120;
        });

        if (upcomingImportant.length > 0) {
            signals.push({
                type: 'energy_schedule',
                severity: 'warning',
                message: `에너지가 낮은 상태에서 "${upcomingImportant[0].text}" 일정이 곧 시작됩니다. 짧은 휴식이나 가벼운 스트레칭을 추천합니다.`,
            });
            suggestions.push('중요 일정 전 5-10분 휴식으로 컨디션을 끌어올리세요.');
        }
    }

    // ============================================
    // Rule 5: 부정적 기분 3일 연속
    // ============================================
    if (trends && trends.moodPattern.includes('부정')) {
        signals.push({
            type: 'mood_goal',
            severity: 'warning',
            message: '최근 기분이 좋지 않은 날이 이어지고 있어요. 오늘은 작은 성취를 목표로 해보세요.',
        });
        suggestions.push('가벼운 산책이나 좋아하는 음악 듣기 등 기분 전환 활동을 추천합니다.');
    }

    // ============================================
    // Rule 6: 완료율 하락 추세 + 목표 마감 임박
    // ============================================
    if (trends && trends.completionTrend === 'declining') {
        const longTermGoals = profile?.longTermGoals || {};
        let nearDeadline = false;

        ['weekly', 'monthly'].forEach(type => {
            (longTermGoals[type] || []).forEach((g: any) => {
                if (g.dueDate && !g.completed) {
                    const daysUntil = Math.ceil(
                        (new Date(g.dueDate).getTime() - now.getTime()) / 86400000
                    );
                    if (daysUntil <= 7 && daysUntil >= 0) nearDeadline = true;
                }
            });
        });

        if (nearDeadline) {
            signals.push({
                type: 'trend_pattern',
                severity: 'critical',
                message: '완료율이 하락 추세이고 목표 마감이 다가오고 있습니다. 목표 범위를 축소하거나 핵심에 집중하세요.',
            });
            suggestions.push('현실적인 범위로 목표를 조정하면 달성 확률이 높아집니다.');
        }
    }

    // ============================================
    // Rule 7: 빈 시간대 + 장기 목표 미진행
    // ============================================
    if (todaySchedules.length < 3 && currentHour >= 9 && currentHour <= 18) {
        const longTermGoals = profile?.longTermGoals || {};
        const stagnantGoals: string[] = [];

        ['weekly', 'monthly', 'yearly'].forEach(type => {
            (longTermGoals[type] || []).forEach((g: any) => {
                if (!g.completed && (g.progress || 0) < 30) {
                    stagnantGoals.push(g.title);
                }
            });
        });

        if (stagnantGoals.length > 0) {
            signals.push({
                type: 'energy_schedule',
                severity: 'info',
                message: `오늘 일정이 적어 여유가 있습니다. "${stagnantGoals[0]}" 목표를 진행해보는 건 어떨까요?`,
            });
            suggestions.push(`장기 목표 "${stagnantGoals[0]}" 진행을 위한 시간을 확보해보세요.`);
        }
    }

    // ============================================
    // Rule 8: 주말 + 연속 높은 스트레스
    // ============================================
    if (isWeekend && userState && userState.stress_level > 60) {
        signals.push({
            type: 'mood_goal',
            severity: 'info',
            message: '주말인데 스트레스가 높은 상태에요. 오늘은 가벼운 휴식이나 여가 활동을 즐겨보세요.',
        });
        suggestions.push('주말에는 업무 관련 알림을 줄이고 충분히 쉬세요.');
    }

    // 종합 긴급도 점수 계산
    const urgencyScore = calculateUrgencyScore(signals);

    return { signals, suggestions, urgencyScore };
}

// ============================================
// AI 프롬프트용 마크다운 생성
// ============================================

export async function getFusedContextForAI(userEmail: string): Promise<string> {
    try {
        const fused = await fuseContext(userEmail);

        if (fused.signals.length === 0) return '';

        let markdown = `\n**컨텍스트 융합 분석:**\n`;

        const criticals = fused.signals.filter(s => s.severity === 'critical');
        const warnings = fused.signals.filter(s => s.severity === 'warning');
        const infos = fused.signals.filter(s => s.severity === 'info');

        if (criticals.length > 0) {
            markdown += `\n🔴 **긴급:**\n`;
            criticals.forEach(s => { markdown += `- ${s.message}\n`; });
        }

        if (warnings.length > 0) {
            markdown += `\n🟡 **주의:**\n`;
            warnings.forEach(s => { markdown += `- ${s.message}\n`; });
        }

        if (infos.length > 0) {
            markdown += `\n🟢 **참고:**\n`;
            infos.forEach(s => { markdown += `- ${s.message}\n`; });
        }

        if (fused.suggestions.length > 0) {
            markdown += `\n**제안:**\n`;
            fused.suggestions.forEach(s => { markdown += `- ${s}\n`; });
        }

        return markdown;
    } catch (error) {
        console.error('[ContextFusion] Failed to generate fused context:', error);
        return '';
    }
}

// ============================================
// Helper Functions
// ============================================

async function getWeatherData(): Promise<WeatherData | null> {
    try {
        // weather_cache 테이블에서 직접 읽기 (자기 서버 fetch 대신 DB 캐시 사용)
        const { data: cached } = await supabase
            .from('weather_cache')
            .select('weather_data, updated_at')
            .eq('location', 'seoul')
            .single();

        if (cached?.weather_data) {
            const cacheAge = Date.now() - new Date(cached.updated_at).getTime();
            // 2시간 이내 캐시만 사용
            if (cacheAge < 2 * 60 * 60 * 1000) {
                return cached.weather_data as WeatherData;
            }
        }
        return null;
    } catch {
        return null;
    }
}

async function getTodaySchedules(userEmail: string): Promise<ScheduleItem[]> {
    try {
        const { data: userData } = await supabase
            .from('users')
            .select('profile')
            .eq('email', userEmail)
            .single();

        const customGoals = userData?.profile?.customGoals || [];
        const now = new Date();
        const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const todayStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}-${String(kstNow.getDate()).padStart(2, '0')}`;
        const dayOfWeek = kstNow.getDay();

        return customGoals.filter((g: any) => {
            if (g.specificDate === todayStr) return true;
            if (g.daysOfWeek?.includes(dayOfWeek)) {
                if (g.startDate && todayStr < g.startDate) return false;
                if (g.endDate && todayStr > g.endDate) return false;
                return true;
            }
            return false;
        });
    } catch {
        return [];
    }
}

async function getUserState(userEmail: string): Promise<any | null> {
    try {
        const { data } = await supabase
            .from('user_states')
            .select('stress_level, energy_level, focus_window_score')
            .eq('user_email', userEmail)
            .single();
        return data;
    } catch {
        return null;
    }
}

async function getUserProfile(userEmail: string): Promise<any | null> {
    try {
        const { data } = await supabase
            .from('users')
            .select('profile')
            .eq('email', userEmail)
            .single();
        return data?.profile || null;
    } catch {
        return null;
    }
}

function calculateUrgencyScore(signals: ContextSignal[]): number {
    let score = 0;
    signals.forEach(s => {
        if (s.severity === 'critical') score += 35;
        else if (s.severity === 'warning') score += 20;
        else score += 5;
    });
    return Math.min(100, score);
}
