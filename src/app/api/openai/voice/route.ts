import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
        }

        const formData = await request.formData();
        const audio = formData.get("audio");

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
            console.warn("[Voice] Unable to fetch trends context:", err);
        }

        // 3) Let GPT decide intent and craft a short Korean reply
        const chat = await client.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `
너는 한국어로 응답하는 개인 비서 Jarvis이다. 역할:
- 사용자의 음성 명령을 요약하고, 필요한 경우 일정 추가/브리핑 의도를 파악한다.
- 일정 의도(add_schedule)일 때는 title/time/location 등을 추출해 간단히 확인 문구를 만든다.
- 브리핑 의도(briefing)일 때는 아래 제공된 최신 트렌드를 2~3개 묶어 짧게 요약해준다.
- 아무 의도가 없으면 일반 대화(reply-only).
JSON만 반환하라.
형식:
{
  "intent": "add_schedule" | "briefing" | "chat",
  "reply": "사용자에게 들려줄 한국어 한두 문장",
  "schedule": { "title": "...", "time": "...", "location": "..." } // 일정일 때만
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

        try {
            const parsed = JSON.parse(content);
            if (parsed.reply) {
                replyText = parsed.reply;
            }
        } catch (err) {
            console.warn("[Voice] Failed to parse JSON reply:", err);
        }

        // 4) Text-to-speech
        const speech = await client.audio.speech.create({
            model: "gpt-4o-mini-tts",
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
    } catch (error) {
        console.error("[Voice] Error handling request:", error);
        return NextResponse.json({ error: "Failed to process voice request" }, { status: 500 });
    }
}
