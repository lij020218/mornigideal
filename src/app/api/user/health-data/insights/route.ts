/**
 * 건강 인사이트 API (Pro+ 전용)
 * GET: 건강 데이터 기반 인사이트 분석
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from '@/lib/auth-utils';
import { kvGet } from '@/lib/kv-store';
import { isProOrAbove } from '@/lib/user-plan';

interface HealthDay {
    date: string;
    steps?: number;
    sleepMinutes?: number;
    sleepQuality?: number;
    activeMinutes?: number;
    heartRateAvg?: number;
    caloriesBurned?: number;
}

export async function GET(request: NextRequest) {
    const email = await getUserEmailWithAuth(request);
    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isProOrAbove(email))) {
        return NextResponse.json(
            { error: '건강 인사이트는 Pro 이상 플랜에서 사용 가능합니다.' },
            { status: 403 },
        );
    }

    const days = parseInt(request.nextUrl.searchParams.get('days') || '7');
    const now = new Date();

    // Collect last N days of health data
    const healthDays: HealthDay[] = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const data = await kvGet<HealthDay>(email, `health_data_${dateStr}`);
        if (data) {
            healthDays.push({ ...data, date: dateStr });
        }
    }

    if (healthDays.length === 0) {
        return NextResponse.json({
            insights: [],
            summary: { message: '건강 데이터가 없습니다. 기기를 연동해주세요.' },
        });
    }

    // Calculate averages
    const withSleep = healthDays.filter(d => d.sleepMinutes != null);
    const withSteps = healthDays.filter(d => d.steps != null);
    const withActive = healthDays.filter(d => d.activeMinutes != null);

    const avgSleep = withSleep.length > 0
        ? Math.round(withSleep.reduce((s, d) => s + (d.sleepMinutes || 0), 0) / withSleep.length)
        : null;
    const avgSteps = withSteps.length > 0
        ? Math.round(withSteps.reduce((s, d) => s + (d.steps || 0), 0) / withSteps.length)
        : null;
    const avgActive = withActive.length > 0
        ? Math.round(withActive.reduce((s, d) => s + (d.activeMinutes || 0), 0) / withActive.length)
        : null;

    // Generate insights
    const insights: Array<{ type: string; title: string; description: string; severity: 'info' | 'warning' | 'good' }> = [];

    if (avgSleep !== null) {
        const sleepHours = avgSleep / 60;
        if (sleepHours < 6) {
            insights.push({
                type: 'sleep',
                title: '수면 부족 주의',
                description: `평균 ${sleepHours.toFixed(1)}시간 수면 중이에요. 7-8시간을 목표로 해보세요.`,
                severity: 'warning',
            });
        } else if (sleepHours >= 7 && sleepHours <= 9) {
            insights.push({
                type: 'sleep',
                title: '수면 양호',
                description: `평균 ${sleepHours.toFixed(1)}시간으로 적정 수면을 유지하고 있어요.`,
                severity: 'good',
            });
        }

        // Sleep trend
        if (withSleep.length >= 3) {
            const recent = withSleep.slice(0, 3);
            const older = withSleep.slice(3);
            if (older.length > 0) {
                const recentAvg = recent.reduce((s, d) => s + (d.sleepMinutes || 0), 0) / recent.length;
                const olderAvg = older.reduce((s, d) => s + (d.sleepMinutes || 0), 0) / older.length;
                if (recentAvg < olderAvg - 30) {
                    insights.push({
                        type: 'sleep_trend',
                        title: '수면 시간 감소 추세',
                        description: '최근 수면 시간이 줄어들고 있어요. 취침 시간을 일정하게 유지해보세요.',
                        severity: 'warning',
                    });
                }
            }
        }
    }

    if (avgSteps !== null) {
        if (avgSteps < 5000) {
            insights.push({
                type: 'activity',
                title: '활동량 부족',
                description: `일 평균 ${avgSteps.toLocaleString()}걸음이에요. 8,000걸음을 목표로 해보세요.`,
                severity: 'warning',
            });
        } else if (avgSteps >= 8000) {
            insights.push({
                type: 'activity',
                title: '활동량 좋음',
                description: `일 평균 ${avgSteps.toLocaleString()}걸음으로 활동적이에요!`,
                severity: 'good',
            });
        }
    }

    if (avgActive !== null && avgActive < 30) {
        insights.push({
            type: 'exercise',
            title: '운동 시간 부족',
            description: `일 평균 ${avgActive}분 활동 중이에요. WHO 권장 하루 30분 이상 운동을 추천해요.`,
            severity: 'warning',
        });
    }

    return NextResponse.json({
        insights,
        summary: {
            avgSleepMinutes: avgSleep,
            avgSteps,
            avgActiveMinutes: avgActive,
            daysWithData: healthDays.length,
            totalDays: days,
        },
        daily: healthDays,
    });
}
