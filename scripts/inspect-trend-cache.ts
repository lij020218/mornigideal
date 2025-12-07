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

async function inspectCache() {
    try {
        console.log('🔍 Inspecting trend_details table...\n');

        // Get all trend details
        const { data: details, error: detailError } = await supabase
            .from('trend_details')
            .select('*')
            .limit(10);

        if (detailError) {
            console.error('Error fetching trend details:', detailError);
        } else {
            console.log(`Found ${details?.length || 0} trend detail entries`);
            if (details && details.length > 0) {
                console.log('\nFirst entry structure:');
                const first = details[0];
                console.log('- trend_id:', first.trend_id);
                console.log('- email:', first.email);
                console.log('- detail_data keys:', Object.keys(first.detail_data || {}));
                console.log('- detail_data:', JSON.stringify(first.detail_data, null, 2));
            }
        }

        console.log('\n🔍 Inspecting trends_cache table...\n');

        // Get all trends cache
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        const { data: cache, error: cacheError } = await supabase
            .from('trends_cache')
            .select('*')
            .eq('date', today);

        if (cacheError) {
            console.error('Error fetching trends cache:', cacheError);
        } else {
            console.log(`Found ${cache?.length || 0} trends cache entries for today (${today})`);
            if (cache && cache.length > 0) {
                console.log('\nFirst entry:');
                console.log('- email:', cache[0].email);
                console.log('- date:', cache[0].date);
                console.log('- trends count:', cache[0].trends?.length || 0);
                console.log('- last_updated:', cache[0].last_updated);
            }
        }

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

inspectCache();
