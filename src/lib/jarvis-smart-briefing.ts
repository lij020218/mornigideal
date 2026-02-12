/**
 * 자비스 스마트 브리핑
 * - 사용자 관심사 기반 뉴스 필터링
 * - AI 판단 보조 (중요도 평가)
 * - 프로/맥스 플랜 기능
 */

import OpenAI from "openai";
import { canUseFeature } from "./user-plan";
import { searchMemories } from "./jarvis-memory";
import { MODELS } from "@/lib/models";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 브리핑 항목
export interface BriefingItem {
    id: string;
    title: string;
    summary: string;
    source: string;
    url?: string;
    relevanceScore: number;      // 관련성 점수 (0-1)
    importanceLevel: "critical" | "important" | "normal" | "fyi";
    actionSuggestion?: string;   // 제안 행동
    relatedGoals?: string[];     // 관련 목표
}

// 스마트 브리핑 결과
export interface SmartBriefing {
    date: string;
    greeting: string;
    criticalItems: BriefingItem[];
    importantItems: BriefingItem[];
    normalItems: BriefingItem[];
    insights: string[];
}

// 사용자 프로필 타입
interface UserProfile {
    job?: string;
    goal?: string;
    interests?: string[];
    customGoals?: any[];
}

/**
 * 스마트 브리핑 생성
 * @param email 사용자 이메일
 * @param news 원본 뉴스 목록
 * @param userProfile 사용자 프로필
 */
export async function generateSmartBriefing(
    email: string,
    news: Array<{ title: string; description: string; source: string; url?: string }>,
    userProfile: UserProfile
): Promise<SmartBriefing | null> {
    try {
        // 프로/맥스 플랜 체크
        const hasAccess = await canUseFeature(email, "smart_briefing");
        if (!hasAccess) {
            return null;
        }

        // 맥스 플랜이면 장기 기억에서 관련 컨텍스트 가져오기
        let memoryContext = "";
        const hasMemory = await canUseFeature(email, "jarvis_memory");
        if (hasMemory && userProfile.goal) {
            const memoryResult = await searchMemories(email, userProfile.goal, {
                limit: 3,
                minSimilarity: 0.6,
            });
            if (memoryResult.success && memoryResult.memories?.length) {
                memoryContext = `
[사용자의 관련 기억]
${memoryResult.memories.map(m => `- ${m.content}`).join("\n")}
`;
            }
        }

        // 프롬프트 구성
        const prompt = `당신은 사용자의 개인 비서 "자비스"입니다. 뉴스를 분석하고 사용자에게 맞춤형 브리핑을 제공하세요.

[사용자 정보]
- 직업: ${userProfile.job || "미설정"}
- 목표: ${userProfile.goal || "미설정"}
- 관심사: ${(userProfile.interests || []).join(", ") || "미설정"}
${memoryContext}

[오늘의 뉴스]
${news.slice(0, 15).map((n, i) => `${i + 1}. [${n.source}] ${n.title}\n   ${n.description || ""}`).join("\n\n")}

[분석 요청]
1. 각 뉴스를 사용자 관점에서 분석
2. 관련성과 중요도 평가
3. 필요시 행동 제안

[중요도 기준]
- critical: 사용자의 직업/목표에 직접적 영향 (즉시 확인 필요)
- important: 관심사와 높은 관련성 (오늘 중 확인 권장)
- normal: 알아두면 좋은 정보
- fyi: 참고용

[응답 형식 - JSON]
{
    "greeting": "사용자 맞춤 인사 (1문장, 오늘 브리핑 요약 포함)",
    "items": [
        {
            "newsIndex": 1,
            "relevanceScore": 0.0-1.0,
            "importanceLevel": "critical|important|normal|fyi",
            "summary": "사용자 관점에서의 요약 (1-2문장)",
            "actionSuggestion": "제안 행동 (필요시만)",
            "relatedGoals": ["관련 목표"]
        }
    ],
    "insights": [
        "오늘 뉴스에서 발견한 패턴/트렌드 (최대 2개)"
    ]
}`;

        const response = await openai.chat.completions.create({
            model: MODELS.GPT_4O_MINI,
            messages: [
                {
                    role: "system",
                    content: "당신은 토니 스타크의 자비스처럼 똑똑하고 통찰력 있는 AI 비서입니다. 단순히 뉴스를 나열하지 않고, 사용자에게 정말 중요한 것을 골라 왜 중요한지 설명합니다.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.5,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) return null;

        // JSON 파싱
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        const result = JSON.parse(jsonMatch[0]);
        const today = new Date().toISOString().split("T")[0];

        // 결과 구조화
        const briefing: SmartBriefing = {
            date: today,
            greeting: result.greeting,
            criticalItems: [],
            importantItems: [],
            normalItems: [],
            insights: result.insights || [],
        };

        // 뉴스 항목 분류
        for (const item of result.items || []) {
            const newsItem = news[item.newsIndex - 1];
            if (!newsItem) continue;

            const briefingItem: BriefingItem = {
                id: `news-${item.newsIndex}`,
                title: newsItem.title,
                summary: item.summary,
                source: newsItem.source,
                url: newsItem.url,
                relevanceScore: item.relevanceScore,
                importanceLevel: item.importanceLevel,
                actionSuggestion: item.actionSuggestion,
                relatedGoals: item.relatedGoals,
            };

            switch (item.importanceLevel) {
                case "critical":
                    briefing.criticalItems.push(briefingItem);
                    break;
                case "important":
                    briefing.importantItems.push(briefingItem);
                    break;
                default:
                    briefing.normalItems.push(briefingItem);
            }
        }

        // 관련성 높은 순으로 정렬
        briefing.criticalItems.sort((a, b) => b.relevanceScore - a.relevanceScore);
        briefing.importantItems.sort((a, b) => b.relevanceScore - a.relevanceScore);
        briefing.normalItems.sort((a, b) => b.relevanceScore - a.relevanceScore);


        return briefing;
    } catch (error) {
        console.error("[SmartBriefing] Error:", error);
        return null;
    }
}

/**
 * 일정 관련 판단 보조
 * - 새 일정 추가 시 기존 일정/목표와의 관계 분석
 */
export async function analyzeScheduleDecision(
    email: string,
    newScheduleText: string,
    context: {
        existingSchedules: Array<{ text: string; startTime: string }>;
        userGoal?: string;
        tomorrowSchedules?: Array<{ text: string; startTime: string }>;
    }
): Promise<{
    recommendation: "approve" | "caution" | "reconsider";
    reason: string;
    suggestion?: string;
} | null> {
    try {
        const hasAccess = await canUseFeature(email, "smart_briefing");
        if (!hasAccess) return null;

        const prompt = `사용자가 새 일정을 추가하려 합니다. 기존 일정과 목표를 고려해 조언해주세요.

[새 일정]
"${newScheduleText}"

[오늘 기존 일정]
${context.existingSchedules.map(s => `- ${s.startTime}: ${s.text}`).join("\n") || "없음"}

[내일 일정]
${context.tomorrowSchedules?.map(s => `- ${s.startTime}: ${s.text}`).join("\n") || "없음"}

[사용자 목표]
${context.userGoal || "미설정"}

[판단 기준]
- 일정 충돌 여부
- 다음 날 중요 일정 영향 (수면, 준비 시간)
- 목표 달성과의 관계

[응답 형식 - JSON]
{
    "recommendation": "approve" | "caution" | "reconsider",
    "reason": "판단 이유 (1-2문장)",
    "suggestion": "대안 제안 (필요시)"
}`;

        const response = await openai.chat.completions.create({
            model: MODELS.GPT_4O_MINI,
            messages: [
                {
                    role: "system",
                    content: "당신은 일정 관리 전문가입니다. 사용자의 생산성과 웰빙을 고려해 일정에 대해 조언합니다.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.3,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) return null;

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error("[SmartBriefing] analyzeScheduleDecision error:", error);
        return null;
    }
}
