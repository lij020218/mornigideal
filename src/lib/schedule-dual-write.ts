/**
 * Schedule Dual-Write Helper
 *
 * customGoals (JSONB) -> schedules 테이블 마이그레이션을 위한 듀얼라이트 모듈.
 * 모든 일정 변경을 customGoals와 schedules 테이블에 동시 기록.
 * 마이그레이션 완료 후 customGoals 의존을 제거하고 schedules만 사용.
 *
 * Phase 1 (현재): 듀얼라이트 - 양쪽에 기록, customGoals가 primary
 * Phase 2: 읽기 리드를 schedules 테이블로 전환
 * Phase 3: customGoals 제거
 */

import { supabaseAdmin } from "@/lib/supabase-admin";

interface ScheduleRow {
    id: string;
    user_id: string;
    title: string;
    date: string;         // ISO date string
    start_time: string;   // HH:MM
    end_time?: string;    // HH:MM
    completed: boolean;
    skipped: boolean;
    color?: string;
    location?: string;
    is_recurring: boolean;
    days_of_week?: number[];
    memo?: string;
}

/**
 * email로 user_id 조회
 */
async function getUserId(email: string): Promise<string | null> {
    const { data } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
    return data?.id || null;
}

/**
 * customGoals 아이템에서 해당 날짜의 schedules 테이블 row 데이터 생성
 */
function goalToScheduleRow(
    goal: any,
    userId: string,
    date: string
): ScheduleRow {
    return {
        id: `${goal.id}_${date}`,
        user_id: userId,
        title: goal.text || "",
        date: `${date}T00:00:00+09:00`,
        start_time: goal.startTime || "00:00",
        end_time: goal.endTime || undefined,
        completed: goal.completed || false,
        skipped: goal.skipped || false,
        color: goal.color || undefined,
        location: goal.location || undefined,
        is_recurring: !!(goal.daysOfWeek && goal.daysOfWeek.length > 0),
        days_of_week: goal.daysOfWeek || undefined,
        memo: goal.memo || undefined,
    };
}

/**
 * 일정 추가 후 schedules 테이블에도 기록
 * - specificDate 일정: 해당 날짜로 1개 row
 * - 반복 일정: 오늘 날짜로 1개 row (이후 cron에서 확장)
 */
export async function dualWriteAdd(
    email: string,
    goal: any,
    specificDate?: string
): Promise<void> {
    try {
        const userId = await getUserId(email);
        if (!userId) return;

        const date = specificDate || goal.specificDate || new Date().toISOString().split("T")[0];
        const row = goalToScheduleRow(goal, userId, date);

        // undefined 값 제거 (Supabase는 undefined를 처리 못함)
        const cleanRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
            if (value !== undefined) {
                cleanRow[key] = value;
            }
        }

        await supabaseAdmin
            .from("schedules")
            .upsert(cleanRow, { onConflict: "id" });
    } catch (error) {
        // 듀얼라이트 실패는 로그만 남기고 무시 (customGoals가 primary)
        console.error("[DualWrite] Add failed:", error);
    }
}

/**
 * 일정 완료/스킵 상태 변경을 schedules 테이블에도 반영
 */
export async function dualWriteUpdate(
    email: string,
    scheduleId: string,
    updates: { completed?: boolean; skipped?: boolean },
    date?: string
): Promise<void> {
    try {
        const userId = await getUserId(email);
        if (!userId) return;

        const targetDate = date || new Date().toISOString().split("T")[0];
        const compositeId = `${scheduleId}_${targetDate}`;

        // 먼저 해당 row가 있는지 확인
        const { data: existing } = await supabaseAdmin
            .from("schedules")
            .select("id")
            .eq("id", compositeId)
            .maybeSingle();

        if (existing) {
            // 있으면 업데이트
            await supabaseAdmin
                .from("schedules")
                .update(updates)
                .eq("id", compositeId)
                .eq("user_id", userId);
        } else {
            // 없으면 원본 ID로도 시도
            const { data: existingOriginal } = await supabaseAdmin
                .from("schedules")
                .select("id")
                .eq("id", scheduleId)
                .eq("user_id", userId)
                .maybeSingle();

            if (existingOriginal) {
                await supabaseAdmin
                    .from("schedules")
                    .update(updates)
                    .eq("id", scheduleId)
                    .eq("user_id", userId);
            }
        }
    } catch (error) {
        console.error("[DualWrite] Update failed:", error);
    }
}

/**
 * 일정 수정 후 schedules 테이블에도 반영
 */
export async function dualWriteModify(
    email: string,
    scheduleId: string,
    updates: {
        text?: string;
        startTime?: string;
        endTime?: string;
        location?: string;
        memo?: string;
    }
): Promise<void> {
    try {
        const userId = await getUserId(email);
        if (!userId) return;

        const dbUpdates: Record<string, any> = {};
        if (updates.text) dbUpdates.title = updates.text;
        if (updates.startTime) dbUpdates.start_time = updates.startTime;
        if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
        if (updates.location !== undefined) dbUpdates.location = updates.location;
        if (updates.memo !== undefined) dbUpdates.memo = updates.memo;

        if (Object.keys(dbUpdates).length === 0) return;

        // scheduleId로 시작하는 모든 row 업데이트 (여러 날짜에 걸칠 수 있음)
        await supabaseAdmin
            .from("schedules")
            .update(dbUpdates)
            .eq("user_id", userId)
            .like("id", `${scheduleId}%`);
    } catch (error) {
        console.error("[DualWrite] Modify failed:", error);
    }
}

/**
 * 일정 삭제 후 schedules 테이블에서도 삭제
 */
export async function dualWriteDelete(
    email: string,
    scheduleId: string
): Promise<void> {
    try {
        const userId = await getUserId(email);
        if (!userId) return;

        // scheduleId로 시작하는 모든 row 삭제
        await supabaseAdmin
            .from("schedules")
            .delete()
            .eq("user_id", userId)
            .like("id", `${scheduleId}%`);
    } catch (error) {
        console.error("[DualWrite] Delete failed:", error);
    }
}

/**
 * customGoals에서 오늘 일정을 schedules 테이블로 동기화 (배치)
 * cron 또는 로그인 시 호출
 */
export async function syncTodaySchedules(email: string): Promise<number> {
    try {
        const userId = await getUserId(email);
        if (!userId) return 0;

        const { data: user } = await supabaseAdmin
            .from("users")
            .select("profile")
            .eq("email", email)
            .maybeSingle();

        if (!user?.profile?.customGoals) return 0;

        const customGoals = user.profile.customGoals;
        const now = new Date();
        const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, "0")}-${String(kst.getDate()).padStart(2, "0")}`;
        const dayOfWeek = kst.getDay();

        // 오늘 해당되는 일정 필터
        const todayGoals = customGoals.filter((g: any) => {
            if (g.specificDate === todayStr) return true;
            if (g.daysOfWeek && g.daysOfWeek.includes(dayOfWeek)) {
                if (g.startDate && todayStr < g.startDate) return false;
                if (g.endDate && todayStr > g.endDate) return false;
                return true;
            }
            return false;
        });

        if (todayGoals.length === 0) return 0;

        const rows = todayGoals.map((g: any) => {
            const row = goalToScheduleRow(g, userId, todayStr);
            const cleanRow: Record<string, any> = {};
            for (const [key, value] of Object.entries(row)) {
                if (value !== undefined) {
                    cleanRow[key] = value;
                }
            }
            return cleanRow;
        });

        const { error } = await supabaseAdmin
            .from("schedules")
            .upsert(rows, { onConflict: "id" });

        if (error) {
            console.error("[DualWrite] Sync failed:", error);
            return 0;
        }

        return rows.length;
    } catch (error) {
        console.error("[DualWrite] Sync error:", error);
        return 0;
    }
}
