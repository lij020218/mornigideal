import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import { logger } from "@/lib/logger";
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET - Fetch all folders for the current user
export const GET = withAuth(async (request: NextRequest, email: string) => {
    const { data: folders, error } = await supabaseAdmin
        .from('folders')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: true });

    if (error) {
        logger.error('[Folders API] Error fetching folders:', error);
        return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
    }

    return NextResponse.json({ folders: folders || [] });
});

// POST - Create a new folder
export const POST = withAuth(async (request: NextRequest, email: string) => {
    const body = await request.json();
    const { name, color = '#6366f1' } = body;

    if (!name || name.trim().length === 0) {
        return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const { data: folder, error } = await supabaseAdmin
        .from('folders')
        .insert({
            email: email,
            name: name.trim(),
            color
        })
        .select()
        .single();

    if (error) {
        logger.error('[Folders API] Error creating folder:', error);
        return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
    }

    return NextResponse.json({ folder });
});

// PATCH - Update folder name or color
export const PATCH = withAuth(async (request: NextRequest, email: string) => {
    const body = await request.json();
    const { id, name, color } = body;

    if (!id) {
        return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;
    updates.updated_at = new Date().toISOString();

    const { data: folder, error } = await supabaseAdmin
        .from('folders')
        .update(updates)
        .eq('id', id)
        .eq('email', email)
        .select()
        .single();

    if (error) {
        logger.error('[Folders API] Error updating folder:', error);
        return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
    }

    return NextResponse.json({ folder });
});

// DELETE - Delete a folder
export const DELETE = withAuth(async (request: NextRequest, email: string) => {
    const body = await request.json();
    const { id } = body;

    if (!id) {
        return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    // Materials will have their folder_id set to NULL due to ON DELETE SET NULL
    const { error } = await supabaseAdmin
        .from('folders')
        .delete()
        .eq('id', id)
        .eq('email', email);

    if (error) {
        logger.error('[Folders API] Error deleting folder:', error);
        return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
});
