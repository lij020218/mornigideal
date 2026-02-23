/**
 * 기분 패턴 분석 API (Pro+ 전용)
 * GET: 요일별, 시간대별 기분 패턴 + 번아웃 위험도
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-handler';
import { kvGet } from '@/lib/kv-store';
import { isProOrAbove } from '@/lib/user-plan';

export const GET = withAuth(async (request: NextRequest, email: string) => {
    // Plan gate
    if (!(await isProOrAbove(email))) {
        return NextResponse.json(
            { error: '기분 패턴 분석은 Pro 이상 플랜에서 사용 가능합니다.' },
            { status: 403 },
        );
    }

    // Collect last 30 days of mood data
    const now = new Date();
    const months = new Set<string>();
    for (let i = 0; i < 30; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        months.add(`mood_checkins_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    let allCheckins: any[] = [];
    for (const monthKey of months) {
        const data = await kvGet<any[]>(email, monthKey);
        if (Array.isArray(data)) {
            allCheckins = allCheckins.concat(data);
        }
    }

    // Filter last 30 days
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startStr = thirtyDaysAgo.toISOString().split('T')[0];
    const filtered = allCheckins.filter(c => c.date >= startStr);

    if (filtered.length < 3) {
        return NextResponse.json({
            patterns: null,
            message: '패턴 분석을 위해 최소 3일 이상의 기록이 필요합니다.',
        });
    }

    // By day of week (0=Sun ~ 6=Sat)
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const byDay: Record<string, { moods: number[]; energies: number[] }> = {};
    for (const name of dayNames) {
        byDay[name] = { moods: [], energies: [] };
    }

    // By time slot
    const timeSlots = ['아침 (6-12)', '오후 (12-18)', '저녁 (18-24)', '새벽 (0-6)'];
    const byTime: Record<string, { moods: number[]; energies: number[] }> = {};
    for (const slot of timeSlots) {
        byTime[slot] = { moods: [], energies: [] };
    }

    for (const c of filtered) {
        const d = new Date(c.time || c.date);
        const dayName = dayNames[d.getDay()];
        const hour = d.getHours();

        byDay[dayName].moods.push(c.mood);
        byDay[dayName].energies.push(c.energy);

        let slot: string;
        if (hour >= 6 && hour < 12) slot = '아침 (6-12)';
        else if (hour >= 12 && hour < 18) slot = '오후 (12-18)';
        else if (hour >= 18) slot = '저녁 (18-24)';
        else slot = '새벽 (0-6)';

        byTime[slot].moods.push(c.mood);
        byTime[slot].energies.push(c.energy);
    }

    // Calculate averages
    const avg = (arr: number[]) => arr.length > 0
        ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length * 10) / 10
        : null;

    const dayPatterns = Object.entries(byDay).map(([day, data]) => ({
        day,
        avgMood: avg(data.moods),
        avgEnergy: avg(data.energies),
        count: data.moods.length,
    }));

    const timePatterns = Object.entries(byTime).map(([slot, data]) => ({
        slot,
        avgMood: avg(data.moods),
        avgEnergy: avg(data.energies),
        count: data.moods.length,
    }));

    // Burnout risk (low mood + low energy trend in recent 7 days)
    const recentWeek = filtered
        .filter(c => c.date >= new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);
    const recentAvgMood = avg(recentWeek.map(c => c.mood));
    const recentAvgEnergy = avg(recentWeek.map(c => c.energy));

    let burnoutRisk: 'low' | 'medium' | 'high' = 'low';
    if (recentAvgMood !== null && recentAvgEnergy !== null) {
        if (recentAvgMood <= 2 && recentAvgEnergy <= 2) burnoutRisk = 'high';
        else if (recentAvgMood <= 3 && recentAvgEnergy <= 3) burnoutRisk = 'medium';
    }

    return NextResponse.json({
        patterns: {
            byDay: dayPatterns,
            byTime: timePatterns,
            burnoutRisk,
            recentWeek: {
                avgMood: recentAvgMood,
                avgEnergy: recentAvgEnergy,
                checkins: recentWeek.length,
            },
        },
        totalCheckins: filtered.length,
    });
});
