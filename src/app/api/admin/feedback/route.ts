/**
 * 관리자 피드백 목록 API
 *
 * GET: 사용자 피드백 목록 조회 (관리자 전용)
 * - 상태 필터링, 페이지네이션
 * - 상태별 카운트 포함
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

function isAdmin(email: string): boolean {
    return ADMIN_EMAILS.includes(email);
}

export const GET = withAuth(async (request: NextRequest, email: string) => {
    if (!isAdmin(email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // 피드백 목록 쿼리
    let query = supabaseAdmin
        .from('user_feedback')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
        query = query.eq('status', status);
    }

    const { data: feedback, count: total, error } = await query;

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
    }

    // 상태별 카운트
    const [newCount, inProgressCount, resolvedCount, closedCount] = await Promise.all([
        supabaseAdmin.from('user_feedback').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabaseAdmin.from('user_feedback').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabaseAdmin.from('user_feedback').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabaseAdmin.from('user_feedback').select('*', { count: 'exact', head: true }).eq('status', 'closed'),
    ]);

    return NextResponse.json({
        feedback: feedback || [],
        total: total || 0,
        page,
        hasMore: offset + limit < (total || 0),
        statusCounts: {
            new: newCount.count || 0,
            in_progress: inProgressCount.count || 0,
            resolved: resolvedCount.count || 0,
            closed: closedCount.count || 0,
        },
    });
});
