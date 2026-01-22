"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FieriSuggestionCardProps {
    id: string;
    message: string;
    actionType?: string;
    actionPayload?: Record<string, any>;
    createdAt: Date;
    onAccept?: (id: string) => void;
    onDismiss?: (id: string) => void;
    onViewDetails?: (id: string) => void;
}

export function FieriSuggestionCard({
    id,
    message,
    actionType,
    actionPayload,
    createdAt,
    onAccept,
    onDismiss,
    onViewDetails
}: FieriSuggestionCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isDismissing, setIsDismissing] = useState(false);

    const handleDismiss = () => {
        setIsDismissing(true);
        setTimeout(() => {
            onDismiss?.(id);
        }, 300);
    };

    const handleAccept = () => {
        onAccept?.(id);
    };

    // Determine if this suggestion has actionable items
    const hasAction = actionType && actionPayload && onAccept;

    return (
        <AnimatePresence>
            {!isDismissing && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -100, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    onHoverStart={() => setIsHovered(true)}
                    onHoverEnd={() => setIsHovered(false)}
                    className={cn(
                        "relative w-full rounded-2xl p-4 shadow-lg",
                        "bg-gradient-to-br from-amber-50/90 to-orange-50/90",
                        "dark:from-amber-950/30 dark:to-orange-950/30",
                        "border-2 border-amber-200/50 dark:border-amber-800/50",
                        "backdrop-blur-sm transition-all duration-300",
                        isHovered && "shadow-xl border-amber-300/70 dark:border-amber-700/70"
                    )}
                >
                    {/* Fi.eri Icon & Close Button */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <motion.div
                                    animate={{
                                        rotate: [0, 5, -5, 5, 0],
                                        scale: [1, 1.05, 1]
                                    }}
                                    transition={{
                                        duration: 3,
                                        repeat: Infinity,
                                        repeatDelay: 5
                                    }}
                                    className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center"
                                >
                                    <Sparkles className="w-4 h-4 text-white" />
                                </motion.div>
                                <motion.div
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        opacity: [0.5, 0.8, 0.5]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity
                                    }}
                                    className="absolute inset-0 rounded-full bg-amber-400/30 blur-sm"
                                />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm text-amber-900 dark:text-amber-100">
                                    Fi.eri
                                </h3>
                                <p className="text-xs text-amber-700/70 dark:text-amber-300/70">
                                    {formatTimeAgo(createdAt)}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDismiss}
                            className="h-7 w-7 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-100/50 dark:text-amber-400 dark:hover:text-amber-200 dark:hover:bg-amber-900/30 rounded-full"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Message */}
                    <p className="text-base leading-relaxed text-amber-950/90 dark:text-amber-50/90 mb-4 whitespace-pre-wrap">
                        {message}
                    </p>

                    {/* Action Buttons */}
                    {hasAction && (
                        <div className="flex gap-2 mt-4">
                            <Button
                                onClick={handleAccept}
                                className={cn(
                                    "flex-1 bg-gradient-to-r from-amber-500 to-orange-500",
                                    "hover:from-amber-600 hover:to-orange-600",
                                    "text-white font-medium shadow-md",
                                    "transition-all duration-200",
                                    "hover:shadow-lg hover:scale-105"
                                )}
                                size="sm"
                            >
                                <Check className="w-4 h-4 mr-1" />
                                {getActionButtonLabel(actionType)}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleDismiss}
                                className="flex-1 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100/50 dark:hover:bg-amber-900/30"
                                size="sm"
                            >
                                괜찮아요
                            </Button>
                        </div>
                    )}

                    {/* View Details Link (for resource_prep actions) */}
                    {actionType === 'resource_prep' && onViewDetails && (
                        <button
                            onClick={() => onViewDetails(id)}
                            className="mt-3 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
                        >
                            <span>준비된 자료 보기</span>
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "방금 전";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}분 전`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}시간 전`;
    return `${Math.floor(diffInSeconds / 86400)}일 전`;
}

// Helper function to get action button label
function getActionButtonLabel(actionType?: string): string {
    switch (actionType) {
        case 'schedule_moved':
            return '옮기기';
        case 'schedule_suggested':
            return '추가하기';
        case 'learning_suggested':
            return '시작하기';
        case 'checklist_created':
            return '확인하기';
        default:
            return '확인';
    }
}
