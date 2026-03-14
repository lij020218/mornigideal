/**
 * 관리자 피드백 상태 업데이트 API
 *
 * PATCH: 피드백 상태 변경 + 관리자 메모 (관리자 전용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';
import { feedbackUpdateSchema, validateBody } from '@/lib/schemas';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

function isAdmin(email: string): boolean {
    return ADMIN_EMAILS.includes(email);
}

export const PATCH = withAuth(async (request: NextRequest, email: string) => {
    if (!isAdmin(email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // URL에서 id 추출
    const url = new URL(request.url);
    const segments = url.pathname.split('/');
    const feedbackId = segments[segments.length - 1];

    if (!feedbackId) {
        return NextResponse.json({ error: 'Missing feedback ID' }, { status: 400 });
    }

    const body = await request.json();
    const v = validateBody(feedbackUpdateSchema, body);
    if (!v.success) return v.response;

    const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (v.data.status) {
        updates.status = v.data.status;
        if (v.data.status === 'resolved') {
            updates.resolved_at = new Date().toISOString();
        }
    }

    if (v.data.admin_notes !== undefined) {
        updates.admin_notes = v.data.admin_notes;
    }

    const { error } = await supabaseAdmin
        .from('user_feedback')
        .update(updates)
        .eq('id', feedbackId);

    if (error) {
        return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
});
