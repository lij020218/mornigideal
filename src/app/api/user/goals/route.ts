import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isValidDate } from "@/lib/validation";
import { dailyGoalsSchema, validateBody } from '@/lib/schemas';
import { logger } from '@/lib/logger';

// GET /api/user/goals?date=2025-11-23
export const GET = withAuth(async (request: NextRequest, email: string) => {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const date = (dateParam && isValidDate(dateParam)) ? dateParam : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (userError || !userData) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: goals, error } = await supabaseAdmin
        .from("daily_goals")
        .select("*")
        .eq("user_id", userData.id)
        .eq("date", date)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        logger.error("[Goals API] Error:", error);
        return NextResponse.json({ error: "Failed to fetch goals" }, { status: 500 });
    }

    return NextResponse.json({
        goals: goals || { date, completed_goals: [], read_trends: [] }
    });
});

// POST /api/user/goals
export const POST = withAuth(async (request: NextRequest, email: string) => {
    const body = await request.json();
    const v = validateBody(dailyGoalsSchema, body);
    if (!v.success) return v.response;
    const { date, completed_goals, read_trends } = v.data;

    const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (userError || !userData) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: any = { user_id: userData.id, date };
    if (completed_goals !== undefined) updateData.completed_goals = completed_goals;
    if (read_trends !== undefined) updateData.read_trends = read_trends;

    const { data, error } = await supabaseAdmin
        .from("daily_goals")
        .upsert(updateData, { onConflict: 'user_id,date' })
        .select()
        .single();

    if (error) {
        logger.error("[Goals API] Error:", error);
        return NextResponse.json({ error: "Failed to update goals" }, { status: 500 });
    }

    return NextResponse.json({ success: true, goals: data });
});
