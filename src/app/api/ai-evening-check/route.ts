/**
 * Evening Check API - Pokey 스타일 저녁 회고
 *
 * 저녁 9시에 하루를 돌아보는 메시지 생성
 * - 오늘 완료한 일정 요약
 * - 미완료 작업 확인
 * - 내일 준비 사항
 * - Wind-down 제안
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { saveDailyLog, extractMemoryFromConversation, updateUserMemory } from "@/lib/memoryService";
import { saveStateSnapshot } from "@/lib/multiDayTrendService";
import { resolvePersonaStyle, getPersonaBlock, completionRateToTone } from "@/lib/prompts/persona";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");


export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { todaySchedules, completedScheduleIds, userProfile, todayMessages } = await request.json();

    // 완료된 일정과 미완료 일정 분리
    const completedSchedules = todaySchedules?.filter((s: any) =>
        completedScheduleIds?.includes(s.id) || s.completed
    ) || [];

    const uncompletedSchedules = todaySchedules?.filter((s: any) =>
        !completedScheduleIds?.includes(s.id) && !s.completed && !s.skipped
    ) || [];

    const skippedSchedules = todaySchedules?.filter((s: any) => s.skipped) || [];

    // 완료율 계산
    const totalSchedules = todaySchedules?.length || 0;
    const completedCount = completedSchedules.length;
    const completionRate = totalSchedules > 0
        ? Math.round((completedCount / totalSchedules) * 100)
        : 0;

    // 내일 일정 가져오기
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const tomorrowDayOfWeek = tomorrow.getDay();

    const customGoals = userProfile?.customGoals || [];
    const tomorrowSchedules = customGoals.filter((g: any) => {
        if (g.specificDate === tomorrowStr) return true;
        if (g.daysOfWeek?.includes(tomorrowDayOfWeek)) {
            if (g.startDate && tomorrowStr < g.startDate) return false;
            if (g.endDate && tomorrowStr > g.endDate) return false;
            return true;
        }
        return false;
    });

    // AI 저녁 회고 메시지 생성
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const personaBlock = getPersonaBlock({
        style: resolvePersonaStyle(userProfile, userProfile?.plan),
        tone: completionRateToTone(completionRate),
        userName: userProfile?.name,
        userJob: userProfile?.job,
        plan: userProfile?.plan,
    });

    const prompt = `${personaBlock}

저녁 회고 메시지를 생성하세요.

**사용자 정보:**
- 이름: ${userProfile?.name || '사용자'}
- 직업: ${userProfile?.job || '미설정'}

**오늘 일정 현황:**
- 전체: ${totalSchedules}개
- 완료: ${completedCount}개 (${completionRate}%)
- 미완료: ${uncompletedSchedules.length}개
- 건너뜀: ${skippedSchedules.length}개

**완료한 일정:**
${completedSchedules.length > 0
    ? completedSchedules.map((s: any) => `• ${s.text}`).join('\n')
    : '• 없음'}

**미완료 일정:**
${uncompletedSchedules.length > 0
    ? uncompletedSchedules.map((s: any) => `• ${s.text}`).join('\n')
    : '• 없음'}

**내일 일정 (${tomorrowSchedules.length}개):**
${tomorrowSchedules.length > 0
    ? tomorrowSchedules.slice(0, 5).map((s: any) => `• ${s.startTime || '시간 미정'}: ${s.text}`).join('\n')
    : '• 등록된 일정 없음'}

**요청사항:**
1. 오늘 하루를 따뜻하게 마무리하는 인사 (1-2문장)
2. 완료율에 따른 격려 메시지
   - 80% 이상: 축하와 칭찬
   - 50-79%: 격려와 긍정적 피드백
   - 50% 미만: 따뜻한 위로와 내일 응원
3. 미완료 작업에 대한 부드러운 언급 (있다면)
4. 내일 준비 tip (첫 번째 일정 기준)
5. Wind-down 제안 (휴식, 수면 준비 등)

**응답 형식:**
자연스러운 한국어 메시지로 작성하세요. 이모지를 적절히 사용하세요.
존댓말을 사용하고, 200자 내외로 간결하게 작성하세요.`;

    const result = await model.generateContent(prompt);
    const eveningMessage = result.response.text();

    // 기분 분석 (완료율 기반)
    let mood: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (completionRate >= 70) mood = 'positive';
    else if (completionRate < 40) mood = 'negative';

    // Daily Log 저장
    await saveDailyLog(email, {
        summary: `${completedCount}/${totalSchedules} 일정 완료 (${completionRate}%)`,
        mood,
        keyTopics: completedSchedules.map((s: any) => s.text).slice(0, 5),
        completedTasks: completedCount,
        totalTasks: totalSchedules
    });

    // 멀티데이 트렌드용 상태 스냅샷 저장
    await saveStateSnapshot(email, {
        completionRate,
        mood,
        totalTasks: totalSchedules,
        completedTasks: completedCount,
    });

    // 오늘 대화에서 메모리 추출 (있다면)
    if (todayMessages && todayMessages.length > 0) {
        const memoryInsights = await extractMemoryFromConversation(email, todayMessages);
        if (memoryInsights) {
            await updateUserMemory(email, memoryInsights);
        }
    }

    return NextResponse.json({
        message: eveningMessage,
        stats: {
            completionRate,
            completedCount,
            totalSchedules,
            uncompletedCount: uncompletedSchedules.length,
            tomorrowCount: tomorrowSchedules.length
        }
    });
});
