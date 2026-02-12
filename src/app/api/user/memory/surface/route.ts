import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Memory Surfacing API
 *
 * 최근 저장된 메모리에서 오늘 언급할 만한 항목을 찾아 자연스러운 메시지로 반환.
 * 임베딩/LLM 호출 없이 규칙 기반으로 동작 → $0 비용, <100ms.
 */

interface SurfacedMemory {
    id: string;
    message: string;
    category: string;
    originalEvent: string;
    daysAgo: number;
}

export async function GET(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: userData } = await supabaseAdmin
            .from("users")
            .select("id, plan, profile")
            .eq("email", email)
            .maybeSingle();

        if (!userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 메모리 서피싱은 규칙 기반 ($0 비용) → 전 플랜 제공

        const now = new Date();
        const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;

        const surfaced: SurfacedMemory[] = [];

        // 1. importantEvents에서 후속 질문 생성 (memoryService의 user_memory 테이블)
        try {
            const { data: memoryRow } = await supabaseAdmin
                .from("user_memory")
                .select("memory")
                .eq("user_email", email)
                .maybeSingle();

            if (memoryRow?.memory?.importantEvents) {
                const events = memoryRow.memory.importantEvents as Array<{
                    date: string;
                    event: string;
                    category: string;
                }>;

                for (const evt of events) {
                    if (!evt.date || !evt.event) continue;
                    const eventDate = new Date(evt.date + "T00:00:00+09:00");
                    const diffDays = Math.floor((kst.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));

                    // 1-7일 전 이벤트만 서피싱 (너무 오래된 건 제외)
                    if (diffDays >= 1 && diffDays <= 7) {
                        const msg = generateFollowUpMessage(evt.event, evt.category, diffDays);
                        if (msg) {
                            surfaced.push({
                                id: `surface-evt-${evt.date}-${surfaced.length}`,
                                message: msg,
                                category: evt.category || "personal",
                                originalEvent: evt.event,
                                daysAgo: diffDays,
                            });
                        }
                    }
                }
            }
        } catch {
            // user_memory 테이블이 없거나 스키마 다를 수 있음 - 무시
        }

        // 2. RAG 메모리에서 최근 이벤트/마일스톤 (user_memory 벡터 테이블)
        try {
            const sevenDaysAgo = new Date(kst);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { data: recentMemories } = await supabaseAdmin
                .from("user_memory")
                .select("id, content, content_type, metadata, created_at")
                .eq("user_id", userData.id)
                .in("content_type", ["event", "goal", "pattern"])
                .gte("created_at", sevenDaysAgo.toISOString())
                .order("created_at", { ascending: false })
                .limit(5);

            if (recentMemories) {
                for (const mem of recentMemories) {
                    // 이미 서피싱된 이벤트와 중복 방지
                    const isDuplicate = surfaced.some(s =>
                        s.originalEvent && mem.content.includes(s.originalEvent.substring(0, 10))
                    );
                    if (isDuplicate) continue;

                    const createdAt = new Date(mem.created_at);
                    const diffDays = Math.floor((kst.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

                    if (diffDays >= 1 && diffDays <= 7) {
                        const msg = generateFollowUpMessage(mem.content, mem.content_type, diffDays);
                        if (msg) {
                            surfaced.push({
                                id: `surface-rag-${mem.id}`,
                                message: msg,
                                category: mem.content_type,
                                originalEvent: mem.content,
                                daysAgo: diffDays,
                            });
                        }
                    }
                }
            }
        } catch {
            // 벡터 테이블 없으면 무시
        }

        // 3. 오늘의 일정에서 과거 컨텍스트 연결
        try {
            const { data: todaySchedules } = await supabaseAdmin
                .from("schedules")
                .select("title, start_time")
                .eq("user_id", userData.id)
                .eq("date", todayStr)
                .order("start_time", { ascending: true })
                .limit(10);

            if (todaySchedules && todaySchedules.length > 0) {
                // 일별 로그에서 관련 과거 기록 찾기
                const { data: recentLogs } = await supabaseAdmin
                    .from("user_daily_logs")
                    .select("date, summary, mood, key_topics")
                    .eq("user_email", email)
                    .gte("date", new Date(kst.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
                    .order("date", { ascending: false })
                    .limit(5);

                if (recentLogs && recentLogs.length > 0) {
                    // 최근 부정적 기분 이후 긍정 전환 감지
                    const recentNegative = recentLogs.find(l => l.mood === "negative");
                    const recentPositive = recentLogs.find(l => l.mood === "positive");

                    if (recentNegative && recentPositive &&
                        recentPositive.date > recentNegative.date &&
                        surfaced.length < 2) {
                        surfaced.push({
                            id: `surface-mood-${todayStr}`,
                            message: "요즘 컨디션이 많이 좋아지신 것 같아요! 이 흐름 계속 이어가봐요.",
                            category: "mood",
                            originalEvent: "mood_improvement",
                            daysAgo: 0,
                        });
                    }
                }
            }
        } catch {
            // schedules나 daily_logs 테이블 없으면 무시
        }

        // 최대 2개만 반환 (과하지 않게)
        const result = surfaced.slice(0, 2);

        // 서피싱 기록 저장 (같은 이벤트 반복 방지용)
        if (result.length > 0) {
            try {
                await supabaseAdmin
                    .from("user_daily_logs")
                    .upsert({
                        user_email: email,
                        date: todayStr,
                        key_topics: result.map(r => `surfaced:${r.originalEvent.substring(0, 30)}`),
                        updated_at: new Date().toISOString(),
                    }, { onConflict: "user_email,date", ignoreDuplicates: true });
            } catch {
                // 로깅 실패 무시
            }
        }

        return NextResponse.json({ memories: result, count: result.length });
    } catch (error) {
        console.error("[Memory Surface] Error:", error);
        return NextResponse.json({ error: "Failed to surface memories" }, { status: 500 });
    }
}

/**
 * 이벤트 내용과 카테고리에 따라 자연스러운 후속 메시지 생성
 */
function generateFollowUpMessage(event: string, category: string, daysAgo: number): string | null {
    const timeLabel = daysAgo === 1 ? "어제" : `${daysAgo}일 전`;

    // 카테고리별 템플릿
    switch (category) {
        case "achievement":
        case "milestone":
            return `${timeLabel}에 "${truncate(event, 25)}" 달성하셨잖아요! 어떠셨어요?`;

        case "decision":
            return `${timeLabel}에 "${truncate(event, 25)}"에 대해 고민하셨었는데, 결정은 잘 되셨나요?`;

        case "personal":
            // 의료/건강 관련
            if (containsAny(event, ["병원", "치과", "의사", "진료", "검진", "수술"])) {
                return `${timeLabel} ${truncate(event, 20)} 잘 다녀오셨어요?`;
            }
            // 면접/시험 관련
            if (containsAny(event, ["면접", "시험", "테스트", "발표", "프레젠테이션"])) {
                return `${timeLabel} ${truncate(event, 20)} 어떠셨어요? 잘 되셨길 바라요!`;
            }
            // 약속/미팅
            if (containsAny(event, ["약속", "미팅", "모임", "만남", "식사"])) {
                return `${timeLabel} ${truncate(event, 20)} 즐거우셨어요?`;
            }
            // 일반
            return `${timeLabel}에 말씀하셨던 "${truncate(event, 20)}" 잘 되셨나요?`;

        case "event":
            return `${timeLabel}에 "${truncate(event, 25)}" 이야기하셨었는데, 그 후 어떠세요?`;

        case "goal":
            return `"${truncate(event, 25)}" 목표, 진행은 어떠세요?`;

        case "pattern":
            return null; // 패턴은 서피싱하지 않음

        default:
            if (daysAgo <= 3) {
                return `${timeLabel}에 "${truncate(event, 25)}" 이야기하셨었는데, 잘 되셨나요?`;
            }
            return null;
    }
}

function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + "...";
}

function containsAny(text: string, keywords: string[]): boolean {
    return keywords.some(kw => text.includes(kw));
}
