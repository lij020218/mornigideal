/**
 * Google Calendar Bidirectional Sync Service
 *
 * - Pull: GCal → local customGoals
 * - Push: local customGoals → GCal
 * - 토큰 자동 refresh
 * - Conflict resolution: GCal 우선
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// ============================================
// Types
// ============================================

export interface SyncResult {
    pulled: { added: number; updated: number; deleted: number };
    pushed: { added: number; updated: number };
    errors: string[];
}

interface GCalEvent {
    id: string;
    summary: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    status: string;
    etag: string;
    updated: string;
    description?: string;
    location?: string;
}

// ============================================
// Main Service
// ============================================

export class GoogleCalendarService {
    private userEmail: string;

    constructor(userEmail: string) {
        this.userEmail = userEmail;
    }

    /**
     * 유효한 access token 반환 (만료 시 자동 refresh)
     */
    private async getAccessToken(): Promise<string | null> {
        const { data: tokenData } = await supabase
            .from('google_calendar_tokens')
            .select('*')
            .eq('user_email', this.userEmail)
            .single();

        if (!tokenData) return null;

        // 토큰 만료 체크 (5분 여유)
        if (tokenData.expires_at && Date.now() > tokenData.expires_at - 300000) {
            if (!tokenData.refresh_token) return null;

            // Refresh token으로 갱신
            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID!,
                    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                    refresh_token: tokenData.refresh_token,
                    grant_type: 'refresh_token',
                }),
            });

            if (!refreshResponse.ok) {
                console.error('[GCalService] Token refresh failed');
                return null;
            }

            const newTokens = await refreshResponse.json();
            const newExpiresAt = Date.now() + (newTokens.expires_in * 1000);

            await supabase
                .from('google_calendar_tokens')
                .update({
                    access_token: newTokens.access_token,
                    expires_at: newExpiresAt,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_email', this.userEmail);

            return newTokens.access_token;
        }

        return tokenData.access_token;
    }

    /**
     * GCal API 호출 헬퍼
     */
    private async gcalFetch(path: string, options: RequestInit = {}): Promise<Response> {
        const accessToken = await this.getAccessToken();
        if (!accessToken) throw new Error('No valid access token');

        return fetch(`${GOOGLE_CALENDAR_API}${path}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
    }

    /**
     * 양방향 동기화 (heartbeat에서 호출)
     */
    async sync(): Promise<SyncResult> {
        const result: SyncResult = {
            pulled: { added: 0, updated: 0, deleted: 0 },
            pushed: { added: 0, updated: 0 },
            errors: [],
        };

        try {
            // Pull: GCal → local
            const pullResult = await this.pullEvents();
            result.pulled = pullResult;
        } catch (error) {
            result.errors.push(`Pull failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Push는 도구 실행 시에만 수행 (pushEvent 개별 호출)
        // sync()에서는 pull만 수행

        if (result.errors.length > 0) {
            console.error('[GCalService] Sync errors:', result.errors);
        } else {
            console.log('[GCalService] Sync completed:', result.pulled);
        }

        return result;
    }

    /**
     * Pull: GCal → local customGoals
     */
    async pullEvents(): Promise<{ added: number; updated: number; deleted: number }> {
        const stats = { added: 0, updated: 0, deleted: 0 };

        // 마지막 동기화 시각 조회
        const { data: lastSync } = await supabase
            .from('google_calendar_tokens')
            .select('updated_at')
            .eq('user_email', this.userEmail)
            .single();

        // 오늘부터 30일 이후까지 이벤트 조회
        const now = new Date();
        const timeMin = now.toISOString();
        const timeMax = new Date(now.getTime() + 30 * 86400000).toISOString();

        const params = new URLSearchParams({
            timeMin,
            timeMax,
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '100',
        });

        // updatedMin으로 변경분만 가져오기
        if (lastSync?.updated_at) {
            params.set('updatedMin', lastSync.updated_at);
        }

        const response = await this.gcalFetch(`/calendars/primary/events?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`GCal events list failed: ${response.status}`);
        }

        const data = await response.json();
        const events: GCalEvent[] = data.items || [];

        if (events.length === 0) return stats;

        // 사용자 프로필 로드
        const { data: userData } = await supabase
            .from('users')
            .select('profile')
            .eq('email', this.userEmail)
            .single();

        if (!userData) return stats;

        const profile = userData.profile || {};
        const customGoals: any[] = [...(profile.customGoals || [])];

        // 기존 매핑 조회
        const { data: mappings } = await supabase
            .from('calendar_sync_mapping')
            .select('*')
            .eq('user_email', this.userEmail);

        const mappingByGcalId = new Map((mappings || []).map(m => [m.gcal_event_id, m]));

        for (const event of events) {
            const existing = mappingByGcalId.get(event.id);

            if (event.status === 'cancelled') {
                // 삭제된 이벤트 → 로컬에서도 삭제
                if (existing) {
                    const idx = customGoals.findIndex(g => g.id === existing.local_goal_id);
                    if (idx !== -1) {
                        customGoals.splice(idx, 1);
                        stats.deleted++;
                    }
                    await supabase
                        .from('calendar_sync_mapping')
                        .delete()
                        .eq('id', existing.id);
                }
                continue;
            }

            const localGoal = this.gcalEventToGoal(event);

            if (existing) {
                // 업데이트: etag가 다르면 GCal 우선으로 덮어쓰기
                if (existing.etag !== event.etag) {
                    const idx = customGoals.findIndex(g => g.id === existing.local_goal_id);
                    if (idx !== -1) {
                        customGoals[idx] = { ...customGoals[idx], ...localGoal };
                        stats.updated++;
                    }
                    await supabase
                        .from('calendar_sync_mapping')
                        .update({ etag: event.etag, last_synced_at: new Date().toISOString() })
                        .eq('id', existing.id);
                }
            } else {
                // 새 이벤트 → 로컬에 추가
                const newGoalId = `gcal_${event.id}_${Date.now()}`;
                customGoals.push({ ...localGoal, id: newGoalId });
                stats.added++;

                await supabase
                    .from('calendar_sync_mapping')
                    .insert({
                        user_email: this.userEmail,
                        local_goal_id: newGoalId,
                        gcal_event_id: event.id,
                        sync_direction: 'gcal_to_local',
                        etag: event.etag,
                        last_synced_at: new Date().toISOString(),
                    });
            }
        }

        // 프로필 업데이트
        if (stats.added > 0 || stats.updated > 0 || stats.deleted > 0) {
            await supabase
                .from('users')
                .update({ profile: { ...profile, customGoals } })
                .eq('email', this.userEmail);

            // 동기화 시각 업데이트
            await supabase
                .from('google_calendar_tokens')
                .update({ updated_at: new Date().toISOString() })
                .eq('user_email', this.userEmail);
        }

        return stats;
    }

    /**
     * Push: local customGoal → GCal
     */
    async pushEvent(goal: any): Promise<string | null> {
        try {
            const event = this.goalToGcalEvent(goal);

            const response = await this.gcalFetch('/calendars/primary/events', {
                method: 'POST',
                body: JSON.stringify(event),
            });

            if (!response.ok) {
                console.error('[GCalService] Push event failed:', response.status);
                return null;
            }

            const created: GCalEvent = await response.json();

            // 매핑 저장
            await supabase
                .from('calendar_sync_mapping')
                .upsert({
                    user_email: this.userEmail,
                    local_goal_id: goal.id,
                    gcal_event_id: created.id,
                    sync_direction: 'local_to_gcal',
                    etag: created.etag,
                    last_synced_at: new Date().toISOString(),
                }, { onConflict: 'user_email,local_goal_id' });

            console.log('[GCalService] Pushed event:', goal.text, '→', created.id);
            return created.id;
        } catch (error) {
            console.error('[GCalService] Push error:', error);
            return null;
        }
    }

    /**
     * GCal 이벤트 삭제
     */
    async deleteEvent(gcalEventId: string): Promise<void> {
        try {
            await this.gcalFetch(`/calendars/primary/events/${gcalEventId}`, {
                method: 'DELETE',
            });

            await supabase
                .from('calendar_sync_mapping')
                .delete()
                .eq('user_email', this.userEmail)
                .eq('gcal_event_id', gcalEventId);
        } catch (error) {
            console.error('[GCalService] Delete error:', error);
        }
    }

    // ============================================
    // Conversion Helpers
    // ============================================

    private gcalEventToGoal(event: GCalEvent): Partial<any> {
        const startDt = event.start.dateTime
            ? new Date(event.start.dateTime)
            : null;
        const endDt = event.end.dateTime
            ? new Date(event.end.dateTime)
            : null;

        let specificDate: string | null = null;
        let startTime: string | null = null;
        let endTime: string | null = null;

        if (startDt) {
            specificDate = `${startDt.getFullYear()}-${String(startDt.getMonth() + 1).padStart(2, '0')}-${String(startDt.getDate()).padStart(2, '0')}`;
            startTime = `${String(startDt.getHours()).padStart(2, '0')}:${String(startDt.getMinutes()).padStart(2, '0')}`;
        } else if (event.start.date) {
            specificDate = event.start.date;
            startTime = '00:00';
        }

        if (endDt) {
            endTime = `${String(endDt.getHours()).padStart(2, '0')}:${String(endDt.getMinutes()).padStart(2, '0')}`;
        }

        return {
            text: event.summary || '(제목 없음)',
            specificDate,
            startTime,
            endTime,
            location: event.location || '',
            memo: event.description || '',
            completed: false,
            source: 'gcal',
        };
    }

    private goalToGcalEvent(goal: any): Record<string, any> {
        const date = goal.specificDate || new Date().toISOString().split('T')[0];

        const event: Record<string, any> = {
            summary: goal.text,
        };

        if (goal.startTime && goal.startTime !== '00:00') {
            event.start = {
                dateTime: `${date}T${goal.startTime}:00`,
                timeZone: 'Asia/Seoul',
            };
            event.end = {
                dateTime: goal.endTime
                    ? `${date}T${goal.endTime}:00`
                    : `${date}T${this.addOneHour(goal.startTime)}:00`,
                timeZone: 'Asia/Seoul',
            };
        } else {
            // 종일 이벤트: GCal API는 end.date가 exclusive이므로 다음날로 설정
            const nextDay = new Date(date + 'T00:00:00');
            nextDay.setDate(nextDay.getDate() + 1);
            const endDate = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
            event.start = { date };
            event.end = { date: endDate };
        }

        if (goal.location) event.location = goal.location;
        if (goal.memo) event.description = goal.memo;

        return event;
    }

    private addOneHour(time: string): string {
        const [h, m] = time.split(':').map(Number);
        // 23시인 경우 23:59로 설정 (0시 넘김 방지, 0분 이벤트 방지)
        if (h >= 23) {
            return '23:59';
        }
        return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
}

/**
 * 사용자가 GCal을 연동했는지 확인
 */
export async function hasGCalLinked(userEmail: string): Promise<boolean> {
    const { data } = await supabase
        .from('google_calendar_tokens')
        .select('user_email')
        .eq('user_email', userEmail)
        .single();

    return !!data;
}
