/**
 * 자비스 리스크 알림 API
 * - GET: 읽지 않은 알림 조회
 * - POST: 일정 분석 및 리스크 체크
 * - PATCH: 알림 상태 업데이트 (읽음/무시)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
    analyzeScheduleRisk,
    getUnreadAlerts,
    markAlertAsRead,
    dismissAlert,
} from "@/lib/jarvis-risk-alerts";
import { canUseFeature } from "@/lib/user-plan";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 프로/맥스 플랜 체크
        const hasAccess = await canUseFeature(session.user.email, "risk_alerts");
        if (!hasAccess) {
            return NextResponse.json(
                { error: "이 기능은 프로 이상 플랜에서만 사용 가능합니다.", alerts: [] },
                { status: 200 }  // 403 대신 200으로 빈 배열 반환 (UX)
            );
        }

        const alerts = await getUnreadAlerts(session.user.email);
        return NextResponse.json({ alerts });
    } catch (error: any) {
        console.error("[Risk Alerts API] GET Error:", error);
        return NextResponse.json(
            { error: "알림 조회 중 오류가 발생했습니다.", alerts: [] },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 프로/맥스 플랜 체크
        const hasAccess = await canUseFeature(session.user.email, "risk_alerts");
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
            session.user.email,
            newSchedule,
            existingSchedules || []
        );

        return NextResponse.json({ alerts });
    } catch (error: any) {
        console.error("[Risk Alerts API] POST Error:", error);
        return NextResponse.json(
            { error: "리스크 분석 중 오류가 발생했습니다.", alerts: [] },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { alertId, action } = await request.json();

        if (!alertId || !action) {
            return NextResponse.json(
                { error: "alertId와 action이 필요합니다." },
                { status: 400 }
            );
        }

        let success = false;

        if (action === "read") {
            success = await markAlertAsRead(session.user.email, alertId);
        } else if (action === "dismiss") {
            success = await dismissAlert(session.user.email, alertId);
        } else {
            return NextResponse.json(
                { error: "action은 'read' 또는 'dismiss'여야 합니다." },
                { status: 400 }
            );
        }

        return NextResponse.json({ success });
    } catch (error: any) {
        console.error("[Risk Alerts API] PATCH Error:", error);
        return NextResponse.json(
            { error: "알림 업데이트 중 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
