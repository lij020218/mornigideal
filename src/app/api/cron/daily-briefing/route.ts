import { NextResponse } from "next/server";
import { generateDailyBriefings } from "@/lib/dailyBriefingGenerator";
import { logCronExecution } from '@/lib/cron-logger';

export const maxDuration = 300; // 5 minutes max duration for Vercel functions

export async function GET(request: Request) {
    const start = Date.now();
    try {
        // Verify the request is authorized
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await generateDailyBriefings();

        await logCronExecution('daily-briefing', 'success', {}, Date.now() - start);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        await logCronExecution('daily-briefing', 'failure', { error: error?.message }, Date.now() - start);
        console.error("[CRON] Daily briefing cron job failed:", error);
        return NextResponse.json({ error: "Failed to run cron" }, { status: 500 });
    }
}
