import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET /api/user/curriculum - Get all curriculums for current user
export async function GET(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);

        if (!email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
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

        // Get all curriculums for this user
        const { data: curriculums, error } = await supabaseAdmin
            .from("user_curriculums")
            .select("*")
            .eq("user_id", userData.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("[Curriculum API] Error:", error);
            return NextResponse.json(
                { error: "Failed to fetch curriculums" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            curriculums: curriculums || []
        });
    } catch (error: any) {
        console.error("[Curriculum API] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch curriculums" },
            { status: 500 }
        );
    }
}

// POST /api/user/curriculum - Save a new curriculum
export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);

        if (!email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { curriculum_id, curriculum_data } = await request.json();

        if (!curriculum_id || !curriculum_data) {
            return NextResponse.json(
                { error: "Missing required fields" },
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

        // Upsert curriculum (insert or update if exists)
        const { data, error } = await supabaseAdmin
            .from("user_curriculums")
            .upsert({
                user_id: userData.id,
                curriculum_id,
                curriculum_data
            }, {
                onConflict: 'user_id,curriculum_id'
            })
            .select()
            .single();

        if (error) {
            console.error("[Curriculum API] Error:", error);
            return NextResponse.json(
                { error: "Failed to save curriculum" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            curriculum: data
        });
    } catch (error: any) {
        console.error("[Curriculum API] Error:", error);
        return NextResponse.json(
            { error: "Failed to save curriculum" },
            { status: 500 }
        );
    }
}

// DELETE /api/user/curriculum - Remove a curriculum
export async function DELETE(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);

        if (!email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { curriculum_id } = await request.json();

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

        // Delete curriculum
        const { error } = await supabaseAdmin
            .from("user_curriculums")
            .delete()
            .eq("user_id", userData.id)
            .eq("curriculum_id", curriculum_id);

        if (error) {
            console.error("[Curriculum API] Error:", error);
            return NextResponse.json(
                { error: "Failed to delete curriculum" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true
        });
    } catch (error: any) {
        console.error("[Curriculum API] Error:", error);
        return NextResponse.json(
            { error: "Failed to delete curriculum" },
            { status: 500 }
        );
    }
}
