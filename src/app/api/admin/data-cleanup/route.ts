import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { executeDataCleanup, getUserDataStats } from "@/lib/data-cleanup-service";

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
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { targetUser, dryRun = false } = await request.json();

        // 관리자 권한 확인 (프로덕션에서는 실제 관리자 체크 필요)
        const isAdmin = session.user.email.includes('admin') ||
                       process.env.ADMIN_EMAILS?.includes(session.user.email);

        // 일반 사용자는 자기 자신의 데이터만 정리 가능
        const cleanupTarget = isAdmin && targetUser ? targetUser : session.user.email;

        console.log(`[Data Cleanup API] Starting cleanup for: ${cleanupTarget}${dryRun ? ' (DRY RUN)' : ''}`);

        if (dryRun) {
            // Dry run: 실제 삭제 없이 통계만 조회
            const stats = await getUserDataStats(cleanupTarget);
            return NextResponse.json({
                dryRun: true,
                stats,
                message: 'Dry run completed - no data was deleted',
            });
        }

        // 실제 정리 실행
        const report = await executeDataCleanup(cleanupTarget);

        return NextResponse.json({
            success: true,
            report,
        });
    } catch (error: any) {
        console.error("[Data Cleanup API] Error:", error);
        return NextResponse.json(
            { error: "Failed to cleanup data", details: error.message },
            { status: 500 }
        );
    }
}

/**
 * GET: 데이터 통계 조회
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const targetUser = searchParams.get('user');

        // 관리자 권한 확인
        const isAdmin = session.user.email.includes('admin') ||
                       process.env.ADMIN_EMAILS?.includes(session.user.email);

        const statsTarget = isAdmin && targetUser ? targetUser : session.user.email;

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
            { error: "Failed to get data stats", details: error.message },
            { status: 500 }
        );
    }
}
