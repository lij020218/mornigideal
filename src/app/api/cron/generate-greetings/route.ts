import { NextResponse } from "next/server";
import { generateGreetingsForAllUsers } from "@/lib/greetingGenerator";
import { logCronExecution } from '@/lib/cron-logger';

export const maxDuration = 300;

export async function GET(request: Request) {
    const start = Date.now();
    try {
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await generateGreetingsForAllUsers();

        await logCronExecution('generate-greetings', 'success', {}, Date.now() - start);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        await logCronExecution('generate-greetings', 'failure', { error: error?.message }, Date.now() - start);
        console.error("[CRON] Generate greetings cron job failed:", error);
        return NextResponse.json({ error: "Failed to run cron" }, { status: 500 });
    }
}
