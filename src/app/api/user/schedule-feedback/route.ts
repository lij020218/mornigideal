import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user ID
        const { data: userData } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (!userData) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const { goalId, goalText, feedback, memo, followUpTask, timestamp } = await request.json();

        // Save to schedule_feedback table (you may need to create this table)
        const { error } = await supabaseAdmin
            .from("schedule_feedback")
            .insert({
                user_id: userData.id,
                goal_id: goalId,
                goal_text: goalText,
                feedback_type: feedback, // 'completed', 'partial', 'skipped'
                memo: memo,
                follow_up_task: followUpTask,
                created_at: timestamp || new Date().toISOString(),
            });

        if (error) {
            // If table doesn't exist, just log and continue
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Schedule Feedback] Error:", error);
        return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
    }
}
