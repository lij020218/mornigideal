"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Focus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusSleepMode } from "@/contexts/FocusSleepModeContext";
import { useState } from "react";

export function FocusModePrompt() {
    const {
        showFocusPrompt,
        setShowFocusPrompt,
        startFocusMode,
        isFocusMode,
    } = useFocusSleepMode();

    const [dontAskToday, setDontAskToday] = useState(false);
    const [selectedDuration, setSelectedDuration] = useState(25);

    const handleClose = () => {
        if (dontAskToday) {
            // Store in localStorage to not show again today
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem(`focus_prompt_dismissed_${today}`, 'true');
        }
        setShowFocusPrompt(false);
    };

    const handleStartFocus = () => {
        startFocusMode(selectedDuration);
    };

    // Don't show if already in focus mode or prompt is not triggered
    if (!showFocusPrompt || isFocusMode) return null;

    const durationOptions = [
        { value: 15, label: "15분" },
        { value: 25, label: "25분" },
        { value: 45, label: "45분" },
        { value: 60, label: "60분" },
    ];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
                    className="bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-2xl shadow-2xl p-8 mx-4 max-w-sm w-full relative"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close button */}
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 opacity-60" />
                    </button>

                    {/* Focus icon with animation */}
                    <div className="flex justify-center mb-6">
                        <motion.div
                            animate={{
                                scale: [1, 1.1, 1],
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="relative"
                        >
                            <Focus className="w-16 h-16 text-white" />
                            <motion.div
                                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.1, 0.4] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute inset-0 bg-white rounded-full blur-xl"
                            />
                        </motion.div>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-center mb-2">
                        업무 시간이에요!
                    </h2>

                    {/* Description */}
                    <p className="text-center text-white/90 mb-6 text-sm">
                        집중 모드를 시작해서<br />
                        효율적으로 일해볼까요?
                    </p>

                    {/* Duration selector */}
                    <div className="flex justify-center gap-2 mb-6">
                        {durationOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setSelectedDuration(option.value)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    selectedDuration === option.value
                                        ? "bg-white text-orange-600"
                                        : "bg-white/20 text-white hover:bg-white/30"
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {/* Buttons */}
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={handleStartFocus}
                            className="w-full bg-white text-orange-600 hover:bg-white/90 font-semibold py-6"
                        >
                            집중 모드 시작
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleClose}
                            className="w-full text-white/80 hover:text-white hover:bg-white/10"
                        >
                            나중에 할게요
                        </Button>
                    </div>

                    {/* Don't ask again checkbox */}
                    <div className="mt-4 flex items-center justify-center gap-2">
                        <input
                            type="checkbox"
                            id="dontAskFocusToday"
                            checked={dontAskToday}
                            onChange={(e) => setDontAskToday(e.target.checked)}
                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500"
                        />
                        <label htmlFor="dontAskFocusToday" className="text-xs text-white/70 cursor-pointer">
                            오늘은 다시 묻지 않기
                        </label>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
