import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
let authSecret = process.env.AUTH_SECRET;

async function fixAuth() {
    // 1. Check and fix AUTH_SECRET
    if (!authSecret) {
        console.log('AUTH_SECRET is missing. Generating one...');
        const newSecret = crypto.randomBytes(32).toString('hex');

        try {
            fs.appendFileSync(envPath, `\nAUTH_SECRET=${newSecret}\n`);
            console.log('✅ Added AUTH_SECRET to .env.local');
            authSecret = newSecret;
        } catch (e) {
            console.error('Failed to write to .env.local:', e);
        }
    } else {
        console.log('✅ AUTH_SECRET is already set.');
    }

    // 2. Get User Info
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('users').select('email, password').limit(1);

    if (data && data.length > 0) {
        console.log('\n--- User Credentials ---');
        console.log(`Email: ${data[0].email}`);
        console.log(`Password: ${data[0].password}`);
        console.log('------------------------');
    } else {
        console.log('\nNo users found. You need to sign up or create a user.');
    }
}

fixAuth();
