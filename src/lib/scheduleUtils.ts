/**
 * 일정 관련 순수 유틸리티 함수
 * page.tsx에서 추출 — 상태 의존 없음
 */

import type { Schedule } from "@/types/dashboard";

/** "HH:MM" → 분(number) 변환 */
export function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

/** KST 기준 오늘 날짜 "YYYY-MM-DD" */
export function getChatDate(): string {
    const now = new Date();
    const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return `${kstDate.getFullYear()}-${String(kstDate.getMonth() + 1).padStart(2, '0')}-${String(kstDate.getDate()).padStart(2, '0')}`;
}

/** 주어진 timestamp를 KST 기준 "YYYY-MM-DD"로 변환 */
export function getDateFromTimestamp(timestamp: Date): string {
    const kstDate = new Date(timestamp.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return `${kstDate.getFullYear()}-${String(kstDate.getMonth() + 1).padStart(2, '0')}-${String(kstDate.getDate()).padStart(2, '0')}`;
}

/** 현재 진행 중이거나 다음 예정된 일정 찾기 */
export function getCurrentScheduleInfo(
    schedules: Schedule[]
): { schedule: Schedule; status: 'in-progress' | 'upcoming' } | null {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 진행 중인 일정
    const currentSchedule = schedules.find((s) => {
        const startMinutes = timeToMinutes(s.startTime);
        const endMinutes = s.endTime ? timeToMinutes(s.endTime) : startMinutes + 60;
        return startMinutes <= currentMinutes && currentMinutes < endMinutes;
    });

    if (currentSchedule) {
        return { schedule: currentSchedule, status: 'in-progress' };
    }

    // 다음 예정 일정 (완료/놓친 제외)
    const nextSchedule = schedules
        .filter(s => !s.completed && !s.skipped)
        .find((s) => {
            const startMinutes = timeToMinutes(s.startTime);
            return startMinutes > currentMinutes;
        });

    if (nextSchedule) {
        return { schedule: nextSchedule, status: 'upcoming' };
    }

    return null;
}

/** 하루 일정 밀도 판단 */
export function calculateDayDensity(schedules: Schedule[]): 'light' | 'normal' | 'busy' {
    if (schedules.length <= 2) return 'light';
    if (schedules.length <= 5) return 'normal';
    return 'busy';
}

/** 완료율 계산 (지나간 일정 기준, -1 = 계산 불가) */
export function calculateCompletionRate(schedules: Schedule[], currentMinutes: number): number {
    const completedCount = schedules.filter(s => s.completed).length;
    const totalPast = schedules.filter(s => {
        const end = s.endTime ? timeToMinutes(s.endTime) : timeToMinutes(s.startTime) + 60;
        return currentMinutes > end;
    }).length;
    return totalPast > 0 ? Math.round((completedCount / totalPast) * 100) : -1;
}

/** 연속 완료 streak 계산 */
export function calculateCompletionStreak(schedules: Schedule[], currentMinutes: number): number {
    let streak = 0;
    const sorted = [...schedules]
        .filter(s => s.endTime && currentMinutes > timeToMinutes(s.endTime))
        .sort((a, b) => timeToMinutes(b.endTime!) - timeToMinutes(a.endTime!));
    for (const s of sorted) {
        if (s.completed) streak++;
        else break;
    }
    return streak;
}
