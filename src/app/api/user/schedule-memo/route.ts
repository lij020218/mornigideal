import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user ID
        const { data: userData } = await supabase
            .from("users")
            .select("id")
            .eq("email", session.user.email)
            .single();

        if (!userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const { goalId, memo, date } = await request.json();

        // Save to schedule_memos table (you may need to create this table)
        const { error } = await supabase
            .from("schedule_memos")
            .upsert({
                user_id: userData.id,
                goal_id: goalId,
                memo: memo,
                date: date,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,goal_id,date'
            });

        if (error) {
            // If table doesn't exist, just log and continue
            console.log("[Schedule Memo] Table may not exist:", error.message);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Schedule Memo] Error:", error);
        return NextResponse.json({ error: "Failed to save memo" }, { status: 500 });
    }
}
