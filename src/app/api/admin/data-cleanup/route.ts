import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { executeDataCleanup, getUserDataStats } from "@/lib/data-cleanup-service";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

function isAdmin(email: string): boolean {
    return ADMIN_EMAILS.includes(email);
}

/**
 * 데이터 정리 API
 *
 * POST /api/admin/data-cleanup - 데이터 정리 실행
 * GET /api/admin/data-cleanup - 데이터 통계 조회
 */

/**
 * POST: 데이터 정리 실행
 */
export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { targetUser, dryRun = false } = await request.json();

        // 일반 사용자는 자기 자신의 데이터만 정리 가능
        const cleanupTarget = isAdmin(email) && targetUser ? targetUser : email;


        if (dryRun) {
            const stats = await getUserDataStats(cleanupTarget);
            return NextResponse.json({
                dryRun: true,
                stats,
                message: 'Dry run completed - no data was deleted',
            });
        }

        const report = await executeDataCleanup(cleanupTarget);

        return NextResponse.json({
            success: true,
            report,
        });
    } catch (error: any) {
        console.error("[Data Cleanup API] Error:", error);
        return NextResponse.json(
            { error: "Failed to cleanup data" },
            { status: 500 }
        );
    }
}

/**
 * GET: 데이터 통계 조회
 */
export async function GET(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const targetUser = searchParams.get('user');

        const statsTarget = isAdmin(email) && targetUser ? targetUser : email;

        const stats = await getUserDataStats(statsTarget);

        return NextResponse.json({
            userEmail: statsTarget,
            stats,
            limits: {
                maxEvents: 10000,
                maxDailyFeatures: 365,
                maxWeeklyFeatures: 104,
            },
        });
    } catch (error: any) {
        console.error("[Data Cleanup API] Error:", error);
        return NextResponse.json(
            { error: "Failed to get data stats" },
            { status: 500 }
        );
    }
}
