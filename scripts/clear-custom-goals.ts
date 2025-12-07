import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearCustomGoals() {
    try {
        console.log('🗑️  Clearing all custom goals (fixed schedules)...\n');

        // Get all users
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('id, email, profile');

        if (userError) {
            console.error('Error fetching users:', userError);
            process.exit(1);
        }

        console.log(`Found ${users?.length || 0} users\n`);

        // Clear customGoals for each user
        for (const user of users || []) {
            const profile = user.profile || {};
            const currentGoals = profile.customGoals || [];

            if (currentGoals.length > 0) {
                console.log(`Clearing ${currentGoals.length} goals for ${user.email}...`);

                // Update profile with empty customGoals
                const { error: updateError } = await supabase
                    .from('users')
                    .update({
                        profile: {
                            ...profile,
                            customGoals: []
                        }
                    })
                    .eq('id', user.id);

                if (updateError) {
                    console.error(`Error updating ${user.email}:`, updateError);
                } else {
                    console.log(`✅ Cleared goals for ${user.email}`);
                }
            } else {
                console.log(`${user.email} has no goals to clear`);
            }
        }

        console.log('\n✅ All custom goals cleared successfully!');

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

clearCustomGoals();
