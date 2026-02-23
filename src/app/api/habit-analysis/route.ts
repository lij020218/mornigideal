import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-handler';
import { generateHabitInsights } from '@/lib/capabilities/habit-insights';

export const revalidate = 21600; // Cache for 6 hours

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const result = await generateHabitInsights(email, {});

    if (!result.success && !result.data) {
        return NextResponse.json({
            insight: '분석 준비 중',
            suggestion: '잠시 후 다시 확인해주세요',
            emoji: '⏳',
            category: 'consistency'
        });
    }

    return NextResponse.json(result.data);
});
