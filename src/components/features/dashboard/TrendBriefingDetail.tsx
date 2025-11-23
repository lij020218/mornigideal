"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Loader2, BookOpen, Lightbulb, CheckCircle } from "lucide-react";
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

    useEffect(() => {
        if (isOpen && briefing) {
            fetchDetail();
        }
    }, [isOpen, briefing]);

    const fetchDetail = async () => {
        if (!briefing) return;

        try {
            setLoading(true);
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

    if (!isOpen || !briefing) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="w-full max-w-4xl max-h-[90vh] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between p-6 border-b border-white/10">
                                <div className="flex-1 pr-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                            {briefing.category}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {briefing.source} • {briefing.time}
                                        </span>
                                    </div>
                                    <h2 className="text-2xl font-bold">
                                        {detail?.title || briefing.title}
                                    </h2>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="shrink-0"
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    </div>
                                ) : detail ? (
                                    <>
                                        {/* Main Content */}
                                        <div className="prose prose-invert prose-sm max-w-none">
                                            <ReactMarkdown>{detail.content}</ReactMarkdown>
                                        </div>

                                        {/* Key Takeaways */}
                                        {detail.keyTakeaways && detail.keyTakeaways.length > 0 && (
                                            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5">
                                                <h3 className="font-semibold flex items-center gap-2 mb-3">
                                                    <Lightbulb className="w-5 h-5 text-purple-400" />
                                                    핵심 인사이트
                                                </h3>
                                                <ul className="space-y-2">
                                                    {detail.keyTakeaways.map((takeaway, index) => (
                                                        <li key={index} className="flex items-start gap-2 text-sm">
                                                            <CheckCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                                            <span>{takeaway}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Action Items */}
                                        {detail.actionItems && detail.actionItems.length > 0 && (
                                            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
                                                <h3 className="font-semibold flex items-center gap-2 mb-3">
                                                    <BookOpen className="w-5 h-5 text-green-400" />
                                                    실행 가능한 액션
                                                </h3>
                                                <ul className="space-y-2">
                                                    {detail.actionItems.map((action, index) => (
                                                        <li key={index} className="flex items-start gap-2 text-sm">
                                                            <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                                <span className="text-xs font-bold text-green-400">{index + 1}</span>
                                                            </div>
                                                            <span>{action}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <p>상세 내용을 불러올 수 없습니다</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-white/10 bg-white/5">
                                <Button
                                    variant="outline"
                                    className="w-full gap-2"
                                    onClick={() => window.open(briefing.originalUrl, "_blank")}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    원문 기사 보기
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
