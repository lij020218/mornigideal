/**
 * 오늘 일정 조회 API (모바일 앱용)
 *
 * GET: 오늘 일정 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';
import { logger } from '@/lib/logger';

export const GET = withAuth(async (request: NextRequest, email: string) => {

  // users 테이블에서 profile.customGoals 조회
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('profile')
    .eq('email', email)
    .maybeSingle();

  if (userError || !user) {
    logger.error('[schedules/today] User not found:', userError);
    return NextResponse.json({ schedules: [] });
  }

  const customGoals = user.profile?.customGoals || [];

  // KST (한국 시간) 기준으로 오늘 날짜 계산
  const now = new Date();
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const todayStr = `${kstNow.getFullYear()}-${String(kstNow.getMonth() + 1).padStart(2, '0')}-${String(kstNow.getDate()).padStart(2, '0')}`;
  const dayOfWeek = kstNow.getDay(); // 0 = Sunday


  // 오늘 일정 필터링 (특정 날짜 또는 반복 일정)
  const todaySchedules = customGoals.filter((schedule: any) => {
    // 특정 날짜 일정
    if (schedule.specificDate === todayStr) {
      return true;
    }

    // 반복 일정 (daysOfWeek 배열에 오늘 요일 포함)
    if (schedule.daysOfWeek && schedule.daysOfWeek.includes(dayOfWeek)) {
      // 시작/종료 날짜 체크
      if (schedule.startDate && todayStr < schedule.startDate) return false;
      if (schedule.endDate && todayStr > schedule.endDate) return false;
      return true;
    }

    return false;
  });

  // 시간순 정렬
  todaySchedules.sort((a: any, b: any) => {
    const timeA = a.startTime || '00:00';
    const timeB = b.startTime || '00:00';
    return timeA.localeCompare(timeB);
  });


  // 모바일 앱 형식으로 변환
  const formattedSchedules = todaySchedules.map((s: any) => ({
    id: s.id,
    text: s.text,
    startTime: s.startTime || '00:00',
    endTime: s.endTime || undefined,
    completed: s.completed || false,
    color: s.color || undefined,
    date: todayStr,
  }));

  return NextResponse.json({ schedules: formattedSchedules });
});
