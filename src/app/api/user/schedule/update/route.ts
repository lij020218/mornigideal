import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { scheduleId, completed, skipped } = await request.json();

        if (!scheduleId) {
            return NextResponse.json({ error: "Schedule ID is required" }, { status: 400 });
        }

        // Get user profile
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('email', session.user.email)
            .single();

        if (fetchError || !user?.profile?.customGoals) {
            return NextResponse.json({ error: "No schedules found" }, { status: 404 });
        }

        // Update the specific schedule
        const updatedGoals = user.profile.customGoals.map((goal: any) => {
            if (goal.id === scheduleId) {
                return {
                    ...goal,
                    completed: completed !== undefined ? completed : goal.completed,
                    skipped: skipped !== undefined ? skipped : goal.skipped,
                };
            }
            return goal;
        });

        // Update profile with new goals
        const updatedProfile = {
            ...user.profile,
            customGoals: updatedGoals,
        };

        // Save back to database
        const { error: updateError } = await supabase
            .from('users')
            .update({ profile: updatedProfile })
            .eq('email', session.user.email);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({
            success: true,
            message: "Schedule updated successfully"
        });

    } catch (error) {
        console.error("[schedule/update] Error:", error);
        return NextResponse.json({
            error: "Failed to update schedule",
            details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}
