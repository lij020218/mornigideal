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
        .select("id, title, file_name, file_size, uploaded_at, created_at, type")
        .eq("user_id", email)
        .order("created_at", { ascending: false })
        .limit(20); // Limit to recent 20 materials for faster loading

    return materials || [];
});

// Cache curriculum fetching
export const getCachedCurriculum = cache(async (userId: string) => {
    if (!userId) return [];

    const { data: curriculums } = await supabase
        .from("user_curriculums")
        .select("curriculum_data, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1) // Only get the most recent curriculum
        .single();

    return curriculums ? [curriculums] : [];
});

// Cache trend briefing fetching
export const getCachedTrendBriefing = cache(async (email: string) => {
    if (!email) return [];

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const { data, error } = await supabase
        .from('trends_cache')
        .select('trends')
        .eq('email', email)
        .eq('date', today)
        .maybeSingle();

    if (error || !data) return [];

    return data.trends || [];
});

// Cache recommendations fetching
export const getCachedRecommendations = cache(async (email: string) => {
    if (!email) return null;

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const { data, error } = await supabase
        .from('recommendations_cache')
        .select('recommendations, created_at')
        .eq('email', email)
        .eq('date', today)
        .maybeSingle();

    if (error || !data) return null;

    return {
        recommendations: data.recommendations || [],
        generated_at: data.created_at
    };
});

// Cache habit insights fetching
export const getCachedHabitInsights = cache(async (email: string) => {
    if (!email) return null;

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const { data, error } = await supabase
        .from('habit_insights_cache')
        .select('insights, created_at')
        .eq('email', email)
        .eq('date', today)
        .maybeSingle();

    if (error || !data) return null;

    return data.insights || null;
});
