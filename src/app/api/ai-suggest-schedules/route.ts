import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { generateSmartSuggestions } from "@/lib/capabilities/smart-suggestions";

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { requestCount = 3, currentHour } = await request.json();

    const result = await generateSmartSuggestions(email, { requestCount, currentHour });

    if (!result.success) {
        return NextResponse.json(
            { error: result.error || "Failed to generate schedule suggestions" },
            { status: 500 }
        );
    }

    return NextResponse.json(result.data);
});
