import db from "@/lib/db";

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
 * 주간 리포트 생성
 */
export async function generateWeeklyReport(userEmail: string): Promise<WeeklyReportData> {
    console.log(`[Weekly Report] Generating report for ${userEmail}`);

    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(now.getDate() - 7);

    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(now.getDate() - 14);

    // Get user profile
    const supabase = db.client;
    const { data: userData } = await supabase
        .from('users')
        .select('profile')
        .eq('email', userEmail)
        .maybeSingle();

    const profile = userData?.profile || {};
    const customGoals = profile.customGoals || [];

    // 1. Schedule Analysis (지난 1주일 일정 분석)
    const lastWeekSchedules = customGoals.filter((goal: any) => {
        if (!goal.specificDate) return false;
        const goalDate = new Date(goal.specificDate);
        return goalDate >= oneWeekAgo && goalDate <= now;
    });

    const previousWeekSchedules = customGoals.filter((goal: any) => {
        if (!goal.specificDate) return false;
        const goalDate = new Date(goal.specificDate);
        return goalDate >= twoWeeksAgo && goalDate < oneWeekAgo;
    });

    const totalSchedules = lastWeekSchedules.length;
    const completedSchedules = lastWeekSchedules.filter((g: any) => g.completed).length;
    const completionRate = totalSchedules > 0 ? (completedSchedules / totalSchedules) * 100 : 0;

    // Category breakdown
    const categoryBreakdown = {
        work: 0,
        learning: 0,
        exercise: 0,
        wellness: 0,
        other: 0,
    };

    lastWeekSchedules.forEach((goal: any) => {
        const text = (goal.text || '').toLowerCase();
        if (text.includes('업무') || text.includes('회의') || text.includes('미팅') || text.includes('work')) {
            categoryBreakdown.work++;
        } else if (text.includes('학습') || text.includes('공부') || text.includes('강의') || text.includes('읽기')) {
            categoryBreakdown.learning++;
        } else if (text.includes('운동') || text.includes('헬스') || text.includes('요가') || text.includes('workout')) {
            categoryBreakdown.exercise++;
        } else if (text.includes('명상') || text.includes('휴식') || text.includes('수면') || text.includes('wellness')) {
            categoryBreakdown.wellness++;
        } else {
            categoryBreakdown.other++;
        }
    });

    // Day-by-day productivity
    const dayProductivity: Record<string, number> = {};
    lastWeekSchedules.forEach((goal: any) => {
        const date = goal.specificDate;
        if (!dayProductivity[date]) dayProductivity[date] = 0;
        if (goal.completed) dayProductivity[date]++;
    });

    const sortedDays = Object.entries(dayProductivity).sort((a, b) => b[1] - a[1]);
    const mostProductiveDay = sortedDays[0]?.[0] || 'N/A';
    const leastProductiveDay = sortedDays[sortedDays.length - 1]?.[0] || 'N/A';
    const avgSchedulesPerDay = totalSchedules / 7;

    // 2. Trend Briefing Analysis (트렌드 브리핑 읽은 횟수)
    const { data: readingEvents } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_email', userEmail)
        .eq('event_type', 'trend_briefing_read')
        .gte('start_at', oneWeekAgo.toISOString())
        .lte('start_at', now.toISOString());

    const totalRead = readingEvents?.length || 0;
    const avgReadPerDay = totalRead / 7;

    // Category breakdown for briefings
    const categoryCount: Record<string, number> = {};
    readingEvents?.forEach((event: any) => {
        const category = event.metadata?.category || 'other';
        categoryCount[category] = (categoryCount[category] || 0) + 1;
    });

    const topCategories = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, count]) => ({ category, count }));

    // Reading streak (연속 읽은 일수)
    const readingDays = new Set(
        readingEvents?.map((event: any) => new Date(event.start_at).toISOString().split('T')[0]) || []
    );
    const readingStreak = readingDays.size;

    // 3. Growth Metrics
    const { data: allEvents } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_email', userEmail)
        .gte('start_at', oneWeekAgo.toISOString());

    const workoutEvents = allEvents?.filter((e: any) => e.event_type === 'workout_completed') || [];
    const learningEvents = allEvents?.filter((e: any) => e.event_type === 'learning_completed') || [];

    const newHabitsFormed = workoutEvents.length >= 3 ? 1 : 0; // 주 3회 이상이면 습관으로 간주
    const consistencyScore = Math.min(100, (completionRate + readingStreak * 10) / 2);

    const focusAreas: string[] = [];
    if (categoryBreakdown.work > categoryBreakdown.learning) focusAreas.push('업무');
    if (categoryBreakdown.learning > 0) focusAreas.push('학습');
    if (categoryBreakdown.exercise >= 3) focusAreas.push('운동');
    if (categoryBreakdown.wellness > 0) focusAreas.push('웰빙');

    // Estimated time invested (duration sum)
    const timeInvested = lastWeekSchedules.reduce((sum: number, goal: any) => {
        const duration = parseInt(goal.duration) || 60;
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
    const previousCompleted = previousWeekSchedules.filter((g: any) => g.completed).length;
    const previousCompletionRate = previousTotal > 0 ? (previousCompleted / previousTotal) * 100 : 0;

    const { data: previousReadingEvents } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_email', userEmail)
        .eq('event_type', 'trend_briefing_read')
        .gte('start_at', twoWeeksAgo.toISOString())
        .lt('start_at', oneWeekAgo.toISOString());

    const previousRead = previousReadingEvents?.length || 0;

    const scheduleChange = previousTotal > 0 ? ((totalSchedules - previousTotal) / previousTotal) * 100 : 0;
    const completionRateChange = previousCompletionRate > 0 ? completionRate - previousCompletionRate : 0;
    const readingChange = previousRead > 0 ? ((totalRead - previousRead) / previousRead) * 100 : 0;

    const weekNumber = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

    return {
        period: {
            start: oneWeekAgo.toISOString().split('T')[0],
            end: now.toISOString().split('T')[0],
            weekNumber,
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
export async function generateWeeklyReportNarrative(reportData: WeeklyReportData, userProfile: any): Promise<string> {
    const { scheduleAnalysis, trendBriefingAnalysis, growthMetrics, insights, comparisonWithLastWeek } = reportData;

    const prompt = `당신은 사용자의 성장을 돕는 코치입니다. 다음 주간 데이터를 바탕으로 격려와 인사이트가 담긴 주간 리포트를 작성해주세요.

**사용자 정보:**
- 직업/역할: ${userProfile.job || '정보 없음'}
- 목표: ${userProfile.goal || '정보 없음'}

**이번 주 활동 (${reportData.period.start} ~ ${reportData.period.end}):**

📅 **일정 관리**
- 총 일정: ${scheduleAnalysis.totalSchedules}개
- 완료한 일정: ${scheduleAnalysis.completedSchedules}개 (완료율 ${scheduleAnalysis.completionRate.toFixed(1)}%)
- 카테고리별: 업무 ${scheduleAnalysis.categoryBreakdown.work}, 학습 ${scheduleAnalysis.categoryBreakdown.learning}, 운동 ${scheduleAnalysis.categoryBreakdown.exercise}, 웰빙 ${scheduleAnalysis.categoryBreakdown.wellness}
- 가장 생산적인 날: ${scheduleAnalysis.mostProductiveDay}

📚 **트렌드 학습**
- 읽은 브리핑: ${trendBriefingAnalysis.totalRead}개
- 일평균: ${trendBriefingAnalysis.avgReadPerDay.toFixed(1)}개
- 연속 학습: ${trendBriefingAnalysis.readingStreak}일
- 관심 카테고리: ${trendBriefingAnalysis.topCategories.map(c => c.category).join(', ')}

📈 **성장 지표**
- 일관성 점수: ${growthMetrics.consistencyScore.toFixed(0)}/100
- 집중 영역: ${growthMetrics.focusAreas.join(', ')}
- 투자 시간: ${Math.round(growthMetrics.timeInvested / 60)}시간

**지난주 대비 변화:**
- 일정 ${comparisonWithLastWeek.scheduleChange > 0 ? '증가' : '감소'}: ${Math.abs(comparisonWithLastWeek.scheduleChange).toFixed(1)}%
- 완료율 ${comparisonWithLastWeek.completionRateChange > 0 ? '상승' : '하락'}: ${Math.abs(comparisonWithLastWeek.completionRateChange).toFixed(1)}%p
- 브리핑 읽기 ${comparisonWithLastWeek.readingChange > 0 ? '증가' : '감소'}: ${Math.abs(comparisonWithLastWeek.readingChange).toFixed(1)}%

**인사이트:**
✅ 성취: ${insights.achievements.join(' ')}
⚠️ 개선점: ${insights.improvements.join(' ')}
💡 추천: ${insights.recommendations.join(' ')}

**리포트 작성 가이드:**
1. 친근하고 격려하는 톤으로 작성
2. 구체적인 숫자와 함께 성장을 강조
3. 개선점은 긍정적으로 표현 (예: "더 나아질 수 있는 부분")
4. 다음 주를 위한 구체적인 액션 아이템 3개 제시
5. 마크다운 형식으로 작성 (제목, 이모지, 리스트 활용)
6. 전체 길이는 400-600자 정도로 간결하게

주간 리포트를 작성해주세요:`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: '당신은 사용자의 성장을 돕는 친근한 AI 코치입니다. 데이터를 바탕으로 격려와 통찰이 담긴 주간 리포트를 작성합니다.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.7,
                max_tokens: 1000,
            }),
        });

        if (!response.ok) {
            console.error('[Weekly Report] OpenAI API failed:', response.status);
            return generateFallbackNarrative(reportData);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('[Weekly Report] Error generating narrative:', error);
        return generateFallbackNarrative(reportData);
    }
}

/**
 * AI 실패 시 폴백 리포트
 */
function generateFallbackNarrative(reportData: WeeklyReportData): string {
    const { scheduleAnalysis, trendBriefingAnalysis, insights } = reportData;

    return `# 📊 이번 주 성장 리포트

## 🎯 주간 하이라이트

이번 주 ${scheduleAnalysis.totalSchedules}개의 일정 중 ${scheduleAnalysis.completedSchedules}개를 완료하셨네요! (완료율 ${scheduleAnalysis.completionRate.toFixed(1)}%)

${insights.achievements.length > 0 ? '### ✨ 이번 주 성취\n' + insights.achievements.map(a => `- ${a}`).join('\n') : ''}

## 📚 학습 현황

- 트렌드 브리핑 ${trendBriefingAnalysis.totalRead}개 읽기
- ${trendBriefingAnalysis.readingStreak}일 연속 학습

${insights.improvements.length > 0 ? '## 💡 다음 주 개선 포인트\n' + insights.improvements.map(i => `- ${i}`).join('\n') : ''}

${insights.recommendations.length > 0 ? '## 🚀 추천 액션\n' + insights.recommendations.map(r => `- ${r}`).join('\n') : ''}

계속해서 성장하는 모습 응원합니다! 💪`;
}
