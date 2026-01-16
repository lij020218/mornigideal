"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface FocusSleepModeState {
    // Focus Mode
    isFocusMode: boolean;
    isFocusPaused: boolean;
    focusStartTime: Date | null;
    focusDuration: number; // in seconds
    focusTarget: number; // target duration in minutes (default: 25)
    focusInterruptCount: number;
    focusPausedDuration: number; // total paused time in seconds

    // Sleep Mode
    isSleepMode: boolean;
    sleepStartTime: Date | null;

    // Sleep Mode Prompt
    showSleepPrompt: boolean;
    setShowSleepPrompt: (show: boolean) => void;

    // Focus Mode Prompt
    showFocusPrompt: boolean;
    setShowFocusPrompt: (show: boolean) => void;

    // Focus Warning
    showFocusWarning: boolean;
    setShowFocusWarning: (show: boolean) => void;

    // Actions
    startFocusMode: (targetMinutes?: number) => void;
    pauseFocusMode: () => void;
    resumeFocusMode: () => void;
    endFocusMode: () => void;
    startSleepMode: () => void;
    endSleepMode: () => void;
}

const FocusSleepModeContext = createContext<FocusSleepModeState | undefined>(undefined);

export function FocusSleepModeProvider({ children }: { children: React.ReactNode }) {
    // Focus Mode State
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [isFocusPaused, setIsFocusPaused] = useState(false);
    const [focusStartTime, setFocusStartTime] = useState<Date | null>(null);
    const [focusDuration, setFocusDuration] = useState(0);
    const [focusTarget, setFocusTarget] = useState(25); // 25 minutes default (Pomodoro)
    const [focusInterruptCount, setFocusInterruptCount] = useState(0);
    const [focusPausedDuration, setFocusPausedDuration] = useState(0);
    const [focusPauseStartTime, setFocusPauseStartTime] = useState<Date | null>(null);
    const [showFocusWarning, setShowFocusWarning] = useState(false);

    // Sleep Mode State
    const [isSleepMode, setIsSleepMode] = useState(false);
    const [sleepStartTime, setSleepStartTime] = useState<Date | null>(null);
    const [showSleepPrompt, setShowSleepPrompt] = useState(false);
    const [showFocusPrompt, setShowFocusPrompt] = useState(false);

    // Refs for visibility handling
    const wasHiddenRef = useRef(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Load state from localStorage on mount
    useEffect(() => {
        const savedFocusMode = localStorage.getItem('focus_mode_active');
        const savedFocusStart = localStorage.getItem('focus_mode_start');
        const savedFocusTarget = localStorage.getItem('focus_mode_target');
        const savedInterruptCount = localStorage.getItem('focus_interrupt_count');
        const savedFocusPaused = localStorage.getItem('focus_mode_paused');
        const savedPausedDuration = localStorage.getItem('focus_paused_duration');
        const savedPauseStart = localStorage.getItem('focus_pause_start');

        if (savedFocusMode === 'true' && savedFocusStart) {
            setIsFocusMode(true);
            setFocusStartTime(new Date(savedFocusStart));
            setFocusTarget(savedFocusTarget ? parseInt(savedFocusTarget) : 25);
            setFocusInterruptCount(savedInterruptCount ? parseInt(savedInterruptCount) : 0);
            setFocusPausedDuration(savedPausedDuration ? parseInt(savedPausedDuration) : 0);

            if (savedFocusPaused === 'true' && savedPauseStart) {
                setIsFocusPaused(true);
                setFocusPauseStartTime(new Date(savedPauseStart));
            }
        }

        const savedSleepMode = localStorage.getItem('sleep_mode_active');
        const savedSleepStart = localStorage.getItem('sleep_mode_start');

        if (savedSleepMode === 'true' && savedSleepStart) {
            setIsSleepMode(true);
            setSleepStartTime(new Date(savedSleepStart));
        }
    }, []);

    // Focus Mode Timer
    useEffect(() => {
        if (isFocusMode && focusStartTime && !isFocusPaused) {
            timerRef.current = setInterval(() => {
                const now = new Date();
                const elapsed = Math.floor((now.getTime() - focusStartTime.getTime()) / 1000);
                // 일시정지된 총 시간을 제외
                setFocusDuration(elapsed - focusPausedDuration);
            }, 1000);

            return () => {
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }
            };
        }
    }, [isFocusMode, focusStartTime, isFocusPaused, focusPausedDuration]);

    // Visibility Change Detection for Focus Mode
    useEffect(() => {
        // 일시정지 중이면 이탈 감지 안함
        if (!isFocusMode || isFocusPaused) return;

        const handleVisibilityChange = () => {
            // 일시정지 상태면 무시
            if (isFocusPaused) return;

            if (document.hidden) {
                // User left the tab
                wasHiddenRef.current = true;

                // Send browser notification
                if (Notification.permission === 'granted') {
                    const elapsed = Math.floor(focusDuration / 60);
                    new Notification('집중하세요!', {
                        body: `집중 모드 ${elapsed}분 진행 중입니다. 돌아와주세요!`,
                        icon: '/icon.png',
                        tag: 'focus-warning',
                    });
                }

                // Increment interrupt count
                setFocusInterruptCount(prev => {
                    const newCount = prev + 1;
                    localStorage.setItem('focus_interrupt_count', newCount.toString());
                    return newCount;
                });

                // Log the interruption
                logModeEvent('focus_interrupted', {
                    duration: focusDuration,
                    interruptCount: focusInterruptCount + 1,
                });

            } else if (wasHiddenRef.current) {
                // User returned to the tab
                wasHiddenRef.current = false;
                setShowFocusWarning(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [isFocusMode, isFocusPaused, focusDuration, focusInterruptCount]);

    // Request notification permission on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }
    }, []);

    // Log mode events to API
    const logModeEvent = async (eventType: string, metadata: Record<string, any>) => {
        try {
            await fetch('/api/user/mode-events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventType, metadata }),
            });
        } catch (error) {
            console.error('[FocusSleepMode] Failed to log event:', error);
        }
    };

    // Start Focus Mode
    const startFocusMode = useCallback((targetMinutes: number = 25) => {
        console.log('[FocusSleepMode] startFocusMode called with targetMinutes:', targetMinutes);
        const now = new Date();
        setIsFocusMode(true);
        setFocusStartTime(now);
        setFocusDuration(0);
        setFocusTarget(targetMinutes);
        setFocusInterruptCount(0);
        setFocusPausedDuration(0);

        localStorage.setItem('focus_mode_active', 'true');
        localStorage.setItem('focus_mode_start', now.toISOString());
        localStorage.setItem('focus_mode_target', targetMinutes.toString());
        localStorage.setItem('focus_interrupt_count', '0');
        localStorage.removeItem('focus_paused_duration');

        logModeEvent('focus_start', { targetMinutes });
        console.log('[FocusSleepMode] Focus mode started successfully');
    }, []);

    // Pause Focus Mode
    const pauseFocusMode = useCallback(() => {
        if (!isFocusMode || isFocusPaused) return;

        const now = new Date();
        setIsFocusPaused(true);
        setFocusPauseStartTime(now);

        localStorage.setItem('focus_mode_paused', 'true');
        localStorage.setItem('focus_pause_start', now.toISOString());

        // 타이머 정지
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        logModeEvent('focus_paused', {
            duration: focusDuration,
            pausedAt: now.toISOString(),
        });
    }, [isFocusMode, isFocusPaused, focusDuration]);

    // Resume Focus Mode
    const resumeFocusMode = useCallback(() => {
        if (!isFocusMode || !isFocusPaused || !focusPauseStartTime) return;

        const now = new Date();
        const pauseDuration = Math.floor((now.getTime() - focusPauseStartTime.getTime()) / 1000);

        setIsFocusPaused(false);
        setFocusPausedDuration(prev => {
            const newTotal = prev + pauseDuration;
            localStorage.setItem('focus_paused_duration', newTotal.toString());
            return newTotal;
        });
        setFocusPauseStartTime(null);

        localStorage.removeItem('focus_mode_paused');
        localStorage.removeItem('focus_pause_start');

        logModeEvent('focus_resumed', {
            pauseDuration,
            totalPausedDuration: focusPausedDuration + pauseDuration,
        });
    }, [isFocusMode, isFocusPaused, focusPauseStartTime, focusPausedDuration]);

    // End Focus Mode
    const endFocusMode = useCallback(() => {
        const duration = focusDuration;

        setIsFocusMode(false);
        setIsFocusPaused(false);
        setFocusStartTime(null);
        setFocusDuration(0);
        setFocusInterruptCount(0);
        setFocusPausedDuration(0);
        setFocusPauseStartTime(null);

        localStorage.removeItem('focus_mode_active');
        localStorage.removeItem('focus_mode_start');
        localStorage.removeItem('focus_mode_target');
        localStorage.removeItem('focus_interrupt_count');
        localStorage.removeItem('focus_mode_paused');
        localStorage.removeItem('focus_pause_start');
        localStorage.removeItem('focus_paused_duration');

        logModeEvent('focus_end', {
            duration,
            targetMinutes: focusTarget,
            interruptCount: focusInterruptCount,
            totalPausedDuration: focusPausedDuration,
            completedTarget: duration >= focusTarget * 60,
        });

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
    }, [focusDuration, focusTarget, focusInterruptCount, focusPausedDuration]);

    // Start Sleep Mode
    const startSleepMode = useCallback(() => {
        const now = new Date();
        setIsSleepMode(true);
        setSleepStartTime(now);
        setShowSleepPrompt(false);

        localStorage.setItem('sleep_mode_active', 'true');
        localStorage.setItem('sleep_mode_start', now.toISOString());

        logModeEvent('sleep_start', { startTime: now.toISOString() });
    }, []);

    // End Sleep Mode
    const endSleepMode = useCallback(() => {
        const endTime = new Date();
        const startTime = sleepStartTime;

        let sleepDurationMinutes = 0;
        if (startTime) {
            sleepDurationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        }

        setIsSleepMode(false);
        setSleepStartTime(null);

        localStorage.removeItem('sleep_mode_active');
        localStorage.removeItem('sleep_mode_start');

        logModeEvent('sleep_end', {
            startTime: startTime?.toISOString(),
            endTime: endTime.toISOString(),
            durationMinutes: sleepDurationMinutes,
            durationHours: (sleepDurationMinutes / 60).toFixed(1),
        });
    }, [sleepStartTime]);

    return (
        <FocusSleepModeContext.Provider
            value={{
                // Focus Mode
                isFocusMode,
                isFocusPaused,
                focusStartTime,
                focusDuration,
                focusTarget,
                focusInterruptCount,
                focusPausedDuration,

                // Sleep Mode
                isSleepMode,
                sleepStartTime,

                // Sleep Mode Prompt
                showSleepPrompt,
                setShowSleepPrompt,

                // Focus Mode Prompt
                showFocusPrompt,
                setShowFocusPrompt,

                // Focus Warning
                showFocusWarning,
                setShowFocusWarning,

                // Actions
                startFocusMode,
                pauseFocusMode,
                resumeFocusMode,
                endFocusMode,
                startSleepMode,
                endSleepMode,
            }}
        >
            {children}
        </FocusSleepModeContext.Provider>
    );
}

// Default values for when provider is not available (e.g., during SSR/prerendering)
const defaultContextValue: FocusSleepModeState = {
    isFocusMode: false,
    isFocusPaused: false,
    focusStartTime: null,
    focusDuration: 0,
    focusTarget: 25,
    focusInterruptCount: 0,
    focusPausedDuration: 0,
    isSleepMode: false,
    sleepStartTime: null,
    showSleepPrompt: false,
    setShowSleepPrompt: () => {},
    showFocusPrompt: false,
    setShowFocusPrompt: () => {},
    showFocusWarning: false,
    setShowFocusWarning: () => {},
    startFocusMode: () => {},
    pauseFocusMode: () => {},
    resumeFocusMode: () => {},
    endFocusMode: () => {},
    startSleepMode: () => {},
    endSleepMode: () => {},
};

export function useFocusSleepMode() {
    const context = useContext(FocusSleepModeContext);
    // Return default values if provider is not available (during SSR/prerendering)
    if (context === undefined) {
        console.warn('[FocusSleepMode] Provider not found, using default values');
        return defaultContextValue;
    }
    return context;
}
