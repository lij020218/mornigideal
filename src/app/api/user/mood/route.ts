/**
 * 기분 체크인 API
 * POST: 기분/에너지 기록
 * GET: 기분 히스토리 조회 (?period=week|month)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { kvGet, kvAppend } from '@/lib/kv-store';
import { moodCheckInSchema, validateBody } from '@/lib/schemas';

export async function POST(request: NextRequest) {
    const email = await getUserEmailWithAuth(request);
    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const v = validateBody(moodCheckInSchema, body);
    if (!v.success) return v.response;
    const { mood, energy, note } = v.data;

    const now = new Date();
    const monthKey = `mood_checkins_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const entry = {
        date: now.toISOString().split('T')[0],
        time: now.toISOString(),
        mood,
        energy,
        note: note || '',
    };

    await kvAppend(email, monthKey, entry, 500);

    // user_states.energy_level 동시 업데이트
    const energyLevel = energy * 20; // 1-5 → 20-100
    await supabaseAdmin
        .from('user_states')
        .update({ energy_level: energyLevel, state_updated_at: now.toISOString() })
        .eq('user_email', email);

    return NextResponse.json({ success: true, entry });
}

export async function GET(request: NextRequest) {
    const email = await getUserEmailWithAuth(request);
    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const period = request.nextUrl.searchParams.get('period') || 'week';

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Determine date range
    let startDate: Date;
    if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
        // week (default)
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
    }
    const startStr = startDate.toISOString().split('T')[0];

    // Collect from relevant months
    const months = new Set<string>();
    const cursor = new Date(startDate);
    while (cursor <= now) {
        months.add(`mood_checkins_${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }

    let allCheckins: any[] = [];
    for (const monthKey of months) {
        const data = await kvGet<any[]>(email, monthKey);
        if (Array.isArray(data)) {
            allCheckins = allCheckins.concat(data);
        }
    }

    // Filter by date range
    const filtered = allCheckins.filter(c => c.date >= startStr && c.date <= todayStr);

    // Stats
    const avgMood = filtered.length > 0
        ? Math.round(filtered.reduce((sum, c) => sum + (c.mood || 3), 0) / filtered.length * 10) / 10
        : null;
    const avgEnergy = filtered.length > 0
        ? Math.round(filtered.reduce((sum, c) => sum + (c.energy || 3), 0) / filtered.length * 10) / 10
        : null;

    return NextResponse.json({
        period,
        checkins: filtered,
        stats: {
            total: filtered.length,
            avgMood,
            avgEnergy,
        },
    });
}
