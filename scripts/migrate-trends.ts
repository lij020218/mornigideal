import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
}

const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Creating "trends" table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS trends (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                time TEXT NOT NULL,
                image_color TEXT NOT NULL,
                image_url TEXT,
                original_url TEXT NOT NULL,
                summary TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('Creating "trend_details" table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS trend_details (
                trend_id TEXT PRIMARY KEY REFERENCES trends(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                key_takeaways JSONB NOT NULL,
                action_items JSONB NOT NULL,
                original_url TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
