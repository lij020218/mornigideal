/**
 * 일정 완료 처리 API
 *
 * POST: 일정 완료 토글
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getUserIdWithAuth, getUserEmailFromRequest } from '@/lib/auth-utils';
import { dualWriteUpdate } from '@/lib/schedule-dual-write';
import { logger } from '@/lib/logger';
import { invalidateUserContext } from '@/lib/shared-context';
import { getUserById, updateUserProfileById } from '@/lib/users';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserIdWithAuth(request);
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
      const newCompleted = !schedule.completed;
      const { error: updateError } = await supabaseAdmin
        .from('schedules')
        .update({ completed: newCompleted })
        .eq('id', id)
        .eq('user_id', userId);

      if (updateError) {
        logger.error('일정 완료 처리 오류:', updateError);
        return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 });
      }

      // 캐시 무효화
      const editEmail = await getUserEmailFromRequest(request);
      if (editEmail) invalidateUserContext(editEmail);

      // 연결된 목표 progress 업데이트 (customGoals에서 linkedGoalId 조회)
      findLinkedGoalId(userId, id).then(linkedGoalId => {
        if (linkedGoalId) {
          updateLinkedGoalProgress(userId, linkedGoalId).catch(e =>
            logger.error('[Complete] 목표 progress 업데이트 실패:', e)
          );
        }
      }).catch(() => {});

      return NextResponse.json({ success: true, completed: newCompleted });
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
      logger.error('customGoals 완료 처리 오류:', updateError);
      return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 });
    }

    // 캐시 무효화 + Dual-write to schedules table
    if (user.email) {
      invalidateUserContext(user.email);
      await dualWriteUpdate(user.email, id, { completed: newCompleted });
    }

    // 연결된 목표 progress 업데이트
    const linkedGoalId = customGoals[goalIndex].linkedGoalId;
    if (linkedGoalId) {
      updateLinkedGoalProgress(userId, linkedGoalId).catch(e =>
        logger.error('[Complete] 목표 progress 업데이트 실패:', e)
      );
    }

    return NextResponse.json({ success: true, completed: newCompleted });
  } catch (error) {
    logger.error('일정 완료 처리 오류:', error);
    return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 });
  }
}

// customGoals에서 일정의 linkedGoalId 조회
async function findLinkedGoalId(userId: string, scheduleId: string): Promise<string | null> {
  const user = await getUserById(userId);
  if (!user?.profile?.customGoals) return null;
  const schedule = user.profile.customGoals.find((s: any) => s.id === scheduleId);
  return schedule?.linkedGoalId || null;
}

// 연결된 목표의 progress를 연관 일정 완료율로 업데이트
async function updateLinkedGoalProgress(userId: string, goalId: string) {
  const user = await getUserById(userId);
  if (!user?.profile) return;

  const customGoals: any[] = user.profile.customGoals || [];
  const linkedSchedules = customGoals.filter((s: any) => s.linkedGoalId === goalId);
  if (linkedSchedules.length === 0) return;

  // schedules 테이블에서 완료 상태 확인 (customGoals보다 최신)
  const linkedIds = linkedSchedules.map((s: any) => s.id);
  const { data: dbSchedules } = await supabaseAdmin
    .from('schedules')
    .select('id, completed')
    .eq('user_id', userId)
    .in('id', linkedIds);

  // DB 일정 완료 상태를 우선 사용, 없으면 customGoals 값 사용
  const dbMap = new Map((dbSchedules || []).map(s => [s.id, s.completed]));
  const completedCount = linkedSchedules.filter((s: any) => {
    return dbMap.has(s.id) ? dbMap.get(s.id) : s.completed;
  }).length;

  const progress = Math.round((completedCount / linkedSchedules.length) * 100);

  const longTermGoals = user.profile.longTermGoals || { weekly: [], monthly: [], yearly: [] };
  let updated = false;

  for (const type of ['weekly', 'monthly', 'yearly'] as const) {
    const goals: any[] = longTermGoals[type] || [];
    const idx = goals.findIndex((g: any) => g.id === goalId);
    if (idx !== -1) {
      goals[idx].progress = progress;
      goals[idx].completed = progress >= 100;
      goals[idx].updatedAt = new Date().toISOString();
      updated = true;
      break;
    }
  }

  if (updated) {
    await updateUserProfileById(userId, { longTermGoals });
  }
}
