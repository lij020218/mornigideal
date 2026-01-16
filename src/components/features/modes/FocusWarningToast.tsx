"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusSleepMode } from "@/contexts/FocusSleepModeContext";

export function FocusWarningToast() {
    const {
        isFocusMode,
        focusDuration,
        showFocusWarning,
        setShowFocusWarning,
    } = useFocusSleepMode();

    // Format duration
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        if (mins >= 60) {
            const hours = Math.floor(mins / 60);
            const remainingMins = mins % 60;
            return `${hours}시간 ${remainingMins}분`;
        }
        return `${mins}분`;
    };

    if (!isFocusMode || !showFocusWarning) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -50, scale: 0.9 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] md:top-24"
            >
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl shadow-xl p-4 mx-4 max-w-sm w-full">
                    <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="flex-shrink-0 bg-white/20 rounded-full p-2">
                            <Target className="w-5 h-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                            <h3 className="font-bold text-lg mb-1">집중하세요!</h3>
                            <p className="text-sm text-white/90">
                                현재 집중 모드 중입니다<br />
                                ({formatDuration(focusDuration)} 경과)
                            </p>
                        </div>

                        {/* Close button */}
                        <button
                            onClick={() => setShowFocusWarning(false)}
                            className="flex-shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Action button */}
                    <div className="mt-3">
                        <Button
                            onClick={() => setShowFocusWarning(false)}
                            className="w-full bg-white/20 hover:bg-white/30 text-white border-none"
                        >
                            확인
                        </Button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
