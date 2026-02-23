import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { generateSchedulePrep } from "@/lib/capabilities/schedule-prep";

export const POST = withAuth(async (request: NextRequest, email: string) => {
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
});
