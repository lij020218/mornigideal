import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('Checking "users" table...');
    const { data, error } = await supabase.from('users').select('*').limit(1);

    if (error) {
        console.error('Error accessing "users" table:', error);
        if (error.code === '42P01') {
            console.log('CONCLUSION: Table "users" does not exist.');
        }
    } else {
        console.log('Table "users" exists. Rows found:', data.length);
    }
}

checkTable();
