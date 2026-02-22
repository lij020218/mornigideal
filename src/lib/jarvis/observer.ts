/**
 * Jarvis Observer
 * 사용자 활동을 감지하고 EventLog에 기록
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { EventType } from '@/types/jarvis';
import { canUseFeature } from '@/lib/user-plan';
import { logger } from '@/lib/logger';

export class JarvisObserver {
    private userEmail: string;

    constructor(userEmail: string) {
        this.userEmail = userEmail;
    }

    /**
     * 이벤트 기록 (Max만 event_logs에 저장)
     */
    async logEvent(
        eventType: EventType,
        payload: Record<string, any> = {},
        source: string = 'manual'
    ): Promise<void> {
        try {
            // 장기 기억이 있는 플랜만 DB에 저장
            const hasMemory = await canUseFeature(this.userEmail, 'jarvis_memory');
            if (!hasMemory) {
                return;
            }

            const { error } = await supabaseAdmin
                .from('event_logs')
                .insert({
                    user_email: this.userEmail,
                    event_type: eventType,
                    payload,
                    source,
                    occurred_at: new Date().toISOString()
                });

            if (error) {
                logger.error('[JarvisObserver] Failed to log event:', error);
            } else {
            }
        } catch (error) {
            logger.error('[JarvisObserver] Exception:', error);
        }
    }

    /**
     * 최근 이벤트 조회
     */
    async getRecentEvents(
        hours: number = 24,
        eventTypes?: EventType[]
    ): Promise<any[]> {
        try {
            const since = new Date();
            since.setHours(since.getHours() - hours);

            let query = supabaseAdmin
                .from('event_logs')
                .select('*')
                .eq('user_email', this.userEmail)
                .gte('occurred_at', since.toISOString())
                .order('occurred_at', { ascending: false });

            if (eventTypes && eventTypes.length > 0) {
                query = query.in('event_type', eventTypes);
            }

            const { data, error } = await query;

            if (error) {
                logger.error('[JarvisObserver] Failed to fetch events:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            logger.error('[JarvisObserver] Exception:', error);
            return [];
        }
    }

    /**
     * 패턴 감지: 연속 스킵
     */
    async detectConsecutiveSkips(scheduleType: string, threshold: number = 3): Promise<boolean> {
        const events = await this.getRecentEvents(168, [ // 7일
            EventType.SCHEDULE_MISSED,
            EventType.SCHEDULE_SNOOZED
        ]);

        const skips = events.filter((e: any) =>
            e.payload?.scheduleType === scheduleType
        );

        return skips.length >= threshold;
    }

    /**
     * 패턴 감지: 일정 과밀
     */
    async detectOverbooking(customGoals: any[], targetDate: string): Promise<boolean> {
        const schedulesOnDay = customGoals.filter((g: any) => {
            if (g.specificDate === targetDate) return true;
            const dayOfWeek = new Date(targetDate).getDay();
            return g.daysOfWeek?.includes(dayOfWeek);
        });

        // 8시간 이상 일정이 잡혀있으면 과밀
        const totalHours = schedulesOnDay.reduce((sum: number, s: any) => {
            if (!s.startTime || !s.endTime) return sum;
            const start = parseInt(s.startTime.split(':')[0]);
            const end = parseInt(s.endTime.split(':')[0]);
            return sum + (end - start);
        }, 0);

        return totalHours > 8;
    }
}
