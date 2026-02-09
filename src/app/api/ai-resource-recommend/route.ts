import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import OpenAI from "openai";
import { getUserByEmail } from "@/lib/users";
import { logOpenAIUsage } from "@/lib/openai-usage";
import { getPrompt, SYSTEM_PROMPT } from "@/lib/prompts/resource-recommend";
import { generateEmbedding } from "@/lib/embeddings";
import { supabaseAdmin } from "@/lib/supabase-admin";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface UserProfileData {
    userType?: string;
    major?: string;
    field?: string;
    experience?: string;
    goal?: string;
    interests?: string[];
    job?: string;
    level?: string;
}

/**
 * RAG 컨텍스트 조회: 활동명으로 관련 과거 기억 검색
 */
async function fetchRagForActivity(activityName: string, userId: string): Promise<string> {
    try {
        const { embedding } = await generateEmbedding(activityName);

        const { data: memories } = await supabaseAdmin.rpc(
            'search_similar_memories',
            {
                query_embedding: JSON.stringify(embedding),
                match_user_id: userId,
                match_threshold: 0.75,
                match_count: 3,
            }
        );

        if (!memories || memories.length === 0) return "";

        return `
🧠 **관련 과거 기억:**
${memories.map((m: any, i: number) => `${i + 1}. [${m.content_type}] ${m.content}${m.metadata?.date ? ` (${m.metadata.date})` : ''}`).join('\n')}

이 과거 기억을 참고하여 더 개인화된 조언을 제공하세요.`;
    } catch (error) {
        console.error("[AI Resource Recommend] RAG fetch error:", error);
        return "";
    }
}

export async function POST(request: NextRequest) {
    try {
        console.log("[AI Resource Recommend] API 호출 시작");

        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { activity, category, context, timeUntil, activityName, userProfile: providedProfile, tone, completionRate, completionStreak, dayDensity, location } = await request.json();
        const targetActivity = activityName || activity;

        if (!targetActivity) {
            return NextResponse.json({ error: "Activity is required" }, { status: 400 });
        }

        // 프로필 로드
        let userProfile: UserProfileData = providedProfile || {};
        if (!providedProfile || Object.keys(providedProfile).length === 0) {
            try {
                const user = await getUserByEmail(session.user.email);
                if (user?.profile) {
                    userProfile = user.profile as UserProfileData;
                }
            } catch {}
        }

        // 사용자 컨텍스트 빌드
        const interestMap: Record<string, string> = {
            ai: "AI/인공지능", startup: "스타트업/창업", marketing: "마케팅/브랜딩",
            development: "개발/프로그래밍", design: "디자인/UX", finance: "재테크/투자",
            selfdev: "자기계발", health: "건강/운동",
        };
        const experienceMap: Record<string, string> = {
            student: "학생/취준생", junior: "1-3년차", mid: "4-7년차",
            senior: "8년차 이상", beginner: "입문자", intermediate: "중급자",
        };

        const interestLabels = (userProfile.interests || []).map(i => interestMap[i] || i);
        const experienceLabel = experienceMap[userProfile.experience || userProfile.level || ""] || userProfile.experience || userProfile.level || "미설정";
        const job = userProfile.job || userProfile.field || '전문직';

        let userContext = "";
        if (userProfile && Object.keys(userProfile).length > 0) {
            userContext = `사용자 정보:
- 직업/분야: ${job}
- 경력: ${experienceLabel}
- 목표: ${userProfile.goal || '미설정'}
- 관심사: ${interestLabels.join(', ') || '미설정'}
${userProfile.major ? `- 전공: ${userProfile.major}` : ''}`;
        }

        const now = new Date();
        const hour = now.getHours();
        const timeOfDay = hour < 12 ? "오전" : hour < 18 ? "오후" : "저녁";

        // RAG 컨텍스트 조회 (사용자 ID 필요)
        let ragContext = "";
        try {
            const user = await getUserByEmail(session.user.email);
            if (user?.id) {
                ragContext = await fetchRagForActivity(targetActivity, user.id);
            }
        } catch {}

        // 위치 컨텍스트
        const locationContext = location
            ? `📍 사용자 현재 위치: ${location.city || `${location.latitude}, ${location.longitude}`}`
            : "";

        // Prompt Registry에서 프롬프트 조회
        const prompt = getPrompt(context, {
            userContext, targetActivity, job, timeUntil, category, timeOfDay, hour, ragContext, tone, completionRate, completionStreak, dayDensity, locationContext,
        });

        // OpenAI 호출 (JSON 출력 강제)
        const modelName = "gpt-4.1-mini-2025-04-14";
        const completion = await openai.chat.completions.create({
            model: modelName,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
        });

        const rawContent = completion.choices[0]?.message?.content || '{}';

        // JSON 파싱 (실패 시 텍스트 fallback)
        let message = "";
        let actions: any[] = [];

        try {
            const parsed = JSON.parse(rawContent);
            message = parsed.message || rawContent;
            actions = Array.isArray(parsed.actions) ? parsed.actions : [];
        } catch {
            // JSON 파싱 실패 시 텍스트 그대로 사용
            message = rawContent;
        }

        // 사용량 로깅
        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(
                session.user.email, modelName, "ai-resource-recommend",
                usage.prompt_tokens, usage.completion_tokens
            );
        }

        return NextResponse.json({
            recommendation: message,
            actions,
            activity: targetActivity,
            category,
            context,
        });
    } catch (error: any) {
        console.error("[AI Resource Recommend] Error:", error.message);
        return NextResponse.json(
            { error: "Failed to generate resource recommendation", details: error.message },
            { status: 500 }
        );
    }
}
