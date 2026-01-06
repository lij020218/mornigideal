"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Clock, Sun, Moon, Coffee, Briefcase, Dumbbell, BookOpen, Target, Edit3, Check, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Heart, Gamepad2, Users } from "lucide-react";
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
    memo?: string; // Memo for the activity
}

interface SchedulePopupProps {
    isOpen: boolean;
    onClose: () => void;
    initialSchedule?: Schedule;
    initialCustomGoals?: CustomGoal[];
    onSave: (schedule: Schedule, customGoals: CustomGoal[]) => void;
}

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

export function SchedulePopup({ isOpen, onClose, initialSchedule, initialCustomGoals, onSave }: SchedulePopupProps) {
    const [schedule, setSchedule] = useState<Schedule>({
        wakeUp: "07:00",
        workStart: "09:00",
        workEnd: "18:00",
        sleep: "23:00",
    });
    const [customGoals, setCustomGoals] = useState<CustomGoal[]>([]);

    // State for View Mode
    // 'calendar-full': The initial large calendar view
    // 'daily-detail': The specific day timeline view
    // 'weekly': The weekly recurring schedule view
    const [viewMode, setViewMode] = useState<'calendar-full' | 'daily-detail' | 'weekly'>('calendar-full');

    // For weekly view
    const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1); // Monday

    // For calendar view
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    // const [showTimeTable, setShowTimeTable] = useState<boolean>(false); // Removed

    // Adding/editing state
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
    const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
    const [showActivityPicker, setShowActivityPicker] = useState(false);
    const [showDurationPicker, setShowDurationPicker] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<typeof PRESET_ACTIVITIES[0] | null>(null);
    const [duration, setDuration] = useState<number>(1);
    const [customActivityText, setCustomActivityText] = useState("");
    const [isAddingCustom, setIsAddingCustom] = useState(false);
    const [notificationEnabled, setNotificationEnabled] = useState<boolean>(true);
    const [showEditOptions, setShowEditOptions] = useState(false);
    const [activityMemo, setActivityMemo] = useState<string>("");

    // Time slots (30-minute intervals)
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

            // Check for pending calendar event from email
            const pendingEvent = localStorage.getItem('pendingCalendarEvent');
            if (pendingEvent) {
                try {
                    const eventData = JSON.parse(pendingEvent);
                    console.log('[SchedulePopup] Adding pending calendar event:', eventData);

                    // Add to customGoals
                    const newGoal: CustomGoal = {
                        id: Date.now().toString(),
                        text: eventData.text,
                        time: "morning",
                        startTime: eventData.startTime,
                        endTime: eventData.endTime || calculateEndTime(eventData.startTime, 1),
                        daysOfWeek: undefined,
                        specificDate: eventData.specificDate,
                        memo: eventData.location ? `장소: ${eventData.location}` : '',
                        notificationEnabled: true
                    };

                    setCustomGoals(prev => [...prev, newGoal]);

                    // Switch to daily view for that date
                    if (eventData.specificDate) {
                        const date = new Date(eventData.specificDate);
                        setSelectedDate(date);
                        setCurrentMonth(date);
                        setViewMode('daily-detail');
                    }

                    // Clear pending event
                    localStorage.removeItem('pendingCalendarEvent');
                } catch (error) {
                    console.error('[SchedulePopup] Error parsing pending calendar event:', error);
                    localStorage.removeItem('pendingCalendarEvent');
                }
            }
        }
    }, [isOpen, initialSchedule, initialCustomGoals]);

    const resetPickers = () => {
        setShowActivityPicker(false);
        setShowDurationPicker(false);
        setShowEditOptions(false);
        setSelectedTimeSlot(null);
        setSelectedActivity(null);
        setIsAddingCustom(false);
        setDuration(1);
        setNotificationEnabled(true);
        setCustomActivityText("");
    };

    const handleTimeSlotClick = (time: string) => {
        const existingGoal = getGoalAtTime(time);

        if (existingGoal) {
            setSelectedTimeSlot(time);
            setSelectedActivityId(existingGoal.id);
            setShowEditOptions(true);
            setShowActivityPicker(false);
            setShowDurationPicker(false);
            // Load existing memo
            setActivityMemo(existingGoal.memo || "");
        } else {
            setSelectedTimeSlot(time);
            setSelectedActivityId(null);
            setShowActivityPicker(true);
            setShowEditOptions(false);
            setShowDurationPicker(false);
            setIsAddingCustom(false);
            setActivityMemo("");
        }
    };

    const handleActivitySelect = (activityId: string) => {
        if (!selectedTimeSlot) return;

        const activity = PRESET_ACTIVITIES.find(a => a.id === activityId);
        if (!activity) return;

        setSelectedActivity(activity);
        setShowActivityPicker(false);
        setShowDurationPicker(true);

        if (!activity.isCore && activity.needsDuration) {
            setDuration(1);
        }
    };

    const handleRecurringConfirm = (isRecurring: boolean, withDuration: boolean = false) => {
        if (!selectedTimeSlot || !selectedActivity) return;

        // For activities with duration, calculate endTime. For core activities, set minimal endTime.
        const endTime = withDuration
            ? calculateEndTime(selectedTimeSlot, duration)
            : calculateEndTime(selectedTimeSlot, 0.5); // 30 minutes default for core activities
        const timeOfDay = getTimeOfDay(selectedTimeSlot);

        if (viewMode === 'weekly' || isRecurring) {
            // Recurring: Add template with daysOfWeek only (rendering will apply to all matching days)
            const templateGoal: CustomGoal = {
                id: Date.now().toString(),
                text: selectedActivity.label,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: selectedActivity.color,
                daysOfWeek: [selectedDayOfWeek],
                notificationEnabled: notificationEnabled,
            };

            setCustomGoals([...customGoals, templateGoal]);
        } else {
            // One-time: Add for specific date only
            let targetDate: Date;
            if (viewMode === 'daily-detail' && selectedDate) {
                targetDate = selectedDate;
            } else {
                // Fallback for other cases, though daily-detail should be the primary path here
                const today = new Date();
                targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            }

            const newGoal: CustomGoal = {
                id: Date.now().toString(),
                text: selectedActivity.label,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: selectedActivity.color,
                specificDate: formatDate(targetDate),
                notificationEnabled: notificationEnabled,
            };
            setCustomGoals([...customGoals, newGoal]);
        }

        resetPickers();
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

        const endTime = calculateEndTime(selectedTimeSlot, duration);
        const timeOfDay = getTimeOfDay(selectedTimeSlot);

        if (viewMode === 'weekly') {
            // Add as recurring goal for this day of week
            const newGoal: CustomGoal = {
                id: Date.now().toString(),
                text: selectedActivity.label,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: selectedActivity.color,
                daysOfWeek: [selectedDayOfWeek],
                notificationEnabled: notificationEnabled,
            };
            setCustomGoals([...customGoals, newGoal]);
        } else if (viewMode === 'daily-detail' && selectedDate) {
            // Add as one-time goal for specific date
            const newGoal: CustomGoal = {
                id: Date.now().toString(),
                text: selectedActivity.label,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: selectedActivity.color,
                specificDate: formatDate(selectedDate),
                notificationEnabled: notificationEnabled,
            };
            setCustomGoals([...customGoals, newGoal]);
        }

        resetPickers();
    };

    const handleCustomActivityAdd = () => {
        if (!selectedTimeSlot || !customActivityText.trim()) return;

        const timeOfDay = getTimeOfDay(selectedTimeSlot);
        const endTime = calculateEndTime(selectedTimeSlot, duration);

        if (viewMode === 'weekly') {
            const newGoal: CustomGoal = {
                id: Date.now().toString(),
                text: customActivityText,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: 'primary',
                daysOfWeek: [selectedDayOfWeek],
                notificationEnabled: notificationEnabled,
            };
            setCustomGoals([...customGoals, newGoal]);
        } else if (viewMode === 'daily-detail' && selectedDate) {
            const newGoal: CustomGoal = {
                id: Date.now().toString(),
                text: customActivityText,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: 'primary',
                specificDate: formatDate(selectedDate),
                notificationEnabled: notificationEnabled,
            };
            setCustomGoals([...customGoals, newGoal]);
        }

        setCustomActivityText("");
        resetPickers();
    };

    const handleDeleteActivity = () => {
        if (!selectedTimeSlot) return;

        // Delete activity from customGoals (all activities are now stored there)
        setCustomGoals(customGoals.filter(g => {
            if (viewMode === 'weekly') {
                // When deleting from weekly view, remove the entire recurring goal (all days)
                // This ensures it's deleted from both weekly view AND calendar view
                return !(g.startTime === selectedTimeSlot && g.daysOfWeek?.length && g.daysOfWeek.includes(selectedDayOfWeek));
            } else if ((viewMode === 'calendar-full' || viewMode === 'daily-detail') && selectedDate) {
                // When deleting from calendar view or daily detail view
                const isSpecificDateMatch = g.specificDate === formatDate(selectedDate);
                const isRecurringMatch = g.daysOfWeek?.includes(selectedDate.getDay()) && !g.specificDate;

                return !(g.startTime === selectedTimeSlot && (isSpecificDateMatch || isRecurringMatch));
            }
            return true;
        }));

        resetPickers();
    };

    const handleEditActivity = () => {
        handleDeleteActivity();
        setShowEditOptions(false);
        setShowActivityPicker(true);
    };

    const handleMemoUpdate = () => {
        if (!selectedActivityId) return;

        // Update memo for the specific activity by ID
        setCustomGoals(customGoals.map(g => {
            if (g.id === selectedActivityId) {
                return { ...g, memo: activityMemo };
            }
            return g;
        }));
    };

    const getTimeOfDay = (time: string): "morning" | "afternoon" | "evening" => {
        const hour = parseInt(time.split(':')[0]);
        if (hour < 12) return "morning";
        if (hour < 18) return "afternoon";
        return "evening";
    };

    const isTimeInRange = (time: string, startTime: string, endTime: string): boolean => {
        const [h, m] = time.split(':').map(Number);
        const timeValue = h * 60 + m;

        const [sh, sm] = startTime.split(':').map(Number);
        const startValue = sh * 60 + sm;

        const [eh, em] = endTime.split(':').map(Number);
        const endValue = eh * 60 + em;

        // Handle overnight schedules (e.g., 21:00 - 01:00)
        if (endValue <= startValue) {
            // Schedule crosses midnight
            return timeValue >= startValue || timeValue < endValue;
        }

        return timeValue >= startValue && timeValue < endValue;
    };

    const formatDate = (date: Date) => {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 for Sunday, 1 for Monday, etc.
        return { daysInMonth, firstDayOfMonth };
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

    const handleDateSelect = (day: number) => {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        setSelectedDate(date);
        setViewMode('daily-detail');
        resetPickers();
    };

    const handleBackToCalendar = () => {
        setViewMode('calendar-full');
        setSelectedDate(null);
        resetPickers();
    };

    // Get the actual goal object at a specific time
    const getGoalAtTime = (time: string): CustomGoal | null => {
        for (const goal of customGoals) {
            // Weekly view: show goals for selected day of week
            if (viewMode === 'weekly' && goal.daysOfWeek?.includes(selectedDayOfWeek)) {
                if (goal.startTime === time) {
                    return goal;
                }
            }

            // Daily Detail view: show goals for selected date (both specific date and recurring)
            if ((viewMode === 'calendar-full' || viewMode === 'daily-detail') && selectedDate) {
                const isSpecificDate = goal.specificDate === formatDate(selectedDate);
                const isRecurringOnThisDay = goal.daysOfWeek?.includes(selectedDate.getDay()) && !goal.specificDate;

                if ((isSpecificDate || isRecurringOnThisDay) && goal.startTime === time) {
                    return goal;
                }
            }
        }
        return null;
    };

    const getScheduledActivityAtTime = (time: string) => {
        // Custom goals (including core activities now stored as customGoals)
        for (const goal of customGoals) {
            // Weekly view: show goals for selected day of week
            if (viewMode === 'weekly' && goal.daysOfWeek?.includes(selectedDayOfWeek)) {
                if (goal.startTime && goal.endTime) {
                    if (goal.startTime === time) {
                        const preset = PRESET_ACTIVITIES.find(a => a.label === goal.text);
                        const ActivityIcon = preset?.icon || Target;
                        return { label: goal.text, color: goal.color || 'primary', icon: ActivityIcon, isStart: true, isCore: preset?.isCore, memo: goal.memo };
                    }
                    if (isTimeInRange(time, goal.startTime, goal.endTime)) {
                        const preset = PRESET_ACTIVITIES.find(a => a.label === goal.text);
                        const ActivityIcon = preset?.icon || Target;
                        return { label: goal.text, color: goal.color || 'primary', icon: ActivityIcon, isStart: false, isCore: preset?.isCore, memo: goal.memo };
                    }
                }
            }

            // Daily Detail view: show goals for selected date (both specific date and recurring)
            if (viewMode === 'daily-detail' && selectedDate) {
                // Check if this goal applies to the selected date
                const isSpecificDate = goal.specificDate === formatDate(selectedDate);
                const isRecurringOnThisDay = goal.daysOfWeek?.includes(selectedDate.getDay());

                if (isSpecificDate || isRecurringOnThisDay) {
                    if (goal.startTime && goal.endTime) {
                        if (goal.startTime === time) {
                            const preset = PRESET_ACTIVITIES.find(a => a.label === goal.text);
                            const ActivityIcon = preset?.icon || Target;
                            return { label: goal.text, color: goal.color || 'primary', icon: ActivityIcon, isStart: true, isCore: preset?.isCore, memo: goal.memo };
                        }
                        if (isTimeInRange(time, goal.startTime, goal.endTime)) {
                            const preset = PRESET_ACTIVITIES.find(a => a.label === goal.text);
                            const ActivityIcon = preset?.icon || Target;
                            return { label: goal.text, color: goal.color || 'primary', icon: ActivityIcon, isStart: false, isCore: preset?.isCore, memo: goal.memo };
                        }
                    } else if (goal.startTime === time) {
                        const preset = PRESET_ACTIVITIES.find(a => a.label === goal.text);
                        return { label: goal.text, color: goal.color || 'primary', icon: Target, isCore: preset?.isCore, memo: goal.memo };
                    }
                }
            }
        }

        return null;
    };

    const getColorClasses = (color: string, isStart: boolean = true) => {
        const colors: Record<string, string> = {
            yellow: 'bg-yellow-50 text-yellow-900 border-yellow-200',
            blue: 'bg-blue-50 text-blue-900 border-blue-200',
            purple: 'bg-purple-50 text-purple-900 border-purple-200',
            violet: 'bg-violet-50 text-violet-900 border-violet-200',
            green: 'bg-green-50 text-green-900 border-green-200',
            emerald: 'bg-emerald-50 text-emerald-900 border-emerald-200',
            red: 'bg-red-50 text-red-900 border-red-200',
            rose: 'bg-rose-50 text-rose-900 border-rose-200',
            orange: 'bg-orange-50 text-orange-900 border-orange-200',
            pink: 'bg-pink-50 text-pink-900 border-pink-200',
            amber: 'bg-amber-50 text-amber-900 border-amber-200',
            cyan: 'bg-cyan-50 text-cyan-900 border-cyan-200',
            sky: 'bg-sky-50 text-sky-900 border-sky-200',
            teal: 'bg-teal-50 text-teal-900 border-teal-200',
            indigo: 'bg-indigo-50 text-indigo-900 border-indigo-200',
            primary: 'bg-primary/10 text-foreground border-primary/20',
        };

        const baseClass = colors[color] || colors.primary;
        const opacityClass = isStart ? '' : ' opacity-75';

        return baseClass + opacityClass;
    };

    const handleSave = () => {
        onSave(schedule, customGoals);
        onClose();
    };

    const renderActivityTools = () => (
        <>
            {showEditOptions && selectedTimeSlot && (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-3"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Edit3 className="w-4 h-4 text-primary" />
                            {selectedTimeSlot} 일정
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

                    <div className="w-full space-y-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">메모</label>
                            <textarea
                                value={activityMemo}
                                onChange={(e) => setActivityMemo(e.target.value)}
                                onBlur={handleMemoUpdate}
                                placeholder="이 일정에 대한 메모를 입력하세요..."
                                className="w-full min-h-[80px] px-3 py-2 bg-white border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                            />
                            <p className="text-xs text-muted-foreground">메모는 자동으로 저장됩니다</p>
                        </div>
                    </div>

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
                </motion.div>
            )}

            {showActivityPicker && selectedTimeSlot && !showDurationPicker && (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-3"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Target className="w-4 h-4 text-primary" />
                            {selectedTimeSlot} 일정 추가
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
                            <div className="grid grid-cols-2 gap-2">
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
                                            <span className="text-xs font-medium text-center leading-tight">{activity.label}</span>
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
                                커스텀 일정
                            </Button>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <Input
                                placeholder="일정 이름 입력..."
                                value={customActivityText}
                                onChange={(e) => setCustomActivityText(e.target.value)}
                                className="bg-white border-border"
                                autoFocus
                            />

                            <div>
                                <label className="text-sm text-muted-foreground mb-2 block">
                                    소요 시간
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

                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={handleCustomActivityAdd}
                                    className="flex-1"
                                    disabled={!customActivityText.trim()}
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
                                    }}
                                >
                                    취소
                                </Button>
                            </div>
                        </div>
                    )}
                </motion.div>
            )}

            {showDurationPicker && selectedActivity && (
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Clock className="w-4 h-4 text-primary" />
                            {selectedActivity.label} 설정
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

                    {/* Duration setting for non-core activities */}
                    {!selectedActivity.isCore && selectedActivity.needsDuration && (
                        <div>
                            <label className="text-sm text-muted-foreground mb-2 block">
                                소요 시간
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

                            <div className="bg-white/5 rounded-lg p-3 text-sm mt-3">
                                <div className="flex justify-between mb-1">
                                    <span className="text-muted-foreground">시작:</span>
                                    <span className="font-mono font-semibold">{selectedTimeSlot}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">종료:</span>
                                    <span className="font-mono font-semibold">
                                        {selectedTimeSlot && calculateEndTime(selectedTimeSlot, duration)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recurring question - only show for daily-detail view */}
                    {viewMode === 'daily-detail' ? (
                        <>
                            <p className="text-sm text-muted-foreground">
                                매주 같은 요일 {selectedTimeSlot}에 {selectedActivity.label}하시나요?
                            </p>
                            <div className="flex flex-col gap-2">
                                <Button
                                    onClick={() => handleRecurringConfirm(true, selectedActivity.needsDuration)}
                                    className="w-full"
                                >
                                    네, 매주 반복됩니다
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => handleRecurringConfirm(false, selectedActivity.needsDuration)}
                                    className="w-full"
                                >
                                    아니요, 이날만 해당됩니다
                                </Button>
                            </div>
                        </>
                    ) : (
                        /* Weekly mode - automatically save as recurring */
                        <Button
                            onClick={() => handleRecurringConfirm(true, selectedActivity.needsDuration)}
                            className="w-full"
                        >
                            일정 추가하기
                        </Button>
                    )}
                </motion.div>
            )}

            {!showActivityPicker && !showDurationPicker && !showEditOptions && (
                <div className="text-center text-sm text-muted-foreground py-12">
                    시간대를 클릭하여<br />일정을 추가하세요
                </div>
            )}
        </>
    );

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
                        className="fixed left-1/2 top-[5%] -translate-x-1/2 w-full max-w-5xl bg-white border border-border rounded-2xl shadow-2xl z-50 h-[85vh] overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-6 border-b border-border shrink-0 bg-white">
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-primary" /> 일정 관리
                                </h2>

                                {/* View Switcher */}
                                <div className="flex bg-muted rounded-lg p-1 border border-border">
                                    <button
                                        onClick={() => setViewMode('calendar-full')}
                                        className={cn(
                                            "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                            (viewMode === 'calendar-full' || viewMode === 'daily-detail')
                                                ? "bg-primary text-white shadow-lg"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        캘린더
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (viewMode !== 'weekly') {
                                                setViewMode('weekly');
                                                resetPickers();
                                            }
                                        }}
                                        className={cn(
                                            "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                            viewMode === 'weekly'
                                                ? "bg-primary text-white shadow-lg"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        주간 시간표
                                    </button>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* CONTENT AREA */}
                        <div className="flex-1 overflow-hidden relative">
                            {/* MODE 1: FULL CALENDAR */}
                            {viewMode === 'calendar-full' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-6 h-full flex flex-col"
                                >
                                    {/* Calendar Header */}
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-2xl font-bold">
                                            {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                                        </h3>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                                                <ChevronLeft className="w-4 h-4 mr-1" /> 이전 달
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={handleNextMonth}>
                                                다음 달 <ChevronRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Days Header */}
                                    <div className="grid grid-cols-7 gap-4 mb-2 text-center">
                                        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                                            <div key={d} className={cn("text-sm font-medium text-muted-foreground py-2", i === 0 && "text-red-500", i === 6 && "text-blue-500")}>
                                                {d}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Calendar Grid - Scrollable Container */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                                        <div className="grid grid-cols-7 gap-4">
                                            {/* Empty cells for start of month */}
                                            {Array.from({ length: getDaysInMonth(currentMonth).firstDayOfMonth }).map((_, i) => (
                                                <div key={`empty-${i}`} className="bg-transparent" />
                                            ))}

                                            {/* Days */}
                                            {Array.from({ length: getDaysInMonth(currentMonth).daysInMonth }).map((_, i) => {
                                                const day = i + 1;
                                                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                                                const isToday = isSameDay(date, new Date());

                                                // Check if has custom goals (use current state, not initial)
                                                const hasGoals = customGoals?.some(g => {
                                                    if (g.specificDate) return g.specificDate === formatDate(date);
                                                    if (g.daysOfWeek && g.daysOfWeek.includes(date.getDay()) && !g.specificDate) return true;
                                                    return false;
                                                });

                                                return (
                                                    <motion.button
                                                        key={day}
                                                        style={{ aspectRatio: '1/1' }}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => handleDateSelect(day)}
                                                        className={cn(
                                                            "relative rounded-2xl border p-3 flex flex-col items-start justify-between transition-all group",
                                                            isToday
                                                                ? "bg-primary/10 border-primary text-foreground shadow-sm"
                                                                : "bg-white border-border hover:border-primary/50 hover:shadow-sm text-foreground"
                                                        )}
                                                    >
                                                        <div className="flex justify-between items-start w-full">
                                                            <span className={cn(
                                                                "text-2xl font-light tracking-tight",
                                                                isToday && "text-primary font-bold"
                                                            )}>{day}</span>

                                                            {isToday && (
                                                                <span className="text-[10px] font-medium bg-primary text-white px-2 py-0.5 rounded-full">
                                                                    TODAY
                                                                </span>
                                                            )}
                                                        </div>

                                                        {hasGoals && (
                                                            <div className="flex gap-1.5 mt-auto">
                                                                <div className="w-2 h-2 rounded-full bg-primary shadow-sm" />
                                                            </div>
                                                        )}

                                                        <div className="absolute inset-0 rounded-2xl ring-1 ring-primary/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* MODE 2: DAILY DETAIL (Same as original right side but expanded) */}
                            {viewMode === 'daily-detail' && (
                                <div className="flex h-full">
                                    {/* Sidebar: Mini Calendar & Back Button */}
                                    <div className="w-64 border-r border-border p-4 bg-muted flex flex-col">
                                        <Button
                                            variant="outline"
                                            onClick={handleBackToCalendar}
                                            className="mb-6 w-full flex items-center gap-2"
                                        >
                                            <ChevronLeft className="w-4 h-4" /> 캘린더로 돌아가기
                                        </Button>

                                        <div className="mb-4">
                                            <h3 className="text-lg font-bold text-foreground">
                                                {selectedDate?.getMonth()! + 1}월 {selectedDate?.getDate()}일
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {DAYS_OF_WEEK.find(d => d.id === selectedDate?.getDay())?.fullLabel}
                                            </p>
                                        </div>

                                        {/* Mini Calendar for context (optional, or just reuse prev/next day nav) */}
                                        <div className="mt-auto pt-4 border-t border-border">
                                            <p className="text-xs text-muted-foreground text-center">
                                                시간대를 클릭하여<br />일정을 추가하거나 수정하세요.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Main Timeline */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white">
                                        <div className="space-y-1">
                                            {timeSlots.map((time) => {
                                                const activity = getScheduledActivityAtTime(time);
                                                const isHourMark = time.endsWith(':00');

                                                return (
                                                    <motion.div
                                                        key={time}
                                                        whileHover={{ scale: 1.005 }}
                                                        onClick={() => handleTimeSlotClick(time)}
                                                        className={cn(
                                                            "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border",
                                                            activity
                                                                ? getColorClasses(activity.color, activity.isStart !== false) + " border"
                                                                : "bg-white border-border hover:bg-muted hover:border-primary/30",
                                                            isHourMark && "border-l-2 border-l-primary/50"
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "font-mono text-sm shrink-0 w-14",
                                                            isHourMark ? "font-bold text-foreground" : "text-muted-foreground"
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
                                                            <div className="flex-1 h-6 border border-dashed border-border rounded flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                                <Plus className="w-3 h-3 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Right Sidebar: Tools (Reused) */}
                                    <div className="w-80 border-l border-border p-4 bg-muted overflow-y-auto custom-scrollbar">
                                        {renderActivityTools()}
                                    </div>
                                </div>
                            )}

                            {/* MODE 3: WEEKLY VIEW (Existing logic wrapped) */}
                            {viewMode === 'weekly' && (
                                <div className="flex h-full">
                                    {/* Sidebar: Days */}
                                    <div className="w-64 border-r border-border p-4 overflow-y-auto custom-scrollbar bg-muted">
                                        <div className="space-y-2">
                                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">요일 선택</h3>
                                            {DAYS_OF_WEEK.map((day) => (
                                                <motion.button
                                                    key={day.id}
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => {
                                                        setSelectedDayOfWeek(day.id);
                                                        resetPickers();
                                                    }}
                                                    className={cn(
                                                        "w-full p-3 rounded-lg border-2 text-left transition-all",
                                                        selectedDayOfWeek === day.id
                                                            ? "bg-primary/10 border-primary text-foreground font-semibold"
                                                            : "bg-white border-border text-muted-foreground hover:border-primary/50"
                                                    )}
                                                >
                                                    {day.fullLabel}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Main Timeline (Reused logic) */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white">
                                        <div className="mb-4">
                                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                                {DAYS_OF_WEEK.find(d => d.id === selectedDayOfWeek)?.fullLabel} 일정
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                매주 반복되는 일정을 설정합니다. 시간을 클릭하여 일정 추가/수정
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            {timeSlots.map((time) => {
                                                const activity = getScheduledActivityAtTime(time);
                                                const isHourMark = time.endsWith(':00');
                                                // ... (Same render as above, just logic differs in getScheduledActivityAtTime) ...
                                                return (
                                                    <motion.div
                                                        key={time}
                                                        whileHover={{ scale: 1.005 }}
                                                        onClick={() => handleTimeSlotClick(time)}
                                                        className={cn(
                                                            "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border",
                                                            activity
                                                                ? getColorClasses(activity.color, activity.isStart !== false) + " border"
                                                                : "bg-white border-border hover:bg-muted hover:border-primary/30",
                                                            isHourMark && "border-l-2 border-l-primary/50"
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "font-mono text-sm shrink-0 w-14",
                                                            isHourMark ? "font-bold text-foreground" : "text-muted-foreground"
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
                                                            <div className="flex-1 h-6 border border-dashed border-border rounded flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                                <Plus className="w-3 h-3 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Right Sidebar: Tools */}
                                    <div className="w-80 border-l border-border p-4 bg-muted overflow-y-auto custom-scrollbar">
                                        {renderActivityTools()}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Footer (Simplified) */}
                        <div className="flex justify-end gap-3 p-6 border-t border-border shrink-0 bg-white">
                            <Button variant="ghost" onClick={onClose}>닫기</Button>
                            <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
                                <Check className="w-4 h-4 mr-2" />
                                저장하기
                            </Button>
                        </div>
                    </motion.div>

                    <style jsx global>{`
                        .custom-scrollbar {
                            -ms-overflow-style: none;  /* IE and Edge */
                            scrollbar-width: none;  /* Firefox */
                        }
                        .custom-scrollbar::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>
                </>
            )}
        </AnimatePresence>
    );
}
