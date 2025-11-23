"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Loader2, BookOpen, Lightbulb, CheckCircle, ArrowRight, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

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
            // Check if we have cached detail first (handled by API, but good to know)
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

            if (!response.ok) throw new Error("Failed to fetch detail");

            const data = await response.json();
            setDetail(data.detail);
        } catch (error) {
            console.error("Error fetching detail:", error);
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
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="w-full max-w-3xl max-h-[85vh] bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Decorative Gradients */}
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                            <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

                            {/* Header */}
                            <div className="flex items-start justify-between p-6 border-b border-white/5 bg-white/5 backdrop-blur-sm z-10">
                                <div className="flex-1 pr-8">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className={cn(
                                            "px-3 py-1 text-xs font-bold rounded-full border shadow-sm",
                                            briefing.category === "AI" ? "bg-purple-500/20 text-purple-300 border-purple-500/30" :
                                                briefing.category === "Business" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                                                    "bg-gray-500/20 text-gray-300 border-gray-500/30"
                                        )}>
                                            {briefing.category}
                                        </span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-gray-500" />
                                            {briefing.source}
                                        </span>
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-gray-500" />
                                            {briefing.time}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl md:text-3xl font-bold leading-tight text-white/90">
                                        {detail?.title || briefing.title}
                                    </h2>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="shrink-0 rounded-full hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Content - Scrollable with hidden scrollbar */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar relative z-10">
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
                                        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                                        <p className="text-sm text-muted-foreground animate-pulse">
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
                                        <div className="prose prose-invert prose-lg max-w-none">
                                            <div className="text-base leading-relaxed text-gray-300 space-y-4">
                                                <ReactMarkdown
                                                    components={{
                                                        h3: ({ node, ...props }) => <h3 className="text-xl font-semibold text-white mt-6 mb-3 flex items-center gap-2" {...props} />,
                                                        p: ({ node, ...props }) => <p className="mb-4 text-gray-300 leading-7" {...props} />,
                                                        ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-2 mb-4 text-gray-300" {...props} />,
                                                        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                                        strong: ({ node, ...props }) => <strong className="font-semibold text-blue-200" {...props} />
                                                    }}
                                                >
                                                    {detail.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>

                                        {/* Key Takeaways & Action Items Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Key Takeaways */}
                                            {detail.keyTakeaways && detail.keyTakeaways.length > 0 && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.2 }}
                                                    className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/40 transition-colors"
                                                >
                                                    <h3 className="font-semibold flex items-center gap-2 mb-4 text-purple-300">
                                                        <Lightbulb className="w-5 h-5" />
                                                        핵심 인사이트
                                                    </h3>
                                                    <ul className="space-y-3">
                                                        {detail.keyTakeaways.map((takeaway, index) => (
                                                            <li key={index} className="flex items-start gap-3 text-sm text-gray-300">
                                                                <CheckCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                                                <span className="leading-relaxed">{takeaway}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </motion.div>
                                            )}

                                            {/* Action Items */}
                                            {detail.actionItems && detail.actionItems.length > 0 && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.3 }}
                                                    className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-xl p-6 hover:border-blue-500/40 transition-colors"
                                                >
                                                    <h3 className="font-semibold flex items-center gap-2 mb-4 text-blue-300">
                                                        <Target className="w-5 h-5" />
                                                        실행 가능한 액션
                                                    </h3>
                                                    <ul className="space-y-3">
                                                        {detail.actionItems.map((action, index) => (
                                                            <li key={index} className="flex items-start gap-3 text-sm text-gray-300">
                                                                <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold text-blue-400">
                                                                    {index + 1}
                                                                </div>
                                                                <span className="leading-relaxed">{action}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </motion.div>
                                            )}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="text-center py-20 text-muted-foreground">
                                        <p>상세 내용을 불러올 수 없습니다</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-white/5 bg-white/5 backdrop-blur-sm z-10 flex justify-end">
                                <Button
                                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none shadow-lg shadow-blue-500/20"
                                    onClick={() => window.open(briefing.originalUrl, "_blank")}
                                >
                                    <span>원문 기사 읽기</span>
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
