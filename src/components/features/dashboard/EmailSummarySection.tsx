"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw, AlertCircle, CheckCircle, Clock, ExternalLink, Calendar, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CalendarEvent {
    title: string;
    date: string;
    startTime: string;
    endTime?: string;
    location?: string;
}

interface ImportantEmail {
    messageId: string;
    from: string;
    subject: string;
    date: string;
    snippet: string;
    summary: string;
    importance: string;
    action: string;
    priority: "high" | "medium" | "low";
    category: string;
    calendarEvent?: CalendarEvent | null;
}

interface EmailSummaryData {
    importantEmails: ImportantEmail[];
    totalUnread: number;
    skippedCount: number;
    message?: string;
}

const priorityColors = {
    high: "text-red-400 bg-red-500/10 border-red-500/20",
    medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    low: "text-blue-400 bg-blue-500/10 border-blue-500/20"
};

const priorityLabels = {
    high: "높음",
    medium: "보통",
    low: "낮음"
};

export function EmailSummarySection() {
    const [emailData, setEmailData] = useState<EmailSummaryData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isGmailConnected, setIsGmailConnected] = useState(false);
    const [lastFetched, setLastFetched] = useState<number | null>(null);

    const CACHE_DURATION = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
    const CACHE_KEY = 'email_summary_cache';
    const CACHE_TIMESTAMP_KEY = 'email_summary_timestamp';

    useEffect(() => {
        // Try to load from cache first, then fetch if needed
        loadEmailSummary();
    }, []);

    const loadEmailSummary = async (forceRefresh = false) => {
        setError(null);

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cachedData = localStorage.getItem(CACHE_KEY);
            const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

            if (cachedData && cachedTimestamp) {
                const timestamp = parseInt(cachedTimestamp);
                const now = Date.now();
                const age = now - timestamp;

                // If cache is less than 4 hours old, use it
                if (age < CACHE_DURATION) {
                    setEmailData(JSON.parse(cachedData));
                    setLastFetched(timestamp);
                    setIsGmailConnected(true);
                    return;
                }
            }
        }

        // Fetch fresh data
        setIsLoading(true);

        try {
            const response = await fetch('/api/gmail/summary');
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 403) {
                    setIsGmailConnected(false);
                    setError(data.message || "Gmail 계정을 연동해주세요");
                } else {
                    setError(data.message || "이메일 요약을 불러오는데 실패했습니다");
                }
                return;
            }

            setIsGmailConnected(true);
            setEmailData(data);

            // Cache the data
            const timestamp = Date.now();
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp.toString());
            setLastFetched(timestamp);

        } catch (err) {
            console.error('[EmailSummary] Error:', err);
            setError("이메일 요약을 불러오는데 실패했습니다");
        } finally {
            setIsLoading(false);
        }
    };

    if (error && (error.includes('연동') || error.includes('로그인'))) {
        return (
            <Card className="glass-card border-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Mail className="w-5 h-5 text-primary" />
                        이메일 요약
                    </CardTitle>
                    <CardDescription>중요한 이메일을 AI가 요약해드립니다</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                        <AlertCircle className="w-12 h-12 text-yellow-500" />
                        <div>
                            <p className="text-white font-medium mb-2">{error}</p>
                            <p className="text-sm text-muted-foreground">
                                Gmail 이메일 요약 기능을 사용하려면 Google 계정으로 로그인이 필요합니다
                            </p>
                        </div>
                        {error.includes('로그인') ? (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (confirm('로그아웃 후 Google 계정으로 다시 로그인하시겠습니까?')) {
                                            localStorage.clear();
                                            window.location.href = '/login';
                                        }
                                    }}
                                >
                                    로그아웃하고 다시 로그인
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                onClick={() => window.location.href = '/settings'}
                            >
                                설정으로 이동
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="glass-card border-none">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Mail className="w-5 h-5 text-primary" />
                            이메일 요약
                            {emailData && (
                                <span className="text-sm font-normal text-muted-foreground">
                                    ({emailData.totalUnread}개 중 {emailData.importantEmails.length}개 선별)
                                </span>
                            )}
                        </CardTitle>
                        <CardDescription>읽지 않은 중요 이메일을 AI가 요약해드립니다</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        {lastFetched && (
                            <span className="text-xs text-muted-foreground">
                                {Math.floor((Date.now() - lastFetched) / 1000 / 60)}분 전
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => loadEmailSummary(true)}
                            disabled={isLoading}
                            className="rounded-full"
                            title="새로고침"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading && !emailData ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                        <span className="ml-2 text-muted-foreground">이메일 분석 중...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                        <p className="text-muted-foreground">{error}</p>
                    </div>
                ) : emailData && emailData.importantEmails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                        <p className="text-muted-foreground">
                            {emailData.message || "중요한 이메일이 없습니다"}
                        </p>
                        {emailData.totalUnread > 0 && (
                            <p className="text-sm text-muted-foreground mt-2">
                                ({emailData.totalUnread}개의 읽지 않은 이메일이 있지만 긴급하지 않습니다)
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                            {emailData?.importantEmails.map((email, index) => (
                                <motion.div
                                    key={email.messageId}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${priorityColors[email.priority]}`}>
                                                    {priorityLabels[email.priority]}
                                                </span>
                                                <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary border border-primary/20">
                                                    {email.category}
                                                </span>
                                            </div>
                                            <h4 className="font-medium text-white mb-1">{email.subject}</h4>
                                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                                                <Mail className="w-3 h-3" />
                                                {email.from.split('<')[0].trim()}
                                                <Clock className="w-3 h-3 ml-2" />
                                                {new Date(email.date).toLocaleDateString('ko-KR', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                        <a
                                            href={`https://mail.google.com/mail/u/0/#inbox/${email.messageId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:text-primary/80"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>

                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="font-medium text-white">요약: </span>
                                            <span className="text-gray-300">{email.summary}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-white">중요도: </span>
                                            <span className="text-gray-300">{email.importance}</span>
                                        </div>
                                        {email.action && (
                                            <div>
                                                <span className="font-medium text-white">제안 조치: </span>
                                                <span className="text-primary">{email.action}</span>
                                            </div>
                                        )}

                                        {/* Calendar Event Detection */}
                                        {email.calendarEvent && (
                                            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                                <div className="flex items-start gap-3">
                                                    <Calendar className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-blue-300 mb-1">
                                                            일정이 감지되었습니다
                                                        </p>
                                                        <div className="text-xs text-gray-300 space-y-1">
                                                            <p><strong>제목:</strong> {email.calendarEvent.title}</p>
                                                            <p><strong>날짜:</strong> {email.calendarEvent.date}</p>
                                                            <p><strong>시간:</strong> {email.calendarEvent.startTime}{email.calendarEvent.endTime ? ` - ${email.calendarEvent.endTime}` : ''}</p>
                                                            {email.calendarEvent.location && (
                                                                <p><strong>장소:</strong> {email.calendarEvent.location}</p>
                                                            )}
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            className="mt-3 h-8 text-xs bg-blue-600 hover:bg-blue-700"
                                                            onClick={() => {
                                                                // TODO: Open schedule popup with this event
                                                                const event = email.calendarEvent;
                                                                if (event) {
                                                                    const eventData = {
                                                                        text: event.title,
                                                                        startTime: event.startTime,
                                                                        endTime: event.endTime || '',
                                                                        specificDate: event.date,
                                                                        location: event.location || ''
                                                                    };
                                                                    // Store in localStorage to be picked up by SchedulePopup
                                                                    localStorage.setItem('pendingCalendarEvent', JSON.stringify(eventData));
                                                                    // Trigger custom event to open schedule popup
                                                                    window.dispatchEvent(new CustomEvent('openSchedulePopup', { detail: eventData }));
                                                                }
                                                            }}
                                                        >
                                                            <Plus className="w-3 h-3 mr-1" />
                                                            일정에 추가
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {emailData && emailData.skippedCount > 0 && (
                            <div className="text-center text-sm text-muted-foreground pt-2">
                                {emailData.skippedCount}개의 덜 중요한 이메일은 건너뛰었습니다
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
