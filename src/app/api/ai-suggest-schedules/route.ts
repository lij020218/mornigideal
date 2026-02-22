import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { generateSmartSuggestions } from "@/lib/capabilities/smart-suggestions";

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { requestCount = 3, currentHour } = await request.json();

        const result = await generateSmartSuggestions(email, { requestCount, currentHour });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || "Failed to generate schedule suggestions" },
                { status: 500 }
            );
        }

        return NextResponse.json(result.data);
    } catch (error: any) {
        console.error("[AI Suggest Schedules] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate schedule suggestions" },
            { status: 500 }
        );
    }
}
