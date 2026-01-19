"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Plus, MessageSquare, Clock, Sparkles, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFocusSleepMode } from "@/contexts/FocusSleepModeContext";
import { markScheduleCompletion } from "@/lib/scheduleNotifications";

export function ScheduleFeedbackPrompt() {
    const { showScheduleFeedback, scheduleFeedbackData, setShowScheduleFeedback } = useFocusSleepMode();
    const [feedback, setFeedback] = useState<"completed" | "partial" | "skipped" | null>(null);
    const [memo, setMemo] = useState("");
    const [showMemoInput, setShowMemoInput] = useState(false);
    const [showFollowUpInput, setShowFollowUpInput] = useState(false);
    const [followUpTask, setFollowUpTask] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleClose = () => {
        setFeedback(null);
        setMemo("");
        setShowMemoInput(false);
        setShowFollowUpInput(false);
        setFollowUpTask("");
        setShowScheduleFeedback(false);
    };

    const handleSubmit = async () => {
        if (!scheduleFeedbackData || !feedback) return;

        setIsSubmitting(true);

        try {
            // Mark schedule completion
            markScheduleCompletion(
                scheduleFeedbackData.goalId,
                feedback === "completed"
            );

            // Save memo if provided
            if (memo.trim()) {
                await saveMemo(scheduleFeedbackData.goalId, memo);
            }

            // Add follow-up task if provided
            if (followUpTask.trim()) {
                await addFollowUpSchedule(followUpTask);
            }

            // Log the feedback
            await fetch('/api/user/schedule-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    goalId: scheduleFeedbackData.goalId,
                    goalText: scheduleFeedbackData.goalText,
                    feedback,
                    memo: memo.trim() || null,
                    followUpTask: followUpTask.trim() || null,
                    timestamp: new Date().toISOString(),
                }),
            });

        } catch (error) {
            console.error('[ScheduleFeedback] Error:', error);
        } finally {
            setIsSubmitting(false);
            handleClose();
        }
    };

    const saveMemo = async (goalId: string, memoText: string) => {
        // Save memo to localStorage and/or API
        const today = new Date().toISOString().split('T')[0];
        const memoKey = `schedule_memo_${today}_${goalId}`;
        localStorage.setItem(memoKey, memoText);

        // Also save to user profile memos
        try {
            await fetch('/api/user/schedule-memo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    goalId,
                    memo: memoText,
                    date: today,
                }),
            });
        } catch (error) {
            console.error('[ScheduleFeedback] Failed to save memo:', error);
        }
    };

    const addFollowUpSchedule = async (taskText: string) => {
        // Add a new schedule for tomorrow or next available time
        try {
            const response = await fetch('/api/user/profile');
            if (!response.ok) return;

            const data = await response.json();
            const customGoals = data.profile?.customGoals || [];

            // Create new goal for tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            const newGoal = {
                id: `goal_${Date.now()}`,
                text: taskText,
                startTime: "09:00",
                endTime: "10:00",
                color: "#8B5CF6",
                specificDate: tomorrowStr,
                notificationEnabled: true,
            };

            const updatedGoals = [...customGoals, newGoal];

            await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customGoals: updatedGoals,
                }),
            });

            // Dispatch event to refresh schedules
            window.dispatchEvent(new CustomEvent('schedules-updated'));
        } catch (error) {
            console.error('[ScheduleFeedback] Failed to add follow-up:', error);
        }
    };

    if (!showScheduleFeedback || !scheduleFeedbackData) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-5 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">일정이 종료되었어요</h3>
                                    <p className="text-sm text-white/80">{scheduleFeedbackData.endTime}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="mt-4 p-3 bg-white/10 rounded-xl">
                            <p className="font-medium">{scheduleFeedbackData.goalText}</p>
                            <p className="text-sm text-white/70 mt-1">
                                {scheduleFeedbackData.startTime} - {scheduleFeedbackData.endTime}
                            </p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                        <p className="text-gray-700 mb-4 font-medium">이 일정은 어떻게 진행되었나요?</p>

                        {/* Feedback Options */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <button
                                onClick={() => setFeedback("completed")}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    feedback === "completed"
                                        ? "border-green-500 bg-green-50"
                                        : "border-gray-200 hover:border-gray-300"
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                                    feedback === "completed" ? "bg-green-500" : "bg-gray-100"
                                }`}>
                                    <Check className={`w-5 h-5 ${feedback === "completed" ? "text-white" : "text-gray-400"}`} />
                                </div>
                                <p className={`text-sm font-medium ${feedback === "completed" ? "text-green-700" : "text-gray-600"}`}>
                                    완료!
                                </p>
                            </button>

                            <button
                                onClick={() => setFeedback("partial")}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    feedback === "partial"
                                        ? "border-amber-500 bg-amber-50"
                                        : "border-gray-200 hover:border-gray-300"
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                                    feedback === "partial" ? "bg-amber-500" : "bg-gray-100"
                                }`}>
                                    <Sparkles className={`w-5 h-5 ${feedback === "partial" ? "text-white" : "text-gray-400"}`} />
                                </div>
                                <p className={`text-sm font-medium ${feedback === "partial" ? "text-amber-700" : "text-gray-600"}`}>
                                    부분 완료
                                </p>
                            </button>

                            <button
                                onClick={() => setFeedback("skipped")}
                                className={`p-4 rounded-xl border-2 transition-all ${
                                    feedback === "skipped"
                                        ? "border-red-500 bg-red-50"
                                        : "border-gray-200 hover:border-gray-300"
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                                    feedback === "skipped" ? "bg-red-500" : "bg-gray-100"
                                }`}>
                                    <X className={`w-5 h-5 ${feedback === "skipped" ? "text-white" : "text-gray-400"}`} />
                                </div>
                                <p className={`text-sm font-medium ${feedback === "skipped" ? "text-red-700" : "text-gray-600"}`}>
                                    못 했어요
                                </p>
                            </button>
                        </div>

                        {/* Additional Options */}
                        {feedback && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="space-y-3"
                            >
                                {/* Memo Toggle */}
                                <button
                                    onClick={() => setShowMemoInput(!showMemoInput)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                >
                                    <MessageSquare className="w-5 h-5 text-gray-500" />
                                    <span className="text-sm text-gray-700">메모 남기기</span>
                                    <Plus className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${showMemoInput ? "rotate-45" : ""}`} />
                                </button>

                                {showMemoInput && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                    >
                                        <textarea
                                            value={memo}
                                            onChange={(e) => setMemo(e.target.value)}
                                            placeholder="오늘 일정에 대해 기록해두고 싶은 것이 있나요?"
                                            className="w-full min-h-[80px] resize-none p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                    </motion.div>
                                )}

                                {/* Follow-up Toggle */}
                                <button
                                    onClick={() => setShowFollowUpInput(!showFollowUpInput)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                >
                                    <CalendarPlus className="w-5 h-5 text-gray-500" />
                                    <span className="text-sm text-gray-700">추가 일정 잡기</span>
                                    <Plus className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${showFollowUpInput ? "rotate-45" : ""}`} />
                                </button>

                                {showFollowUpInput && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                    >
                                        <textarea
                                            value={followUpTask}
                                            onChange={(e) => setFollowUpTask(e.target.value)}
                                            placeholder="내일 추가할 일정을 입력하세요 (예: 프로젝트 마무리)"
                                            className="w-full min-h-[60px] resize-none p-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">내일 오전 9시에 자동으로 추가됩니다</p>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 pb-5 flex gap-3">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            className="flex-1"
                        >
                            나중에
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={!feedback || isSubmitting}
                            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                        >
                            {isSubmitting ? "저장 중..." : "완료"}
                        </Button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
