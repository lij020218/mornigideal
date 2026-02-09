/**
 * Expo Push Notification Sending Service
 *
 * 서버에서 Expo Push API를 통해 모바일 기기에 푸시 알림 전송
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
    to: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    sound?: 'default' | null;
    badge?: number;
    channelId?: string;
    priority?: 'default' | 'normal' | 'high';
    categoryId?: string;
}

interface ExpoPushTicket {
    id?: string;
    status: 'ok' | 'error';
    message?: string;
    details?: { error: string };
}

/**
 * 사용자의 활성 푸시 토큰 조회
 */
export async function getUserPushTokens(userEmail: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_email', userEmail)
        .eq('active', true);

    if (error || !data) return [];
    return data.map(row => row.token);
}

/**
 * 단일 사용자에게 푸시 알림 전송
 */
export async function sendPushNotification(
    userEmail: string,
    notification: {
        title: string;
        body: string;
        data?: Record<string, any>;
        channelId?: string;
        priority?: 'default' | 'normal' | 'high';
    }
): Promise<boolean> {
    const tokens = await getUserPushTokens(userEmail);
    if (tokens.length === 0) return false;

    const messages: ExpoPushMessage[] = tokens.map(token => ({
        to: token,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: 'default',
        channelId: notification.channelId || 'default',
        priority: notification.priority || 'high',
    }));

    try {
        const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });

        if (!response.ok) {
            console.error('[PushService] Expo API error:', response.status);
            return false;
        }

        const result = await response.json();
        const tickets: ExpoPushTicket[] = result.data || [];

        // 실패한 토큰 비활성화 (DeviceNotRegistered 등)
        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                await supabase
                    .from('push_tokens')
                    .update({ active: false, updated_at: new Date().toISOString() })
                    .eq('token', tokens[i]);
                console.log(`[PushService] Deactivated stale token`);
            }
        }

        const successCount = tickets.filter(t => t.status === 'ok').length;
        console.log(`[PushService] Sent: ${successCount}/${tokens.length} success`);
        return successCount > 0;
    } catch (error) {
        console.error('[PushService] Send error:', error);
        return false;
    }
}

/**
 * 여러 사용자에게 푸시 알림 일괄 전송
 */
export async function sendBulkPushNotifications(
    notifications: Array<{
        userEmail: string;
        title: string;
        body: string;
        data?: Record<string, any>;
        channelId?: string;
    }>
): Promise<{ sent: number; failed: number }> {
    // 모든 사용자의 토큰 한 번에 조회
    const emails = [...new Set(notifications.map(n => n.userEmail))];
    const { data: allTokens } = await supabase
        .from('push_tokens')
        .select('user_email, token')
        .in('user_email', emails)
        .eq('active', true);

    if (!allTokens || allTokens.length === 0) {
        return { sent: 0, failed: notifications.length };
    }

    // 이메일별 토큰 맵
    const tokenMap = new Map<string, string[]>();
    for (const row of allTokens) {
        const existing = tokenMap.get(row.user_email) || [];
        existing.push(row.token);
        tokenMap.set(row.user_email, existing);
    }

    // Expo API는 한 번에 최대 100개 메시지
    const messages: ExpoPushMessage[] = [];
    for (const n of notifications) {
        const tokens = tokenMap.get(n.userEmail) || [];
        for (const token of tokens) {
            messages.push({
                to: token,
                title: n.title,
                body: n.body,
                data: n.data,
                sound: 'default',
                channelId: n.channelId || 'default',
                priority: 'high',
            });
        }
    }

    if (messages.length === 0) {
        return { sent: 0, failed: notifications.length };
    }

    let sent = 0;
    let failed = 0;

    // 100개씩 배치 전송
    for (let i = 0; i < messages.length; i += 100) {
        const batch = messages.slice(i, i + 100);
        try {
            const response = await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(batch),
            });

            if (response.ok) {
                const result = await response.json();
                const tickets: ExpoPushTicket[] = result.data || [];
                sent += tickets.filter(t => t.status === 'ok').length;
                failed += tickets.filter(t => t.status === 'error').length;
            } else {
                failed += batch.length;
            }
        } catch {
            failed += batch.length;
        }
    }

    console.log(`[PushService] Bulk send: ${sent} sent, ${failed} failed`);
    return { sent, failed };
}
