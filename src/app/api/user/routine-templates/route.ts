/**
 * 루틴 템플릿 API
 * GET: 템플릿 목록 조회
 * POST: 템플릿 적용 (일정에 추가)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getTemplatesByCategory, getTemplateById } from '@/lib/routineTemplates';
import { templateApplySchema, validateBody } from '@/lib/schemas';
import { isProOrAbove } from '@/lib/user-plan';

export async function GET(request: NextRequest) {
    const email = await getUserEmailWithAuth(request);
    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const category = request.nextUrl.searchParams.get('category') || undefined;
    const templates = getTemplatesByCategory(category);

    return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
    const email = await getUserEmailWithAuth(request);
    if (!email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const v = validateBody(templateApplySchema, body);
    if (!v.success) return v.response;
    const { templateId, targetDate, daysOfWeek } = v.data;

    const template = getTemplateById(templateId);
    if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Get existing schedules
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('profile')
        .eq('email', email)
        .maybeSingle();

    if (!userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const profile = userData.profile || {};
    const customGoals = profile.customGoals || [];

    // Check template limit for free users
    const isPro = await isProOrAbove(email);
    if (!isPro) {
        // Free users: check if they already applied a template today
        const today = new Date().toISOString().split('T')[0];
        const templateGoalsToday = customGoals.filter(
            (g: any) => g.fromTemplate && g.specificDate === today
        );
        if (templateGoalsToday.length > 0) {
            return NextResponse.json(
                { error: 'Free 플랜은 하루 1개 템플릿만 적용 가능합니다. Pro로 업그레이드하세요.' },
                { status: 403 },
            );
        }
    }

    // Convert template schedules to customGoals format
    const now = new Date();
    const defaultDate = targetDate || now.toISOString().split('T')[0];

    const newGoals = template.schedules.map(s => ({
        id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text: s.text,
        startTime: s.startTime,
        endTime: s.endTime,
        color: s.color,
        specificDate: daysOfWeek ? null : defaultDate,
        daysOfWeek: daysOfWeek || null,
        completed: false,
        fromTemplate: template.id,
        createdAt: now.toISOString(),
    }));

    // Check for time conflicts
    const existingForDate = customGoals.filter((g: any) => {
        if (daysOfWeek) {
            return g.daysOfWeek?.some((d: number) => daysOfWeek.includes(d));
        }
        return g.specificDate === defaultDate;
    });

    const conflicts = newGoals.filter(ng =>
        existingForDate.some((eg: any) => {
            if (!eg.startTime || !ng.startTime) return false;
            const eStart = eg.startTime;
            const eEnd = eg.endTime || eg.startTime;
            const nStart = ng.startTime;
            const nEnd = ng.endTime || ng.startTime;
            return nStart < eEnd && nEnd > eStart;
        })
    );

    // Add non-conflicting schedules
    const nonConflicting = newGoals.filter(ng => !conflicts.includes(ng));
    const merged = [...customGoals, ...nonConflicting];

    const { error } = await supabaseAdmin
        .from('users')
        .update({ profile: { ...profile, customGoals: merged } })
        .eq('email', email);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        added: nonConflicting.length,
        skipped: conflicts.length,
        conflicts: conflicts.map(c => c.text),
        templateName: template.nameKo,
    });
}
