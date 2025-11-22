import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
let envContent = '';

if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
}

const keysToAdd = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: 'https://ojqyphkwipvdyqktsjij.supabase.co' },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: 'sb_publishable_7m_BthOQmZKunR4SAvK3OQ_9q7zesJS' },
    { key: 'AUTH_SECRET', value: 'restored_auth_secret_key_2025_complex_string' }
];

let addedCount = 0;
keysToAdd.forEach(({ key, value }) => {
    if (!envContent.includes(key)) {
        envContent += `\n${key}=${value}`;
        addedCount++;
        console.log(`Added ${key}`);
    } else {
        console.log(`${key} already exists`);
    }
});

if (addedCount > 0) {
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Successfully restored ${addedCount} keys to .env.local`);
} else {
    console.log('All keys are already present.');
}
