"use client";

import React from "react";
import { motion } from "framer-motion";
import { X, Plus, Trash2, Clock, Sun, Moon, Coffee, Briefcase, Dumbbell, BookOpen, Target, Edit3, Check, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Heart, Gamepad2, Users, MapPin, FileText, Tv, Music, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CustomGoal } from "./SchedulePopup";

const PRESET_ACTIVITIES = [
    // 생활 리듬
    { id: 'wake', label: '기상', icon: Sun, color: 'yellow', needsDuration: false, isCore: true },
    { id: 'sleep', label: '취침', icon: Moon, color: 'indigo', needsDuration: false, isCore: true },
    // 업무/학업
    { id: 'work-start', label: '업무/수업 시작', icon: Briefcase, color: 'purple', needsDuration: false, isCore: true },
    { id: 'work-end', label: '업무/수업 종료', icon: Briefcase, color: 'violet', needsDuration: false, isCore: true },
    // 식사
    { id: 'breakfast', label: '아침 식사', icon: Coffee, color: 'orange', needsDuration: true, isCore: false },
    { id: 'lunch', label: '점심 식사', icon: Coffee, color: 'orange', needsDuration: true, isCore: false },
    { id: 'dinner', label: '저녁 식사', icon: Coffee, color: 'amber', needsDuration: true, isCore: false },
    // 운동/건강
    { id: 'exercise', label: '운동', icon: Dumbbell, color: 'pink', needsDuration: true, isCore: false },
    { id: 'hospital', label: '병원', icon: Plus, color: 'rose', needsDuration: true, isCore: false },
    // 자기계발
    { id: 'reading', label: '독서', icon: BookOpen, color: 'cyan', needsDuration: true, isCore: false },
    { id: 'study', label: '자기계발', icon: Target, color: 'teal', needsDuration: true, isCore: false },
    // 휴식/여가
    { id: 'leisure', label: '휴식/여가', icon: Gamepad2, color: 'emerald', needsDuration: true, isCore: false },
    // 사회활동
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

export interface WeeklyViewProps {
    selectedWeekStart: Date;
    setSelectedWeekStart: React.Dispatch<React.SetStateAction<Date>>;
    selectedDayOfWeek: number;
    setSelectedDayOfWeek: React.Dispatch<React.SetStateAction<number>>;
    customGoals: CustomGoal[];
    setCustomGoals: React.Dispatch<React.SetStateAction<CustomGoal[]>>;
    showEditOptions: boolean;
    setShowEditOptions: React.Dispatch<React.SetStateAction<boolean>>;
    showTimePicker: boolean;
    setShowTimePicker: React.Dispatch<React.SetStateAction<boolean>>;
    showActivityPicker: boolean;
    selectedTimeSlot: string | null;
    setSelectedTimeSlot: React.Dispatch<React.SetStateAction<string | null>>;
    selectedActivityId: string | null;
    setSelectedActivityId: React.Dispatch<React.SetStateAction<string | null>>;
    activityMemo: string;
    setActivityMemo: React.Dispatch<React.SetStateAction<string>>;
    pendingActivity: typeof PRESET_ACTIVITIES[0] | null;
    setPendingActivity: React.Dispatch<React.SetStateAction<typeof PRESET_ACTIVITIES[0] | null>>;
    isAddingCustom: boolean;
    setIsAddingCustom: React.Dispatch<React.SetStateAction<boolean>>;
    customActivityText: string;
    setCustomActivityText: React.Dispatch<React.SetStateAction<string>>;
    duration: number;
    setDuration: React.Dispatch<React.SetStateAction<number>>;
    resetPickers: () => void;
    formatDate: (date: Date) => string;
    getColorClasses: (color: string, isStart?: boolean) => string;
    handleDeleteActivity: (deleteAllRecurring?: boolean) => void;
    handleMemoUpdate: () => void;
    isSelectedActivityRecurring: () => boolean;
    activityToolsRenderer: () => React.ReactNode;
}

export function WeeklyView({
    selectedWeekStart,
    setSelectedWeekStart,
    selectedDayOfWeek,
    setSelectedDayOfWeek,
    customGoals,
    setCustomGoals,
    showEditOptions,
    setShowEditOptions,
    showTimePicker,
    setShowTimePicker,
    showActivityPicker,
    selectedTimeSlot,
    setSelectedTimeSlot,
    selectedActivityId,
    setSelectedActivityId,
    activityMemo,
    setActivityMemo,
    pendingActivity,
    setPendingActivity,
    isAddingCustom,
    setIsAddingCustom,
    customActivityText,
    setCustomActivityText,
    duration,
    setDuration,
    resetPickers,
    formatDate,
    getColorClasses,
    handleDeleteActivity,
    handleMemoUpdate,
    isSelectedActivityRecurring,
    activityToolsRenderer,
}: WeeklyViewProps) {
    return (
        <div className="flex flex-col h-full">
            {/* Week Navigation Header */}
            <div className="flex items-center justify-between p-2 md:p-4 border-b border-border/30 bg-gradient-to-r from-purple-50/50 to-pink-50/50">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        const newWeekStart = new Date(selectedWeekStart);
                        newWeekStart.setDate(selectedWeekStart.getDate() - 7);
                        setSelectedWeekStart(newWeekStart);
                    }}
                    className="gap-1 md:gap-2 h-8 px-2 md:px-3"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden md:inline">이전 주</span>
                </Button>
                <div className="text-center">
                    <p className="text-xs md:text-sm font-semibold text-purple-600">
                        {selectedWeekStart.getFullYear()}년 {selectedWeekStart.getMonth() + 1}월 {(() => {
                            const weekNum = Math.ceil((selectedWeekStart.getDate() + new Date(selectedWeekStart.getFullYear(), selectedWeekStart.getMonth(), 1).getDay()) / 7);
                            return `${weekNum}주차`;
                        })()}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
                        {selectedWeekStart.getMonth() + 1}/{selectedWeekStart.getDate()} - {(() => {
                            const sunday = new Date(selectedWeekStart);
                            sunday.setDate(selectedWeekStart.getDate() + 6);
                            return `${sunday.getMonth() + 1}/${sunday.getDate()}`;
                        })()}
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        const newWeekStart = new Date(selectedWeekStart);
                        newWeekStart.setDate(selectedWeekStart.getDate() + 7);
                        setSelectedWeekStart(newWeekStart);
                    }}
                    className="gap-1 md:gap-2 h-8 px-2 md:px-3"
                >
                    <span className="hidden md:inline">다음 주</span>
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            {/* Weekly Calendar Grid */}
            <div className="flex flex-1 overflow-hidden">
                {/* Time column + Days grid */}
                <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-gray-50 to-white">
                    {/* Header: Days of week */}
                    <div className="flex border-b border-border/50 bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                        {/* Time column header */}
                        <div className="w-10 md:w-16 shrink-0 p-1 md:p-2 border-r border-border/30" />
                        {/* Day headers */}
                        {DAYS_OF_WEEK.map((day) => {
                            // Calculate the actual date for this day in the selected week
                            const dayDate = new Date(selectedWeekStart);
                            dayDate.setDate(selectedWeekStart.getDate() + (day.id === 0 ? 6 : day.id - 1));
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const isPast = dayDate < today;

                            return (
                                <div
                                    key={day.id}
                                    onClick={() => {
                                        if (isPast) return;
                                        setSelectedDayOfWeek(day.id);
                                        resetPickers();
                                    }}
                                    className={cn(
                                        "flex-1 py-2 md:py-4 text-center transition-all border-r border-border/30 last:border-r-0",
                                        isPast
                                            ? "opacity-40 cursor-not-allowed"
                                            : "cursor-pointer",
                                        !isPast && selectedDayOfWeek === day.id
                                            ? "bg-gradient-to-br from-primary/10 to-purple-500/5"
                                            : !isPast && "hover:bg-muted/30",
                                    )}
                                >
                                    <span className={cn(
                                        "text-xs md:text-sm font-bold transition-colors",
                                        isPast && "line-through",
                                        !isPast && selectedDayOfWeek === day.id && "text-primary",
                                        !isPast && day.id === 0 && selectedDayOfWeek !== day.id && "text-red-500",
                                        !isPast && day.id === 6 && selectedDayOfWeek !== day.id && "text-blue-500"
                                    )}>
                                        {day.label}
                                    </span>
                                    {!isPast && selectedDayOfWeek === day.id && (
                                        <motion.div
                                            layoutId="weeklyDayIndicator"
                                            className="mx-auto mt-1 md:mt-1.5 w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-primary"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Scrollable time grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {/* Generate hourly rows (6AM to 11PM) */}
                        {Array.from({ length: 18 }, (_, i) => i + 6).map((hour) => {
                            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                            return (
                                <div key={hour} className="flex border-b border-border/30 min-h-[48px] md:min-h-[64px] hover:bg-white/50 transition-colors">
                                    {/* Time label */}
                                    <div className="w-10 md:w-16 shrink-0 py-1 md:py-2 px-0.5 md:px-1 text-[9px] md:text-[11px] text-muted-foreground/70 font-medium border-r border-border/20 text-right pr-1 md:pr-2 flex items-start justify-end pt-0.5 md:pt-1">
                                        {hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`}
                                    </div>
                                    {/* Day cells */}
                                    {DAYS_OF_WEEK.map((day) => {
                                        // Calculate the actual date for this day in the selected week
                                        const targetDate = new Date(selectedWeekStart);
                                        targetDate.setDate(selectedWeekStart.getDate() + (day.id === 0 ? 6 : day.id - 1));
                                        const dateStr = formatDate(targetDate);

                                        // Find activities for this specific date and hour
                                        const activitiesAtHour = customGoals.filter(goal => {
                                            // Check if this goal applies to this specific date
                                            const isSpecificDate = goal.specificDate === dateStr;
                                            let isRecurringOnThisDay = goal.daysOfWeek?.includes(day.id) && !goal.specificDate;

                                            // Check date range for recurring goals
                                            if (isRecurringOnThisDay && goal.startDate && dateStr < goal.startDate) {
                                                isRecurringOnThisDay = false;
                                            }
                                            if (isRecurringOnThisDay && goal.endDate && dateStr > goal.endDate) {
                                                isRecurringOnThisDay = false;
                                            }

                                            if (!isSpecificDate && !isRecurringOnThisDay) return false;
                                            if (!goal.startTime) return false;
                                            const [startH] = goal.startTime.split(':').map(Number);
                                            return startH === hour;
                                        });

                                        // Gradient map for cards
                                        const gradientMap: Record<string, string> = {
                                            yellow: 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/40 text-yellow-700',
                                            purple: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/40 text-purple-700',
                                            violet: 'bg-gradient-to-br from-violet-500/20 to-purple-500/20 border-violet-500/40 text-violet-700',
                                            green: 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/40 text-green-700',
                                            emerald: 'bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-emerald-500/40 text-emerald-700',
                                            blue: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/40 text-blue-700',
                                            sky: 'bg-gradient-to-br from-sky-500/20 to-blue-500/20 border-sky-500/40 text-sky-700',
                                            cyan: 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/40 text-cyan-700',
                                            teal: 'bg-gradient-to-br from-teal-500/20 to-cyan-500/20 border-teal-500/40 text-teal-700',
                                            red: 'bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/40 text-red-700',
                                            rose: 'bg-gradient-to-br from-rose-500/20 to-pink-500/20 border-rose-500/40 text-rose-700',
                                            orange: 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-orange-500/40 text-orange-700',
                                            amber: 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border-amber-500/40 text-amber-700',
                                            pink: 'bg-gradient-to-br from-pink-500/20 to-purple-500/20 border-pink-500/40 text-pink-700',
                                            indigo: 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500/40 text-indigo-700',
                                            primary: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/40 text-purple-700',
                                        };
                                        const iconBgMap: Record<string, string> = {
                                            yellow: 'bg-yellow-500/30',
                                            purple: 'bg-purple-500/30',
                                            violet: 'bg-violet-500/30',
                                            green: 'bg-green-500/30',
                                            emerald: 'bg-emerald-500/30',
                                            blue: 'bg-blue-500/30',
                                            sky: 'bg-sky-500/30',
                                            cyan: 'bg-cyan-500/30',
                                            teal: 'bg-teal-500/30',
                                            red: 'bg-red-500/30',
                                            rose: 'bg-rose-500/30',
                                            orange: 'bg-orange-500/30',
                                            amber: 'bg-amber-500/30',
                                            pink: 'bg-pink-500/30',
                                            indigo: 'bg-indigo-500/30',
                                            primary: 'bg-purple-500/30',
                                        };

                                        return (
                                            <div
                                                key={day.id}
                                                className={cn(
                                                    "flex-1 p-1.5 border-r border-border/20 last:border-r-0 transition-all relative",
                                                    selectedDayOfWeek === day.id && "bg-gradient-to-b from-primary/5 to-transparent"
                                                )}
                                            >
                                                {activitiesAtHour.map((activity, idx) => {
                                                    const preset = PRESET_ACTIVITIES.find(a => a.label === activity.text);
                                                    const ActivityIcon = preset?.icon || Target;
                                                    return (
                                                        <motion.div
                                                            key={activity.id || idx}
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            whileHover={{ scale: 1.02 }}
                                                            className={cn(
                                                                "flex items-center gap-0.5 md:gap-1.5 px-1 md:px-2 py-1 md:py-1.5 rounded-md md:rounded-lg border shadow-sm mb-1 cursor-pointer transition-all hover:shadow-md",
                                                                gradientMap[activity.color || 'primary'] || gradientMap.primary
                                                            )}
                                                            title={`${activity.text} (${activity.startTime}-${activity.endTime})`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedDayOfWeek(day.id);
                                                                setSelectedTimeSlot(activity.startTime || timeStr);
                                                                setSelectedActivityId(activity.id);
                                                                setShowEditOptions(true);
                                                                setShowTimePicker(false);
                                                                setActivityMemo(activity.memo || "");
                                                            }}
                                                        >
                                                            <div className={cn(
                                                                "w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center shrink-0",
                                                                iconBgMap[activity.color || 'primary'] || iconBgMap.primary
                                                            )}>
                                                                <ActivityIcon className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                                            </div>
                                                            <span className="text-[8px] md:text-[10px] font-semibold truncate">{activity.text}</span>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Sidebar: Add/Edit Panel - Fixed bottom sheet on mobile */}
                <div className={cn(
                    "bg-gradient-to-b from-muted/50 to-white overflow-y-auto custom-scrollbar flex flex-col",
                    (showEditOptions || showTimePicker || showActivityPicker)
                        ? "fixed md:relative bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto z-10 rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-l border-border/50 p-4 md:p-5 max-h-[60vh] md:max-h-none w-full md:w-80"
                        : "hidden md:flex w-80 border-l border-border/50 p-5"
                )}>
                {showEditOptions && selectedActivityId ? (
                    /* Edit existing schedule */
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

                        {/* Memo */}
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

                        {/* Delete Button */}
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
                    /* Add new schedule - time picker */
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

                        {/* Custom Activity Name */}
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
                                            const [sH, sM] = start.split(':').map(Number);
                                            const [eH, eM] = e.target.value.split(':').map(Number);
                                            const diff = (eH * 60 + eM) - (sH * 60 + sM);
                                            setDuration(Math.max(0.5, diff / 60));
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
                                id="weekly-location-input"
                            />
                        </div>

                        {/* Memo */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5" /> 세부사항 (선택)
                            </label>
                            <textarea
                                id="weekly-memo-input"
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
                                const endH = sH + Math.floor(duration);
                                const endM = sM + Math.round((duration % 1) * 60);
                                const finalEndH = endH + Math.floor(endM / 60);
                                const finalEndM = endM % 60;
                                const endTime = `${String(finalEndH % 24).padStart(2, '0')}:${String(finalEndM).padStart(2, '0')}`;

                                const locationInput = document.getElementById('weekly-location-input') as HTMLInputElement;
                                const memoInput = document.getElementById('weekly-memo-input') as HTMLTextAreaElement;

                                const newGoal: CustomGoal = {
                                    id: `goal_${Date.now()}`,
                                    text: activityName,
                                    time: sH < 12 ? "morning" : sH < 18 ? "afternoon" : "evening",
                                    daysOfWeek: [selectedDayOfWeek],
                                    startDate: formatDate(new Date()),
                                    startTime,
                                    endTime,
                                    color: activityColor,
                                    location: locationInput?.value || undefined,
                                    memo: memoInput?.value || undefined,
                                };

                                setCustomGoals([...customGoals, newGoal]);
                                resetPickers();
                            }}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            일정 추가
                        </Button>
                    </motion.div>
                ) : (
                    /* Default: Activity picker */
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                                <CalendarIcon className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-foreground">
                                    {DAYS_OF_WEEK.find(d => d.id === selectedDayOfWeek)?.fullLabel}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    매주 반복되는 일정
                                </p>
                            </div>
                        </div>

                        <div className="pt-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">일정 추가</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {PRESET_ACTIVITIES.map((activity) => {
                                    const ActivityIcon = activity.icon;
                                    return (
                                        <motion.button
                                            key={activity.id}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => {
                                                setPendingActivity(activity);
                                                setShowTimePicker(true);
                                                setSelectedTimeSlot("09:00");
                                                setDuration(1);
                                            }}
                                            className={cn(
                                                "p-2 rounded-xl border flex flex-col items-center gap-1 transition-all hover:shadow-md",
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
                                className="w-full border-dashed mt-4"
                                onClick={() => {
                                    setShowTimePicker(true);
                                    setPendingActivity(null);
                                    setIsAddingCustom(true);
                                    setSelectedTimeSlot("09:00");
                                    setDuration(1);
                                    setCustomActivityText("");
                                }}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                직접 입력
                            </Button>
                        </div>
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}
