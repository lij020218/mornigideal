import { cache } from 'react';
import { auth } from '@/auth';
import { supabase } from '@/lib/supabase';
import { getUserByEmail } from '@/lib/users';

// Cache the user fetching
export const getCachedUser = cache(async () => {
    const session = await auth();
    if (!session?.user?.email) return null;
    return getUserByEmail(session.user.email);
});

// Cache materials fetching
export const getCachedMaterials = cache(async (email: string) => {
    if (!email) return [];

    const { data: materials } = await supabase
        .from("materials")
        .select("*")
        .eq("user_id", email)
        .order("created_at", { ascending: false });

    return materials || [];
});

// Cache curriculum fetching
export const getCachedCurriculum = cache(async (userId: string) => {
    if (!userId) return [];

    const { data: curriculums } = await supabase
        .from("user_curriculums")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    return curriculums || [];
});

// Cache trend briefing fetching
export const getCachedTrendBriefing = cache(async (email: string) => {
    if (!email) return null;

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const { data } = await supabase
        .from('trends_cache')
        .select('trends, last_updated')
        .eq('email', email)
        .eq('date', today)
        .single();

    if (!data) return null;

    return {
        trends: data.trends || [],
        generated_at: data.last_updated
    };
});
