import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase Connection...');
console.log('URL:', supabaseUrl);
console.log('Key provided:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    try {
        // Try to fetch data from a non-existent table just to check connection auth
        // Or better, check health if possible, but usually a simple select is enough.
        // Since we don't know tables, we'll try to get the user session or just a simple query.
        // A query to a non-existent table will return a 404 or 400, but if auth is wrong it returns 401.

        const { data, error } = await supabase.from('random_table_check').select('*').limit(1);

        if (error) {
            // 42P01 means undefined table, which means connection worked but table missing (Good!)
            // 401 means unauthorized (Bad key)
            // 500 or connection refused means bad URL
            console.log('Connection response code:', error.code);
            console.log('Connection response message:', error.message);

            if (error.code === '42P01' || error.code === 'PGRST200') {
                console.log('✅ Connection Successful! (Table not found, but reachable)');
            } else if (error.message.includes('JWT')) {
                console.error('❌ Connection Failed: Invalid JWT/Key');
            } else {
                // Even if it errors, if it's not a network error, we reached the server.
                console.log('⚠️ Connection reachable but returned error (expected if table missing).');
            }
        } else {
            console.log('✅ Connection Successful!');
        }
    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

testConnection();
