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

async function clearTrendCache() {
    try {
        console.log('🗑️  Clearing trend detail cache...');

        // Delete all trend details
        const { error: detailError, count: detailCount } = await supabase
            .from('trend_details')
            .delete()
            .neq('trend_id', ''); // Delete all

        if (detailError) {
            console.error('Error deleting trend details:', detailError);
        } else {
            console.log(`✅ Deleted ${detailCount || 0} trend detail entries`);
        }

        console.log('🗑️  Clearing trend cache...');

        // Delete today's trend cache
        const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        const { error: cacheError, count: cacheCount } = await supabase
            .from('trends_cache')
            .delete()
            .eq('date', today);

        if (cacheError) {
            console.error('Error deleting trends cache:', cacheError);
        } else {
            console.log(`✅ Deleted ${cacheCount || 0} trend cache entries for ${today}`);
        }

        console.log('\n✨ Cache cleared successfully!');
        console.log('💡 Refresh your browser to load new trend briefings with proper detail structure.');
    } catch (error) {
        console.error('Error clearing cache:', error);
        process.exit(1);
    }
}

clearTrendCache();
