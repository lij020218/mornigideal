import { supabase } from './supabase';

export interface User {
    id: string;
    name: string;
    username: string;
    email: string;
    password: string; // In production, this should be hashed
    created_at?: string;
    updated_at?: string;
}

export async function getUserByEmail(email: string): Promise<User | null> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows returned
                return null;
            }
            console.error('[getUserByEmail] Error:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('[getUserByEmail] Exception:', error);
        return null;
    }
}

export async function getUserByUsername(username: string): Promise<User | null> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows returned
                return null;
            }
            console.error('[getUserByUsername] Error:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('[getUserByUsername] Exception:', error);
        return null;
    }
}

export async function createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    try {
        const { data, error } = await supabase
            .from('users')
            .insert([userData])
            .select()
            .single();

        if (error) {
            console.error('[createUser] Error:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('[createUser] Exception:', error);
        throw error;
    }
}

export async function validateUser(email: string, password: string): Promise<User | null> {
    const user = await getUserByEmail(email);
    if (!user) return null;

    // In production, compare hashed passwords
    if (user.password !== password) return null;

    return user;
}
