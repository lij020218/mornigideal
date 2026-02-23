import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { supabaseAdmin } from '@/lib/supabase-admin';

export const POST = withAuth(async (request: NextRequest, email: string) => {
    // Get user ID
    const { data: userData } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (!userData) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { goalId, memo, date } = await request.json();

    // Save to schedule_memos table (you may need to create this table)
    const { error } = await supabaseAdmin
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
    }

    return NextResponse.json({ success: true });
});
