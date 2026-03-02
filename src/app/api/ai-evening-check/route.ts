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
import { getPlanName } from "@/lib/user-plan";

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

    const userPlan = await getPlanName(email);

    const personaBlock = getPersonaBlock({
        style: resolvePersonaStyle(userProfile, userPlan),
        tone: completionRateToTone(completionRate),
        userName: userProfile?.name,
        userJob: userProfile?.job,
        plan: userPlan,
    });

    const userName = userProfile?.name || '사용자';

    // AI에게 JSON 컴포넌트만 요청
    const contextParts: string[] = [];
    contextParts.push(`${userName}, ${userProfile?.job || '직장인'}`);
    contextParts.push(`완료:${completedCount}/${totalSchedules}(${completionRate}%)`);
    if (completedSchedules.length > 0) contextParts.push(`완료:${completedSchedules.slice(0, 4).map((s: any) => s.text).join(',')}`);
    if (uncompletedSchedules.length > 0) contextParts.push(`미완료:${uncompletedSchedules.slice(0, 3).map((s: any) => s.text).join(',')}`);
    if (tomorrowSchedules.length > 0) contextParts.push(`내일:${tomorrowSchedules.slice(0, 3).map((s: any) => `${s.startTime||'?'} ${s.text}`).join(',')}`);

    const prompt = `${personaBlock}\n${contextParts.join('. ')}. JSON만(이모지 제외): {"closing":"마무리 인사 한 문장","encouragement":"격려 한 문장","tomorrowTip":"내일 준비 팁 한 문장","windDown":"수면/휴식 제안 한 문장"}`;

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
    });
    const responseText = result.response.text();

    let parsed: any;
    try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
        parsed = {};
    }

    // 코드가 최종 메시지 조립
    const eveningParts: string[] = [];

    // 1. 마무리 인사
    eveningParts.push(parsed.closing || `${userName}님, 오늘 하루 수고 많으셨어요 🌙`);

    // 2. 성과 (코드)
    if (totalSchedules > 0) {
        eveningParts.push(`📊 오늘의 성과: ${completedCount}/${totalSchedules}개 완료 (${completionRate}%)`);
    }

    // 3. 격려 (AI)
    if (parsed.encouragement) {
        eveningParts.push(parsed.encouragement);
    } else if (completionRate >= 80) {
        eveningParts.push('오늘 정말 잘해내셨어요! 👏');
    } else if (completionRate >= 50) {
        eveningParts.push('절반 이상 해내신 것도 대단해요 💪');
    } else {
        eveningParts.push('쉬어가는 것도 중요해요. 내일 다시 시작하면 돼요 ☕');
    }

    // 4. 미완료 (코드)
    if (uncompletedSchedules.length > 0 && uncompletedSchedules.length <= 3) {
        eveningParts.push(`⏳ ${uncompletedSchedules.map((s: any) => s.text).join(', ')} — 내일로 미뤄도 괜찮아요`);
    }

    // 5. 내일 준비 (AI)
    if (parsed.tomorrowTip) {
        eveningParts.push(`📋 ${parsed.tomorrowTip}`);
    }

    // 6. Wind-down (AI)
    if (parsed.windDown) {
        eveningParts.push(`🌙 ${parsed.windDown}`);
    } else {
        eveningParts.push('🌙 편안한 밤 보내세요 😴');
    }

    const eveningMessage = eveningParts.join('\n\n');

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
