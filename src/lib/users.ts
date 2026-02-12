import { supabaseAdmin } from './supabase-admin';
import bcrypt from 'bcryptjs';

export interface User {
    id: string;
    name: string;
    username: string;
    email: string;
    password: string;
    profile?: any; // JSONB field for user profile data
    created_at?: string;
    updated_at?: string;
}

export async function getUserByEmail(email: string): Promise<User | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

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

export async function getUserById(id: string): Promise<User | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            if (error.code === 'PGRST116') {
                // No rows returned
                return null;
            }
            console.error('[getUserById] Error:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('[getUserById] Exception:', error);
        return null;
    }
}

export async function updateUserProfileById(userId: string, profileUpdates: any): Promise<User | null> {
    try {
        const user = await getUserById(userId);
        if (!user) return null;

        const updatedProfile = {
            ...user.profile,
            ...profileUpdates,
        };

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({ profile: updatedProfile })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('[updateUserProfileById] Error:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('[updateUserProfileById] Exception:', error);
        throw error;
    }
}

export async function getUserByUsername(username: string): Promise<User | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('username', username)
            .maybeSingle();

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
        const { data, error } = await supabaseAdmin
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
    if (!user || !user.password) return null;

    let isValid = false;

    if (user.password.startsWith('$2')) {
        // bcrypt 해시 비교
        isValid = await bcrypt.compare(password, user.password);
    } else {
        // 평문 비밀번호: 검증 후 bcrypt로 자동 마이그레이션
        if (password === user.password) {
            isValid = true;
            const hashedPassword = await bcrypt.hash(password, 12);
            await supabaseAdmin
                .from('users')
                .update({ password: hashedPassword })
                .eq('email', email);
        }
    }

    if (!isValid) return null;
    return user;
}

export async function updateUserProfile(email: string, profileUpdates: any): Promise<User | null> {
    try {
        const user = await getUserByEmail(email);
        if (!user) return null;

        const updatedProfile = {
            ...user.profile,
            ...profileUpdates,
        };

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({ profile: updatedProfile })
            .eq('email', email)
            .select()
            .single();

        if (error) {
            console.error('[updateUserProfile] Error:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('[updateUserProfile] Exception:', error);
        throw error;
    }
}
