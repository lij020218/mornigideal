"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Loader2, BookOpen, Lightbulb, CheckCircle, ArrowRight, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from "rehype-raw";

interface TrendBriefing {
    id: string;
    title: string;
    category: string;
    summary: string;
    time: string;
    imageColor: string;
    originalUrl: string;
    imageUrl?: string;
    source: string;
    relevance?: string;
}

interface BriefingDetail {
    title: string;
    content: string;
    keyTakeaways: string[];
    actionItems: string[];
    originalUrl: string;
}

interface TrendBriefingDetailProps {
    briefing: TrendBriefing | null;
    isOpen: boolean;
    onClose: () => void;
    userLevel: string;
    userJob: string;
}

export function TrendBriefingDetail({ briefing, isOpen, onClose, userLevel, userJob }: TrendBriefingDetailProps) {
    const [detail, setDetail] = useState<BriefingDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen && briefing) {
            fetchDetail();
            // Prevent body scroll when modal is open and scroll to top
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${window.scrollY}px`;
            document.body.style.width = '100%';
        } else {
            const scrollY = document.body.style.top;
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        }
        return () => {
            const scrollY = document.body.style.top;
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            if (scrollY) {
                window.scrollTo(0, parseInt(scrollY || '0') * -1);
            }
        };
    }, [isOpen, briefing]);

    const fetchDetail = async () => {
        if (!briefing) return;

        try {
            setLoading(true);
            console.log('[TrendBriefingDetail] Fetching detail for:', briefing.title);
            console.log('[TrendBriefingDetail] Request payload:', {
                title: briefing.title,
                level: userLevel,
                job: userJob,
                originalUrl: briefing.originalUrl,
                trendId: briefing.id
            });

            const response = await fetch("/api/trend-briefing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: briefing.title,
                    level: userLevel,
                    job: userJob,
                    originalUrl: briefing.originalUrl,
                    summary: briefing.summary,
                    trendId: briefing.id
                })
            });

            console.log('[TrendBriefingDetail] Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[TrendBriefingDetail] Response error:', errorText);
                throw new Error("Failed to fetch detail");
            }

            const data = await response.json();
            console.log('[TrendBriefingDetail] Response data:', data);
            console.log('[TrendBriefingDetail] Detail structure:', {
                hasDetail: !!data.detail,
                hasTitle: !!data.detail?.title,
                hasContent: !!data.detail?.content,
                hasKeyTakeaways: !!data.detail?.keyTakeaways,
                hasActionItems: !!data.detail?.actionItems,
                keyTakeawaysLength: data.detail?.keyTakeaways?.length,
                actionItemsLength: data.detail?.actionItems?.length
            });

            setDetail(data.detail);
        } catch (error) {
            console.error("[TrendBriefingDetail] Error fetching detail:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && briefing && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
                        onClick={onClose}
                    />

                    {/* Modal Container - Centered */}
                    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="w-full max-w-4xl max-h-[90vh] bg-white/95 backdrop-blur-xl border border-gray-200/50 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Subtle gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/30 pointer-events-none" />

                            {/* Header */}
                            <div className="flex items-start justify-between p-8 border-b border-gray-200/50 bg-white/40 backdrop-blur-sm z-10">
                                <div className="flex-1 pr-8">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className={cn(
                                            "px-3 py-1.5 text-xs font-bold rounded-full border",
                                            briefing.category === "AI" ? "bg-purple-100 text-purple-700 border-purple-200" :
                                                briefing.category === "Business" ? "bg-blue-100 text-blue-700 border-blue-200" :
                                                    "bg-gray-100 text-gray-700 border-gray-200"
                                        )}>
                                            {briefing.category}
                                        </span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                            <span className="w-1 h-1 rounded-full bg-gray-400" />
                                            {briefing.source}
                                        </span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                            <span className="w-1 h-1 rounded-full bg-gray-400" />
                                            {briefing.time}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold leading-tight text-gray-900 tracking-tight">
                                        {detail?.title || briefing.title}
                                    </h2>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="shrink-0 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Content - Scrollable with hidden scrollbar */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar relative z-10">
                                <style jsx global>{`
                                    .custom-scrollbar::-webkit-scrollbar {
                                        width: 0px;
                                        background: transparent;
                                    }
                                    .custom-scrollbar {
                                        -ms-overflow-style: none;
                                        scrollbar-width: none;
                                    }
                                `}</style>

                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                                        <p className="text-sm text-gray-600 animate-pulse font-medium">
                                            AI가 심층 분석 중입니다...
                                        </p>
                                    </div>
                                ) : detail ? (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.4 }}
                                        className="space-y-8"
                                    >
                                        {/* Main Content */}
                                        <div className="prose prose-lg max-w-none">
                                            <div className="text-base leading-relaxed text-gray-700 space-y-4">
                                                <ReactMarkdown
                                                    rehypePlugins={[rehypeRaw]}
                                                    components={{
                                                        mark: ({ node, ...props }) => <mark className="bg-yellow-100 text-yellow-900 px-1.5 py-0.5 rounded font-semibold" {...props} />,
                                                        h3: ({ node, ...props }) => <h3 className="text-xl font-bold text-gray-900 mt-8 mb-4" {...props} />,
                                                        p: ({ node, ...props }) => <p className="mb-4 text-gray-700 leading-7" {...props} />,
                                                        ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-2 mb-4 text-gray-700" {...props} />,
                                                        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                                        strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />
                                                    }}
                                                >
                                                    {detail.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>

                                        {/* Key Takeaways Box */}
                                        {detail.keyTakeaways && detail.keyTakeaways.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.1 }}
                                                className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200/60 rounded-2xl p-6 shadow-sm"
                                            >
                                                <h3 className="font-bold flex items-center gap-2 mb-4 text-blue-900 text-lg">
                                                    <Lightbulb className="w-5 h-5 text-blue-600" />
                                                    핵심 요약
                                                </h3>
                                                <div className="space-y-3">
                                                    {detail.keyTakeaways.map((takeaway, index) => (
                                                        <div key={index} className="flex items-start gap-3 text-base text-gray-800 font-medium">
                                                            <span className="text-blue-600 font-bold shrink-0 mt-0.5">{index + 1}.</span>
                                                            <span className="leading-relaxed">{takeaway}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Action Items with + Button */}
                                        {detail.actionItems && detail.actionItems.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.2 }}
                                                className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-2xl p-6 shadow-sm"
                                            >
                                                <h3 className="font-bold flex items-center gap-2 mb-4 text-gray-900 text-lg">
                                                    <Target className="w-5 h-5 text-purple-600" />
                                                    무엇을 할 것인가
                                                </h3>
                                                <ul className="space-y-3">
                                                    {detail.actionItems.map((action, index) => (
                                                        <li key={index} className="group flex items-start gap-3 text-sm text-gray-700 hover:bg-gray-50 p-3 rounded-xl transition-all">
                                                            <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-purple-600">
                                                                {index + 1}
                                                            </div>
                                                            <span className="leading-relaxed flex-1 font-medium">{action}</span>
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        // Ask user for duration
                                                                        const duration = prompt('이 활동에 몇 분이 필요하신가요? (예: 30, 60)', '60');
                                                                        if (!duration) return; // User cancelled

                                                                        const durationMinutes = parseInt(duration);
                                                                        if (isNaN(durationMinutes) || durationMinutes <= 0) {
                                                                            alert('올바른 시간(분)을 입력해주세요.');
                                                                            return;
                                                                        }

                                                                        const now = new Date();
                                                                        const today = now.toISOString().split('T')[0];
                                                                        const startTime = `${(now.getHours() + 1).toString().padStart(2, '0')}:00`;

                                                                        // Calculate end time based on duration
                                                                        const startHour = now.getHours() + 1;
                                                                        const endTotalMin = startHour * 60 + durationMinutes;
                                                                        const endHour = Math.floor(endTotalMin / 60);
                                                                        const endMin = endTotalMin % 60;
                                                                        const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

                                                                        const response = await fetch("/api/user/schedule/add", {
                                                                            method: "POST",
                                                                            headers: { "Content-Type": "application/json" },
                                                                            body: JSON.stringify({
                                                                                text: action,
                                                                                startTime,
                                                                                endTime,
                                                                                specificDate: today,
                                                                            }),
                                                                        });

                                                                        if (response.ok) {
                                                                            // Notify Dashboard to refresh schedule
                                                                            console.log("[TrendBriefing] 일정 업데이트 이벤트 발송");
                                                                            window.dispatchEvent(new CustomEvent('schedule-updated'));

                                                                            // Get AI resource recommendations
                                                                            console.log("[TrendBriefing] AI 리소스 요청 시작:", action);
                                                                            const resourceResponse = await fetch("/api/ai-resource-recommend", {
                                                                                method: "POST",
                                                                                headers: { "Content-Type": "application/json" },
                                                                                body: JSON.stringify({
                                                                                    activity: action,
                                                                                    category: "productivity",
                                                                                }),
                                                                            });

                                                                            if (resourceResponse.ok) {
                                                                                const resourceData = await resourceResponse.json();
                                                                                console.log("[TrendBriefing] AI 리소스 데이터:", resourceData);

                                                                                // Send message to AI chat
                                                                                const chatMessage = `✅ "${action}" 일정이 추가되었습니다!\n\n${resourceData.recommendation}`;
                                                                                console.log("[TrendBriefing] AI 채팅 이벤트 발송");

                                                                                window.dispatchEvent(new CustomEvent('ai-chat-message', {
                                                                                    detail: {
                                                                                        role: 'assistant',
                                                                                        content: chatMessage,
                                                                                    }
                                                                                }));

                                                                                // Auto-open AI chat after 500ms
                                                                                setTimeout(() => {
                                                                                    console.log("[TrendBriefing] AI 채팅 오픈 이벤트 발송");
                                                                                    window.dispatchEvent(new CustomEvent('ai-chat-open'));
                                                                                }, 500);
                                                                            }

                                                                            alert(`✅ "${action}" 일정이 추가되었습니다! (${durationMinutes}분)`);
                                                                        }
                                                                    } catch (e) {
                                                                        console.error("Failed to add schedule:", e);
                                                                    }
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 shrink-0 w-7 h-7 rounded-full bg-purple-500 hover:bg-purple-600 flex items-center justify-center transition-all transform hover:scale-110 shadow-md"
                                                                title="일정에 추가"
                                                            >
                                                                <span className="text-white text-sm font-bold">+</span>
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <p className="text-xs text-gray-500 mt-4 flex items-center gap-1.5">
                                                    <span className="text-base">💡</span>
                                                    <span>항목 위에 마우스를 올리면 일정에 추가할 수 있습니다</span>
                                                </p>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                ) : (
                                    <div className="text-center py-20 text-gray-500">
                                        <p className="font-medium">상세 내용을 불러올 수 없습니다</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-gray-200/50 bg-white/60 backdrop-blur-sm z-10 flex justify-end">
                                <Button
                                    className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-none shadow-lg"
                                    onClick={() => window.open(briefing.originalUrl, "_blank")}
                                >
                                    <span className="font-semibold">원문 기사 읽기</span>
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
}
