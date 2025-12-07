import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabase } from "@/lib/supabase";

// GET - Fetch all folders for the current user
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: folders, error } = await supabase
            .from('folders')
            .select('*')
            .eq('email', session.user.email)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[Folders API] Error fetching folders:', error);
            return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
        }

        return NextResponse.json({ folders: folders || [] });
    } catch (error) {
        console.error('[Folders API] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create a new folder
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name, color = '#6366f1' } = body;

        if (!name || name.trim().length === 0) {
            return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
        }

        const { data: folder, error } = await supabase
            .from('folders')
            .insert({
                email: session.user.email,
                name: name.trim(),
                color
            })
            .select()
            .single();

        if (error) {
            console.error('[Folders API] Error creating folder:', error);
            return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
        }

        return NextResponse.json({ folder });
    } catch (error) {
        console.error('[Folders API] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH - Update folder name or color
export async function PATCH(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { id, name, color } = body;

        if (!id) {
            return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
        }

        const updates: any = {};
        if (name !== undefined) updates.name = name.trim();
        if (color !== undefined) updates.color = color;
        updates.updated_at = new Date().toISOString();

        const { data: folder, error } = await supabase
            .from('folders')
            .update(updates)
            .eq('id', id)
            .eq('email', session.user.email)
            .select()
            .single();

        if (error) {
            console.error('[Folders API] Error updating folder:', error);
            return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
        }

        return NextResponse.json({ folder });
    } catch (error) {
        console.error('[Folders API] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete a folder
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
        }

        // Materials will have their folder_id set to NULL due to ON DELETE SET NULL
        const { error } = await supabase
            .from('folders')
            .delete()
            .eq('id', id)
            .eq('email', session.user.email);

        if (error) {
            console.error('[Folders API] Error deleting folder:', error);
            return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Folders API] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
