/**
 * 자비스 리스크 알림 시스템
 * - 일정 충돌 감지
 * - 준비 시간 부족 경고
 * - 과로/건강 우려 알림
 * - 프로/맥스 플랜 기능
 */

import { supabaseAdmin } from "./supabase-admin";
import { canUseFeature } from "./user-plan";

// 리스크 알림 타입
export type RiskAlertType =
    | "schedule_conflict"      // 일정 충돌
    | "preparation_shortage"   // 준비 시간 부족
    | "overwork_warning"       // 과로 경고
    | "deadline_risk"          // 마감일 위험
    | "health_concern";        // 건강 우려

// 리스크 알림
export interface RiskAlert {
    id: string;
    alertType: RiskAlertType;
    title: string;
    message: string;
    severity: number;  // 1-5
    relatedScheduleIds: string[];
    suggestedAction: string | null;
    isRead: boolean;
    isDismissed: boolean;
    alertDate: string;
    createdAt: string;
}

// 일정 타입 (간단화)
interface Schedule {
    id: string;
    text: string;
    startTime: string;  // "HH:mm"
    endTime?: string;
    specificDate?: string;
    preparationTime?: number;  // 분
}

/**
 * 이메일로 사용자 ID 조회
 */
async function getUserIdByEmail(email: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    return data.id;
}

/**
 * 리스크 분석 - 일정 추가/수정 시 호출
 * @param email 사용자 이메일
 * @param newSchedule 새로 추가/수정하는 일정
 * @param existingSchedules 기존 일정들
 */
export async function analyzeScheduleRisk(
    email: string,
    newSchedule: Schedule,
    existingSchedules: Schedule[]
): Promise<RiskAlert[]> {
    const alerts: RiskAlert[] = [];

    // 프로/맥스 플랜 체크
    const hasAccess = await canUseFeature(email, "risk_alerts");
    if (!hasAccess) {
        return alerts;
    }

    const userId = await getUserIdByEmail(email);
    if (!userId) return alerts;

    // 1. 일정 충돌 체크
    const conflictAlert = checkScheduleConflict(newSchedule, existingSchedules);
    if (conflictAlert) {
        alerts.push(conflictAlert);
    }

    // 2. 준비 시간 부족 체크
    const prepAlert = checkPreparationTime(newSchedule, existingSchedules);
    if (prepAlert) {
        alerts.push(prepAlert);
    }

    // 3. 과로 체크 (하루 일정 시간)
    const overworkAlert = checkOverwork([...existingSchedules, newSchedule]);
    if (overworkAlert) {
        alerts.push(overworkAlert);
    }

    // DB에 알림 저장
    for (const alert of alerts) {
        await saveAlert(userId, alert);
    }

    return alerts;
}

/**
 * 일정 충돌 체크
 */
function checkScheduleConflict(
    newSchedule: Schedule,
    existingSchedules: Schedule[]
): RiskAlert | null {
    const newStart = timeToMinutes(newSchedule.startTime);
    const newEnd = newSchedule.endTime
        ? timeToMinutes(newSchedule.endTime)
        : newStart + 60;  // 기본 1시간

    for (const existing of existingSchedules) {
        if (existing.id === newSchedule.id) continue;  // 같은 일정은 스킵

        const existStart = timeToMinutes(existing.startTime);
        const existEnd = existing.endTime
            ? timeToMinutes(existing.endTime)
            : existStart + 60;

        // 시간 겹침 체크
        if (newStart < existEnd && newEnd > existStart) {
            return {
                id: "",  // DB에서 생성
                alertType: "schedule_conflict",
                title: "일정 충돌 감지",
                message: `"${newSchedule.text}"가 "${existing.text}"와 시간이 겹칩니다. (${existing.startTime}~${existing.endTime || "?"})`,
                severity: 4,
                relatedScheduleIds: [newSchedule.id, existing.id],
                suggestedAction: `"${newSchedule.text}"를 ${existing.endTime || formatTime(existEnd)} 이후로 옮기는 건 어떨까요?`,
                isRead: false,
                isDismissed: false,
                alertDate: new Date().toISOString().split("T")[0],
                createdAt: new Date().toISOString(),
            };
        }
    }

    return null;
}

/**
 * 준비 시간 부족 체크
 */
function checkPreparationTime(
    newSchedule: Schedule,
    existingSchedules: Schedule[]
): RiskAlert | null {
    // 중요 일정 키워드 (준비 시간이 필요한)
    const importantKeywords = ["발표", "미팅", "면접", "회의", "프레젠테이션", "시험", "발표회"];
    const isImportant = importantKeywords.some(k =>
        newSchedule.text.toLowerCase().includes(k)
    );

    if (!isImportant) return null;

    // 최소 준비 시간 (분)
    const minPrepTime = newSchedule.preparationTime || 60;  // 기본 1시간
    const newStart = timeToMinutes(newSchedule.startTime);

    // 바로 전 일정 찾기
    let previousEndTime = 0;
    let previousSchedule: Schedule | null = null;

    for (const existing of existingSchedules) {
        if (existing.id === newSchedule.id) continue;

        const existEnd = existing.endTime
            ? timeToMinutes(existing.endTime)
            : timeToMinutes(existing.startTime) + 60;

        if (existEnd <= newStart && existEnd > previousEndTime) {
            previousEndTime = existEnd;
            previousSchedule = existing;
        }
    }

    if (previousSchedule && (newStart - previousEndTime) < minPrepTime) {
        const availableTime = newStart - previousEndTime;

        return {
            id: "",
            alertType: "preparation_shortage",
            title: "준비 시간 부족 경고",
            message: `"${newSchedule.text}" 전에 준비 시간이 ${availableTime}분밖에 없습니다. "${previousSchedule.text}" 직후입니다.`,
            severity: 3,
            relatedScheduleIds: [newSchedule.id, previousSchedule.id],
            suggestedAction: `"${previousSchedule.text}"를 ${minPrepTime - availableTime}분 앞당기거나, "${newSchedule.text}"를 ${minPrepTime - availableTime}분 뒤로 미루는 건 어떨까요?`,
            isRead: false,
            isDismissed: false,
            alertDate: new Date().toISOString().split("T")[0],
            createdAt: new Date().toISOString(),
        };
    }

    return null;
}

/**
 * 과로 체크
 */
function checkOverwork(schedules: Schedule[]): RiskAlert | null {
    let totalMinutes = 0;

    for (const schedule of schedules) {
        const start = timeToMinutes(schedule.startTime);
        const end = schedule.endTime
            ? timeToMinutes(schedule.endTime)
            : start + 60;
        totalMinutes += (end - start);
    }

    // 12시간 이상이면 과로 경고
    if (totalMinutes >= 720) {
        const hours = Math.floor(totalMinutes / 60);

        return {
            id: "",
            alertType: "overwork_warning",
            title: "과로 주의",
            message: `오늘 총 ${hours}시간의 일정이 잡혀있습니다. 충분한 휴식을 취하세요.`,
            severity: 3,
            relatedScheduleIds: schedules.map(s => s.id),
            suggestedAction: "일부 일정을 다른 날로 옮기거나, 중간에 휴식 시간을 추가하는 건 어떨까요?",
            isRead: false,
            isDismissed: false,
            alertDate: new Date().toISOString().split("T")[0],
            createdAt: new Date().toISOString(),
        };
    }

    return null;
}

/**
 * DB에 알림 저장
 */
async function saveAlert(userId: string, alert: RiskAlert): Promise<void> {
    try {
        await supabaseAdmin.from("risk_alerts").insert({
            user_id: userId,
            alert_type: alert.alertType,
            title: alert.title,
            message: alert.message,
            severity: alert.severity,
            related_schedule_ids: alert.relatedScheduleIds,
            suggested_action: alert.suggestedAction,
            alert_date: alert.alertDate,
        });
    } catch (error) {
        console.error("[RiskAlerts] Error saving alert:", error);
    }
}

/**
 * 읽지 않은 알림 조회
 */
export async function getUnreadAlerts(email: string): Promise<RiskAlert[]> {
    try {
        const userId = await getUserIdByEmail(email);
        if (!userId) return [];

        const { data, error } = await supabaseAdmin
            .from("risk_alerts")
            .select("*")
            .eq("user_id", userId)
            .eq("is_read", false)
            .eq("is_dismissed", false)
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) {
            console.error("[RiskAlerts] Error fetching alerts:", error);
            return [];
        }

        return (data || []).map(mapDbToAlert);
    } catch (error) {
        console.error("[RiskAlerts] Error:", error);
        return [];
    }
}

/**
 * 알림 읽음 처리
 */
export async function markAlertAsRead(
    email: string,
    alertId: string
): Promise<boolean> {
    try {
        const userId = await getUserIdByEmail(email);
        if (!userId) return false;

        const { error } = await supabaseAdmin
            .from("risk_alerts")
            .update({ is_read: true })
            .eq("id", alertId)
            .eq("user_id", userId);

        return !error;
    } catch (error) {
        console.error("[RiskAlerts] Error marking as read:", error);
        return false;
    }
}

/**
 * 알림 무시 처리
 */
export async function dismissAlert(
    email: string,
    alertId: string
): Promise<boolean> {
    try {
        const userId = await getUserIdByEmail(email);
        if (!userId) return false;

        const { error } = await supabaseAdmin
            .from("risk_alerts")
            .update({ is_dismissed: true })
            .eq("id", alertId)
            .eq("user_id", userId);

        return !error;
    } catch (error) {
        console.error("[RiskAlerts] Error dismissing alert:", error);
        return false;
    }
}

// 유틸리티 함수
function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + (minutes || 0);
}

function formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function mapDbToAlert(db: any): RiskAlert {
    return {
        id: db.id,
        alertType: db.alert_type,
        title: db.title,
        message: db.message,
        severity: db.severity,
        relatedScheduleIds: db.related_schedule_ids || [],
        suggestedAction: db.suggested_action,
        isRead: db.is_read,
        isDismissed: db.is_dismissed,
        alertDate: db.alert_date,
        createdAt: db.created_at,
    };
}
