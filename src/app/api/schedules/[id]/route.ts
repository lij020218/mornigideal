/**
 * 개별 일정 관리 API
 *
 * GET: 일정 상세 조회
 * PUT: 일정 수정
 * DELETE: 일정 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserIdFromRequest, getUserEmailFromRequest } from '@/lib/auth-utils';
import { dualWriteDelete } from '@/lib/schedule-dual-write';
import { scheduleEditSchema, validateBody } from '@/lib/schemas';

// 일정 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data: schedule, error } = await supabaseAdmin
      .from('schedules')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({
      schedule: {
        id: schedule.id,
        text: schedule.title,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        completed: schedule.completed,
        skipped: schedule.skipped,
        color: schedule.color,
        location: schedule.location,
        date: schedule.date?.split('T')[0] || new Date().toISOString().split('T')[0],
      }
    });
  } catch (error) {
    console.error('일정 조회 오류:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

// 일정 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const v = validateBody(scheduleEditSchema, body);
    if (!v.success) return v.response;
    const { text, startTime, endTime, completed } = v.data;

    const updateData: any = {};
    if (text) updateData.title = text;
    if (startTime) updateData.start_time = startTime;
    if (endTime !== undefined) updateData.end_time = endTime;
    if (completed !== undefined) updateData.completed = completed;

    const { data, error } = await supabaseAdmin
      .from('schedules')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('일정 수정 오류:', error);
      return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('일정 수정 오류:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}

// 일정 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // customGoals 또는 learning 일정에서 삭제 시도 (goal_ 또는 learning- 접두사)
    if (id.startsWith('goal_') || id.startsWith('learning-')) {
      // 사용자의 customGoals에서 해당 일정 삭제
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('profile')
        .eq('id', userId)
        .maybeSingle();

      if (userError || !user) {
        console.error('사용자 조회 오류:', userError);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const customGoals = user.profile?.customGoals || [];
      const updatedGoals = customGoals.filter((goal: any) => goal.id !== id);

      // 일정이 존재하지 않는 경우 - learning- 일정은 customGoals에 없을 수 있으므로 성공 처리
      if (customGoals.length === updatedGoals.length) {
        if (id.startsWith('learning-')) {
          // learning- 접두사 일정은 클라이언트에서 생성된 가상 일정일 수 있음
          return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
      }

      // 업데이트된 customGoals 저장
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          profile: {
            ...user.profile,
            customGoals: updatedGoals
          }
        })
        .eq('id', userId);

      if (updateError) {
        console.error('customGoals 삭제 오류:', updateError);
        return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
      }

      // Dual-write: also delete from schedules table
      const userEmail = await getUserEmailFromRequest(request);
      if (userEmail) {
        await dualWriteDelete(userEmail, id);
      }

      return NextResponse.json({ success: true });
    }

    // schedules 테이블에서 삭제 시도 (기존 로직)
    const { data, error } = await supabaseAdmin
      .from('schedules')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error('일정 삭제 오류:', error);
      return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('일정 삭제 오류:', error);
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
  }
}
