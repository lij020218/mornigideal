import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
    const userEmail = 'lij020218@naver.com';

    try {
        // Get user profile
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('email', userEmail)
            .single();

        if (fetchError) {
            return NextResponse.json(
                { error: 'Failed to fetch user', details: fetchError },
                { status: 500 }
            );
        }

        if (!userData || !userData.profile) {
            return NextResponse.json(
                { error: 'No profile found for user' },
                { status: 404 }
            );
        }

        const profile = userData.profile;
        const customGoals = profile.customGoals || [];

        console.log(`[DeleteEnglishSchedules] Total schedules before: ${customGoals.length}`);

        // Filter out English study schedules on Saturday (6) and Sunday (0)
        const deletedSchedules: any[] = [];
        const filteredGoals = customGoals.filter((goal: any) => {
            const isEnglish = goal.text?.includes('영어');
            const hasWeekendDays = goal.daysOfWeek?.includes(0) || goal.daysOfWeek?.includes(6);

            if (isEnglish && hasWeekendDays) {
                console.log(`[DeleteEnglishSchedules] Deleting: ${goal.text} (${goal.id}) - days: ${goal.daysOfWeek}`);
                deletedSchedules.push(goal);
                return false; // Filter out
            }
            return true; // Keep
        });

        console.log(`[DeleteEnglishSchedules] Total schedules after: ${filteredGoals.length}`);
        console.log(`[DeleteEnglishSchedules] Deleted: ${customGoals.length - filteredGoals.length} schedules`);

        // Update profile with filtered goals
        const { error: updateError } = await supabase
            .from('users')
            .update({
                profile: {
                    ...profile,
                    customGoals: filteredGoals
                }
            })
            .eq('email', userEmail);

        if (updateError) {
            return NextResponse.json(
                { error: 'Failed to update profile', details: updateError },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Successfully deleted English schedules on weekends',
            deletedCount: deletedSchedules.length,
            deletedSchedules: deletedSchedules.map(s => ({
                id: s.id,
                text: s.text,
                daysOfWeek: s.daysOfWeek,
                startTime: s.startTime,
                endTime: s.endTime
            }))
        });

    } catch (error: any) {
        console.error('[DeleteEnglishSchedules] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error.message },
            { status: 500 }
        );
    }
}
