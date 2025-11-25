import { NextResponse } from "next/server";

export async function POST() {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: "OpenAI API key not configured" },
                { status: 500 }
            );
        }

        const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-realtime-preview-2024-12-17",
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            return NextResponse.json(
                { error: error.error?.message || "Failed to create session" },
                { status: response.status }
            );
        }

        const data = await response.json();

        // Return the ephemeral client secret value
        // The response structure is { client_secret: { value: "ek_...", ... } }
        return NextResponse.json({
            client_secret: data.client_secret,
        });

    } catch (error) {
        console.error("Error creating OpenAI session:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
