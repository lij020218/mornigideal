import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isValidDate } from "@/lib/validation";

// GET /api/user/goals?date=2025-11-23 - Get goals for specific date
export async function GET(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);

        if (!email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');
        const date = (dateParam && isValidDate(dateParam)) ? dateParam : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        // Get user ID from email
        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (userError || !userData) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Get goals for this date
        const { data: goals, error } = await supabaseAdmin
            .from("daily_goals")
            .select("*")
            .eq("user_id", userData.id)
            .eq("date", date)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error("[Goals API] Error:", error);
            return NextResponse.json(
                { error: "Failed to fetch goals" },
                { status: 500 }
            );
        }

        // Return empty goals if not found
        return NextResponse.json({
            goals: goals || {
                date,
                completed_goals: [],
                read_trends: []
            }
        });
    } catch (error: any) {
        console.error("[Goals API] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch goals" },
            { status: 500 }
        );
    }
}

// POST /api/user/goals - Update daily goals
export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);

        if (!email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { date, completed_goals, read_trends } = await request.json();

        if (!date || !isValidDate(date)) {
            return NextResponse.json(
                { error: "Missing or invalid date (YYYY-MM-DD)" },
                { status: 400 }
            );
        }

        // Get user ID from email
        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (userError || !userData) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Upsert goals
        const updateData: any = {
            user_id: userData.id,
            date
        };

        if (completed_goals !== undefined) {
            updateData.completed_goals = completed_goals;
        }

        if (read_trends !== undefined) {
            updateData.read_trends = read_trends;
        }

        const { data, error } = await supabaseAdmin
            .from("daily_goals")
            .upsert(updateData, {
                onConflict: 'user_id,date'
            })
            .select()
            .single();

        if (error) {
            console.error("[Goals API] Error:", error);
            return NextResponse.json(
                { error: "Failed to update goals" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            goals: data
        });
    } catch (error: any) {
        console.error("[Goals API] Error:", error);
        return NextResponse.json(
            { error: "Failed to update goals" },
            { status: 500 }
        );
    }
}
