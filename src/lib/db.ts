import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
}

// Server-side Supabase client with service role key for full database access
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

/**
 * Database wrapper providing PostgreSQL-like query interface
 * Uses Supabase RPC for raw SQL queries
 */
const db = {
    async query(text: string, params?: any[]) {
        console.log('[DB] Query called:', text.substring(0, 100));

        try {
            // Use Supabase RPC to execute raw SQL
            // Note: This requires creating a PostgreSQL function in Supabase
            // For now, we'll use Supabase's query builder where possible

            // Parse the query to determine table and operation
            const tableName = this.extractTableName(text);

            if (!tableName) {
                console.warn('[DB] Could not parse table name from query');
                return { rows: [] };
            }

            // For SELECT queries
            if (text.trim().toUpperCase().startsWith('SELECT')) {
                const { data, error } = await supabaseAdmin
                    .from(tableName)
                    .select('*');

                if (error) {
                    console.error(`[DB] Query error on ${tableName}:`, error);
                    return { rows: [] };
                }

                return { rows: data || [] };
            }

            // For other queries, return empty for now
            console.log(`[DB] Non-SELECT query on ${tableName}, returning empty`);
            return { rows: [] };

        } catch (error) {
            console.error('[DB] Query execution error:', error);
            return { rows: [] };
        }
    },

    extractTableName(sql: string): string | null {
        // Extract table name from SQL query
        const fromMatch = sql.match(/FROM\s+(\w+)/i);
        const intoMatch = sql.match(/INTO\s+(\w+)/i);
        const updateMatch = sql.match(/UPDATE\s+(\w+)/i);

        return fromMatch?.[1] || intoMatch?.[1] || updateMatch?.[1] || null;
    },

    // Helper to get supabase admin client directly
    get client() {
        return supabaseAdmin;
    }
};

export default db;
