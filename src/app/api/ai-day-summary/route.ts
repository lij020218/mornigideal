import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import OpenAI from "openai";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { MODELS } from "@/lib/models";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { todaySchedules, completedCount, totalCount, userProfile, tomorrowSchedules, userPlan } = await request.json();

    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isMaxUser = userPlan === 'Max';
    const userName = userProfile?.name || '사용자';

    // 완료/미완료 일정
    const completed = (todaySchedules || []).filter((s: any) => s.completed);
    const uncompleted = (todaySchedules || []).filter((s: any) => !s.completed && !s.skipped);
    const tomorrowList = (tomorrowSchedules || []).slice(0, 5);

    // AI에게 JSON 컴포넌트만 요청 (포맷/조립은 코드)
    const contextParts: string[] = [];
    contextParts.push(`${userName}, ${userProfile?.job || '직장인'}, 목표:${userProfile?.goal || '없음'}`);
    contextParts.push(`완료:${completedCount}/${totalCount}(${completionRate}%)`);
    if (completed.length > 0) contextParts.push(`완료일정:${completed.slice(0, 5).map((s: any) => s.text).join(',')}`);
    if (uncompleted.length > 0) contextParts.push(`미완료:${uncompleted.slice(0, 3).map((s: any) => s.text).join(',')}`);
    if (isMaxUser && tomorrowList.length > 0) contextParts.push(`내일:${tomorrowList.map((s: any) => `${s.startTime || '?'} ${s.text}`).join(',')}`);

    const modelName = isMaxUser ? MODELS.GPT_5_2 : MODELS.GPT_5_4_NANO;

    const systemPrompt = isMaxUser
        ? `하루 마무리 비서. JSON만: {"closing":"마무리 인사 한 문장","highlight":"오늘 핵심 성과 한 문장","feedback":"피드백 한 문장","tomorrowPrep":"내일 준비사항 한 문장","strategy":"장기 목표 조언 한 문장"}`
        : `하루 마무리 비서. JSON만: {"closing":"마무리 인사 한 문장","highlight":"오늘 핵심 성과 한 문장","feedback":"피드백+격려 한 문장"}`;

    const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contextParts.join('. ') },
        ],
        temperature: 1.0,
        response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';

    const usage = completion.usage;
    if (usage) {
        await logOpenAIUsage(email, modelName, '/api/ai-day-summary', usage.prompt_tokens, usage.completion_tokens);
    }

    let parsed: any;
    try {
        parsed = JSON.parse(content);
    } catch {
        parsed = {};
    }

    // 코드가 최종 메시지 조립
    const summary = assembleDaySummary({
        userName, completedCount, totalCount, completionRate,
        completed, uncompleted, tomorrowList, isMaxUser,
        closing: parsed.closing,
        highlight: parsed.highlight,
        feedback: parsed.feedback,
        tomorrowPrep: parsed.tomorrowPrep,
        strategy: parsed.strategy,
    });

    return NextResponse.json({ summary });
});

function assembleDaySummary(ctx: {
    userName: string;
    completedCount: number;
    totalCount: number;
    completionRate: number;
    completed: any[];
    uncompleted: any[];
    tomorrowList: any[];
    isMaxUser: boolean;
    closing?: string;
    highlight?: string;
    feedback?: string;
    tomorrowPrep?: string;
    strategy?: string;
}): string {
    const parts: string[] = [];

    // 1. 마무리 인사
    parts.push(ctx.closing || `${ctx.userName}님, 오늘 하루 수고 많으셨어요! 🌙`);

    // 2. 성과 요약 (코드)
    if (ctx.totalCount > 0) {
        parts.push(`📊 오늘의 성과: ${ctx.completedCount}/${ctx.totalCount}개 완료 (${ctx.completionRate}%)`);
    }

    // 3. 하이라이트 (AI)
    if (ctx.highlight) {
        parts.push(`✨ ${ctx.highlight}`);
    } else if (ctx.completed.length > 0) {
        parts.push(`✨ 오늘 완료: ${ctx.completed.slice(0, 3).map((s: any) => s.text).join(', ')}`);
    }

    // 4. 미완료 (코드)
    if (ctx.uncompleted.length > 0) {
        const items = ctx.uncompleted.slice(0, 2).map((s: any) => s.text).join(', ');
        parts.push(`⏳ 미완료: ${items} — 내일 이어서 해도 괜찮아요`);
    }

    // 5. 피드백 (AI)
    if (ctx.feedback) {
        parts.push(ctx.feedback);
    }

    // 6. Max 전용: 내일 준비 + 전략 (AI)
    if (ctx.isMaxUser) {
        if (ctx.tomorrowPrep) {
            parts.push(`📋 내일 준비: ${ctx.tomorrowPrep}`);
        } else if (ctx.tomorrowList.length > 0) {
            parts.push(`📋 내일 첫 일정: ${ctx.tomorrowList[0].startTime || '?'} ${ctx.tomorrowList[0].text}`);
        }
        if (ctx.strategy) {
            parts.push(`💡 ${ctx.strategy}`);
        }
    }

    // 7. 마무리 (코드)
    parts.push('충분한 휴식 취하시고, 내일 또 만나요! 💤');

    return parts.join('\n\n');
}
