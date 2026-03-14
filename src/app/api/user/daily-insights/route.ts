/**
 * Daily Insights API
 *
 * GET /api/user/daily-insights — 오늘 일일 인사이트 조회
 * 매일 밤 9시 cron이 생성한 AI 인사이트를 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { kvGet } from '@/lib/kv-store';
import { withAuth } from '@/lib/api-handler';

export const GET = withAuth(async (request: NextRequest, userEmail: string) => {
    const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;

    // 오늘 인사이트 먼저 조회
    const todayInsights = await kvGet(userEmail, `daily_insights_${todayStr}`);
    if (todayInsights) {
        return NextResponse.json({ insights: todayInsights, date: todayStr });
    }

    // 오늘 없으면 어제 것 조회 (9시 전이면 아직 생성 안 됐을 수 있음)
    const yesterday = new Date(kst);
    yesterday.setDate(kst.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const yesterdayInsights = await kvGet(userEmail, `daily_insights_${yesterdayStr}`);
    if (yesterdayInsights) {
        return NextResponse.json({ insights: yesterdayInsights, date: yesterdayStr });
    }

    return NextResponse.json({ insights: null, date: todayStr });
});
