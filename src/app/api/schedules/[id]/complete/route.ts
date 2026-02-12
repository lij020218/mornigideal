/**
 * 일정 완료 처리 API
 *
 * POST: 일정 완료 토글
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserIdFromRequest, getUserEmailFromRequest } from '@/lib/auth-utils';
import { dualWriteUpdate } from '@/lib/schedule-dual-write';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // 현재 일정 조회
    const { data: schedule, error: fetchError } = await supabaseAdmin
      .from('schedules')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!fetchError && schedule) {
      // schedules 테이블에서 찾은 경우: 토글
      const { error: updateError } = await supabaseAdmin
        .from('schedules')
        .update({ completed: !schedule.completed })
        .eq('id', id);

      if (updateError) {
        console.error('일정 완료 처리 오류:', updateError);
        return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 });
      }

      return NextResponse.json({ success: true, completed: !schedule.completed });
    }

    // customGoals 폴백: schedules 테이블에 없으면 customGoals에서 찾기
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, profile')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user?.profile?.customGoals) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const customGoals = user.profile.customGoals;
    const goalIndex = customGoals.findIndex((g: any) => g.id === id);

    if (goalIndex === -1) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const newCompleted = !customGoals[goalIndex].completed;
    customGoals[goalIndex] = { ...customGoals[goalIndex], completed: newCompleted };

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ profile: { ...user.profile, customGoals } })
      .eq('id', userId);

    if (updateError) {
      console.error('customGoals 완료 처리 오류:', updateError);
      return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 });
    }

    // Dual-write to schedules table
    if (user.email) {
      await dualWriteUpdate(user.email, id, { completed: newCompleted });
    }

    return NextResponse.json({ success: true, completed: newCompleted });
  } catch (error) {
    console.error('일정 완료 처리 오류:', error);
    return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 });
  }
}
