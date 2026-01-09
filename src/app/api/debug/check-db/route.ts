import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import db from "@/lib/db";

/**
 * 데이터베이스 상태 확인 API
 * 테이블 존재 여부 및 데이터 확인
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userEmail = session.user.email;
        const results: any = {
            userEmail,
            timestamp: new Date().toISOString(),
            tables: {},
        };

        // 1. user_constraints 테이블 확인
        try {
            const { data: constraints } = await db.client
                .from('user_constraints')
                .select('*')
                .eq('user_email', userEmail)
                .maybeSingle();
            results.tables.user_constraints = {
                exists: true,
                hasData: !!constraints,
                data: constraints || null,
            };
        } catch (error: any) {
            results.tables.user_constraints = {
                exists: false,
                error: error.message,
            };
        }

        // 2. user_preferences 테이블 확인
        try {
            const { data: preferences } = await db.client
                .from('user_preferences')
                .select('*')
                .eq('user_email', userEmail)
                .maybeSingle();
            results.tables.user_preferences = {
                exists: true,
                hasData: !!preferences,
                data: preferences || null,
            };
        } catch (error: any) {
            results.tables.user_preferences = {
                exists: false,
                error: error.message,
            };
        }

        // 3. user_events 테이블 확인 (최근 10개)
        try {
            const { data: events, count } = await db.client
                .from('user_events')
                .select('*', { count: 'exact' })
                .eq('user_email', userEmail)
                .order('created_at', { ascending: false })
                .limit(10);
            results.tables.user_events = {
                exists: true,
                totalCount: count || 0,
                recentEvents: events || [],
            };
        } catch (error: any) {
            results.tables.user_events = {
                exists: false,
                error: error.message,
            };
        }

        // 4. timeblock_success_rate 테이블 확인
        try {
            const { data: successRates, count } = await db.client
                .from('timeblock_success_rate')
                .select('*', { count: 'exact' })
                .eq('user_email', userEmail)
                .limit(10);
            results.tables.timeblock_success_rate = {
                exists: true,
                totalCount: count || 0,
                sampleData: successRates || [],
            };
        } catch (error: any) {
            results.tables.timeblock_success_rate = {
                exists: false,
                error: error.message,
            };
        }

        // 5. user_context_cache 테이블 확인
        try {
            const { data: cache } = await db.client
                .from('user_context_cache')
                .select('*')
                .eq('user_email', userEmail)
                .maybeSingle();
            results.tables.user_context_cache = {
                exists: true,
                hasCache: !!cache,
                cacheAge: cache?.generated_at ?
                    Math.round((Date.now() - new Date(cache.generated_at).getTime()) / 1000 / 60) + ' minutes'
                    : null,
            };
        } catch (error: any) {
            results.tables.user_context_cache = {
                exists: false,
                error: error.message,
            };
        }

        // 6. users 테이블에서 프로필 확인
        try {
            const { data: user } = await db.client
                .from('users')
                .select('profile')
                .eq('email', userEmail)
                .maybeSingle();
            results.tables.users = {
                exists: true,
                profile: user?.profile || null,
                customGoalsCount: user?.profile?.customGoals?.length || 0,
            };
        } catch (error: any) {
            results.tables.users = {
                exists: false,
                error: error.message,
            };
        }

        // 7. 오늘 일정 확인
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: user } = await db.client
                .from('users')
                .select('profile')
                .eq('email', userEmail)
                .maybeSingle();

            const todaySchedules = user?.profile?.customGoals?.filter((goal: any) =>
                goal.specificDate === today
            ) || [];

            results.todaySchedules = {
                date: today,
                count: todaySchedules.length,
                schedules: todaySchedules.map((s: any) => ({
                    text: s.text,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    color: s.color,
                })),
            };
        } catch (error: any) {
            results.todaySchedules = {
                error: error.message,
            };
        }

        return NextResponse.json(results, { status: 200 });
    } catch (error: any) {
        console.error("[Debug Check DB] Error:", error);
        return NextResponse.json(
            { error: "Failed to check database", details: error.message },
            { status: 500 }
        );
    }
}
