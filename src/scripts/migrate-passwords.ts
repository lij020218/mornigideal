/**
 * One-time migration script: convert plaintext passwords to bcrypt hashes.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-passwords.ts
 *
 * This finds all users whose password does NOT start with '$2' (bcrypt prefix)
 * and hashes them with bcrypt (cost factor 12).
 *
 * Safe to run multiple times — already-hashed passwords are skipped.
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
    console.log('Scanning for plaintext passwords...');

    // Fetch all users with a password set
    const { data: users, error } = await supabase
        .from('users')
        .select('id, email, password')
        .not('password', 'is', null);

    if (error) {
        console.error('Failed to query users:', error);
        process.exit(1);
    }

    // Filter to those whose password is NOT a bcrypt hash
    const plaintext = (users || []).filter(
        (u) => u.password && !u.password.startsWith('$2'),
    );

    console.log(`Found ${plaintext.length} user(s) with plaintext passwords (out of ${users?.length || 0} total).`);

    if (plaintext.length === 0) {
        console.log('Nothing to migrate.');
        return;
    }

    let migrated = 0;
    let failed = 0;

    for (const user of plaintext) {
        try {
            const hashed = await bcrypt.hash(user.password, 12);
            const { error: updateError } = await supabase
                .from('users')
                .update({ password: hashed })
                .eq('id', user.id);

            if (updateError) {
                console.error(`  FAIL [${user.email}]: ${updateError.message}`);
                failed++;
            } else {
                console.log(`  OK   [${user.email}]`);
                migrated++;
            }
        } catch (e) {
            console.error(`  FAIL [${user.email}]:`, e);
            failed++;
        }
    }

    console.log(`\nDone. Migrated: ${migrated}, Failed: ${failed}`);
}

main();
