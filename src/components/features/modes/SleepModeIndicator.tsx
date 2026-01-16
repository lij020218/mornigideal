"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusSleepMode } from "@/contexts/FocusSleepModeContext";
import { useEffect, useState } from "react";

export function SleepModeIndicator() {
    const {
        isSleepMode,
        sleepStartTime,
        endSleepMode,
    } = useFocusSleepMode();

    const [elapsedTime, setElapsedTime] = useState("");

    // Update elapsed time every minute
    useEffect(() => {
        if (!isSleepMode || !sleepStartTime) return;

        const updateElapsed = () => {
            const now = new Date();
            const elapsed = Math.floor((now.getTime() - sleepStartTime.getTime()) / (1000 * 60));
            const hours = Math.floor(elapsed / 60);
            const mins = elapsed % 60;

            if (hours > 0) {
                setElapsedTime(`${hours}시간 ${mins}분`);
            } else {
                setElapsedTime(`${mins}분`);
            }
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [isSleepMode, sleepStartTime]);

    if (!isSleepMode) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[100]"
            >
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-lg px-6 py-3">
                    <div className="flex items-center gap-4">
                        {/* Moon icon with glow */}
                        <div className="relative">
                            <Moon className="w-5 h-5" />
                            <motion.div
                                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
                                transition={{ duration: 3, repeat: Infinity }}
                                className="absolute inset-0 bg-white rounded-full blur-sm"
                            />
                        </div>

                        {/* Sleep info */}
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">수면 중</span>
                            <span className="text-xs opacity-80">({elapsedTime})</span>
                        </div>

                        {/* Wake up button */}
                        <Button
                            size="sm"
                            onClick={endSleepMode}
                            className="bg-white/20 hover:bg-white/30 text-white border-none rounded-full h-8 px-4"
                        >
                            <Sun className="w-4 h-4 mr-1" />
                            <span className="text-xs font-medium">일어났어요</span>
                        </Button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
