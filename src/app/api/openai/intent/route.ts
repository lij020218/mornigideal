import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { getUserByEmail } from "@/lib/users";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { MODELS } from "@/lib/models";

type IntentResult = {
    intent: "schedule_update" | "briefing" | "chat";
    reply: string;
    scheduleUpdate?: {
        target?: "wakeUp" | "workStart" | "workEnd" | "sleep" | "customGoal";
        time?: string;
        title?: string;
    };
};

export async function POST(request: NextRequest) {
    try {
        const { text } = await request.json();
        if (!text || typeof text !== "string") {
            return NextResponse.json({ error: "Invalid text" }, { status: 400 });
        }

        const userEmail = await getUserEmailWithAuth(request);

        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // 1) Parse intent
        const intentResp = await client.chat.completions.create({
            model: MODELS.GPT_4O_MINI_SHORT,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `
한국어로 intent를 분류하고 JSON만 반환합니다.
{
  "intent": "schedule_update" | "briefing" | "chat",
  "reply": "사용자에게 들려줄 짧은 확인/응답",
  "scheduleUpdate": { "target": "wakeUp|workStart|workEnd|sleep|customGoal", "time": "HH:MM", "title": "선택" }
}
- "일정 변경" 요청이면 schedule_update, 시간을 HH:MM으로 추출.
- "브리핑 읽어줘" 요청이면 briefing.
- 기타는 chat.
                `.trim(),
                },
                { role: "user", content: text },
            ],
        });

        let parsed: IntentResult = { intent: "chat", reply: "요청을 이해하지 못했어요." };
        try {
            parsed = JSON.parse(intentResp.choices[0].message.content || "{}");
        } catch (err) {
        }

        // 2) Act on intent
        if (parsed.intent === "schedule_update" && parsed.scheduleUpdate && userEmail) {
            try {
                const user = await getUserByEmail(userEmail);
                const profile = user?.profile || {};
                const target = parsed.scheduleUpdate.target;
                const time = parsed.scheduleUpdate.time;

                if (target && time) {
                    if (["wakeUp", "workStart", "workEnd", "sleep"].includes(target)) {
                        profile.schedule = {
                            ...(profile.schedule || {}),
                            [target]: time,
                        };
                    } else if (target === "customGoal") {
                        profile.customGoals = [
                            ...(profile.customGoals || []),
                            {
                                id: `voice-${Date.now()}`,
                                text: parsed.scheduleUpdate.title || "새 목표",
                                time: "morning",
                                startTime: time,
                                endTime: time,
                                color: "#6366f1",
                            },
                        ];
                    }

                    const { error } = await supabaseAdmin.from("users").update({ profile }).eq("email", userEmail);
                    if (error) {
                        console.error("[Intent] schedule update failed:", error);
                    } else {
                        parsed.reply = parsed.reply || "일정이 업데이트되었습니다.";
                    }
                }
            } catch (err) {
                console.error("[Intent] schedule update error", err);
            }
        }

        if (parsed.intent === "briefing") {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
                const res = await fetch(`${baseUrl}/api/trend-briefing`);
                if (res.ok) {
                    const data = await res.json();
                    const first = (data.trends || [])[0];
                    if (first) {
                        parsed.reply = `브리핑 카드: ${first.title}. 요약: ${first.summary || ""}`;
                    }
                }
            } catch (err) {
                console.error("[Intent] briefing fetch error", err);
            }
        }

        return NextResponse.json({ reply: parsed.reply || "요청을 처리했습니다." });
    } catch (error) {
        console.error("Intent error:", error);
        return NextResponse.json({ error: "Failed to process intent" }, { status: 500 });
    }
}
