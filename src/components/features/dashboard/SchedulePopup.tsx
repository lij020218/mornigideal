"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Clock, Sun, Moon, Coffee, Briefcase, Dumbbell, BookOpen, Target, Edit3, Check, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Schedule {
    wakeUp: string;
    workStart: string;
    workEnd: string;
    sleep: string;
}

export interface CustomGoal {
    id: string;
    text: string;
    time: "morning" | "afternoon" | "evening";
    startTime?: string;
    endTime?: string;
    color?: string;
    daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    notificationEnabled?: boolean;
    specificDate?: string; // YYYY-MM-DD format for specific date goals
}

interface SchedulePopupProps {
    isOpen: boolean;
    onClose: () => void;
    initialSchedule?: Schedule;
    initialCustomGoals?: CustomGoal[];
    onSave: (schedule: Schedule, customGoals: CustomGoal[]) => void;
}

interface ScheduleItem {
    time: string;
    type: 'wake' | 'work-start' | 'work-end' | 'sleep' | 'custom';
    label: string;
    icon: any;
    color: string;
}

const PRESET_ACTIVITIES = [
    { id: 'wake', label: '기상', icon: Sun, color: 'yellow', needsDuration: false },
    { id: 'sleep', label: '취침', icon: Moon, color: 'blue', needsDuration: false },
    { id: 'work-start', label: '업무 시작', icon: Briefcase, color: 'purple', needsDuration: false },
    { id: 'work-end', label: '업무 종료', icon: Briefcase, color: 'green', needsDuration: false },
    { id: 'breakfast', label: '아침 식사', icon: Coffee, color: 'orange', needsDuration: true },
    { id: 'lunch', label: '점심 식사', icon: Coffee, color: 'amber', needsDuration: true },
    { id: 'dinner', label: '저녁 식사', icon: Coffee, color: 'red', needsDuration: true },
    { id: 'exercise', label: '운동', icon: Dumbbell, color: 'pink', needsDuration: true },
    { id: 'reading', label: '독서', icon: BookOpen, color: 'cyan', needsDuration: true },
    { id: 'study', label: '자기계발', icon: Target, color: 'indigo', needsDuration: true },
];

const DAYS_OF_WEEK = [
    { id: 0, label: '일', fullLabel: '일요일' },
    { id: 1, label: '월', fullLabel: '월요일' },
    { id: 2, label: '화', fullLabel: '화요일' },
    { id: 3, label: '수', fullLabel: '수요일' },
    { id: 4, label: '목', fullLabel: '목요일' },
    { id: 5, label: '금', fullLabel: '금요일' },
    { id: 6, label: '토', fullLabel: '토요일' },
];

export function SchedulePopup({ isOpen, onClose, initialSchedule, initialCustomGoals, onSave }: SchedulePopupProps) {
    const [schedule, setSchedule] = useState<Schedule>({
        wakeUp: "07:00",
        workStart: "09:00",
        workEnd: "18:00",
        sleep: "23:00",
    });
    const [customGoals, setCustomGoals] = useState<CustomGoal[]>([]);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
    const [showActivityPicker, setShowActivityPicker] = useState(false);
    const [showDurationPicker, setShowDurationPicker] = useState(false);
    const [showDayPicker, setShowDayPicker] = useState(false);
    const [showEditOptions, setShowEditOptions] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<typeof PRESET_ACTIVITIES[0] | null>(null);
    const [duration, setDuration] = useState<number>(1);
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Default: weekdays
    const [notificationEnabled, setNotificationEnabled] = useState<boolean>(true);
    const [customActivityText, setCustomActivityText] = useState("");
    const [isAddingCustom, setIsAddingCustom] = useState(false);

    // Calendar State
    const [viewMode, setViewMode] = useState<'default' | 'calendar'>('default');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

    const timeSlots = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            timeSlots.push(timeStr);
        }
    }

    useEffect(() => {
        if (isOpen) {
            if (initialSchedule) setSchedule(initialSchedule);
            if (initialCustomGoals) setCustomGoals(initialCustomGoals);
        }
    }, [isOpen, initialSchedule, initialCustomGoals]);

    const handleTimeSlotClick = (time: string) => {
        const existingActivity = getScheduledActivityAtTime(time);

        if (existingActivity) {
            setSelectedTimeSlot(time);
            setShowEditOptions(true);
            setShowActivityPicker(false);
            setShowDurationPicker(false);
            setShowDayPicker(false);
        } else {
            setSelectedTimeSlot(time);
            setShowActivityPicker(true);
            setShowEditOptions(false);
            setShowDurationPicker(false);
            setShowDayPicker(false);
            setIsAddingCustom(false);
        }
    };

    const handleActivitySelect = (activityId: string) => {
        if (!selectedTimeSlot) return;

        const activity = PRESET_ACTIVITIES.find(a => a.id === activityId);
        if (!activity) return;

        if (activity.needsDuration) {
            setSelectedActivity(activity);
            setShowDurationPicker(true);
            setShowActivityPicker(false);
            setDuration(1);
        } else {
            switch (activityId) {
                case 'wake':
                    setSchedule(prev => ({ ...prev, wakeUp: selectedTimeSlot }));
                    break;
                case 'sleep':
                    setSchedule(prev => ({ ...prev, sleep: selectedTimeSlot }));
                    break;
                case 'work-start':
                    setSchedule(prev => ({ ...prev, workStart: selectedTimeSlot }));
                    break;
                case 'work-end':
                    setSchedule(prev => ({ ...prev, workEnd: selectedTimeSlot }));
                    break;
            }
            resetPickers();
        }
    };

    const calculateEndTime = (startTime: string, durationHours: number): string => {
        const [hours, minutes] = startTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + (durationHours * 60);
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;
        return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    };

    const handleDurationConfirm = () => {
        if (!selectedTimeSlot || !selectedActivity) return;

        // Show day picker
        setShowDurationPicker(false);
        setShowDayPicker(true);
    };

    const handleDayPickerConfirm = () => {
        if (!selectedTimeSlot || !selectedActivity) return;

        const endTime = calculateEndTime(selectedTimeSlot, duration);
        const timeOfDay = getTimeOfDay(selectedTimeSlot);

        const newGoal: CustomGoal = {
            id: Date.now().toString(),
            text: selectedActivity.label,
            time: timeOfDay,
            startTime: selectedTimeSlot,
            endTime: endTime,
            color: selectedActivity.color,
            daysOfWeek: viewMode === 'default' ? selectedDays : undefined,
            specificDate: viewMode === 'calendar' ? formatDate(selectedDate) : undefined,
            notificationEnabled: notificationEnabled,
        };

        setCustomGoals([...customGoals, newGoal]);
        resetPickers();
    };

    const handleCustomActivityAdd = () => {
        if (!selectedTimeSlot || !customActivityText.trim()) return;

        const timeOfDay = getTimeOfDay(selectedTimeSlot);
        const endTime = calculateEndTime(selectedTimeSlot, duration);

        const newGoal: CustomGoal = {
            id: Date.now().toString(),
            text: customActivityText,
            time: timeOfDay,
            startTime: selectedTimeSlot,
            endTime: endTime,
            color: 'primary',
            daysOfWeek: viewMode === 'default' ? selectedDays : undefined,
            specificDate: viewMode === 'calendar' ? formatDate(selectedDate) : undefined,
            notificationEnabled: notificationEnabled,
        };

        setCustomGoals([...customGoals, newGoal]);
        setCustomActivityText("");
        resetPickers();
    };

    const handleDeleteActivity = () => {
        if (!selectedTimeSlot) return;

        if (schedule.wakeUp === selectedTimeSlot) {
            setSchedule(prev => ({ ...prev, wakeUp: "" }));
        } else if (schedule.sleep === selectedTimeSlot) {
            setSchedule(prev => ({ ...prev, sleep: "" }));
        } else if (schedule.workStart === selectedTimeSlot) {
            setSchedule(prev => ({ ...prev, workStart: "" }));
        } else if (schedule.workEnd === selectedTimeSlot) {
            setSchedule(prev => ({ ...prev, workEnd: "" }));
        } else {
            setCustomGoals(customGoals.filter(g => g.startTime !== selectedTimeSlot));
        }

        resetPickers();
    };

    const handleEditActivity = () => {
        if (selectedTimeSlot) {
            setCustomGoals(customGoals.filter(g => g.startTime !== selectedTimeSlot));
        }

        setShowEditOptions(false);
        setShowActivityPicker(true);
    };

    const resetPickers = () => {
        setShowActivityPicker(false);
        setShowDurationPicker(false);
        setShowDayPicker(false);
        setShowEditOptions(false);
        setSelectedTimeSlot(null);
        setSelectedActivity(null);
        setIsAddingCustom(false);
        setDuration(1);
        setSelectedDays([1, 2, 3, 4, 5]);
        setNotificationEnabled(true);
    };

    const getTimeOfDay = (time: string): "morning" | "afternoon" | "evening" => {
        const hour = parseInt(time.split(':')[0]);
        if (hour < 12) return "morning";
        if (hour < 18) return "afternoon";
        return "evening";
    };

    const handleDeleteGoal = (id: string) => {
        setCustomGoals(customGoals.filter(g => g.id !== id));
    };

    const handleSave = () => {
        onSave(schedule, customGoals);
        onClose();
    };

    const toggleDay = (dayId: number) => {
        if (selectedDays.includes(dayId)) {
            setSelectedDays(selectedDays.filter(d => d !== dayId));
        } else {
            setSelectedDays([...selectedDays, dayId].sort());
        }
    };

    const isTimeInRange = (time: string, startTime: string, endTime: string): boolean => {
        const [h, m] = time.split(':').map(Number);
        const timeValue = h * 60 + m;

        const [sh, sm] = startTime.split(':').map(Number);
        const startValue = sh * 60 + sm;

        const [eh, em] = endTime.split(':').map(Number);
        const endValue = eh * 60 + em;

        return timeValue >= startValue && timeValue < endValue;
    };

    // Calendar Helpers
    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        return { daysInMonth, firstDayOfMonth };
    };

    const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const handleDateClick = (day: number) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        setSelectedDate(newDate);
        setViewMode('calendar');
    };

    const getScheduledActivityAtTime = (time: string) => {
        // Base schedule always applies unless overridden (TODO: Allow override)
        if (schedule.wakeUp === time) return { label: '기상', color: 'yellow', icon: Sun };
        if (schedule.sleep === time) return { label: '취침', color: 'blue', icon: Moon };
        if (schedule.workStart === time) return { label: '업무 시작', color: 'purple', icon: Briefcase };
        if (schedule.workEnd === time) return { label: '업무 종료', color: 'green', icon: Briefcase };

        const targetDateStr = viewMode === 'calendar' ? formatDate(selectedDate) : null;
        const targetDay = viewMode === 'calendar' ? selectedDate.getDay() : null;

        // 1. Priority: Specific Date Goals (Only in Calendar Mode)
        if (viewMode === 'calendar') {
            for (const goal of customGoals) {
                if (!goal.specificDate || goal.specificDate !== targetDateStr) continue;

                if (goal.startTime && goal.endTime) {
                    if (goal.startTime === time) {
                        const ActivityIcon = PRESET_ACTIVITIES.find(a => a.label === goal.text)?.icon || Target;
                        return { label: goal.text, color: goal.color || 'primary', icon: ActivityIcon, isStart: true };
                    }
                    if (isTimeInRange(time, goal.startTime, goal.endTime)) {
                        const ActivityIcon = PRESET_ACTIVITIES.find(a => a.label === goal.text)?.icon || Target;
                        return { label: goal.text, color: goal.color || 'primary', icon: ActivityIcon, isStart: false };
                    }
                } else if (goal.text.startsWith(time)) {
                    return { label: goal.text.split(' - ')[1] || goal.text, color: goal.color || 'primary', icon: Target };
                }
            }
        }

        // 2. Recurring Goals
        for (const goal of customGoals) {
            if (goal.specificDate) continue; // Skip specific date goals

            // In calendar view, check day match. In default view, show all recurring.
            if (viewMode === 'calendar' && goal.daysOfWeek && !goal.daysOfWeek.includes(targetDay!)) continue;

            if (goal.startTime && goal.endTime) {
                if (goal.startTime === time) {
                    const ActivityIcon = PRESET_ACTIVITIES.find(a => a.label === goal.text)?.icon || Target;
                    return { label: goal.text, color: goal.color || 'primary', icon: ActivityIcon, isStart: true };
                }
                if (isTimeInRange(time, goal.startTime, goal.endTime)) {
                    const ActivityIcon = PRESET_ACTIVITIES.find(a => a.label === goal.text)?.icon || Target;
                    return { label: goal.text, color: goal.color || 'primary', icon: ActivityIcon, isStart: false };
                }
            } else if (goal.text.startsWith(time)) {
                return { label: goal.text.split(' - ')[1] || goal.text, color: goal.color || 'primary', icon: Target };
            }
        }

        return null;
    };

    const getColorClasses = (color: string, isStart: boolean = true) => {
        const colors: Record<string, string> = {
            yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            green: 'bg-green-500/20 text-green-400 border-green-500/30',
            red: 'bg-red-500/20 text-red-400 border-red-500/30',
            orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
            pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
            amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
            indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
            primary: 'bg-primary/20 text-primary border-primary/30',
        };

        const baseClass = colors[color] || colors.primary;
        const opacityClass = isStart ? '' : ' opacity-75';

        return baseClass + opacityClass;
    };

    const getDayLabel = (days: number[]) => {
        if (days.length === 7) return '매일';
        if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) return '평일';
        if (days.length === 2 && days.includes(0) && days.includes(6)) return '주말';
        return days.map(d => DAYS_OF_WEEK[d].label).join(', ');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-[5%] -translate-x-1/2 w-full max-w-4xl bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-[90vh] overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-primary" /> 일정 관리
                                </h2>
                                <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                                    <button
                                        onClick={() => {
                                            setViewMode('default');
                                            resetPickers();
                                        }}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            viewMode === 'default'
                                                ? "bg-primary text-white shadow-lg"
                                                : "text-muted-foreground hover:text-white"
                                        )}
                                    >
                                        기본 일정
                                    </button>
                                    <button
                                        onClick={() => {
                                            setViewMode('calendar');
                                            resetPickers();
                                        }}
                                        className={cn(
                                            "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                            viewMode === 'calendar'
                                                ? "bg-primary text-white shadow-lg"
                                                : "text-muted-foreground hover:text-white"
                                        )}
                                    >
                                        캘린더
                                    </button>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-12 gap-4">
                                {/* Left: Timeline */}
                                <div className="col-span-7 space-y-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                            {viewMode === 'calendar'
                                                ? `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 일정`
                                                : "시간대별 일정표"}
                                        </h3>
                                        <p className="text-xs text-muted-foreground">클릭하여 일정 추가/수정</p>
                                    </div>

                                    <div className="space-y-1 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                        {timeSlots.map((time) => {
                                            const activity = getScheduledActivityAtTime(time);
                                            const isHourMark = time.endsWith(':00');

                                            return (
                                                <motion.div
                                                    key={time}
                                                    whileHover={{ scale: 1.01 }}
                                                    onClick={() => handleTimeSlotClick(time)}
                                                    className={cn(
                                                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border",
                                                        activity
                                                            ? getColorClasses(activity.color, activity.isStart !== false) + " border"
                                                            : "bg-white/5 border-white/5 hover:bg-white/10",
                                                        isHourMark && "border-l-2 border-l-primary/50"
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "font-mono text-sm shrink-0 w-14",
                                                        isHourMark ? "font-bold text-white" : "text-muted-foreground"
                                                    )}>
                                                        {time}
                                                    </span>

                                                    {activity ? (
                                                        <div className="flex items-center gap-2 flex-1">
                                                            {activity.isStart !== false && <activity.icon className="w-4 h-4" />}
                                                            <span className="text-sm font-medium">
                                                                {activity.isStart === false ? '⋮' : activity.label}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex-1 h-6 border border-dashed border-white/10 rounded flex items-center justify-center">
                                                            <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                                        </div>
                                                    )}
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Right: Activity Picker & Options */}
                                <div className="col-span-5 space-y-4">
                                    {/* Calendar View Grid */}
                                    {viewMode === 'calendar' && !selectedTimeSlot && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-white/5 border border-white/10 rounded-xl p-4"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                                    <CalendarIcon className="w-4 h-4 text-primary" />
                                                    {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                                                </h4>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handlePrevMonth}>
                                                        <ChevronLeft className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleNextMonth}>
                                                        <ChevronRight className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-7 gap-1 mb-2">
                                                {['일', '월', '화', '수', '목', '금', '토'].map(day => (
                                                    <div key={day} className="text-center text-xs text-muted-foreground py-1">
                                                        {day}
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="grid grid-cols-7 gap-1">
                                                {Array.from({ length: getDaysInMonth(currentMonth).firstDayOfMonth }).map((_, i) => (
                                                    <div key={`empty-${i}`} className="aspect-square" />
                                                ))}
                                                {Array.from({ length: getDaysInMonth(currentMonth).daysInMonth }).map((_, i) => {
                                                    const day = i + 1;
                                                    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                                                    const isSelected = isSameDay(date, selectedDate);
                                                    const isToday = isSameDay(date, new Date());

                                                    return (
                                                        <button
                                                            key={day}
                                                            onClick={() => handleDateClick(day)}
                                                            className={cn(
                                                                "aspect-square rounded-lg text-sm flex items-center justify-center transition-all relative",
                                                                isSelected
                                                                    ? "bg-primary text-white font-bold shadow-lg shadow-primary/25"
                                                                    : "hover:bg-white/10 text-muted-foreground hover:text-white",
                                                                isToday && !isSelected && "border border-primary/50 text-primary"
                                                            )}
                                                        >
                                                            {day}
                                                            {/* Dot for events? (Optional) */}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                    {/* Edit/Delete Options */}
                                    {showEditOptions && selectedTimeSlot && (
                                        <motion.div
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="bg-white/5 border border-white/10 rounded-xl p-4"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                                    <Edit3 className="w-4 h-4 text-primary" />
                                                    {selectedTimeSlot} 일정 관리
                                                </h4>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={resetPickers}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            <div className="space-y-2">
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-start"
                                                    onClick={handleEditActivity}
                                                >
                                                    <Edit3 className="w-4 h-4 mr-2" />
                                                    수정하기
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="w-full justify-start text-red-400 hover:text-red-400 hover:bg-red-500/10 border-red-500/30"
                                                    onClick={handleDeleteActivity}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    삭제하기
                                                </Button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Day Picker */}
                                    {showDayPicker && selectedActivity && (
                                        <motion.div
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="bg-white/5 border border-white/10 rounded-xl p-4"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                                    <CalendarIcon className="w-4 h-4 text-primary" />
                                                    요일 선택
                                                </h4>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={resetPickers}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="grid grid-cols-7 gap-2">
                                                    {DAYS_OF_WEEK.map((day) => (
                                                        <motion.button
                                                            key={day.id}
                                                            whileHover={{ scale: 1.05 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => toggleDay(day.id)}
                                                            className={cn(
                                                                "aspect-square rounded-lg border-2 flex items-center justify-center font-semibold text-sm transition-all",
                                                                selectedDays.includes(day.id)
                                                                    ? "bg-primary border-primary text-white"
                                                                    : "bg-white/5 border-white/10 text-muted-foreground hover:border-primary/50"
                                                            )}
                                                        >
                                                            {day.label}
                                                        </motion.button>
                                                    ))}
                                                </div>

                                                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                                                    <span className="text-sm text-muted-foreground">알림 받기</span>
                                                    <button
                                                        onClick={() => setNotificationEnabled(!notificationEnabled)}
                                                        className={cn(
                                                            "w-12 h-6 rounded-full transition-all relative",
                                                            notificationEnabled ? "bg-primary" : "bg-white/10"
                                                        )}
                                                    >
                                                        <motion.div
                                                            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-lg"
                                                            animate={{ left: notificationEnabled ? '26px' : '2px' }}
                                                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                        />
                                                    </button>
                                                </div>

                                                <Button
                                                    className="w-full"
                                                    onClick={handleDayPickerConfirm}
                                                    disabled={selectedDays.length === 0}
                                                >
                                                    <Check className="w-4 h-4 mr-2" />
                                                    확인
                                                </Button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Duration Picker */}
                                    {showDurationPicker && selectedActivity && !showDayPicker && (
                                        <motion.div
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="bg-white/5 border border-white/10 rounded-xl p-4"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-primary" />
                                                    {selectedActivity.label} 시간 설정
                                                </h4>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={resetPickers}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-sm text-muted-foreground mb-2 block">
                                                        몇 시간 하시겠습니까?
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="icon"
                                                            variant="outline"
                                                            onClick={() => setDuration(Math.max(0.5, duration - 0.5))}
                                                            disabled={duration <= 0.5}
                                                        >
                                                            -
                                                        </Button>
                                                        <div className="flex-1 text-center">
                                                            <span className="text-2xl font-bold">{duration}</span>
                                                            <span className="text-sm text-muted-foreground ml-1">시간</span>
                                                        </div>
                                                        <Button
                                                            size="icon"
                                                            variant="outline"
                                                            onClick={() => setDuration(Math.min(12, duration + 0.5))}
                                                            disabled={duration >= 12}
                                                        >
                                                            +
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="bg-white/5 rounded-lg p-3 text-sm">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-muted-foreground">시작 시간:</span>
                                                        <span className="font-mono font-semibold">{selectedTimeSlot}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">종료 시간:</span>
                                                        <span className="font-mono font-semibold">
                                                            {selectedTimeSlot && calculateEndTime(selectedTimeSlot, duration)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <Button
                                                    className="w-full"
                                                    onClick={handleDurationConfirm}
                                                >
                                                    다음 단계
                                                </Button>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Activity Picker */}
                                    {showActivityPicker && selectedTimeSlot && !showDurationPicker && !showDayPicker && (
                                        <motion.div
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="bg-white/5 border border-white/10 rounded-xl p-4"
                                        >
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                                    <Target className="w-4 h-4 text-primary" />
                                                    {selectedTimeSlot} 일정 선택
                                                </h4>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={resetPickers}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            {!isAddingCustom ? (
                                                <>
                                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                                        {PRESET_ACTIVITIES.map((activity) => {
                                                            const ActivityIcon = activity.icon;
                                                            return (
                                                                <motion.button
                                                                    key={activity.id}
                                                                    whileHover={{ scale: 1.05 }}
                                                                    whileTap={{ scale: 0.95 }}
                                                                    onClick={() => handleActivitySelect(activity.id)}
                                                                    className={cn(
                                                                        "p-3 rounded-lg border flex flex-col items-center gap-2 transition-all",
                                                                        getColorClasses(activity.color)
                                                                    )}
                                                                >
                                                                    <ActivityIcon className="w-5 h-5" />
                                                                    <span className="text-xs font-medium">{activity.label}</span>
                                                                </motion.button>
                                                            );
                                                        })}
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setIsAddingCustom(true)}
                                                        className="w-full border-dashed border-primary/30 text-primary hover:bg-primary/10"
                                                    >
                                                        <Edit3 className="w-3 h-3 mr-2" />
                                                        커스텀 일정 입력
                                                    </Button>
                                                </>
                                            ) : (
                                                <div className="space-y-3">
                                                    <Input
                                                        placeholder="일정 이름 입력..."
                                                        value={customActivityText}
                                                        onChange={(e) => setCustomActivityText(e.target.value)}
                                                        className="bg-white/5 border-white/10"
                                                        autoFocus
                                                    />

                                                    <div>
                                                        <label className="text-sm text-muted-foreground mb-2 block">
                                                            몇 시간 하시겠습니까?
                                                        </label>
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                size="icon"
                                                                variant="outline"
                                                                onClick={() => setDuration(Math.max(0.5, duration - 0.5))}
                                                                disabled={duration <= 0.5}
                                                            >
                                                                -
                                                            </Button>
                                                            <div className="flex-1 text-center">
                                                                <span className="text-xl font-bold">{duration}</span>
                                                                <span className="text-xs text-muted-foreground ml-1">시간</span>
                                                            </div>
                                                            <Button
                                                                size="icon"
                                                                variant="outline"
                                                                onClick={() => setDuration(Math.min(12, duration + 0.5))}
                                                                disabled={duration >= 12}
                                                            >
                                                                +
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-7 gap-1">
                                                        {DAYS_OF_WEEK.map((day) => (
                                                            <button
                                                                key={day.id}
                                                                onClick={() => toggleDay(day.id)}
                                                                className={cn(
                                                                    "aspect-square rounded border text-xs font-semibold transition-all",
                                                                    selectedDays.includes(day.id)
                                                                        ? "bg-primary border-primary text-white"
                                                                        : "bg-white/5 border-white/10 text-muted-foreground"
                                                                )}
                                                            >
                                                                {day.label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={handleCustomActivityAdd}
                                                            className="flex-1"
                                                            disabled={!customActivityText.trim() || selectedDays.length === 0}
                                                        >
                                                            <Check className="w-3 h-3 mr-2" />
                                                            추가
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setIsAddingCustom(false);
                                                                setCustomActivityText("");
                                                                setDuration(1);
                                                            }}
                                                        >
                                                            취소
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* Current Schedule Summary */}
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            설정된 일정
                                        </h4>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground flex items-center gap-2">
                                                    <Sun className="w-3 h-3 text-yellow-400" />
                                                    기상
                                                </span>
                                                <span className="font-mono font-semibold">{schedule.wakeUp}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground flex items-center gap-2">
                                                    <Briefcase className="w-3 h-3 text-purple-400" />
                                                    업무 시작
                                                </span>
                                                <span className="font-mono font-semibold">{schedule.workStart}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground flex items-center gap-2">
                                                    <Briefcase className="w-3 h-3 text-green-400" />
                                                    업무 종료
                                                </span>
                                                <span className="font-mono font-semibold">{schedule.workEnd}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground flex items-center gap-2">
                                                    <Moon className="w-3 h-3 text-blue-400" />
                                                    취침
                                                </span>
                                                <span className="font-mono font-semibold">{schedule.sleep}</span>
                                            </div>
                                        </div>

                                        {customGoals.length > 0 && (
                                            <>
                                                <div className="border-t border-white/10 my-4" />
                                                <h5 className="text-xs font-semibold text-muted-foreground mb-2">추가 일정</h5>
                                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                                    {customGoals.map((goal) => {
                                                        const activityColor = goal.color || 'primary';
                                                        return (
                                                            <div
                                                                key={goal.id}
                                                                className={cn(
                                                                    "flex items-center justify-between p-2 rounded-lg border group",
                                                                    getColorClasses(activityColor)
                                                                )}
                                                            >
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-semibold">{goal.text}</span>
                                                                        {goal.notificationEnabled && (
                                                                            <span className="text-[8px] px-1 py-0.5 rounded bg-primary/20 text-primary">알림</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-muted-foreground">
                                                                        {goal.startTime} - {goal.endTime} | {getDayLabel(goal.daysOfWeek || [])}
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteGoal(goal.id)}
                                                                    className="text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end gap-3 p-6 border-t border-white/10 shrink-0">
                            <Button variant="ghost" onClick={onClose}>취소</Button>
                            <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
                                <Check className="w-4 h-4 mr-2" />
                                저장하기
                            </Button>
                        </div>
                    </motion.div>

                    <style jsx global>{`
                        .custom-scrollbar::-webkit-scrollbar {
                            width: 6px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-track {
                            background: rgba(255, 255, 255, 0.05);
                            border-radius: 3px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                            background: rgba(255, 255, 255, 0.2);
                            border-radius: 3px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                            background: rgba(255, 255, 255, 0.3);
                        }
                    `}</style>
                </>
            )}
        </AnimatePresence>
    );
}

function CheckCircle({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}
