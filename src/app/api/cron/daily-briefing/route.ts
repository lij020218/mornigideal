import { NextResponse } from "next/server";
import { generateDailyBriefings } from "@/lib/dailyBriefingGenerator";

export const maxDuration = 300; // 5 minutes max duration for Vercel functions

export async function GET(request: Request) {
    try {
        // Verify the request is authorized
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Starting daily briefing generation at 5:00 AM KST...');

        // Start generation
        await generateDailyBriefings();

        console.log('[CRON] Daily briefing generation completed');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[CRON] Daily briefing cron job failed:", error);
        return NextResponse.json({ error: "Failed to run cron" }, { status: 500 });
    }
}
