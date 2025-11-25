import { NextResponse } from "next/server";

export async function POST() {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: "OpenAI API key not configured" },
                { status: 500 }
            );
        }

        const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-realtime-2025-08-28",
                voice: "alloy",
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            console.error("[OpenAI Session] Failed:", error);
            return NextResponse.json(
                { error: error || "Failed to create session" },
                { status: 400 }
            );
        }

        const data = await response.json();

        return NextResponse.json({
            client_secret: data.client_secret?.value || data.client_secret,
        });

    } catch (error) {
        console.error("Error creating OpenAI session:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
