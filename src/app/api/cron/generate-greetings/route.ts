import { NextResponse } from "next/server";
import { generateGreetingsForAllUsers } from "@/lib/greetingGenerator";

export const maxDuration = 300;

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await generateGreetingsForAllUsers();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[CRON] Generate greetings cron job failed:", error);
        return NextResponse.json({ error: "Failed to run cron" }, { status: 500 });
    }
}
