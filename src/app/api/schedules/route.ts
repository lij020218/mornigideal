/**
 * 일정 관리 API
 *
 * GET: 오늘 일정 조회
 * POST: 일정 추가
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withAuth } from '@/lib/api-handler';
import { logger } from '@/lib/logger';
import { dualWriteAdd } from '@/lib/schedule-dual-write';
import { isValidDate } from '@/lib/validation';
import { scheduleCreateSchema, validateBody } from '@/lib/schemas';
import { invalidateUserContext } from '@/lib/shared-context';

// 일정 조회 (customGoals 기반)
export const GET = withAuth(async (request: NextRequest, userEmail: string) => {
    // URL에서 date 파라미터 가져오기 (없으면 오늘 KST)
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
    const targetDateStr = (dateParam && isValidDate(dateParam)) ? dateParam : todayStr;
    const dayOfWeek = new Date(targetDateStr + 'T12:00:00').getDay();

    // customGoals에서 조회
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('profile')
      .eq('email', userEmail)
      .maybeSingle();

    if (error) {
      logger.error('일정 조회 오류:', error);
      return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
    }

    const customGoals: any[] = user?.profile?.customGoals || [];

    // 해당 날짜의 일정 필터 (specificDate 매칭 + 반복 일정, ID 기준 중복 제거)
    const seenIds = new Set<string>();
    const daySchedules = customGoals.filter((g: any) => {
      let matches = false;
      if (g.specificDate === targetDateStr) matches = true;
      if (!matches && g.daysOfWeek && g.daysOfWeek.includes(dayOfWeek)) {
        if (g.startDate && targetDateStr < g.startDate) return false;
        if (g.endDate && targetDateStr > g.endDate) return false;
        matches = true;
      }
      if (!matches) return false;
      if (seenIds.has(g.id)) return false;
      seenIds.add(g.id);
      return true;
    });

    // startTime 기준 정렬
    daySchedules.sort((a: any, b: any) => {
      const aTime = a.startTime || '00:00';
      const bTime = b.startTime || '00:00';
      return aTime.localeCompare(bTime);
    });

    // 모바일 앱 형식으로 변환
    const formattedSchedules = daySchedules.map((g: any) => ({
      id: g.id,
      text: g.text,
      startTime: g.startTime || '00:00',
      endTime: g.endTime || undefined,
      completed: g.completed || false,
      skipped: g.skipped || false,
      color: g.color || undefined,
      location: g.location || undefined,
      memo: g.memo || undefined,
      date: targetDateStr,
      linkedGoalId: g.linkedGoalId || undefined,
    }));

    return NextResponse.json({ schedules: formattedSchedules });
});

// 일정 추가
export const POST = withAuth(async (request: NextRequest, userEmail: string) => {
    const body = await request.json();
    const v = validateBody(scheduleCreateSchema, body);
    if (!v.success) return v.response;
    const { text, startTime, endTime, date, specificDate, color } = v.data;

    // KST 기준 날짜 계산
    const now = new Date();
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
    const scheduleDate = specificDate || date || todayStr;

    // customGoals에 추가 (profile.customGoals 배열에 push)
    const newGoal: Record<string, any> = {
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      time: 'morning' as const,
      startTime,
      endTime: endTime || undefined,
      specificDate: scheduleDate,
      completed: false,
      ...(color ? { color } : {}),
    };


    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('profile')
      .eq('email', userEmail)
      .maybeSingle();

    if (fetchError || !user) {
      logger.error('[schedules/POST] 사용자 조회 오류:', fetchError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingProfile = user.profile || {};
    const customGoals = existingProfile.customGoals || [];

    // 중복 일정 체크 (같은 날짜 + 같은 텍스트 + 같은 시간)
    const isDuplicate = customGoals.some((g: any) =>
      g.text === text && g.startTime === startTime && g.specificDate === scheduleDate
    );
    if (isDuplicate) {
      return NextResponse.json({ error: '동일한 일정이 이미 존재합니다.' }, { status: 409 });
    }

    customGoals.push(newGoal);


    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ profile: { ...existingProfile, customGoals } })
      .eq('email', userEmail);

    if (updateError) {
      logger.error('[schedules/POST] 일정 추가 오류:', updateError);
      return NextResponse.json({ error: '일정 추가에 실패했습니다.' }, { status: 500 });
    }

    // 캐시 무효화
    invalidateUserContext(userEmail);

    // Dual-write to schedules table
    await dualWriteAdd(userEmail, newGoal, scheduleDate);

    return NextResponse.json({
      schedule: {
        id: newGoal.id,
        text: newGoal.text,
        startTime: newGoal.startTime,
        endTime: newGoal.endTime,
        completed: false,
        date: scheduleDate,
      }
    });
});
