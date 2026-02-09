import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabase } from "@/lib/supabase";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

function isAdmin(email: string): boolean {
    return ADMIN_EMAILS.includes(email);
}

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!isAdmin(email)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { targetEmail } = await request.json();
        if (!targetEmail) {
            return NextResponse.json({ error: "targetEmail is required" }, { status: 400 });
        }

        // Get user profile
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('email', targetEmail)
            .single();

        if (fetchError || !userData?.profile) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const profile = userData.profile;
        const customGoals = profile.customGoals || [];

        // Filter out English study schedules on Saturday (6) and Sunday (0)
        const filteredGoals = customGoals.filter((goal: any) => {
            const isEnglish = goal.text?.includes('영어');
            const hasWeekendDays = goal.daysOfWeek?.includes(0) || goal.daysOfWeek?.includes(6);
            return !(isEnglish && hasWeekendDays);
        });

        const deletedCount = customGoals.length - filteredGoals.length;

        // Update profile with filtered goals
        const { error: updateError } = await supabase
            .from('users')
            .update({ profile: { ...profile, customGoals: filteredGoals } })
            .eq('email', targetEmail);

        if (updateError) {
            console.error('[DeleteEnglishSchedules] Update error:', updateError);
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            deletedCount,
        });
    } catch (error: any) {
        console.error('[DeleteEnglishSchedules] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
