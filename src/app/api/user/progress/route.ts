import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET /api/user/progress?curriculum_id=xxx - Get progress for specific curriculum
export const GET = withAuth(async (request: NextRequest, email: string) => {
    const { searchParams } = new URL(request.url);
    const curriculum_id = searchParams.get('curriculum_id');

    if (!curriculum_id) {
        return NextResponse.json(
            { error: "Missing curriculum_id parameter" },
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

    // Get progress for this curriculum
    const { data: progress, error } = await supabaseAdmin
        .from("curriculum_progress")
        .select("*")
        .eq("user_id", userData.id)
        .eq("curriculum_id", curriculum_id)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error("[Progress API] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch progress" },
            { status: 500 }
        );
    }

    // Return empty progress if not found
    return NextResponse.json({
        progress: progress || {
            curriculum_id,
            completed_days: [],
            current_day: 1
        }
    });
});

// POST /api/user/progress - Update progress
export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { curriculum_id, completed_days, current_day } = await request.json();

    if (!curriculum_id) {
        return NextResponse.json(
            { error: "Missing curriculum_id" },
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

    // Upsert progress
    const updateData: any = {
        user_id: userData.id,
        curriculum_id
    };

    if (completed_days !== undefined) {
        updateData.completed_days = completed_days;
    }

    if (current_day !== undefined) {
        updateData.current_day = current_day;
    }

    const { data, error } = await supabaseAdmin
        .from("curriculum_progress")
        .upsert(updateData, {
            onConflict: 'user_id,curriculum_id'
        })
        .select()
        .single();

    if (error) {
        logger.error("[Progress API] Error:", error);
        return NextResponse.json(
            { error: "Failed to update progress" },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        progress: data
    });
});
