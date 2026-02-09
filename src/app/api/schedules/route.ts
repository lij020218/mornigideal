/**
 * 일정 관리 API
 *
 * GET: 오늘 일정 조회
 * POST: 일정 추가
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { getUserIdFromRequest, getUserEmailFromRequest } from '@/lib/auth-utils';
import { isValidDate } from '@/lib/validation';

// 오늘 일정 조회
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // URL에서 date 파라미터 가져오기 (없으면 오늘)
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    const targetDate = (dateParam && isValidDate(dateParam)) ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: schedules, error } = await supabaseAdmin
      .from('schedules')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startOfDay.toISOString())
      .lte('date', endOfDay.toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('일정 조회 오류:', error);
      return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
    }

    // 모바일 앱 형식으로 변환
    const formattedSchedules = (schedules || []).map(s => ({
      id: s.id,
      text: s.title,
      startTime: s.start_time || '00:00',
      endTime: s.end_time || undefined,
      completed: s.completed,
      skipped: s.skipped,
      color: s.color,
      location: s.location,
      date: s.date?.split('T')[0] || new Date().toISOString().split('T')[0],
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

    console.log('[schedules/POST] Request body:', { text, startTime, endTime, specificDate, color });

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

    console.log('[schedules/POST] Looking up user');

    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('profile')
      .eq('email', userEmail)
      .single();

    if (fetchError || !user) {
      console.error('[schedules/POST] 사용자 조회 오류:', fetchError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existingProfile = user.profile || {};
    const customGoals = existingProfile.customGoals || [];
    customGoals.push(newGoal);

    console.log('[schedules/POST] Adding goal, total customGoals:', customGoals.length);

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ profile: { ...existingProfile, customGoals } })
      .eq('email', userEmail);

    if (updateError) {
      console.error('[schedules/POST] 일정 추가 오류:', updateError);
      return NextResponse.json({ error: 'Failed to add schedule', details: updateError.message }, { status: 500 });
    }

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
