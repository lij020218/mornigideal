
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectContent() {
    console.log("Inspecting daily_briefings CONTENT...");

    const { data, error } = await supabase.from('daily_briefings').select('*').limit(1);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Row count:", data?.length);
        if (data && data.length > 0) {
            console.log("Content:", JSON.stringify(data[0].content, null, 2));
            console.log("Is Read:", data[0].is_read);
        }
    }
}

inspectContent();
