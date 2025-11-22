import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to database');

        const sql = `
      -- Enable pgcrypto for gen_random_uuid()
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      -- Users table
      CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          profile JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_profile ON users USING GIN (profile);

      -- Updated_at trigger
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = TIMEZONE('utc', NOW());
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();

      -- RLS
      ALTER TABLE users ENABLE ROW LEVEL SECURITY;

      -- Policies
      -- Since we are using custom auth with the anon key, we need permissive policies for now.
      -- Security is enforced by the API layer (NextAuth).
      
      DROP POLICY IF EXISTS "Users can read own data" ON users;
      DROP POLICY IF EXISTS "Users can insert own data" ON users;
      DROP POLICY IF EXISTS "Users can update own data" ON users;
      
      DROP POLICY IF EXISTS "Enable read access for all users" ON users;
      CREATE POLICY "Enable read access for all users" ON users FOR SELECT USING (true);

      DROP POLICY IF EXISTS "Enable insert access for all users" ON users;
      CREATE POLICY "Enable insert access for all users" ON users FOR INSERT WITH CHECK (true);

      DROP POLICY IF EXISTS "Enable update access for all users" ON users;
      CREATE POLICY "Enable update access for all users" ON users FOR UPDATE USING (true);

      -- Add profile column if it doesn't exist (for safety, though CREATE TABLE handles it for new tables)
      ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB DEFAULT '{}'::jsonb;
    `;

        await client.query(sql);
        console.log('Successfully updated users table schema and policies.');

    } catch (err) {
        console.error('Error executing migration:', err);
    } finally {
        await client.end();
    }
}

migrate();
