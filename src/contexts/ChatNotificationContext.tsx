"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, BookOpen, Bell } from "lucide-react";

interface ChatNotification {
    id: string;
    title: string;
    message: string;
    type: 'learning' | 'schedule' | 'general';
    timestamp: Date;
}

interface ChatNotificationContextType {
    notifications: ChatNotification[];
    addNotification: (notification: Omit<ChatNotification, 'id' | 'timestamp'>) => void;
    clearNotifications: () => void;
    unreadCount: number;
}

const ChatNotificationContext = createContext<ChatNotificationContextType | null>(null);

export function useChatNotification() {
    const context = useContext(ChatNotificationContext);
    if (!context) {
        throw new Error("useChatNotification must be used within ChatNotificationProvider");
    }
    return context;
}

// Toast Component
function NotificationToast({ notification, onClose, onClick }: {
    notification: ChatNotification;
    onClose: () => void;
    onClick: () => void;
}) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const getIcon = () => {
        switch (notification.type) {
            case 'learning':
                return <BookOpen className="w-5 h-5 text-purple-400" />;
            case 'schedule':
                return <Bell className="w-5 h-5 text-blue-400" />;
            default:
                return <MessageCircle className="w-5 h-5 text-orange-400" />;
        }
    };

    const getBorderColor = () => {
        switch (notification.type) {
            case 'learning':
                return 'border-purple-500/30';
            case 'schedule':
                return 'border-blue-500/30';
            default:
                return 'border-orange-500/30';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -20, x: 20 }}
            className={`bg-card/95 backdrop-blur-md rounded-xl shadow-lg border ${getBorderColor()} p-4 max-w-sm cursor-pointer hover:bg-card transition-colors`}
            onClick={onClick}
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    {getIcon()}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm">{notification.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                    </p>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="flex-shrink-0 p-1 rounded-lg hover:bg-muted transition-colors"
                >
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>
            <div className="mt-2 text-right">
                <span className="text-xs text-primary font-medium">채팅으로 이동 →</span>
            </div>
        </motion.div>
    );
}

export function ChatNotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<ChatNotification[]>([]);
    const [toastNotifications, setToastNotifications] = useState<ChatNotification[]>([]);
    const pathname = usePathname();
    const router = useRouter();

    const isOnChatPage = pathname === '/chat';

    const addNotification = useCallback((notification: Omit<ChatNotification, 'id' | 'timestamp'>) => {
        const newNotification: ChatNotification = {
            ...notification,
            id: `notif-${Date.now()}`,
            timestamp: new Date(),
        };

        setNotifications(prev => [...prev, newNotification]);

        // 채팅 페이지가 아닐 때만 토스트 표시
        if (!isOnChatPage) {
            setToastNotifications(prev => [...prev, newNotification]);
        }
    }, [isOnChatPage]);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToastNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const handleToastClick = useCallback((notification: ChatNotification) => {
        removeToast(notification.id);
        router.push('/chat');
    }, [removeToast, router]);

    // Listen for custom notification events
    useEffect(() => {
        const handleNewNotification = (event: CustomEvent<{
            title: string;
            message: string;
            type: 'learning' | 'schedule' | 'general';
        }>) => {
            addNotification(event.detail);
        };

        window.addEventListener('new-chat-notification', handleNewNotification as EventListener);
        return () => {
            window.removeEventListener('new-chat-notification', handleNewNotification as EventListener);
        };
    }, [addNotification]);

    // Clear notifications when entering chat page
    useEffect(() => {
        if (isOnChatPage) {
            setToastNotifications([]);
        }
    }, [isOnChatPage]);

    return (
        <ChatNotificationContext.Provider
            value={{
                notifications,
                addNotification,
                clearNotifications,
                unreadCount: notifications.length,
            }}
        >
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[200] space-y-2">
                <AnimatePresence>
                    {toastNotifications.map(notification => (
                        <NotificationToast
                            key={notification.id}
                            notification={notification}
                            onClose={() => removeToast(notification.id)}
                            onClick={() => handleToastClick(notification)}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </ChatNotificationContext.Provider>
    );
}
