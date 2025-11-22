import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

// GET /api/user/progress?curriculum_id=xxx - Get progress for specific curriculum
export async function GET(request: Request) {
    try {
        const session = await auth();

        if (!session || !session.user || !session.user.email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const curriculum_id = searchParams.get('curriculum_id');

        if (!curriculum_id) {
            return NextResponse.json(
                { error: "Missing curriculum_id parameter" },
                { status: 400 }
            );
        }

        // Get user ID from email
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("email", session.user.email)
            .single();

        if (userError || !userData) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Get progress for this curriculum
        const { data: progress, error } = await supabase
            .from("curriculum_progress")
            .select("*")
            .eq("user_id", userData.id)
            .eq("curriculum_id", curriculum_id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error("[Progress API] Error:", error);
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
    } catch (error: any) {
        console.error("[Progress API] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch progress" },
            { status: 500 }
        );
    }
}

// POST /api/user/progress - Update progress
export async function POST(request: Request) {
    try {
        const session = await auth();

        if (!session || !session.user || !session.user.email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { curriculum_id, completed_days, current_day } = await request.json();

        if (!curriculum_id) {
            return NextResponse.json(
                { error: "Missing curriculum_id" },
                { status: 400 }
            );
        }

        // Get user ID from email
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("id")
            .eq("email", session.user.email)
            .single();

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

        const { data, error } = await supabase
            .from("curriculum_progress")
            .upsert(updateData, {
                onConflict: 'user_id,curriculum_id'
            })
            .select()
            .single();

        if (error) {
            console.error("[Progress API] Error:", error);
            return NextResponse.json(
                { error: "Failed to update progress" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            progress: data
        });
    } catch (error: any) {
        console.error("[Progress API] Error:", error);
        return NextResponse.json(
            { error: "Failed to update progress" },
            { status: 500 }
        );
    }
}
