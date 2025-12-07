import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id && !session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }); // Today YYYY-MM-DD

        // We need user ID. First try session.user.id, else fetch by email logic
        let userId = session.user.id;

        // If next-auth session id isn't the user table id (sometimes it's different depending on adapter),
        // fetch it. Assuming NextAuth adapter is used and IDs match, but checking email is safer if unsure.
        // Actually, let's trust supabase lookup by email if needed.
        if (!userId) {
            const { data: u } = await supabase.from('users').select('id').eq('email', session.user.email!).single();
            userId = u?.id;
        }

        if (!userId) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const { data, error } = await supabase
            .from('daily_briefings')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error("Fetch briefing error", error);
            return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
        }

        return NextResponse.json({ briefing: data });

    } catch (error) {
        console.error("Error fetching daily briefing:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    // Mark as read
    try {
        const session = await auth();
        if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { briefingId } = await request.json();

        await supabase
            .from('daily_briefings')
            .update({ is_read: true })
            .eq('id', briefingId);

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
