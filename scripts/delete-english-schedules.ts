import { supabase } from '../src/lib/supabase';

async function deleteEnglishSchedules() {
    const userEmail = 'lij020218@naver.com';

    try {
        // Get user profile
        const { data: userData, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('email', userEmail)
            .single();

        if (fetchError) {
            console.error('Failed to fetch user:', fetchError);
            return;
        }

        if (!userData || !userData.profile) {
            console.log('No profile found for user');
            return;
        }

        const profile = userData.profile;
        const customGoals = profile.customGoals || [];

        console.log(`Total schedules before: ${customGoals.length}`);

        // Filter out English study schedules on Saturday (6) and Sunday (0)
        const filteredGoals = customGoals.filter((goal: any) => {
            const isEnglish = goal.text?.includes('영어');
            const hasWeekendDays = goal.daysOfWeek?.includes(0) || goal.daysOfWeek?.includes(6);

            if (isEnglish && hasWeekendDays) {
                console.log(`Deleting: ${goal.text} (${goal.id}) - days: ${goal.daysOfWeek}`);
                return false; // Filter out
            }
            return true; // Keep
        });

        console.log(`Total schedules after: ${filteredGoals.length}`);
        console.log(`Deleted: ${customGoals.length - filteredGoals.length} schedules`);

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
            console.error('Failed to update profile:', updateError);
            return;
        }

        console.log('✅ Successfully deleted English schedules on weekends');

    } catch (error) {
        console.error('Error:', error);
    }
}

deleteEnglishSchedules();
