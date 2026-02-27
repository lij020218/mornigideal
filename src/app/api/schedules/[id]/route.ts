/**
 * 개별 일정 관리 API
 *
 * GET: 일정 상세 조회
 * PUT: 일정 수정
 * DELETE: 일정 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserIdWithAuth, getUserEmailFromRequest } from '@/lib/auth-utils';
import { logger } from '@/lib/logger';
import { dualWriteDelete } from '@/lib/schedule-dual-write';
import { scheduleEditSchema, validateBody } from '@/lib/schemas';
import { invalidateUserContext } from '@/lib/shared-context';

// 일정 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdWithAuth(request);
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
    logger.error('일정 조회 오류:', error);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

// 일정 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdWithAuth(request);
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
      logger.error('일정 수정 오류:', error);
      return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // 캐시 무효화
    const editEmail = await getUserEmailFromRequest(request);
    if (editEmail) {
      invalidateUserContext(editEmail);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('일정 수정 오류:', error);
    return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 });
  }
}

// 일정 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdWithAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // customGoals에서 삭제 시도 (goal_, learning-, recurring_ 접두사)
    if (id.startsWith('goal_') || id.startsWith('learning-') || id.startsWith('recurring_')) {
      // 사용자의 customGoals에서 해당 일정 삭제
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('profile')
        .eq('id', userId)
        .maybeSingle();

      if (userError || !user) {
        logger.error('사용자 조회 오류:', userError);
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const customGoals = user.profile?.customGoals || [];
      const updatedGoals = customGoals.filter((goal: any) => goal.id !== id);

      // 일정이 존재하지 않는 경우
      if (customGoals.length === updatedGoals.length) {
        if (id.startsWith('learning-') || id.startsWith('recurring_')) {
          // 가상 일정이거나 이미 삭제된 경우 성공 처리
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
        logger.error('customGoals 삭제 오류:', updateError);
        return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
      }

      // 캐시 무효화 — 삭제된 일정이 알림에 남지 않도록
      const userEmail = await getUserEmailFromRequest(request);
      if (userEmail) {
        invalidateUserContext(userEmail);
        // Dual-write: also delete from schedules table
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
      logger.error('일정 삭제 오류:', error);
      return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // 캐시 무효화
    const userEmail2 = await getUserEmailFromRequest(request);
    if (userEmail2) {
      invalidateUserContext(userEmail2);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('일정 삭제 오류:', error);
    return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 });
  }
}
