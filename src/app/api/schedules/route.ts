/**
 * 일정 관리 API
 *
 * GET: 오늘 일정 조회
 * POST: 일정 추가
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserEmailFromRequest } from '@/lib/auth-utils';
import { dualWriteAdd } from '@/lib/schedule-dual-write';
import { isValidDate } from '@/lib/validation';

// 일정 조회 (customGoals 기반)
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getUserEmailFromRequest(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      console.error('일정 조회 오류:', error);
      return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
    }

    const customGoals: any[] = user?.profile?.customGoals || [];

    // 해당 날짜의 일정 필터 (specificDate 매칭 + 반복 일정)
    const daySchedules = customGoals.filter((g: any) => {
      if (g.specificDate === targetDateStr) return true;
      if (g.daysOfWeek && g.daysOfWeek.includes(dayOfWeek)) {
        if (g.startDate && targetDateStr < g.startDate) return false;
        if (g.endDate && targetDateStr > g.endDate) return false;
        return true;
      }
      return false;
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
    }));

    return NextResponse.json({ schedules: formattedSchedules });
  } catch (error) {
    console.error('일정 조회 오류:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

// 일정 추가
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getUserEmailFromRequest(request);
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { text, startTime, endTime, date, specificDate, color } = body;


    if (!text || !startTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

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
      console.error('[schedules/POST] 사용자 조회 오류:', fetchError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingProfile = user.profile || {};
    const customGoals = existingProfile.customGoals || [];
    customGoals.push(newGoal);


    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ profile: { ...existingProfile, customGoals } })
      .eq('email', userEmail);

    if (updateError) {
      console.error('[schedules/POST] 일정 추가 오류:', updateError);
      return NextResponse.json({ error: '일정 추가에 실패했습니다.' }, { status: 500 });
    }

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
  } catch (error) {
    console.error('일정 추가 오류:', error);
    return NextResponse.json({ error: 'Failed to add schedule' }, { status: 500 });
  }
}
