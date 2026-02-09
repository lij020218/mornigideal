/**
 * 일정 완료 처리 API
 *
 * POST: 일정 완료 토글
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/auth-utils';

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
      .single();

    if (fetchError || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // 완료 상태 토글
    const { error: updateError } = await supabaseAdmin
      .from('schedules')
      .update({ completed: !schedule.completed })
      .eq('id', id);

    if (updateError) {
      console.error('일정 완료 처리 오류:', updateError);
      return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 });
    }

    return NextResponse.json({ success: true, completed: !schedule.completed });
  } catch (error) {
    console.error('일정 완료 처리 오류:', error);
    return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 });
  }
}
