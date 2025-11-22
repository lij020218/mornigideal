import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const authSecret = process.env.AUTH_SECRET;

console.log('--- Auth Debug Info ---');
console.log('AUTH_SECRET present:', !!authSecret);
if (!authSecret) {
    console.error('❌ AUTH_SECRET is MISSING! NextAuth needs this in production.');
} else {
    console.log('✅ AUTH_SECRET is set.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    console.log('\nChecking "users" table content...');
    const { data, error } = await supabase.from('users').select('email, password, name');

    if (error) {
        console.error('Error accessing "users" table:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log(`Found ${data.length} users:`);
        data.forEach(user => {
            console.log(`- Email: ${user.email}, Password: ${user.password} (Check if this looks hashed or plain)`);
        });
    } else {
        console.log('No users found in the table.');
    }
}

checkUsers();
