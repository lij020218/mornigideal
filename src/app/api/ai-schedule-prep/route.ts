import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { generateSchedulePrep } from "@/lib/capabilities/schedule-prep";

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { schedule, userProfile, timeUntil } = await request.json();

        const result = await generateSchedulePrep(email, {
            scheduleText: schedule.text,
            startTime: schedule.startTime,
            timeUntil,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || "Failed to generate schedule preparation advice" },
                { status: 500 }
            );
        }

        // API 응답 형태 보존: { advice: string }
        return NextResponse.json({ advice: result.data!.advice });
    } catch (error: any) {
        console.error("[AI Schedule Prep] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate schedule preparation advice" },
            { status: 500 }
        );
    }
}
