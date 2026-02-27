/**
 * Resource Recommend Capability
 *
 * ai-resource-recommend API 라우트에서 추출한 핵심 로직.
 * RAG 임베딩 검색 + GPT-4.1-MINI.
 */

import OpenAI from 'openai';
import { getUserByEmail } from '@/lib/users';
import { logOpenAIUsage } from '@/lib/openai-usage';
import { getPrompt, SYSTEM_PROMPT } from '@/lib/prompts/resource-recommend';
import { generateEmbedding } from '@/lib/embeddings';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { MODELS } from '@/lib/models';
import {
    registerCapability,
    type CapabilityResult,
    type ResourceRecommendParams,
    type ResourceRecommendResult,
} from '@/lib/agent-capabilities';
import { logger } from '@/lib/logger';

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
 * RAG 컨텍스트 조회
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
        logger.error("[ResourceRecommend] RAG fetch error:", error);
        return "";
    }
}

/**
 * 리소스 추천 핵심 로직
 */
export async function generateResourceRecommendation(
    email: string,
    params: ResourceRecommendParams
): Promise<CapabilityResult<ResourceRecommendResult>> {
    try {
        const { activity, category, context, timeUntil } = params;

        if (!activity) {
            return { success: false, error: 'Activity is required', costTier: 'free', cachedHit: false };
        }

        // 프로필 로드
        let userProfile: UserProfileData = {};
        try {
            const user = await getUserByEmail(email);
            if (user?.profile) {
                userProfile = user.profile as UserProfileData;
            }
        } catch { /* ignore */ }

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
        if (Object.keys(userProfile).length > 0) {
            userContext = `사용자 정보:
- 직업/분야: ${job}
- 경력: ${experienceLabel}
- 목표: ${userProfile.goal || '미설정'}
- 관심사: ${interestLabels.join(', ') || '미설정'}
${userProfile.major ? `- 전공: ${userProfile.major}` : ''}`;
        }

        const now = new Date();
        const hourNow = now.getHours();
        const timeOfDay = hourNow < 12 ? "오전" : hourNow < 18 ? "오후" : "저녁";

        // RAG 컨텍스트 조회
        let ragContext = "";
        try {
            const user = await getUserByEmail(email);
            if (user?.id) {
                ragContext = await fetchRagForActivity(activity, user.id);
            }
        } catch { /* ignore */ }

        // Prompt Registry에서 프롬프트 조회
        const prompt = getPrompt(context, {
            userContext,
            targetActivity: activity,
            job,
            timeUntil,
            category,
            timeOfDay,
            hour: hourNow,
            ragContext,
        });

        // OpenAI 호출
        const modelName = MODELS.GPT_5_MINI;
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

        let message = "";
        let actions: unknown[] = [];
        try {
            const parsed = JSON.parse(rawContent);
            message = parsed.message || rawContent;
            actions = Array.isArray(parsed.actions) ? parsed.actions : [];
        } catch {
            message = rawContent;
        }

        const usage = completion.usage;
        if (usage) {
            await logOpenAIUsage(email, modelName, "ai-resource-recommend", usage.prompt_tokens, usage.completion_tokens);
        }

        return {
            success: true,
            data: { recommendation: message, actions, activity },
            costTier: 'moderate',
            cachedHit: false,
        };
    } catch (error) {
        logger.error('[ResourceRecommend] Error:', error);
        return { success: false, error: 'Failed to generate resource recommendation', costTier: 'moderate', cachedHit: false };
    }
}

// Register capability
registerCapability<ResourceRecommendParams, ResourceRecommendResult>({
    name: 'resource_recommend',
    description: 'RAG 기반 리소스 추천',
    costTier: 'moderate',
    execute: generateResourceRecommendation,
});
