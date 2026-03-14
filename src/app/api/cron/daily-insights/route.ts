/**
 * 일일 인사이트 생성 CRON
 *
 * 매일 21시 KST (UTC 12시)에 실행
 * 사용자의 오늘 일정 데이터를 분석하여 AI 인사이트 생성
 * → user_kv_store에 daily_insights_YYYY-MM-DD 키로 저장
 * → 성장 탭 분석 페이지에서 표시
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { kvGet, kvSet } from '@/lib/kv-store';
import { withCron } from '@/lib/api-handler';
import { withCronLogging } from '@/lib/cron-logger';
import { logger } from '@/lib/logger';
import { MODELS } from '@/lib/models';
import type { CustomGoal } from '@/lib/types';

export const maxDuration = 120;

interface DailyInsight {
    achievements: string[];
    improvements: string[];
    recommendations: string[];
    summary: string; // AI 한 줄 요약
    generatedAt: string;
}

// 카테고리 분류 키워드
const WORK_KEYWORDS = ['업무', '회의', '미팅', '출근', '퇴근', '근무', '야근', 'work', '수업', '강의', '과제'];
const LEARNING_KEYWORDS = ['학습', '공부', '강의', '읽기', '독서', '스터디', '코딩', '개발', '사이드프로젝트', '포트폴리오', 'study', 'learn'];
const EXERCISE_KEYWORDS = ['운동', '헬스', '요가', '러닝', '조깅', '필라테스', '수영', '등산', '산책', '스트레칭', '근력', '축구', '농구', '테니스', '배드민턴', '자전거', '걷기', 'workout', 'gym'];
const WELLNESS_KEYWORDS = ['명상', '휴식', '수면', '취침', '기상', '낮잠', '웰빙', '마사지', '사우나', '반신욕', 'wellness', 'rest', 'sleep'];

function categorizeSchedule(text: string): string {
    const t = text.toLowerCase();
    if (WORK_KEYWORDS.some(k => t.includes(k))) return '업무';
    if (LEARNING_KEYWORDS.some(k => t.includes(k))) return '학습';
    if (EXERCISE_KEYWORDS.some(k => t.includes(k))) return '운동';
    if (WELLNESS_KEYWORDS.some(k => t.includes(k))) return '웰빙';
    return '기타';
}

export const GET = withCron(withCronLogging('daily-insights', async (_request: NextRequest) => {
    const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayDayOfWeek = kst.getDay();

    // 전체 사용자 조회
    const { data: users } = await supabaseAdmin
        .from('users')
        .select('email, profile');

    if (!users || users.length === 0) {
        return NextResponse.json({ message: 'No users', processed: 0 });
    }

    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
        try {
            // 이미 오늘 인사이트 생성됐는지 확인
            const existing = await kvGet<DailyInsight>(user.email, `daily_insights_${todayStr}`);
            if (existing) {
                skipped++;
                continue;
            }

            const profile = user.profile || {};
            const customGoals: CustomGoal[] = profile.customGoals || [];

            // 오늘 일정 필터링 (specificDate 또는 반복 일정)
            const todaySchedules = customGoals.filter(g => {
                if (g.specificDate === todayStr) return true;
                if (g.daysOfWeek && g.daysOfWeek.includes(todayDayOfWeek)) {
                    if (g.startDate && todayStr < g.startDate) return false;
                    if (g.endDate && todayStr > g.endDate) return false;
                    return true;
                }
                return false;
            });

            if (todaySchedules.length === 0) {
                skipped++;
                continue;
            }

            // 일정 통계 계산
            const total = todaySchedules.length;
            const completed = todaySchedules.filter(s => s.completed).length;
            const completionRate = Math.round((completed / total) * 100);

            // 카테고리별 분류
            const categoryStats: Record<string, { total: number; completed: number }> = {};
            todaySchedules.forEach(s => {
                const cat = categorizeSchedule(s.text || '');
                if (!categoryStats[cat]) categoryStats[cat] = { total: 0, completed: 0 };
                categoryStats[cat].total++;
                if (s.completed) categoryStats[cat].completed++;
            });

            // 시간대별 분포
            const timeSlots = { morning: 0, afternoon: 0, evening: 0 };
            todaySchedules.forEach(s => {
                if (!s.startTime) return;
                const hour = parseInt(s.startTime.split(':')[0], 10);
                if (hour >= 6 && hour < 12) timeSlots.morning++;
                else if (hour >= 12 && hour < 18) timeSlots.afternoon++;
                else if (hour >= 18) timeSlots.evening++;
            });

            // 최근 7일 완료율 조회 (트렌드 파악)
            const weekAgo = new Date(kst);
            weekAgo.setDate(kst.getDate() - 7);
            const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;

            const recentInsightsKeys: string[] = [];
            for (let i = 1; i <= 7; i++) {
                const d = new Date(kst);
                d.setDate(kst.getDate() - i);
                recentInsightsKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            }

            // 기분 데이터 조회
            const monthKey = `mood_checkins_${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}`;
            const moodData = await kvGet<any[]>(user.email, monthKey);
            const todayMood = Array.isArray(moodData) ? moodData.find(m => m.date === todayStr) : null;

            // 일정 상세 목록 구성
            const scheduleList = todaySchedules.map(s => {
                const cat = categorizeSchedule(s.text || '');
                return `- ${s.text} [${cat}] ${s.completed ? '(완료)' : '(미완료)'}${s.startTime ? ` ${s.startTime}` : ''}`;
            }).join('\n');

            const categorySummary = Object.entries(categoryStats)
                .map(([cat, st]) => `${cat}: ${st.completed}/${st.total}`)
                .join(', ');

            const userJob = profile.job || '';
            const userGoal = profile.goal || '';
            const userContext = userJob && userGoal
                ? `직업: ${userJob}, 목표: "${userGoal}"`
                : userJob ? `직업: ${userJob}` : userGoal ? `목표: "${userGoal}"` : '';

            // GPT로 인사이트 생성
            const prompt = `오늘(${todayStr}, ${dayNames[todayDayOfWeek]}요일) 일정 데이터를 분석하여 인사이트를 JSON으로 생성해주세요.

${userContext ? `사용자 정보: ${userContext}` : ''}

오늘 일정 (${total}개 중 ${completed}개 완료, 완료율 ${completionRate}%):
${scheduleList}

카테고리별: ${categorySummary}
시간대별: 아침 ${timeSlots.morning}개, 오후 ${timeSlots.afternoon}개, 저녁 ${timeSlots.evening}개
${todayMood ? `오늘 기분: ${todayMood.mood}/5, 에너지: ${todayMood.energy}/5` : ''}

다음 JSON 형식으로 응답:
{
  "achievements": ["잘한 점 1~2개 (구체적, 데이터 기반)"],
  "improvements": ["개선할 점 0~1개 (실질적 제안)"],
  "recommendations": ["내일을 위한 추천 0~1개 (구체적 행동)"],
  "summary": "한 줄 요약 (30자 이내)"
}

규칙:
- 각 항목은 한국어, 반말 금지, 존댓말
- 이모지 1개씩 앞에 포함
- 실제 일정 이름과 데이터를 구체적으로 언급
- 일정이 없는 카테고리는 언급하지 않기
- achievements: 완료한 일정이 있으면 반드시 1개 이상
- improvements: 미완료 일정이 많으면 1개, 완료율 높으면 빈 배열
- recommendations: 내일 실천할 수 있는 구체적 제안 1개
- summary: 오늘 하루를 한 줄로 요약`;

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
                                content: '당신은 개인 일정 관리 앱의 AI 분석가입니다. 사용자의 실제 일정 데이터를 기반으로 구체적이고 실용적인 인사이트를 생성합니다. 반드시 유효한 JSON만 출력하세요.',
                            },
                            { role: 'user', content: prompt },
                        ],
                        response_format: { type: 'json_object' },
                        temperature: 0.7,
                        max_completion_tokens: 500,
                    }),
                });

                if (!response.ok) {
                    logger.error(`[DailyInsights] OpenAI API failed for ${user.email}: ${response.status}`);
                    // 폴백: 규칙 기반 인사이트
                    const fallback = generateFallbackInsights(todaySchedules, completionRate, categoryStats);
                    await kvSet(user.email, `daily_insights_${todayStr}`, fallback);
                    generated++;
                    continue;
                }

                const data = await response.json();
                const parsed = JSON.parse(data.choices[0].message.content || '{}');

                const insight: DailyInsight = {
                    achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
                    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
                    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
                    summary: parsed.summary || '',
                    generatedAt: new Date().toISOString(),
                };

                await kvSet(user.email, `daily_insights_${todayStr}`, insight);
                generated++;
            } catch (aiError) {
                logger.error(`[DailyInsights] AI error for ${user.email}:`, aiError instanceof Error ? aiError.message : aiError);
                const fallback = generateFallbackInsights(todaySchedules, completionRate, categoryStats);
                await kvSet(user.email, `daily_insights_${todayStr}`, fallback);
                generated++;
            }
        } catch (error) {
            logger.error(`[DailyInsights] Error for ${user.email}:`, error instanceof Error ? error.message : error);
            errors++;
        }
    }

    return NextResponse.json({
        success: true,
        date: todayStr,
        generated,
        skipped,
        errors,
        total: users.length,
    });
}));

/**
 * AI 실패 시 규칙 기반 폴백 인사이트
 */
function generateFallbackInsights(
    schedules: CustomGoal[],
    completionRate: number,
    categoryStats: Record<string, { total: number; completed: number }>,
): DailyInsight {
    const achievements: string[] = [];
    const improvements: string[] = [];
    const recommendations: string[] = [];

    const total = schedules.length;
    const completed = schedules.filter(s => s.completed).length;

    if (completionRate >= 80) {
        achievements.push(`🎯 오늘 ${completed}/${total}개 일정을 완료하셨어요! 훌륭한 실행력입니다.`);
    } else if (completed > 0) {
        achievements.push(`✅ 오늘 ${completed}개의 일정을 완료하셨어요.`);
    }

    if (categoryStats['운동']?.completed && categoryStats['운동'].completed > 0) {
        achievements.push(`💪 운동 일정을 실천하셨어요! 건강한 하루였습니다.`);
    }

    if (completionRate < 50 && total > 0) {
        improvements.push(`📋 미완료 일정이 ${total - completed}개 있어요. 내일은 우선순위를 정해보세요.`);
    }

    if (!categoryStats['학습'] || categoryStats['학습'].total === 0) {
        recommendations.push(`📚 내일은 짧은 학습 시간을 추가해보세요.`);
    } else {
        recommendations.push(`🔄 오늘의 흐름을 유지하면서 내일도 계획을 실행해보세요.`);
    }

    const summary = completionRate >= 80
        ? `완료율 ${completionRate}%, 알찬 하루!`
        : completionRate >= 50
            ? `${completed}/${total}개 완료, 꾸준히 성장 중!`
            : `${completed}개 완료, 내일 더 분발!`;

    return {
        achievements,
        improvements,
        recommendations,
        summary,
        generatedAt: new Date().toISOString(),
    };
}
