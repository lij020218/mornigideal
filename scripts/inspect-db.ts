
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log("Inspecting recent daily_briefings...");

    // Check recent briefings to see what DATE they are saved with
    const { data, error } = await supabase
        .from('daily_briefings')
        .select('id, user_id, date, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Select Error:", error);
    } else {
        console.log("Recent Briefings (Key Fields):");
        console.log(JSON.stringify(data, null, 2));
    }
}

inspect();
