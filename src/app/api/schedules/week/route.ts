/**
 * 주간 일정 일괄 조회 API
 *
 * GET /api/schedules/week?start=2025-02-10&end=2025-02-16
 *
 * 7개 날짜를 개별 호출하는 대신 1회 DB 조회로 주간 일정 반환.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserEmailFromRequest } from '@/lib/auth-utils';
import { isValidDate } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getUserEmailFromRequest(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    if (!startParam || !endParam || !isValidDate(startParam) || !isValidDate(endParam)) {
      return NextResponse.json({ error: 'start and end date params required (YYYY-MM-DD)' }, { status: 400 });
    }

    // DB 조회 1회: 사용자 프로필에서 customGoals 가져오기
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('profile')
      .eq('email', userEmail)
      .maybeSingle();

    if (error) {
      console.error('[schedules/week] 조회 오류:', error);
      return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
    }

    const customGoals: any[] = user?.profile?.customGoals || [];

    // 날짜 범위 생성
    const dates: string[] = [];
    const current = new Date(startParam + 'T12:00:00');
    const end = new Date(endParam + 'T12:00:00');
    while (current <= end) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      dates.push(dateStr);
      current.setDate(current.getDate() + 1);
    }

    // 전체 기간의 일정을 한 번에 필터링
    const allSchedules: any[] = [];

    for (const dateStr of dates) {
      const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();

      const daySchedules = customGoals.filter((g: any) => {
        if (g.specificDate === dateStr) return true;
        if (g.daysOfWeek && g.daysOfWeek.includes(dayOfWeek)) {
          if (g.startDate && dateStr < g.startDate) return false;
          if (g.endDate && dateStr > g.endDate) return false;
          return true;
        }
        return false;
      });

      for (const g of daySchedules) {
        allSchedules.push({
          id: g.id,
          text: g.text,
          startTime: g.startTime || '00:00',
          endTime: g.endTime || undefined,
          completed: g.completed || false,
          skipped: g.skipped || false,
          color: g.color || undefined,
          location: g.location || undefined,
          memo: g.memo || undefined,
          date: dateStr,
        });
      }
    }

    // startTime 기준 정렬
    allSchedules.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime || '00:00').localeCompare(b.startTime || '00:00');
    });

    return NextResponse.json({ schedules: allSchedules });
  } catch (error) {
    console.error('[schedules/week] 오류:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}
