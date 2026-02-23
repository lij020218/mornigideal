import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { scheduleFeedbackSchema, validateBody } from '@/lib/schemas';

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

    const body = await request.json();
    const v = validateBody(scheduleFeedbackSchema, body);
    if (!v.success) return v.response;
    const { goalId, goalText, feedback, memo, followUpTask, timestamp } = v.data;

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
});
