"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Moon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusSleepMode } from "@/contexts/FocusSleepModeContext";
import { useState } from "react";

export function SleepModePrompt() {
    const {
        showSleepPrompt,
        setShowSleepPrompt,
        startSleepMode,
    } = useFocusSleepMode();

    const [dontAskToday, setDontAskToday] = useState(false);

    const handleClose = () => {
        if (dontAskToday) {
            // Store in localStorage to not show again today
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem(`sleep_prompt_dismissed_${today}`, 'true');
        }
        setShowSleepPrompt(false);
    };

    const handleStartSleep = () => {
        startSleepMode();
    };

    if (!showSleepPrompt) return null;

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
                    className="bg-gradient-to-br from-indigo-900 to-purple-900 text-white rounded-2xl shadow-2xl p-8 mx-4 max-w-sm w-full"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close button */}
                    <button
                        onClick={handleClose}
                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5 opacity-60" />
                    </button>

                    {/* Moon icon with animation */}
                    <div className="flex justify-center mb-6">
                        <motion.div
                            animate={{
                                y: [0, -5, 0],
                                rotate: [0, 5, -5, 0],
                            }}
                            transition={{ duration: 4, repeat: Infinity }}
                            className="relative"
                        >
                            <Moon className="w-16 h-16 text-yellow-300" />
                            <motion.div
                                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
                                transition={{ duration: 3, repeat: Infinity }}
                                className="absolute inset-0 bg-yellow-300 rounded-full blur-xl"
                            />
                        </motion.div>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-center mb-2">
                        취침 시간이에요!
                    </h2>

                    {/* Description */}
                    <p className="text-center text-white/80 mb-6 text-sm">
                        취침 모드를 켜서 수면 시간을<br />
                        기록할까요?
                    </p>

                    {/* Buttons */}
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={handleStartSleep}
                            className="w-full bg-white text-indigo-900 hover:bg-white/90 font-semibold py-6"
                        >
                            네, 취침할게요
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={handleClose}
                            className="w-full text-white/80 hover:text-white hover:bg-white/10"
                        >
                            아직 안 잘래요
                        </Button>
                    </div>

                    {/* Don't ask again checkbox */}
                    <div className="mt-4 flex items-center justify-center gap-2">
                        <input
                            type="checkbox"
                            id="dontAskToday"
                            checked={dontAskToday}
                            onChange={(e) => setDontAskToday(e.target.checked)}
                            className="w-4 h-4 rounded border-white/30 bg-white/10 text-indigo-500 focus:ring-indigo-500"
                        />
                        <label htmlFor="dontAskToday" className="text-xs text-white/60 cursor-pointer">
                            오늘은 다시 묻지 않기
                        </label>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
