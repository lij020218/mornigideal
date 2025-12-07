import { NextResponse } from "next/server";
import { generateDailyBriefings } from "@/lib/dailyBriefingGenerator";

export const maxDuration = 300; // 5 minutes max duration for Vercel functions

export async function GET(request: Request) {
    try {
        // Verification (Optional: Check for secret key if deployed publicly)
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return new NextResponse('Unauthorized', { status: 401 });
        // }

        // Start generation
        // Note: In Vercel, we should await this.
        await generateDailyBriefings();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Cron job failed:", error);
        return NextResponse.json({ error: "Failed to run cron" }, { status: 500 });
    }
}
