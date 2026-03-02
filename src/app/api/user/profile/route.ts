import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/users";
import { withAuth } from "@/lib/api-handler";
import { profileReplaceSchema, validateBody } from '@/lib/schemas';
import { logger } from '@/lib/logger';

const MAX_PROFILE_SIZE = 50_000; // 50KB
const ALLOWED_TOP_KEYS = new Set([
    'profile', 'settings', 'job', 'goal', 'level', 'interests', 'name',
    'notifications', 'userSettings', 'appearance', 'aiSettings',
    'wakeUpTime', 'sleepTime', 'exerciseEnabled', 'location',
]);

function validateProfilePayload(body: unknown): string | null {
    if (body === null || body === undefined) return 'Body is required';
    if (typeof body !== 'object' || Array.isArray(body)) return 'Body must be an object';
    const json = JSON.stringify(body);
    if (json.length > MAX_PROFILE_SIZE) return `Payload too large (max ${MAX_PROFILE_SIZE} bytes)`;
    return null;
}

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const user = await getUserByEmail(email);

    if (!user) {
        return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
        );
    }

    const p = (user.profile || {}) as Record<string, any>;

    // 클라이언트가 data.profile.settings.{profile,userSettings,...} 경로로 읽으므로
    // DB의 flat 구조를 settings 래퍼로 감싸서 반환
    return NextResponse.json({
        profile: {
            ...p,
            settings: {
                profile: {
                    name: p.name || user.name || '',
                    job: p.job || '',
                    goal: p.goal || '',
                    level: p.level || '',
                    interests: p.interests || [],
                },
                userSettings: {
                    wakeUpTime: p.wakeUpTime || '07:00',
                    sleepTime: p.sleepTime || '23:00',
                    exerciseEnabled: p.exerciseEnabled ?? false,
                    location: p.location || 'Seoul,KR',
                },
                notifications: p.notifications || null,
                appearance: p.appearance || null,
                aiSettings: p.aiSettings || null,
            },
        }
    });
});

// POST: 전체 프로필 교체 (customGoals 등 스케줄 데이터는 보존)
export const POST = withAuth(async (request: NextRequest, email: string) => {
    const body = await request.json();
    const v = validateBody(profileReplaceSchema, body);
    if (!v.success) return v.response;
    const validationError = validateProfilePayload(body);
    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const { profile } = v.data;

    const { supabaseAdmin } = await import("@/lib/supabase-admin");

    // 기존 프로필에서 스케줄 데이터 보존 (full replace 시 유실 방지)
    const PRESERVED_KEYS = ['customGoals', 'learnings', 'reminders'] as const;
    const { data: existing } = await supabaseAdmin
        .from("users")
        .select("profile")
        .eq("email", email)
        .maybeSingle();

    const existingProfile = existing?.profile || {};
    const mergedProfile = { ...profile };
    for (const key of PRESERVED_KEYS) {
        if (!(key in mergedProfile) && existingProfile[key]) {
            mergedProfile[key] = existingProfile[key];
        }
    }

    const { data, error } = await supabaseAdmin
        .from("users")
        .update({ profile: mergedProfile })
        .eq("email", email)
        .select()
        .single();

    if (error) {
        logger.error("[Profile API] Update error:", error);
        return NextResponse.json(
            { error: "Failed to update profile" },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        profile: data.profile
    });
});

// PUT: 부분 프로필 업데이트 (병합)
export const PUT = withAuth(async (request: NextRequest, email: string) => {
    const updates = await request.json();
    const validationError = validateProfilePayload(updates);
    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // 기존 프로필 가져오기
    const user = await getUserByEmail(email);
    if (!user) {
        return NextResponse.json(
            { error: "User not found" },
            { status: 404 }
        );
    }

    const existing = (user.profile || {}) as Record<string, any>;

    // 클라이언트가 { settings: { profile, userSettings, notifications, ... } } 로 보냄
    // → DB에는 평탄하게 저장 (name, job, goal, ... wakeUpTime, sleepTime 등)
    let flat: Record<string, any> = {};
    if (updates.settings) {
        const s = updates.settings;
        // profile 필드 → top-level
        if (s.profile) {
            const { name, job, goal, level, interests } = s.profile;
            if (name !== undefined) flat.name = name;
            if (job !== undefined) flat.job = job;
            if (goal !== undefined) flat.goal = goal;
            if (level !== undefined) flat.level = level;
            if (interests !== undefined) flat.interests = interests;
        }
        // userSettings 필드 → top-level
        if (s.userSettings) {
            const { wakeUpTime, sleepTime, exerciseEnabled, location } = s.userSettings;
            if (wakeUpTime !== undefined) flat.wakeUpTime = wakeUpTime;
            if (sleepTime !== undefined) flat.sleepTime = sleepTime;
            if (exerciseEnabled !== undefined) flat.exerciseEnabled = exerciseEnabled;
            if (location !== undefined) flat.location = location;
        }
        // 나머지는 그대로 저장
        if (s.notifications) flat.notifications = s.notifications;
        if (s.appearance) flat.appearance = s.appearance;
        if (s.aiSettings) flat.aiSettings = s.aiSettings;
    } else {
        // settings 래퍼 없이 온 경우 (다른 API에서 직접 호출)
        flat = updates;
    }

    const updatedProfile = { ...existing, ...flat };

    // Update user profile in database
    const { supabaseAdmin } = await import("@/lib/supabase-admin");

    // 이름이 변경되면 users.name 컬럼도 동기화 (앱 전체에서 참조)
    const updatePayload: Record<string, any> = { profile: updatedProfile };
    if (flat.name) {
        updatePayload.name = flat.name;
    }

    const { data, error } = await supabaseAdmin
        .from("users")
        .update(updatePayload)
        .eq("email", email)
        .select()
        .single();

    if (error) {
        logger.error("[Profile API] Update error:", error);
        return NextResponse.json(
            { error: "Failed to update profile" },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        profile: data.profile
    });
});
