import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { withAuth } from "@/lib/api-handler";
import { getUserByEmail } from "@/lib/users";
import { MODELS } from "@/lib/models";
import { kvAppend } from "@/lib/kv-store";
import { logger } from '@/lib/logger';

export const POST = withAuth(async (request: NextRequest, email: string) => {
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const formData = await request.formData();
    const audio = formData.get("audio");
    const explicitIntent = (formData.get("intent") as string) || null;
    const duration = parseFloat((formData.get("duration") as string) || "0") || 0;

    if (!(audio instanceof File)) {
        return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 1) Speech-to-text
    const transcription = await client.audio.transcriptions.create({
        file: audio,
        model: "whisper-1",
        response_format: "json",
    });

    const transcriptText = transcription.text?.trim() || "";

    // Handle explicit intents from client
    if (explicitIntent === "journal") {
        // Save transcription as voice journal entry
        const now = new Date();
        const monthKey = `voice_journals_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        await kvAppend(email, monthKey, {
            date: now.toISOString().split('T')[0],
            time: now.toISOString(),
            transcription: transcriptText,
            duration: duration,
        }, 200);

        // Generate AI summary/response for the journal entry
        const journalChat = await client.chat.completions.create({
            model: MODELS.GPT_4O_MINI_SHORT,
            messages: [
                {
                    role: "system",
                    content: "너는 따뜻하고 공감적인 음성 저널 비서야. 사용자의 저널 기록에 대해 짧고 따뜻한 한국어 응답을 해줘. 1~2문장으로 감정을 인정하고 격려해줘.",
                },
                { role: "user", content: transcriptText || "음성 저널을 기록했어요." },
            ],
        });

        const journalReply = journalChat.choices[0]?.message?.content || "저널이 저장되었어요.";

        // TTS for journal response
        const speech = await client.audio.speech.create({
            model: MODELS.GPT_4O_MINI_TTS,
            voice: "verse",
            input: journalReply,
        });

        const audioBuffer = Buffer.from(await speech.arrayBuffer());
        const audioBase64 = audioBuffer.toString("base64");

        return NextResponse.json({
            transcript: transcriptText,
            reply: journalReply,
            audio: audioBase64,
            audioContentType: "audio/mpeg",
            intent: "journal",
            journalSaved: true,
        });
    }

    if (explicitIntent === "briefing_readback") {
        // Briefing readback is handled by the dedicated /api/openai/voice/briefing route
        return NextResponse.json({
            transcript: transcriptText,
            reply: "브리핑은 별도 API를 사용해주세요.",
            intent: "briefing_readback",
            redirectTo: "/api/openai/voice/briefing",
        });
    }

    // 2) Fetch latest trends to give the model briefing context (best-effort)
    let trendsSummary = "";
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3001";
        const trendRes = await fetch(`${baseUrl}/api/trend-briefing`);
        if (trendRes.ok) {
            const trendData = await trendRes.json();
            const trends = (trendData.trends || []).slice(0, 5);
            trendsSummary = trends.map((t: any, idx: number) => `${idx + 1}. ${t.title} (${t.source})`).join("\n");
        }
    } catch (err) {
    }

    // 3) Let GPT decide intent and craft a short Korean reply
    const chat = await client.chat.completions.create({
        model: MODELS.GPT_4O_MINI_SHORT,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: `
너는 한국어로 응답하는 개인 비서 Jarvis이다. 역할:
- 사용자의 음성 명령을 요약하고, 필요한 경우 "일정 조정" 또는 "브리핑" 의도를 파악한다.
- 일정 조정 시, 다음 필드 중 하나를 채운다: wakeUp, workStart, workEnd, sleep, 또는 customGoal.
- 시간은 24시간 형식 HH:MM 으로 반환한다. 날짜는 오늘을 기본으로 한다.
- 브리핑 의도(briefing)일 때는 아래 제공된 최신 트렌드를 2~3개 묶어 짧게 요약해준다.
- 아무 의도가 없으면 일반 대화(reply-only).
JSON만 반환하라.
형식:
{
  "intent": "schedule_update" | "briefing" | "chat",
  "reply": "사용자에게 들려줄 한국어 한두 문장",
  "scheduleUpdate": {
    "target": "wakeUp" | "workStart" | "workEnd" | "sleep" | "customGoal",
    "time": "HH:MM",
    "title": "회의/할 일 이름",
    "location": "선택",
    "daysOfWeek": [0-6] // 선택
  }
}

제공된 최신 트렌드:
${trendsSummary || "없음"}
                `.trim(),
            },
            { role: "user", content: transcriptText || "사용자 입력 없음" },
        ],
    });

    const content = chat.choices[0]?.message?.content || "{}";
    let replyText = "요청을 이해하지 못했어요. 다시 말씀해 주세요.";
    let scheduleUpdate: any = null;

    try {
        const parsed = JSON.parse(content);
        if (parsed.reply) {
            replyText = parsed.reply;
        }
        if (parsed.scheduleUpdate) {
            scheduleUpdate = parsed.scheduleUpdate;
        }
    } catch (err) {
    }

    // 4) If schedule update requested, attempt to persist to user profile
    if (scheduleUpdate) {
        try {
            const user = await getUserByEmail(email);
            const profile = user?.profile || {};
            const currentSchedule = profile.schedule || {};
            const target = scheduleUpdate.target as string;
            const time = scheduleUpdate.time as string;

            // Update known schedule fields; otherwise push as custom goal
            if (["wakeUp", "workStart", "workEnd", "sleep"].includes(target) && time) {
                profile.schedule = {
                    ...currentSchedule,
                    [target]: time,
                };
            } else if (target === "customGoal" && time) {
                const custom = profile.customGoals || [];
                custom.push({
                    id: `voice-${Date.now()}`,
                    text: scheduleUpdate.title || "새 일정",
                    startTime: time,
                    endTime: time,
                    color: "#6366f1",
                    daysOfWeek: scheduleUpdate.daysOfWeek || undefined,
                });
                profile.customGoals = custom;
            }

            // Persist profile
            const { supabaseAdmin } = await import("@/lib/supabase-admin");
            const { error } = await supabaseAdmin
                .from("users")
                .update({ profile })
                .eq("email", email);

            if (error) {
                logger.error("[Voice] Failed to update schedule:", error);
            } else {
                replyText += " 일정이 반영됐어요.";
            }
        } catch (err) {
            logger.error("[Voice] Error applying schedule update:", err);
        }
    }

    // 4) Text-to-speech
    const speech = await client.audio.speech.create({
        model: MODELS.GPT_4O_MINI_TTS,
        voice: "verse",
        input: replyText,
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    const audioBase64 = audioBuffer.toString("base64");

    return NextResponse.json({
        transcript: transcriptText,
        reply: replyText,
        audio: audioBase64,
        audioContentType: "audio/mpeg",
    });
});
