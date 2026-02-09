/**
 * Memory Service - Pokey 스타일 메모리 시스템
 *
 * 사용자와의 대화에서 중요한 정보를 추출하여 저장
 * - USER.md 스타일: 사용자 정보 & 선호도
 * - MEMORY.md 스타일: 장기 지식 (중요한 이벤트, 결정사항 등)
 * - Daily logs: 일별 대화 요약
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

export interface UserMemory {
    // USER.md 스타일 - 사용자 정보
    preferences: {
        communicationStyle?: string; // 선호하는 대화 스타일
        motivationTriggers?: string[]; // 동기부여 요소
        stressIndicators?: string[]; // 스트레스 신호
        productivityPeaks?: string[]; // 생산성 높은 시간대
    };
    // MEMORY.md 스타일 - 장기 기억
    importantEvents: Array<{
        date: string;
        event: string;
        category: 'achievement' | 'decision' | 'milestone' | 'personal';
    }>;
    // 반복 패턴
    patterns: {
        commonRequests?: string[]; // 자주 하는 요청
        frequentTopics?: string[]; // 자주 대화하는 주제
        timePreferences?: Record<string, string>; // 시간대별 선호 활동
    };
}

export interface DailyLog {
    date: string;
    summary: string;
    mood?: 'positive' | 'neutral' | 'negative';
    keyTopics: string[];
    completedTasks: number;
    totalTasks: number;
}

/**
 * 대화에서 중요한 정보 추출 (AI 기반)
 */
export async function extractMemoryFromConversation(
    userEmail: string,
    messages: Array<{ role: string; content: string }>
): Promise<{ userInsights: any; importantEvents: any[] } | null> {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const conversationText = messages
            .map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
            .join('\n');

        const prompt = `다음 대화에서 사용자에 대한 중요한 정보를 추출하세요.

대화:
${conversationText}

다음 JSON 형식으로 응답하세요:
{
    "userInsights": {
        "preferences": {
            "communicationStyle": "친근한/격식체/간결한 등 (발견되면)",
            "motivationTriggers": ["동기부여 요소들"],
            "stressIndicators": ["스트레스 신호들"],
            "productivityPeaks": ["생산적인 시간대"]
        },
        "patterns": {
            "commonRequests": ["자주 하는 요청 유형"],
            "frequentTopics": ["자주 언급하는 주제"],
            "timePreferences": {"아침": "선호 활동", "저녁": "선호 활동"}
        }
    },
    "importantEvents": [
        {
            "event": "중요한 이벤트 설명",
            "category": "achievement/decision/milestone/personal"
        }
    ],
    "dailySummary": "오늘 대화의 한 줄 요약",
    "mood": "positive/neutral/negative",
    "keyTopics": ["주요 주제들"]
}

발견된 정보만 포함하세요. 없으면 빈 배열/null로 두세요.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // JSON 파싱
        const jsonStr = responseText.replace(/```json|```/g, "").trim();
        const extracted = JSON.parse(jsonStr);

        return extracted;
    } catch (error) {
        console.error('[MemoryService] Failed to extract memory:', error);
        return null;
    }
}

/**
 * 사용자 메모리 저장/업데이트
 */
export async function updateUserMemory(
    userEmail: string,
    newInsights: any
): Promise<boolean> {
    try {
        // 기존 메모리 가져오기
        const { data: existing } = await supabase
            .from('user_memory')
            .select('*')
            .eq('user_email', userEmail)
            .single();

        const currentMemory: UserMemory = existing?.memory || {
            preferences: {},
            importantEvents: [],
            patterns: {}
        };

        // 새 인사이트 병합
        if (newInsights.userInsights?.preferences) {
            const prefs = newInsights.userInsights.preferences;
            if (prefs.communicationStyle) {
                currentMemory.preferences.communicationStyle = prefs.communicationStyle;
            }
            if (prefs.motivationTriggers?.length) {
                currentMemory.preferences.motivationTriggers = [
                    ...new Set([
                        ...(currentMemory.preferences.motivationTriggers || []),
                        ...prefs.motivationTriggers
                    ])
                ].slice(-10); // 최대 10개 유지
            }
            if (prefs.stressIndicators?.length) {
                currentMemory.preferences.stressIndicators = [
                    ...new Set([
                        ...(currentMemory.preferences.stressIndicators || []),
                        ...prefs.stressIndicators
                    ])
                ].slice(-10);
            }
            if (prefs.productivityPeaks?.length) {
                currentMemory.preferences.productivityPeaks = [
                    ...new Set([
                        ...(currentMemory.preferences.productivityPeaks || []),
                        ...prefs.productivityPeaks
                    ])
                ].slice(-5);
            }
        }

        if (newInsights.userInsights?.patterns) {
            const patterns = newInsights.userInsights.patterns;
            if (patterns.commonRequests?.length) {
                currentMemory.patterns.commonRequests = [
                    ...new Set([
                        ...(currentMemory.patterns.commonRequests || []),
                        ...patterns.commonRequests
                    ])
                ].slice(-10);
            }
            if (patterns.frequentTopics?.length) {
                currentMemory.patterns.frequentTopics = [
                    ...new Set([
                        ...(currentMemory.patterns.frequentTopics || []),
                        ...patterns.frequentTopics
                    ])
                ].slice(-10);
            }
            if (patterns.timePreferences) {
                currentMemory.patterns.timePreferences = {
                    ...(currentMemory.patterns.timePreferences || {}),
                    ...patterns.timePreferences
                };
            }
        }

        // 중요 이벤트 추가
        if (newInsights.importantEvents?.length) {
            const today = new Date().toISOString().split('T')[0];
            const newEvents = newInsights.importantEvents.map((e: any) => ({
                ...e,
                date: today
            }));
            currentMemory.importantEvents = [
                ...currentMemory.importantEvents,
                ...newEvents
            ].slice(-50); // 최대 50개 유지
        }

        // 저장
        await supabase
            .from('user_memory')
            .upsert({
                user_email: userEmail,
                memory: currentMemory,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_email' });

        return true;
    } catch (error) {
        console.error('[MemoryService] Failed to update memory:', error);
        return false;
    }
}

/**
 * 일별 로그 저장
 */
export async function saveDailyLog(
    userEmail: string,
    log: Omit<DailyLog, 'date'>
): Promise<boolean> {
    try {
        const today = new Date().toISOString().split('T')[0];

        await supabase
            .from('user_daily_logs')
            .upsert({
                user_email: userEmail,
                date: today,
                summary: log.summary,
                mood: log.mood,
                key_topics: log.keyTopics,
                completed_tasks: log.completedTasks,
                total_tasks: log.totalTasks,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_email,date' });

        return true;
    } catch (error) {
        console.error('[MemoryService] Failed to save daily log:', error);
        return false;
    }
}

/**
 * 사용자 메모리 가져오기
 */
export async function getUserMemory(userEmail: string): Promise<UserMemory | null> {
    try {
        const { data } = await supabase
            .from('user_memory')
            .select('memory')
            .eq('user_email', userEmail)
            .single();

        return data?.memory || null;
    } catch (error) {
        console.error('[MemoryService] Failed to get memory:', error);
        return null;
    }
}

/**
 * 최근 일별 로그 가져오기
 */
export async function getRecentDailyLogs(
    userEmail: string,
    days: number = 7
): Promise<DailyLog[]> {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data } = await supabase
            .from('user_daily_logs')
            .select('*')
            .eq('user_email', userEmail)
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: false });

        return (data || []).map(d => ({
            date: d.date,
            summary: d.summary,
            mood: d.mood,
            keyTopics: d.key_topics || [],
            completedTasks: d.completed_tasks || 0,
            totalTasks: d.total_tasks || 0
        }));
    } catch (error) {
        console.error('[MemoryService] Failed to get daily logs:', error);
        return [];
    }
}

/**
 * AI 프롬프트에 사용할 메모리 컨텍스트 생성
 */
export async function getMemoryContextForAI(userEmail: string): Promise<string> {
    const memory = await getUserMemory(userEmail);
    const recentLogs = await getRecentDailyLogs(userEmail, 3);

    if (!memory && recentLogs.length === 0) {
        return '';
    }

    let context = '\n\n[사용자 메모리 컨텍스트]\n';

    if (memory) {
        if (memory.preferences.communicationStyle) {
            context += `- 선호 대화 스타일: ${memory.preferences.communicationStyle}\n`;
        }
        if (memory.preferences.motivationTriggers?.length) {
            context += `- 동기부여 요소: ${memory.preferences.motivationTriggers.join(', ')}\n`;
        }
        if (memory.patterns.frequentTopics?.length) {
            context += `- 관심 주제: ${memory.patterns.frequentTopics.join(', ')}\n`;
        }
        if (memory.importantEvents.length > 0) {
            const recentEvents = memory.importantEvents.slice(-3);
            context += `- 최근 중요 이벤트:\n`;
            recentEvents.forEach(e => {
                context += `  • [${e.date}] ${e.event}\n`;
            });
        }
    }

    if (recentLogs.length > 0) {
        context += `- 최근 대화 요약:\n`;
        recentLogs.forEach(log => {
            context += `  • [${log.date}] ${log.summary} (기분: ${log.mood || '알 수 없음'})\n`;
        });
    }

    return context;
}
