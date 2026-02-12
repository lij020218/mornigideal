import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12')));
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data: materials, count, error } = await supabaseAdmin
            .from("materials")
            .select("*", { count: 'exact' })
            .eq("user_id", email)
            .order("created_at", { ascending: false })
            .range(from, to);

        if (error) {
            console.error("[Materials API] Error:", error);
            return NextResponse.json(
                { error: "Failed to fetch materials" },
                { status: 500 }
            );
        }

        // Get folder counts using grouped query (avoids fetching all materials)
        const { data: folderData } = await supabaseAdmin
            .from("materials")
            .select("folder_id")
            .eq("user_id", email)
            .limit(1000);

        const folderCounts: Record<string, number> = {};
        folderData?.forEach(m => {
            const folderId = m.folder_id || 'all';
            folderCounts[folderId] = (folderCounts[folderId] || 0) + 1;
        });

        return NextResponse.json({
            materials: materials || [],
            total: count || 0,
            page,
            limit,
            totalPages: count ? Math.ceil(count / limit) : 0,
            folderCounts
        });
    } catch (error: any) {
        console.error("[Materials API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id, folder_id } = await request.json();
        if (!id) {
            return NextResponse.json({ error: "Material ID is required" }, { status: 400 });
        }


        const { data: material, error } = await supabaseAdmin
            .from("materials")
            .update({ folder_id: folder_id || null })
            .eq("id", id)
            .eq("user_id", email)
            .select()
            .single();

        if (error) {
            console.error("[Materials API] Error updating material:", error);
            return NextResponse.json({ error: "Failed to update material" }, { status: 500 });
        }

        return NextResponse.json({ material });
    } catch (error: any) {
        console.error("[Materials API] Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await request.json();
        if (!id) {
            return NextResponse.json({ error: "Material ID is required" }, { status: 400 });
        }


        // 1. Get file_url to delete from storage
        const { data: material, error: fetchError } = await supabaseAdmin
            .from("materials")
            .select("file_url")
            .eq("id", id)
            .eq("user_id", email)
            .maybeSingle();

        if (fetchError) {
            console.error("[Materials API] Error fetching material:", fetchError);
            return NextResponse.json({ error: "Material not found" }, { status: 404 });
        }

        // 2. Delete from database
        const { error: deleteError } = await supabaseAdmin
            .from("materials")
            .delete()
            .eq("id", id)
            .eq("user_id", email);

        if (deleteError) {
            console.error("[Materials API] Error deleting material:", deleteError);
            return NextResponse.json({ error: "Failed to delete material" }, { status: 500 });
        }

        // 3. Delete from storage if file_url exists
        if (material?.file_url) {
            try {
                const fileName = material.file_url.split("/").pop();
                if (fileName) {
                    await supabaseAdmin.storage.from("materials").remove([fileName]);
                }
            } catch (storageError) {
                console.error("[Materials API] Error deleting file from storage:", storageError);
                // Continue even if storage delete fails
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Materials API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
