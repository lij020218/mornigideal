import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserUsageStats } from "@/lib/openai-usage";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'today'; // today, week, month, all

        let startDate: Date | undefined;
        const endDate = new Date();

        switch (period) {
            case 'today':
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
                break;
            case 'all':
                startDate = undefined;
                break;
        }

        const stats = await getUserUsageStats(session.user.email, startDate, endDate);

        return NextResponse.json({
            period,
            startDate: startDate?.toISOString(),
            endDate: endDate.toISOString(),
            stats: {
                totalCalls: stats.totalCalls,
                totalTokens: stats.totalTokens,
                totalCost: stats.totalCost,
                byEndpoint: stats.byEndpoint,
            },
            summary: {
                averageCostPerCall: stats.totalCalls > 0 ? stats.totalCost / stats.totalCalls : 0,
                averageTokensPerCall: stats.totalCalls > 0 ? stats.totalTokens / stats.totalCalls : 0,
            }
        });

    } catch (error) {
        console.error('[Usage Stats] Error:', error);
        return NextResponse.json(
            { error: 'Failed to get usage statistics' },
            { status: 500 }
        );
    }
}
