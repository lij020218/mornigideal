"use client";

import React from "react";
import { motion } from "framer-motion";
import { X, Plus, Trash2, Clock, Sun, Moon, Coffee, Briefcase, Dumbbell, BookOpen, Target, Edit3, Check, Calendar as CalendarIcon, ChevronLeft, Heart, Gamepad2, Users, MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CustomGoal } from "./SchedulePopup";

const PRESET_ACTIVITIES = [
    // 🌅 생활 리듬 - 노란색/남색 계열
    { id: 'wake', label: '기상', icon: Sun, color: 'yellow', needsDuration: false, isCore: true },
    { id: 'sleep', label: '취침', icon: Moon, color: 'indigo', needsDuration: false, isCore: true },

    // 💼 업무/학업 - 보라색 계열
    { id: 'work-start', label: '업무/수업 시작', icon: Briefcase, color: 'purple', needsDuration: false, isCore: true },
    { id: 'work-end', label: '업무/수업 종료', icon: Briefcase, color: 'violet', needsDuration: false, isCore: true },

    // 🍽️ 식사 - 주황색 계열
    { id: 'breakfast', label: '아침 식사', icon: Coffee, color: 'orange', needsDuration: true, isCore: false },
    { id: 'lunch', label: '점심 식사', icon: Coffee, color: 'orange', needsDuration: true, isCore: false },
    { id: 'dinner', label: '저녁 식사', icon: Coffee, color: 'amber', needsDuration: true, isCore: false },

    // 💪 운동/건강 - 분홍색/빨간색 계열
    { id: 'exercise', label: '운동', icon: Dumbbell, color: 'pink', needsDuration: true, isCore: false },
    { id: 'hospital', label: '병원', icon: Plus, color: 'rose', needsDuration: true, isCore: false },

    // 📚 자기계발 - 청록색 계열
    { id: 'reading', label: '독서', icon: BookOpen, color: 'cyan', needsDuration: true, isCore: false },
    { id: 'study', label: '자기계발', icon: Target, color: 'teal', needsDuration: true, isCore: false },

    // 🎮 휴식/여가 - 녹색 계열
    { id: 'leisure', label: '휴식/여가', icon: Gamepad2, color: 'emerald', needsDuration: true, isCore: false },

    // 👥 사회활동 - 하늘색/빨간색 계열
    { id: 'meeting', label: '미팅', icon: Users, color: 'sky', needsDuration: true, isCore: false },
    { id: 'date', label: '데이트', icon: Heart, color: 'red', needsDuration: true, isCore: false },
];

const DAYS_OF_WEEK = [
    { id: 1, label: '월', fullLabel: '월요일' },
    { id: 2, label: '화', fullLabel: '화요일' },
    { id: 3, label: '수', fullLabel: '수요일' },
    { id: 4, label: '목', fullLabel: '목요일' },
    { id: 5, label: '금', fullLabel: '금요일' },
    { id: 6, label: '토', fullLabel: '토요일' },
    { id: 0, label: '일', fullLabel: '일요일' },
];

export interface DailyDetailViewProps {
    // State
    selectedDate: Date;
    customGoals: CustomGoal[];
    showEditOptions: boolean;
    showTimePicker: boolean;
    showActivityPicker: boolean;
    showDurationPicker: boolean;
    selectedActivityId: string | null;
    selectedTimeSlot: string | null;
    activityMemo: string;
    pendingActivity: typeof PRESET_ACTIVITIES[0] | null;
    isAddingCustom: boolean;
    customActivityText: string;
    duration: number;

    // Setters
    setShowEditOptions: (v: boolean) => void;
    setShowTimePicker: (v: boolean) => void;
    setShowActivityPicker: (v: boolean) => void;
    setShowDurationPicker: (v: boolean) => void;
    setSelectedTimeSlot: (v: string | null) => void;
    setSelectedActivityId: (v: string | null) => void;
    setActivityMemo: (v: string) => void;
    setPendingActivity: (v: typeof PRESET_ACTIVITIES[0] | null) => void;
    setIsAddingCustom: (v: boolean) => void;
    setCustomActivityText: (v: string) => void;
    setDuration: (v: number) => void;
    setCustomGoals: React.Dispatch<React.SetStateAction<CustomGoal[]>>;

    // Handlers
    handleBackToCalendar: () => void;
    resetPickers: () => void;
    handleMemoUpdate: () => void;
    handleDeleteActivity: (deleteAllRecurring?: boolean) => void;
    isSelectedActivityRecurring: () => boolean;
    formatDate: (date: Date) => string;
    getColorClasses: (color: string, isStart?: boolean) => string;

    // Render prop
    activityToolsRenderer: () => React.ReactNode;
}

export function DailyDetailView({
    selectedDate,
    customGoals,
    showEditOptions,
    showTimePicker,
    showActivityPicker,
    showDurationPicker,
    selectedActivityId,
    selectedTimeSlot,
    activityMemo,
    pendingActivity,
    isAddingCustom,
    customActivityText,
    duration,
    setShowEditOptions,
    setShowTimePicker,
    setShowActivityPicker,
    setShowDurationPicker,
    setSelectedTimeSlot,
    setSelectedActivityId,
    setActivityMemo,
    setPendingActivity,
    setIsAddingCustom,
    setCustomActivityText,
    setDuration,
    setCustomGoals,
    handleBackToCalendar,
    resetPickers,
    handleMemoUpdate,
    handleDeleteActivity,
    isSelectedActivityRecurring,
    formatDate,
    getColorClasses,
    activityToolsRenderer,
}: DailyDetailViewProps) {
    return (
                                <div className="flex flex-col md:flex-row h-full">
                                    {/* Left Sidebar - horizontal on mobile */}
                                    <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-border bg-muted/50 flex flex-col shrink-0">
                                        {/* Fixed Header */}
                                        <div className="p-3 md:p-6 md:pb-4 flex md:flex-col items-center md:items-start gap-3 md:gap-0">
                                            <Button
                                                variant="ghost"
                                                onClick={handleBackToCalendar}
                                                className="md:mb-4 w-fit flex items-center gap-1 md:gap-2 -ml-1 md:-ml-2 text-muted-foreground hover:text-foreground h-8 px-2"
                                            >
                                                <ChevronLeft className="w-4 h-4" /> <span className="hidden md:inline">돌아가기</span>
                                            </Button>

                                            <div className="flex items-baseline gap-2 md:block">
                                                <h3 className="text-xl md:text-3xl font-bold text-foreground">
                                                    {selectedDate?.getDate()}일
                                                </h3>
                                                <p className="text-sm md:text-lg text-muted-foreground">
                                                    {selectedDate?.getMonth()! + 1}월 · {DAYS_OF_WEEK.find(d => d.id === selectedDate?.getDay())?.fullLabel}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Scrollable Activity List - horizontal scroll on mobile */}
                                        <div className="flex-1 overflow-x-auto md:overflow-y-auto px-3 md:px-6 pb-3 md:pb-6 hide-scrollbar">
                                            <h4 className="hidden md:block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 sticky top-0 bg-muted/50 py-2">일정 추가</h4>
                                            <div className="flex md:grid md:grid-cols-3 gap-2">
                                                {PRESET_ACTIVITIES.map((activity) => {
                                                    const ActivityIcon = activity.icon;
                                                    return (
                                                        <motion.button
                                                            key={activity.id}
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => {
                                                                // Set pending activity and show time picker
                                                                setPendingActivity(activity);
                                                                setShowTimePicker(true);
                                                                setShowActivityPicker(false);
                                                                setShowDurationPicker(false);
                                                                setShowEditOptions(false);
                                                                setActivityMemo("");
                                                            }}
                                                            className={cn(
                                                                "p-2 rounded-xl border flex flex-col items-center gap-1 transition-all hover:shadow-md shrink-0 w-14 md:w-auto",
                                                                getColorClasses(activity.color)
                                                            )}
                                                        >
                                                            <ActivityIcon className="w-4 h-4" />
                                                            <span className="text-[9px] font-medium text-center leading-tight">{activity.label.slice(0, 4)}</span>
                                                        </motion.button>
                                                    );
                                                })}
                                            </div>

                                            {/* Custom Activity Button */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="shrink-0 w-14 md:w-full border-dashed md:mt-4 flex-col md:flex-row h-auto py-2 md:py-2"
                                                onClick={() => {
                                                    setShowTimePicker(true);
                                                    setPendingActivity(null);
                                                    setIsAddingCustom(true);
                                                    setShowEditOptions(false);
                                                    setActivityMemo("");
                                                    setCustomActivityText("");
                                                }}
                                            >
                                                <Plus className="w-4 h-4 md:mr-2" />
                                                <span className="text-[9px] md:text-sm">직접</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Main Content */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-6 bg-white">
                                        {(() => {
                                            // Get goals for selected date - 중복 제거 로직 포함
                                            const dateStr = formatDate(selectedDate);
                                            const dayOfWeek = selectedDate.getDay();

                                            // 먼저 특정 날짜 일정 수집 (우선순위 높음)
                                            const specificDateGoals = customGoals.filter(g => g.specificDate === dateStr);

                                            // 반복 일정 수집 (특정 날짜 일정과 중복되지 않는 것만)
                                            const recurringGoals = customGoals.filter(g => {
                                                // specificDate가 있으면 반복 일정이 아님
                                                if (g.specificDate) return false;
                                                // 이 요일에 해당하는 반복 일정인지 확인
                                                if (!g.daysOfWeek?.includes(dayOfWeek)) return false;

                                                // startDate가 있으면 해당 날짜 이후에만 표시
                                                if (g.startDate && dateStr < g.startDate) return false;
                                                // endDate가 있으면 해당 날짜까지만 표시
                                                if (g.endDate && dateStr > g.endDate) return false;

                                                // 같은 이름 + 같은 시간의 특정 날짜 일정이 있으면 중복이므로 제외
                                                const hasDuplicate = specificDateGoals.some(sg =>
                                                    sg.text === g.text && sg.startTime === g.startTime
                                                );
                                                return !hasDuplicate;
                                            });

                                            const dateGoals = [...specificDateGoals, ...recurringGoals].sort((a, b) => {
                                                const [aH, aM] = (a.startTime || "00:00").split(':').map(Number);
                                                const [bH, bM] = (b.startTime || "00:00").split(':').map(Number);
                                                return (aH * 60 + aM) - (bH * 60 + bM);
                                            });

                                            if (dateGoals.length === 0) {
                                                // No schedules - show empty state
                                                return (
                                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
                                                            <CalendarIcon className="w-10 h-10 text-muted-foreground" />
                                                        </div>
                                                        <h3 className="text-xl font-semibold text-foreground mb-2">일정이 없습니다</h3>
                                                        <p className="text-muted-foreground max-w-sm">
                                                            왼쪽에서 일정을 선택하여 추가하세요.
                                                        </p>
                                                    </div>
                                                );
                                            }

                                            // Has schedules - show card-based timeline
                                            return (
                                                <div className="space-y-4">
                                                    <h3 className="text-lg font-semibold mb-4">이 날의 일정</h3>

                                                    {dateGoals.map((goal) => {
                                                        const preset = PRESET_ACTIVITIES.find(a => a.label === goal.text);
                                                        const GoalIcon = preset?.icon || Target;
                                                        const goalColor = goal.color || preset?.color || 'primary';

                                                        return (
                                                            <motion.div
                                                                key={goal.id}
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                whileHover={{ scale: 1.01 }}
                                                                onClick={() => {
                                                                    setSelectedTimeSlot(goal.startTime || "09:00");
                                                                    setSelectedActivityId(goal.id);
                                                                    setShowEditOptions(true);
                                                                    setActivityMemo(goal.memo || "");
                                                                }}
                                                                className={cn(
                                                                    "p-4 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-lg",
                                                                    getColorClasses(goalColor)
                                                                )}
                                                            >
                                                                <div className="flex items-start gap-4">
                                                                    <div className={cn(
                                                                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                                                                        `bg-${goalColor}-200/50`
                                                                    )}>
                                                                        <GoalIcon className="w-6 h-6" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <span className="font-bold text-lg">{goal.text}</span>
                                                                            {goal.daysOfWeek && goal.daysOfWeek.length > 0 && !goal.specificDate && (
                                                                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/50 text-muted-foreground">반복</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                                            <span className="flex items-center gap-1">
                                                                                <Clock className="w-3.5 h-3.5" />
                                                                                {goal.startTime} - {goal.endTime || "??:??"}
                                                                            </span>
                                                                            {goal.location && (
                                                                                <span className="flex items-center gap-1">
                                                                                    <MapPin className="w-3.5 h-3.5" />
                                                                                    {goal.location}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {goal.memo && (
                                                                            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                                                                {goal.memo}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Right Sidebar: Edit Panel - Fixed bottom sheet on mobile */}
                                    <div className={cn(
                                        "overflow-y-auto custom-scrollbar",
                                        // Mobile: fixed bottom sheet when active - solid white background
                                        (showEditOptions || showTimePicker)
                                            ? "fixed md:relative bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto z-50 rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-l border-border p-4 md:p-5 max-h-[60vh] md:max-h-none w-full md:w-80 bg-white md:bg-muted/50 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] md:shadow-none"
                                            : "hidden md:block w-80 border-l border-border p-5 bg-muted/50"
                                    )}>
                                        {showEditOptions && selectedActivityId ? (
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="space-y-5"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold">일정 수정</h4>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetPickers}>
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>

                                                {/* Time Edit */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground">시간</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-xs text-muted-foreground">시작</span>
                                                            <Input
                                                                type="time"
                                                                value={customGoals.find(g => g.id === selectedActivityId)?.startTime || ""}
                                                                onChange={(e) => {
                                                                    setCustomGoals(customGoals.map(g =>
                                                                        g.id === selectedActivityId ? { ...g, startTime: e.target.value } : g
                                                                    ));
                                                                }}
                                                                className="mt-1"
                                                            />
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-muted-foreground">종료</span>
                                                            <Input
                                                                type="time"
                                                                value={customGoals.find(g => g.id === selectedActivityId)?.endTime || ""}
                                                                onChange={(e) => {
                                                                    setCustomGoals(customGoals.map(g =>
                                                                        g.id === selectedActivityId ? { ...g, endTime: e.target.value } : g
                                                                    ));
                                                                }}
                                                                className="mt-1"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Location */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                                        <MapPin className="w-3.5 h-3.5" /> 장소
                                                    </label>
                                                    <Input
                                                        placeholder="장소를 입력하세요"
                                                        value={customGoals.find(g => g.id === selectedActivityId)?.location || ""}
                                                        onChange={(e) => {
                                                            setCustomGoals(customGoals.map(g =>
                                                                g.id === selectedActivityId ? { ...g, location: e.target.value } : g
                                                            ));
                                                        }}
                                                    />
                                                </div>

                                                {/* Memo / Details */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                                        <FileText className="w-3.5 h-3.5" /> 세부사항
                                                    </label>
                                                    <textarea
                                                        value={activityMemo}
                                                        onChange={(e) => setActivityMemo(e.target.value)}
                                                        onBlur={handleMemoUpdate}
                                                        placeholder="세부사항을 입력하세요..."
                                                        className="w-full min-h-[100px] px-3 py-2 bg-white border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    />
                                                </div>

                                                {/* Actions */}
                                                <div className="pt-4 border-t border-border space-y-2">
                                                    {isSelectedActivityRecurring() ? (
                                                        <>
                                                            <p className="text-xs text-muted-foreground">이 일정은 반복 일정입니다</p>
                                                            <Button
                                                                variant="outline"
                                                                className="w-full justify-start text-orange-500 hover:text-orange-600 hover:bg-orange-50"
                                                                onClick={() => handleDeleteActivity(false)}
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                이 요일만 삭제
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
                                                                onClick={() => handleDeleteActivity(true)}
                                                            >
                                                                <Trash2 className="w-4 h-4 mr-2" />
                                                                모든 반복 삭제
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => handleDeleteActivity(true)}
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            일정 삭제
                                                        </Button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ) : showTimePicker ? (
                                            // Time picker for quick add
                                            <motion.div
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="space-y-5"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold">
                                                        {pendingActivity ? pendingActivity.label : '새 일정'} 추가
                                                    </h4>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetPickers}>
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>

                                                {/* Custom Activity Name (when adding custom) */}
                                                {isAddingCustom && !pendingActivity && (
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium text-muted-foreground">일정 이름</label>
                                                        <Input
                                                            placeholder="일정 이름을 입력하세요"
                                                            value={customActivityText}
                                                            onChange={(e) => setCustomActivityText(e.target.value)}
                                                            autoFocus
                                                        />
                                                    </div>
                                                )}

                                                {/* Time Selection */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground">시간</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <span className="text-xs text-muted-foreground">시작</span>
                                                            <Input
                                                                type="time"
                                                                value={selectedTimeSlot || "09:00"}
                                                                onChange={(e) => setSelectedTimeSlot(e.target.value)}
                                                                className="mt-1"
                                                            />
                                                        </div>
                                                        <div>
                                                            <span className="text-xs text-muted-foreground">종료</span>
                                                            <Input
                                                                type="time"
                                                                value={(() => {
                                                                    const start = selectedTimeSlot || "09:00";
                                                                    const [h, m] = start.split(':').map(Number);
                                                                    const endH = h + duration;
                                                                    return `${String(endH % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                                                })()}
                                                                onChange={(e) => {
                                                                    const start = selectedTimeSlot || "09:00";
                                                                    const [sH] = start.split(':').map(Number);
                                                                    const [eH] = e.target.value.split(':').map(Number);
                                                                    setDuration(Math.max(1, eH - sH));
                                                                }}
                                                                className="mt-1"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Location */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                                        <MapPin className="w-3.5 h-3.5" /> 장소 (선택)
                                                    </label>
                                                    <Input
                                                        placeholder="장소를 입력하세요"
                                                        value={activityMemo.split('\n')[0]?.startsWith('📍') ? activityMemo.split('\n')[0].replace('📍 ', '') : ''}
                                                        onChange={(e) => {
                                                            // Store location temporarily
                                                            const currentMemo = activityMemo.split('\n').filter(l => !l.startsWith('📍')).join('\n');
                                                            setActivityMemo(e.target.value ? `📍 ${e.target.value}\n${currentMemo}` : currentMemo);
                                                        }}
                                                    />
                                                </div>

                                                {/* Memo / Details */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                                        <FileText className="w-3.5 h-3.5" /> 세부사항 (선택)
                                                    </label>
                                                    <textarea
                                                        value={activityMemo.split('\n').filter(l => !l.startsWith('📍')).join('\n')}
                                                        onChange={(e) => {
                                                            const locationLine = activityMemo.split('\n').find(l => l.startsWith('📍'));
                                                            setActivityMemo(locationLine ? `${locationLine}\n${e.target.value}` : e.target.value);
                                                        }}
                                                        placeholder="세부사항을 입력하세요..."
                                                        className="w-full min-h-[80px] px-3 py-2 bg-white border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                                                    />
                                                </div>

                                                {/* Add Button */}
                                                <Button
                                                    className="w-full"
                                                    disabled={isAddingCustom && !pendingActivity && !customActivityText.trim()}
                                                    onClick={() => {
                                                        const activityName = pendingActivity?.label || customActivityText.trim();
                                                        const activityColor = pendingActivity?.color || 'primary';
                                                        const startTime = selectedTimeSlot || "09:00";
                                                        const [sH, sM] = startTime.split(':').map(Number);
                                                        const endH = sH + duration;
                                                        const endTime = `${String(endH % 24).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;

                                                        // Extract location from memo
                                                        const locationLine = activityMemo.split('\n').find(l => l.startsWith('📍'));
                                                        const location = locationLine ? locationLine.replace('📍 ', '') : undefined;
                                                        const memoWithoutLocation = activityMemo.split('\n').filter(l => !l.startsWith('📍')).join('\n').trim();

                                                        // Determine time period based on startTime
                                                        const timeHour = parseInt(startTime.split(':')[0]);
                                                        const timePeriod: "morning" | "afternoon" | "evening" =
                                                            timeHour < 12 ? "morning" : timeHour < 18 ? "afternoon" : "evening";

                                                        const newGoal: CustomGoal = {
                                                            id: `goal_${Date.now()}`,
                                                            text: activityName,
                                                            time: timePeriod,
                                                            specificDate: formatDate(selectedDate!),
                                                            startTime,
                                                            endTime,
                                                            color: activityColor,
                                                            location,
                                                            memo: memoWithoutLocation || undefined,
                                                        };

                                                        setCustomGoals([...customGoals, newGoal]);
                                                        resetPickers();
                                                    }}
                                                >
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    일정 추가
                                                </Button>
                                            </motion.div>
                                        ) : showActivityPicker || showDurationPicker ? (
                                            activityToolsRenderer()
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                                                <CalendarIcon className="w-8 h-8 mb-3 opacity-50" />
                                                <p className="text-sm">왼쪽에서 일정을 선택하거나<br />기존 일정을 클릭하세요</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
    );
}
