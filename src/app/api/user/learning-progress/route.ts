import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const { searchParams } = new URL(request.url);
    const curriculumId = searchParams.get("curriculumId");

    if (!curriculumId) {
        return NextResponse.json({ error: "Missing curriculumId" }, { status: 400 });
    }

    const { data: userData } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (!userData) {
        return NextResponse.json({ progress: null });
    }

    const { data: progress } = await supabaseAdmin
        .from("learning_progress")
        .select("*")
        .eq("user_id", userData.id)
        .eq("curriculum_id", curriculumId)
        .maybeSingle();

    if (!progress) {
        return NextResponse.json({
            progress: {
                completedDays: [],
                currentDay: 1,
            },
        });
    }

    return NextResponse.json({
        progress: {
            completedDays: progress.completed_days || [],
            currentDay: progress.current_day || 1,
        },
    });
});

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { curriculumId, completedDays, currentDay } = await request.json();

    if (!curriculumId) {
        return NextResponse.json({ error: "Missing curriculumId" }, { status: 400 });
    }

    const { data: userData } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (!userData) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if progress exists
    const { data: existingProgress } = await supabaseAdmin
        .from("learning_progress")
        .select("id")
        .eq("user_id", userData.id)
        .eq("curriculum_id", curriculumId)
        .maybeSingle();

    if (existingProgress) {
        // Update existing progress
        await supabaseAdmin
            .from("learning_progress")
            .update({
                completed_days: completedDays,
                current_day: currentDay,
                updated_at: new Date().toISOString(),
            })
            .eq("id", existingProgress.id);
    } else {
        // Create new progress
        await supabaseAdmin
            .from("learning_progress")
            .insert({
                user_id: userData.id,
                curriculum_id: curriculumId,
                completed_days: completedDays,
                current_day: currentDay,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
    }

    return NextResponse.json({ success: true });
});
