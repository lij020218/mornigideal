"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Target, X, Clock, AlertTriangle, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusSleepMode } from "@/contexts/FocusSleepModeContext";

export function FocusModeOverlay() {
    const {
        isFocusMode,
        isFocusPaused,
        focusDuration,
        focusTarget,
        focusInterruptCount,
        pauseFocusMode,
        resumeFocusMode,
        endFocusMode,
    } = useFocusSleepMode();

    // Format duration as HH:MM:SS
    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate target in seconds and progress
    const targetSeconds = focusTarget * 60;
    const progress = Math.min((focusDuration / targetSeconds) * 100, 100);
    const isOverTarget = focusDuration >= targetSeconds;

    if (!isFocusMode) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -60, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="fixed top-0 left-0 right-0 z-[100] md:left-20"
            >
                <div className={`${isFocusPaused
                    ? 'bg-gradient-to-r from-gray-500 to-gray-600'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500'
                } text-white shadow-lg transition-all duration-300`}>
                    <div className="max-w-7xl mx-auto px-4 py-3">
                        <div className="flex items-center justify-between">
                            {/* Left: Focus indicator */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    {isFocusPaused ? (
                                        <Pause className="w-5 h-5" />
                                    ) : (
                                        <Target className="w-5 h-5" />
                                    )}
                                    <span className="font-bold text-sm">
                                        {isFocusPaused ? '일시정지' : '집중 중'}
                                    </span>
                                </div>

                                {/* Pulsing dot - only show when not paused */}
                                {!isFocusPaused && (
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                        className="w-2 h-2 rounded-full bg-white"
                                    />
                                )}
                            </div>

                            {/* Center: Timer */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 opacity-80" />
                                    <span className="font-mono text-lg font-bold">
                                        {formatDuration(focusDuration)}
                                    </span>
                                    <span className="text-sm opacity-80">
                                        / {focusTarget}:00
                                    </span>
                                </div>

                                {/* Progress bar */}
                                <div className="hidden sm:block w-32 h-2 bg-white/30 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        className={`h-full rounded-full ${isOverTarget ? 'bg-green-400' : 'bg-white'
                                            }`}
                                    />
                                </div>

                                {/* Interrupt count warning */}
                                {focusInterruptCount > 0 && (
                                    <div className="hidden sm:flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>이탈 {focusInterruptCount}회</span>
                                    </div>
                                )}
                            </div>

                            {/* Right: Pause/Resume and End buttons */}
                            <div className="flex items-center gap-2">
                                {isFocusPaused ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={resumeFocusMode}
                                        className="text-white hover:bg-white/20 hover:text-white"
                                    >
                                        <Play className="w-4 h-4 mr-1" />
                                        <span className="hidden sm:inline">재개</span>
                                    </Button>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={pauseFocusMode}
                                        className="text-white hover:bg-white/20 hover:text-white"
                                    >
                                        <Pause className="w-4 h-4 mr-1" />
                                        <span className="hidden sm:inline">정지</span>
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={endFocusMode}
                                    className="text-white hover:bg-white/20 hover:text-white"
                                >
                                    <X className="w-4 h-4 mr-1" />
                                    <span className="hidden sm:inline">종료</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
