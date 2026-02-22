import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/users";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { profileReplaceSchema, validateBody } from '@/lib/schemas';

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

export async function GET(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);

        if (!email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const user = await getUserByEmail(email);

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            profile: user.profile || {}
        });
    } catch (error: any) {
        console.error("[Profile API] Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch profile" },
            { status: 500 }
        );
    }
}

// POST: 전체 프로필 교체 (customGoals 등 스케줄 데이터는 보존)
export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);

        if (!email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

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
            console.error("[Profile API] Update error:", error);
            return NextResponse.json(
                { error: "Failed to update profile" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            profile: data.profile
        });
    } catch (error: any) {
        console.error("[Profile API] Error:", error);
        return NextResponse.json(
            { error: "Failed to update profile" },
            { status: 500 }
        );
    }
}

// PUT: 부분 프로필 업데이트 (병합)
export async function PUT(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);

        if (!email) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

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

        // 기존 프로필과 새로운 업데이트 병합
        const updatedProfile = {
            ...(user.profile || {}),
            ...updates
        };

        // Update user profile in database
        const { supabaseAdmin } = await import("@/lib/supabase-admin");

        const { data, error } = await supabaseAdmin
            .from("users")
            .update({ profile: updatedProfile })
            .eq("email", email)
            .select()
            .single();

        if (error) {
            console.error("[Profile API] Update error:", error);
            return NextResponse.json(
                { error: "Failed to update profile" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            profile: data.profile
        });
    } catch (error: any) {
        console.error("[Profile API] Error:", error);
        return NextResponse.json(
            { error: "Failed to update profile" },
            { status: 500 }
        );
    }
}
