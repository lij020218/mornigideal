"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Bell, X, Clock, Sun, Target, AlertCircle, ChevronRight, Brain, Repeat, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProactiveNotification {
    id: string;
    type: 'schedule_reminder' | 'morning_briefing' | 'urgent_alert' | 'context_suggestion' | 'goal_nudge' | 'memory_suggestion' | 'pattern_reminder' | 'lifestyle_recommend';
    priority: 'high' | 'medium' | 'low';
    title: string;
    message: string;
    actionType?: string;
    actionPayload?: Record<string, any>;
    expiresAt?: string;
}

interface ProactiveNotificationManagerProps {
    onOpenBriefing?: () => void;
    onOpenSchedule?: (scheduleId?: string) => void;
    onOpenChat?: (message?: string) => void;
    className?: string;
}

const notificationIcons: Record<string, React.ReactNode> = {
    schedule_reminder: <Clock className="w-5 h-5 text-blue-500" />,
    morning_briefing: <Sun className="w-5 h-5 text-amber-500" />,
    urgent_alert: <AlertCircle className="w-5 h-5 text-red-500" />,
    context_suggestion: <Bell className="w-5 h-5 text-purple-500" />,
    goal_nudge: <Target className="w-5 h-5 text-emerald-500" />,
    memory_suggestion: <Brain className="w-5 h-5 text-indigo-500" />,
    pattern_reminder: <Repeat className="w-5 h-5 text-teal-500" />,
    lifestyle_recommend: <MapPin className="w-5 h-5 text-pink-500" />,
};

const priorityStyles: Record<string, string> = {
    high: 'border-l-4 border-l-red-500 bg-red-50',
    medium: 'border-l-4 border-l-amber-500 bg-amber-50',
    low: 'border-l-4 border-l-blue-500 bg-blue-50',
};

export function ProactiveNotificationManager({
    onOpenBriefing,
    onOpenSchedule,
    onOpenChat,
    className
}: ProactiveNotificationManagerProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const [notifications, setNotifications] = useState<ProactiveNotification[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lastFetchTime, setLastFetchTime] = useState<number>(0);

    // 알림 가져오기
    const fetchNotifications = useCallback(async () => {
        if (!session?.user?.email) return;

        // 30초 이내에 다시 요청하지 않음
        const now = Date.now();
        if (now - lastFetchTime < 30000) return;

        try {
            setIsLoading(true);
            const response = await fetch('/api/fieri/proactive');

            if (!response.ok) {
                console.error('[ProactiveNotification] Failed to fetch');
                return;
            }

            const data = await response.json();
            setNotifications(data.notifications || []);
            setLastFetchTime(now);

            // 표시한 알림 타입 기록
            for (const notif of data.notifications || []) {
                if (['morning_briefing', 'goal_nudge', 'urgent_alert', 'lifestyle_recommend'].includes(notif.type)) {
                    await markAsShown(notif.type);
                }
            }
        } catch (error) {
            console.error('[ProactiveNotification] Error fetching:', error);
        } finally {
            setIsLoading(false);
        }
    }, [session?.user?.email, lastFetchTime]);

    // 알림 해제
    const dismissNotification = async (notificationId: string, notificationType?: string) => {
        try {
            await fetch('/api/fieri/proactive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'dismiss',
                    notificationId,
                    notificationType,
                })
            });

            setNotifications(prev => prev.filter(n => n.id !== notificationId));
        } catch (error) {
            console.error('[ProactiveNotification] Error dismissing:', error);
        }
    };

    // 알림 액션 실행
    const handleAction = async (notification: ProactiveNotification) => {
        const { actionType, actionPayload, id, type } = notification;

        // 액션 처리
        switch (actionType) {
            case 'open_briefing':
                onOpenBriefing?.();
                break;
            case 'view_schedule':
                onOpenSchedule?.(actionPayload?.scheduleId);
                break;
            case 'view_goal':
                router.push('/insights');
                break;
            case 'view_uncompleted':
                // 메인 페이지의 일정 영역으로 스크롤
                router.push('/');
                setTimeout(() => {
                    document.getElementById('schedule-section')?.scrollIntoView({ behavior: 'smooth' });
                }, 300);
                break;
            case 'convert_to_recurring':
                // 확인 후 서버에서 반복 일정 전환 처리
                if (confirm(`"${actionPayload?.text}"을(를) 반복 일정으로 전환할까요?`)) {
                    toast.success('반복 일정으로 전환되었습니다');
                } else {
                    return; // 취소 시 accept 보내지 않음
                }
                break;
            case 'lifestyle_suggest':
                // 채팅으로 이동하여 추천 대화 시작
                if (onOpenChat) {
                    const suggestMessage = actionPayload?.suggestion
                        || `${notification.title}에 대해 더 알려줘`;
                    onOpenChat(suggestMessage);
                } else {
                    router.push('/');
                }
                break;
        }

        // 알림 수락 처리 (해제됨 + streak 리셋)
        try {
            await fetch('/api/fieri/proactive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'accept',
                    notificationId: id,
                    notificationType: type,
                    actionType,
                    actionPayload,
                })
            });

            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (error) {
            console.error('[ProactiveNotification] Error accepting:', error);
        }
    };

    // 표시됨 기록
    const markAsShown = async (notificationType: string) => {
        try {
            await fetch('/api/fieri/proactive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mark_shown',
                    notificationType
                })
            });
        } catch (error) {
            console.error('[ProactiveNotification] Error marking shown:', error);
        }
    };

    // 초기 로드 및 주기적 업데이트
    useEffect(() => {
        if (!session?.user?.email) return;

        // 초기 로드
        fetchNotifications();

        // 1분마다 새 알림 확인
        const interval = setInterval(fetchNotifications, 60000);

        return () => clearInterval(interval);
    }, [session?.user?.email, fetchNotifications]);

    if (notifications.length === 0) return null;

    return (
        <div className={className}>
            <AnimatePresence mode="popLayout">
                {notifications.map((notification, index) => (
                    <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: -20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.95 }}
                        transition={{ delay: index * 0.1 }}
                        className={`
                            relative rounded-lg p-4 mb-3 shadow-sm
                            ${priorityStyles[notification.priority]}
                        `}
                    >
                        {/* 닫기 버튼 */}
                        <button
                            onClick={() => dismissNotification(notification.id, notification.type)}
                            className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/5 transition-colors"
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>

                        {/* 알림 내용 */}
                        <div className="flex items-start gap-3 pr-6">
                            <div className="flex-shrink-0 mt-0.5">
                                {notificationIcons[notification.type]}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 text-sm">
                                    {notification.title}
                                </h4>
                                <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">
                                    {notification.message}
                                </p>

                                {/* 액션 버튼 */}
                                {notification.actionType && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleAction(notification)}
                                        className="mt-2 text-xs h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                        자세히 보기
                                        <ChevronRight className="w-3 h-3 ml-1" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* 우선순위 표시 (high만) */}
                        {notification.priority === 'high' && (
                            <div className="absolute top-2 left-2">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                    중요
                                </span>
                            </div>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
