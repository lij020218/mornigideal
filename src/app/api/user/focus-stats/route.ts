/**
 * 집중 세션 통계 API
 * POST: 집중 세션 저장
 * GET: 집중 통계 조회 (?period=today|week|month)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from '@/lib/auth-utils';
import { kvGet, kvAppend } from '@/lib/kv-store';
import { focusSessionSchema, validateBody } from '@/lib/schemas';

export async function POST(request: NextRequest) {
    const email = await getUserEmailWithAuth(request);
    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const v = validateBody(focusSessionSchema, body);
    if (!v.success) return v.response;
    const { duration, pomodoroCount, interruptions, category, note } = v.data;

    const now = new Date();
    const monthKey = `focus_sessions_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const entry = {
        date: now.toISOString().split('T')[0],
        time: now.toISOString(),
        duration,
        pomodoroCount: pomodoroCount ?? 0,
        interruptions: interruptions ?? 0,
        category: category ?? 'general',
        note: note ?? '',
    };

    await kvAppend(email, monthKey, entry, 500);

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
    if (period === 'today') {
        startDate = new Date(todayStr);
    } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
        // week (default)
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
    }
    const startStr = startDate.toISOString().split('T')[0];

    // Collect sessions from relevant months
    const months = new Set<string>();
    const cursor = new Date(startDate);
    while (cursor <= now) {
        months.add(`focus_sessions_${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }

    let allSessions: any[] = [];
    for (const monthKey of months) {
        const sessions = await kvGet<any[]>(email, monthKey);
        if (Array.isArray(sessions)) {
            allSessions = allSessions.concat(sessions);
        }
    }

    // Filter by date range
    const filtered = allSessions.filter(s => s.date >= startStr && s.date <= todayStr);

    // Calculate stats
    const totalMinutes = filtered.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalSessions = filtered.length;
    const totalPomodoros = filtered.reduce((sum, s) => sum + (s.pomodoroCount || 0), 0);
    const totalInterruptions = filtered.reduce((sum, s) => sum + (s.interruptions || 0), 0);

    // Daily breakdown
    const dailyMap: Record<string, { minutes: number; sessions: number }> = {};
    for (const s of filtered) {
        if (!dailyMap[s.date]) dailyMap[s.date] = { minutes: 0, sessions: 0 };
        dailyMap[s.date].minutes += s.duration || 0;
        dailyMap[s.date].sessions += 1;
    }

    // Calculate streak (consecutive days with focus sessions)
    let streak = 0;
    const check = new Date(todayStr);
    while (true) {
        const dateStr = check.toISOString().split('T')[0];
        if (dailyMap[dateStr]) {
            streak++;
            check.setDate(check.getDate() - 1);
        } else {
            break;
        }
    }

    const days = period === 'today' ? 1 : period === 'month' ? now.getDate() : 7;
    const avgMinutesPerDay = days > 0 ? Math.round(totalMinutes / days) : 0;

    return NextResponse.json({
        period,
        stats: {
            totalMinutes,
            totalSessions,
            totalPomodoros,
            totalInterruptions,
            avgMinutesPerDay,
            streak,
        },
        daily: dailyMap,
        sessions: period === 'today' ? filtered : undefined,
    });
}
