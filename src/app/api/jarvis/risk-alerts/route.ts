/**
 * 자비스 리스크 알림 API
 * - GET: 읽지 않은 알림 조회
 * - POST: 일정 분석 및 리스크 체크
 * - PATCH: 알림 상태 업데이트 (읽음/무시)
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-handler";
import {
    analyzeScheduleRisk,
    getUnreadAlerts,
    markAlertAsRead,
    dismissAlert,
} from "@/lib/jarvis-risk-alerts";
import { canUseFeature } from "@/lib/user-plan";

export const GET = withAuth(async (request: NextRequest, email: string) => {
    // 프로/맥스 플랜 체크
    const hasAccess = await canUseFeature(email, "risk_alerts");
    if (!hasAccess) {
        return NextResponse.json(
            { error: "이 기능은 프로 이상 플랜에서만 사용 가능합니다.", alerts: [] },
            { status: 200 }  // 403 대신 200으로 빈 배열 반환 (UX)
        );
    }

    const alerts = await getUnreadAlerts(email);
    return NextResponse.json({ alerts });
});

export const POST = withAuth(async (request: NextRequest, email: string) => {
    // 프로/맥스 플랜 체크
    const hasAccess = await canUseFeature(email, "risk_alerts");
    if (!hasAccess) {
        return NextResponse.json({ alerts: [] });  // 무료 플랜은 빈 배열
    }

    const { newSchedule, existingSchedules } = await request.json();

    if (!newSchedule) {
        return NextResponse.json(
            { error: "newSchedule이 필요합니다." },
            { status: 400 }
        );
    }

    const alerts = await analyzeScheduleRisk(
        email,
        newSchedule,
        existingSchedules || []
    );

    return NextResponse.json({ alerts });
});

export const PATCH = withAuth(async (request: NextRequest, email: string) => {
    const { alertId, action } = await request.json();

    if (!alertId || !action) {
        return NextResponse.json(
            { error: "alertId와 action이 필요합니다." },
            { status: 400 }
        );
    }

    let success = false;

    if (action === "read") {
        success = await markAlertAsRead(email, alertId);
    } else if (action === "dismiss") {
        success = await dismissAlert(email, alertId);
    } else {
        return NextResponse.json(
            { error: "action은 'read' 또는 'dismiss'여야 합니다." },
            { status: 400 }
        );
    }

    return NextResponse.json({ success });
});
