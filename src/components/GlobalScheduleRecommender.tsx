"use client";

import { useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

// 전역적으로 일정 추천 및 알림을 관리하는 컴포넌트
export function GlobalScheduleRecommender() {
    const { data: session } = useSession();
    const pathname = usePathname();
    const router = useRouter();

    // KST 기준 오늘 날짜
    const getTodayKST = useCallback(() => {
        const now = new Date();
        const kstDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        return `${kstDate.getFullYear()}-${String(kstDate.getMonth() + 1).padStart(2, '0')}-${String(kstDate.getDate()).padStart(2, '0')}`;
    }, []);

    // 브라우저 알림 권한 요청 및 발송
    const sendBrowserNotification = useCallback((title: string, body: string, onClick?: () => void) => {
        if (!("Notification" in window)) return;

        if (Notification.permission === "granted") {
            const notification = new Notification(title, {
                body,
                icon: "/icon.svg",
                tag: "schedule-recommendation",
                requireInteraction: true,
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
                onClick?.();
            };
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    sendBrowserNotification(title, body, onClick);
                }
            });
        }
    }, []);

    // 채팅 페이지에 메시지 추가
    const addChatMessage = useCallback((content: string) => {
        const today = getTodayKST();
        const messagesKey = `chat_messages_${today}`;

        try {
            const existingMessages = JSON.parse(localStorage.getItem(messagesKey) || '[]');
            const newMessage = {
                id: `auto-schedule-recommend-${Date.now()}`,
                role: 'assistant',
                content,
                timestamp: new Date().toISOString(),
            };

            existingMessages.push(newMessage);
            localStorage.setItem(messagesKey, JSON.stringify(existingMessages));

            // 현재 채팅 페이지에 있으면 새로고침 이벤트 발생
            window.dispatchEvent(new CustomEvent('new-chat-message', { detail: newMessage }));
        } catch (error) {
            console.error('[GlobalScheduleRecommender] Failed to add chat message:', error);
        }
    }, [getTodayKST]);

    // 일정 체크 및 추천
    useEffect(() => {
        if (!session?.user) return;

        const checkScheduleAndRecommend = async () => {
            const today = getTodayKST();
            const now = new Date();
            const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const currentHour = kstNow.getHours();
            const currentMinutes = kstNow.getHours() * 60 + kstNow.getMinutes();

            // 오전 6시 ~ 오후 10시 사이에만 추천
            if (currentHour < 6 || currentHour > 22) return;

            // 매 2시간마다 체크 (6, 8, 10, 12, 14, 16, 18, 20, 22시)
            const recommendHours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
            if (!recommendHours.includes(currentHour)) return;

            // 해당 시간에 이미 추천했는지 확인 (첫 15분 동안만)
            const currentMinuteOfHour = kstNow.getMinutes();
            if (currentMinuteOfHour > 15) return;

            const recommendKey = `schedule_recommend_${today}_${currentHour}`;
            if (localStorage.getItem(recommendKey)) return;

            // 오늘 일정 가져오기
            try {
                const profileStr = localStorage.getItem('user_profile');
                if (!profileStr) return;

                const profile = JSON.parse(profileStr);
                const customGoals = profile.customGoals || [];
                const dayOfWeek = kstNow.getDay();

                // 오늘 해당하는 일정 필터링
                const todaySchedules = customGoals.filter((goal: any) => {
                    // specificDate가 있으면 해당 날짜만
                    if (goal.specificDate) {
                        return goal.specificDate === today;
                    }
                    // daysOfWeek가 있으면 해당 요일만
                    if (goal.daysOfWeek && goal.daysOfWeek.length > 0) {
                        // startDate가 있으면 해당 날짜 이후에만 표시
                        if (goal.startDate && today < goal.startDate) return false;
                        // endDate가 있으면 해당 날짜까지만 표시
                        if (goal.endDate && today > goal.endDate) return false;
                        return goal.daysOfWeek.includes(dayOfWeek);
                    }
                    return true; // 매일 반복
                });

                // 완료되지 않은 남은 일정 확인
                const completionsStr = localStorage.getItem(`schedule_completions_${today}`);
                const completions = completionsStr ? JSON.parse(completionsStr) : {};

                const pendingSchedules = todaySchedules.filter((s: any) => {
                    const startMinutes = parseInt(s.startTime?.split(':')[0] || '0') * 60 +
                        parseInt(s.startTime?.split(':')[1] || '0');
                    const isCompleted = completions[s.id]?.completed;
                    return startMinutes > currentMinutes && !isCompleted;
                });

                // 일정이 없거나 남은 일정이 없을 때 추천
                if (todaySchedules.length === 0 || pendingSchedules.length === 0) {
                    console.log('[GlobalScheduleRecommender] No schedules found, sending recommendation');

                    // AI 일정 추천 요청
                    const res = await fetch('/api/ai-suggest-schedules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            currentTime: `${currentHour}:${String(kstNow.getMinutes()).padStart(2, '0')}`,
                            existingSchedules: todaySchedules,
                        }),
                    });

                    if (res.ok) {
                        const data = await res.json();
                        const suggestions = data.suggestions || [];

                        if (suggestions.length > 0) {
                            // 추천 메시지 생성
                            let messageContent = `📋 일정 추천\n\n`;
                            messageContent += `현재 ${currentHour}시인데 ${pendingSchedules.length === 0 ? '남은 일정이 없네요' : '오늘 일정이 없네요'}!\n\n`;
                            messageContent += `오늘 이런 활동은 어떠세요?\n\n`;

                            suggestions.slice(0, 3).forEach((s: any, i: number) => {
                                const time = s.estimatedTime || s.duration || '1시간';
                                messageContent += `${i + 1}. ${s.icon || ''} ${s.title} (${time})\n`;
                                if (s.description) {
                                    messageContent += `   ${s.description}\n`;
                                }
                            });

                            messageContent += `\n채팅에서 "일정 추가해줘"라고 말씀해주시면 바로 추가해드릴게요!`;

                            // 채팅 메시지 추가
                            addChatMessage(messageContent);

                            // 브라우저 알림 발송 (홈 페이지가 아닐 때만)
                            if (pathname !== '/') {
                                sendBrowserNotification(
                                    '📋 일정 추천',
                                    `${pendingSchedules.length === 0 ? '남은 일정이 없어요' : '오늘 일정이 없어요'}! 새로운 일정을 추천해드릴까요?`,
                                    () => router.push('/')
                                );
                            }

                            // 추천 완료 표시
                            localStorage.setItem(recommendKey, 'true');
                            console.log('[GlobalScheduleRecommender] Recommendation sent');
                        }
                    }
                }
            } catch (error) {
                console.error('[GlobalScheduleRecommender] Error:', error);
            }
        };

        // 초기 실행
        checkScheduleAndRecommend();

        // 5분마다 체크
        const interval = setInterval(checkScheduleAndRecommend, 5 * 60 * 1000);

        return () => clearInterval(interval);
    }, [session, pathname, getTodayKST, addChatMessage, sendBrowserNotification, router]);

    // 알림 권한 요청 (처음 로드 시)
    useEffect(() => {
        if (session?.user && "Notification" in window && Notification.permission === "default") {
            // 5초 후에 권한 요청 (바로 요청하면 무시될 수 있음)
            const timer = setTimeout(() => {
                Notification.requestPermission();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [session]);

    return null; // UI를 렌더링하지 않음
}
