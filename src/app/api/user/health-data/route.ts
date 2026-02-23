/**
 * 건강 데이터 API
 * POST: 건강 데이터 저장 (모바일에서 HealthKit/Google Fit 동기화)
 * GET: 건강 데이터 조회 (?from=YYYY-MM-DD&to=YYYY-MM-DD)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-handler';
import { kvGet, kvSet } from '@/lib/kv-store';
import { isProOrAbove } from '@/lib/user-plan';
import { healthDataSchema, validateBody } from '@/lib/schemas';

export const POST = withAuth(async (request: NextRequest, email: string) => {
    // Plan gate
    if (!(await isProOrAbove(email))) {
        return NextResponse.json(
            { error: '건강 데이터 동기화는 Pro 이상 플랜에서 사용 가능합니다.' },
            { status: 403 },
        );
    }

    const body = await request.json();
    const v = validateBody(healthDataSchema, body);
    if (!v.success) return v.response;

    const key = `health_data_${v.data.date}`;
    const existing = await kvGet<Record<string, any>>(email, key);

    // Merge with existing data (don't overwrite fields not provided)
    const merged = { ...existing, ...v.data, updatedAt: new Date().toISOString() };
    await kvSet(email, key, merged);

    return NextResponse.json({ success: true, data: merged });
});

export const GET = withAuth(async (request: NextRequest, email: string) => {
    if (!(await isProOrAbove(email))) {
        return NextResponse.json(
            { error: '건강 데이터 조회는 Pro 이상 플랜에서 사용 가능합니다.' },
            { status: 403 },
        );
    }

    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to') || new Date().toISOString().split('T')[0];

    if (!from) {
        return NextResponse.json({ error: 'from parameter required (YYYY-MM-DD)' }, { status: 400 });
    }

    // Collect data for date range
    const results: Record<string, any> = {};
    const cursor = new Date(from);
    const endDate = new Date(to);

    while (cursor <= endDate) {
        const dateStr = cursor.toISOString().split('T')[0];
        const data = await kvGet(email, `health_data_${dateStr}`);
        if (data) {
            results[dateStr] = data;
        }
        cursor.setDate(cursor.getDate() + 1);
    }

    return NextResponse.json({ data: results, from, to });
});
