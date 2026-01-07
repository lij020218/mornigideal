import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import db from "@/lib/db";

/**
 * 사용자 선호 설정 조회/저장 API
 */

// GET: 현재 설정 조회
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const preferences = await db.query(
            `SELECT * FROM user_preferences WHERE user_email = $1`,
            [session.user.email]
        );

        const constraints = await db.query(
            `SELECT * FROM user_constraints WHERE user_email = $1`,
            [session.user.email]
        );

        return NextResponse.json({
            preferences: preferences.rows[0] || null,
            constraints: constraints.rows[0] || null,
        });
    } catch (error: any) {
        console.error("[User Preferences GET] Error:", error);
        return NextResponse.json(
            { error: "Failed to get preferences", details: error.message },
            { status: 500 }
        );
    }
}

// POST: 설정 저장/업데이트
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { preferences, constraints } = await request.json();

        let savedPreferences = null;
        let savedConstraints = null;

        // Preferences 저장
        if (preferences) {
            const result = await db.query(
                `INSERT INTO user_preferences (
                    id, user_email,
                    preferred_workout_types, workout_frequency_goal, preferred_workout_duration,
                    chronotype, preferred_time_slots,
                    preferred_learning_format, focus_duration,
                    work_life_balance_mode
                ) VALUES (
                    gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9
                )
                ON CONFLICT (user_email)
                DO UPDATE SET
                    preferred_workout_types = EXCLUDED.preferred_workout_types,
                    workout_frequency_goal = EXCLUDED.workout_frequency_goal,
                    preferred_workout_duration = EXCLUDED.preferred_workout_duration,
                    chronotype = EXCLUDED.chronotype,
                    preferred_time_slots = EXCLUDED.preferred_time_slots,
                    preferred_learning_format = EXCLUDED.preferred_learning_format,
                    focus_duration = EXCLUDED.focus_duration,
                    work_life_balance_mode = EXCLUDED.work_life_balance_mode,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *`,
                [
                    session.user.email,
                    JSON.stringify(preferences.preferredWorkoutTypes || []),
                    preferences.workoutFrequencyGoal || 3,
                    preferences.preferredWorkoutDuration || 30,
                    preferences.chronotype || 'neutral',
                    JSON.stringify(preferences.preferredTimeSlots || []),
                    preferences.preferredLearningFormat || [],
                    preferences.focusDuration || 25,
                    preferences.workLifeBalanceMode || 'balanced',
                ]
            );
            savedPreferences = result.rows[0];
        }

        // Constraints 저장
        if (constraints) {
            const result = await db.query(
                `INSERT INTO user_constraints (
                    id, user_email,
                    blocked_time_ranges, workout_restrictions, travel_times, notification_limits
                ) VALUES (
                    gen_random_uuid()::text, $1, $2, $3, $4, $5
                )
                ON CONFLICT (user_email)
                DO UPDATE SET
                    blocked_time_ranges = EXCLUDED.blocked_time_ranges,
                    workout_restrictions = EXCLUDED.workout_restrictions,
                    travel_times = EXCLUDED.travel_times,
                    notification_limits = EXCLUDED.notification_limits,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *`,
                [
                    session.user.email,
                    JSON.stringify(constraints.blockedTimeRanges || []),
                    JSON.stringify(constraints.workoutRestrictions || {}),
                    JSON.stringify(constraints.travelTimes || {}),
                    JSON.stringify(constraints.notificationLimits || {}),
                ]
            );
            savedConstraints = result.rows[0];
        }

        console.log(`[User Preferences] Updated for ${session.user.email}`);

        // 컨텍스트 캐시 무효화
        await db.query(
            `DELETE FROM user_context_cache WHERE user_email = $1`,
            [session.user.email]
        );

        return NextResponse.json({
            success: true,
            preferences: savedPreferences,
            constraints: savedConstraints,
        });
    } catch (error: any) {
        console.error("[User Preferences POST] Error:", error);
        return NextResponse.json(
            { error: "Failed to save preferences", details: error.message },
            { status: 500 }
        );
    }
}
