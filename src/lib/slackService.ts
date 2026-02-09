/**
 * Slack 서비스
 *
 * - 미확인 메시지 요약 가져오기
 * - 슬랙으로 메시지 보내기
 * - 연결 상태 확인
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SlackChannel {
  name: string;
  unread: number;
  latestMessage?: string;
}

interface SlackDM {
  from: string;
  unread: number;
  latestMessage?: string;
}

export interface SlackUnreadSummary {
  totalUnread: number;
  channels: SlackChannel[];
  dms: SlackDM[];
}

// 토큰 가져오기
async function getSlackToken(userEmail: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("slack_tokens")
    .select("access_token")
    .eq("user_email", userEmail)
    .single();

  if (error || !data) return null;
  return data.access_token;
}

// Slack API 호출 헬퍼
async function slackAPI(token: string, method: string, params: Record<string, string> = {}): Promise<any> {
  const url = `https://slack.com/api/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });

  return response.json();
}

// 연결 상태 확인
export async function isSlackConnected(userEmail: string): Promise<boolean> {
  const token = await getSlackToken(userEmail);
  return !!token;
}

// 미확인 메시지 요약 가져오기
export async function getUnreadSummary(userEmail: string): Promise<SlackUnreadSummary> {
  const token = await getSlackToken(userEmail);
  if (!token) {
    return { totalUnread: 0, channels: [], dms: [] };
  }

  try {
    // 채널 목록 조회 (공개/비공개 채널 + DM)
    const conversationsResult = await slackAPI(token, "conversations.list", {
      types: "public_channel,private_channel,im,mpim",
      exclude_archived: "true",
      limit: "200",
    });

    if (!conversationsResult.ok) {
      console.error("[SlackService] conversations.list failed:", conversationsResult.error);
      return { totalUnread: 0, channels: [], dms: [] };
    }

    const conversations = conversationsResult.channels || [];

    // 사용자 ID → 이름 캐시
    const userNameCache: Record<string, string> = {};

    const channels: SlackChannel[] = [];
    const dms: SlackDM[] = [];
    let totalUnread = 0;

    // 멤버인 채널만 필터링
    const memberConversations = conversations.filter((c: any) => c.is_member || c.is_im || c.is_mpim);

    for (const conv of memberConversations) {
      let unreadCount = 0;

      // DM의 경우 unread_count_display 사용
      if (conv.is_im || conv.is_mpim) {
        // DM 마크 정보 조회
        const markResult = await slackAPI(token, "conversations.info", {
          channel: conv.id,
        });

        if (markResult.ok && markResult.channel) {
          unreadCount = markResult.channel.unread_count_display || 0;
        }

        if (unreadCount > 0) {
          // DM 상대방 이름 조회
          let fromName = "Unknown";
          if (conv.user) {
            if (!userNameCache[conv.user]) {
              const userResult = await slackAPI(token, "users.info", { user: conv.user });
              if (userResult.ok) {
                userNameCache[conv.user] = userResult.user?.real_name || userResult.user?.name || "Unknown";
              }
            }
            fromName = userNameCache[conv.user] || "Unknown";
          }

          // 최신 메시지 조회
          let latestMessage: string | undefined;
          const historyResult = await slackAPI(token, "conversations.history", {
            channel: conv.id,
            limit: "1",
          });
          if (historyResult.ok && historyResult.messages?.length > 0) {
            latestMessage = historyResult.messages[0].text?.substring(0, 100);
          }

          dms.push({ from: fromName, unread: unreadCount, latestMessage });
          totalUnread += unreadCount;
        }
      } else {
        // 채널 - unread_count 확인
        const markResult = await slackAPI(token, "conversations.info", {
          channel: conv.id,
        });

        if (markResult.ok && markResult.channel) {
          unreadCount = markResult.channel.unread_count_display || 0;
        }

        if (unreadCount > 0) {
          channels.push({
            name: conv.name || conv.id,
            unread: unreadCount,
          });
          totalUnread += unreadCount;
        }
      }

      // rate limit 방지: 상위 채널만 확인
      if (channels.length + dms.length >= 10) break;
    }

    // 미확인 수 기준 정렬
    channels.sort((a, b) => b.unread - a.unread);
    dms.sort((a, b) => b.unread - a.unread);

    return {
      totalUnread,
      channels: channels.slice(0, 5),
      dms: dms.slice(0, 5),
    };
  } catch (error) {
    console.error("[SlackService] getUnreadSummary error:", error);
    return { totalUnread: 0, channels: [], dms: [] };
  }
}

// 슬랙으로 메시지 보내기
export async function sendSlackMessage(
  userEmail: string,
  text: string,
  channelId?: string
): Promise<boolean> {
  const token = await getSlackToken(userEmail);
  if (!token) return false;

  try {
    // 채널ID가 없으면 default_channel 사용
    let targetChannel = channelId;
    if (!targetChannel) {
      const { data } = await supabase
        .from("slack_tokens")
        .select("default_channel_id, slack_user_id")
        .eq("user_email", userEmail)
        .single();

      // 기본 채널 없으면 자기 자신에게 DM
      targetChannel = data?.default_channel_id || data?.slack_user_id;
    }

    if (!targetChannel) return false;

    const result = await slackAPI(token, "chat.postMessage", {
      channel: targetChannel,
      text,
    });

    if (!result.ok) {
      console.error("[SlackService] sendMessage failed:", result.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[SlackService] sendMessage error:", error);
    return false;
  }
}
