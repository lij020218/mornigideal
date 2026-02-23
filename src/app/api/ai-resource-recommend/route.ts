import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { generateResourceRecommendation } from "@/lib/capabilities/resource-recommend";

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { activity, category, context, timeUntil, activityName } = await request.json();
    const targetActivity = activityName || activity;

    if (!targetActivity) {
        return NextResponse.json({ error: "Activity is required" }, { status: 400 });
    }

    const result = await generateResourceRecommendation(email, {
        activity: targetActivity,
        category,
        context,
        timeUntil,
    });

    if (!result.success) {
        return NextResponse.json(
            { error: result.error || "Failed to generate resource recommendation" },
            { status: 500 }
        );
    }

    // API 응답 형태 보존
    return NextResponse.json({
        ...result.data,
        category,
        context,
    });
});
