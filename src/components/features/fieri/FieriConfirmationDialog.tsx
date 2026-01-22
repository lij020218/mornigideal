"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, AlertCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FieriConfirmationDialogProps {
    id: string;
    message: string;
    actionType: string;
    actionPayload: Record<string, any>;
    onAccept: (id: string) => void;
    onReject: (id: string) => void;
    isOpen: boolean;
}

export function FieriConfirmationDialog({
    id,
    message,
    actionType,
    actionPayload,
    onAccept,
    onReject,
    isOpen
}: FieriConfirmationDialogProps) {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAccept = async () => {
        setIsProcessing(true);
        await onAccept(id);
        setIsProcessing(false);
    };

    const handleReject = () => {
        onReject(id);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleReject}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Dialog */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", duration: 0.4 }}
                            className="pointer-events-auto w-full max-w-md"
                        >
                            <div className={cn(
                                "relative rounded-3xl p-6 shadow-2xl",
                                "bg-white dark:bg-gray-900",
                                "border-2 border-amber-300/50 dark:border-amber-700/50"
                            )}>
                                {/* Fi.eri Header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="relative">
                                        <motion.div
                                            animate={{
                                                rotate: [0, 5, -5, 5, 0]
                                            }}
                                            transition={{
                                                duration: 2,
                                                repeat: Infinity,
                                                repeatDelay: 3
                                            }}
                                            className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center"
                                        >
                                            <Sparkles className="w-6 h-6 text-white" />
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
                                            className="absolute inset-0 rounded-full bg-amber-400/30 blur-md"
                                        />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                            Fi.eri
                                        </h2>
                                        <p className="text-xs text-amber-700 dark:text-amber-300">
                                            확인이 필요해요
                                        </p>
                                    </div>
                                </div>

                                {/* Important Indicator */}
                                {isImportantAction(actionType) && (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-100/80 dark:bg-amber-900/30 border border-amber-300/50 dark:border-amber-700/50 mb-4">
                                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                        <span className="text-xs text-amber-800 dark:text-amber-200">
                                            중요한 변경사항입니다
                                        </span>
                                    </div>
                                )}

                                {/* Message */}
                                <p className="text-base leading-relaxed text-gray-800 dark:text-gray-200 mb-6 whitespace-pre-wrap">
                                    {message}
                                </p>

                                {/* Action Preview */}
                                {renderActionPreview(actionType, actionPayload)}

                                {/* Action Buttons */}
                                <div className="flex gap-3 mt-6">
                                    <Button
                                        onClick={handleAccept}
                                        disabled={isProcessing}
                                        className={cn(
                                            "flex-1 bg-gradient-to-r from-amber-500 to-orange-500",
                                            "hover:from-amber-600 hover:to-orange-600",
                                            "text-white font-semibold shadow-md",
                                            "transition-all duration-200",
                                            "hover:shadow-lg disabled:opacity-50"
                                        )}
                                    >
                                        {isProcessing ? (
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            >
                                                <Sparkles className="w-4 h-4 mr-2" />
                                            </motion.div>
                                        ) : (
                                            <Check className="w-4 h-4 mr-2" />
                                        )}
                                        {getAcceptButtonLabel(actionType)}
                                    </Button>
                                    <Button
                                        onClick={handleReject}
                                        disabled={isProcessing}
                                        variant="outline"
                                        className="flex-1 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium"
                                    >
                                        <X className="w-4 h-4 mr-2" />
                                        괜찮아요
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}

// Helper: Check if action is important
function isImportantAction(actionType: string): boolean {
    const importantActions = ['schedule_moved', 'schedule_deleted', 'buffer_added'];
    return importantActions.includes(actionType);
}

// Helper: Render action preview based on type
function renderActionPreview(actionType: string, payload: Record<string, any>) {
    if (actionType === 'schedule_moved' && payload.fromTime && payload.toTime) {
        return (
            <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm mb-2">
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                    <span className="line-through opacity-60">{payload.fromTime}</span>
                    <span className="mx-2">→</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">{payload.toTime}</span>
                </div>
                {payload.scheduleTitle && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{payload.scheduleTitle}</p>
                )}
            </div>
        );
    }

    if (actionType === 'schedule_suggested' && payload.suggestedSchedule) {
        const schedule = payload.suggestedSchedule;
        return (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm mb-2">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{schedule.text}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {schedule.startTime} {schedule.endTime && `- ${schedule.endTime}`}
                </p>
            </div>
        );
    }

    return null;
}

// Helper: Get accept button label
function getAcceptButtonLabel(actionType: string): string {
    switch (actionType) {
        case 'schedule_moved':
            return '일정 옮기기';
        case 'schedule_suggested':
            return '일정 추가하기';
        case 'buffer_added':
            return '버퍼 추가하기';
        case 'learning_suggested':
            return '시작하기';
        default:
            return '확인';
    }
}
