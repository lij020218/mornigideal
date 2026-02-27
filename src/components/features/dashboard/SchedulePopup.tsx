"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Clock, Sun, Moon, Coffee, Briefcase, Dumbbell, BookOpen, Target, Edit3, Check, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Heart, Gamepad2, Users, MapPin, FileText, Film, Tv, Music, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CalendarView } from "./CalendarView";
import { DailyDetailView } from "./DailyDetailView";
import { WeeklyView } from "./WeeklyView";

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
    startDate?: string; // YYYY-MM-DD format - recurring schedules only appear from this date onwards
    endDate?: string; // YYYY-MM-DD format - recurring schedules only appear until this date (for goal-linked schedules)
    memo?: string; // Memo for the activity
    location?: string; // Location of the activity
    detailedInfo?: string; // Additional details
    linkedGoalId?: string; // ID of the long-term goal this schedule is linked to
    linkedGoalType?: "weekly" | "monthly" | "yearly"; // Type of the linked goal
}

interface SchedulePopupProps {
    isOpen: boolean;
    onClose: () => void;
    initialSchedule?: Schedule;
    initialCustomGoals?: CustomGoal[];
    onSave: (schedule: Schedule, customGoals: CustomGoal[]) => void;
    linkedGoalData?: { id: string; title: string; type: 'weekly' | 'monthly' | 'yearly' } | null;
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

export function SchedulePopup({ isOpen, onClose, initialSchedule, initialCustomGoals, onSave, linkedGoalData }: SchedulePopupProps) {
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
    // 'weekly': The weekly schedule view for a specific week
    const [viewMode, setViewMode] = useState<'calendar-full' | 'daily-detail' | 'weekly'>('daily-detail');

    // For weekly view - now shows specific week's schedules
    const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => {
        // Get current week's Monday
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - daysToSubtract);
        monday.setHours(0, 0, 0, 0);
        return monday;
    });
    const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number>(1); // For adding schedules in weekly view
    const [showRecurringPrompt, setShowRecurringPrompt] = useState(false); // Ask if schedule should be recurring

    // For calendar view
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    // const [showTimeTable, setShowTimeTable] = useState<boolean>(false); // Removed

    // Adding/editing state
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
    const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
    const [showActivityPicker, setShowActivityPicker] = useState(false);
    const [showDurationPicker, setShowDurationPicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false); // New: for quick add time selection
    const [pendingActivity, setPendingActivity] = useState<typeof PRESET_ACTIVITIES[0] | null>(null); // Activity waiting for time selection
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

    // State for linked goal (when adding schedule from goal page)
    const [linkedGoal, setLinkedGoal] = useState<{ id: string; title: string; type: 'weekly' | 'monthly' | 'yearly' } | null>(null);
    const [availableGoals, setAvailableGoals] = useState<Array<{ id: string; title: string; type: 'weekly' | 'monthly' | 'yearly' }>>([]);
    const [showGoalSelector, setShowGoalSelector] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialSchedule) setSchedule(initialSchedule);
            if (initialCustomGoals) setCustomGoals(initialCustomGoals);

            // 팝업 열릴 때마다 오늘 날짜의 일별 상세 보기로 시작
            if (!linkedGoalData) {
                const today = new Date();
                setSelectedDate(today);
                setViewMode('daily-detail');
                setCurrentMonth(today);
            }
            resetPickers();

            // Fetch available goals for linking
            const fetchGoals = async () => {
                try {
                    const response = await fetch('/api/user/long-term-goals');
                    if (response.ok) {
                        const data = await response.json();
                        const allGoals = [
                            ...(data.goals?.weekly || []).map((g: any) => ({ ...g, type: 'weekly' })),
                            ...(data.goals?.monthly || []).map((g: any) => ({ ...g, type: 'monthly' })),
                            ...(data.goals?.yearly || []).map((g: any) => ({ ...g, type: 'yearly' })),
                        ].filter((g: any) => !g.completed); // Only show incomplete goals
                        setAvailableGoals(allGoals);
                    }
                } catch (error) {
                    console.error('[SchedulePopup] Failed to fetch goals:', error);
                }
            };
            fetchGoals();

            // Listen for open-schedule-popup event from goals page
            const handleOpenWithGoal = (event: CustomEvent) => {
                const { linkedGoalId, linkedGoalTitle, goalType, linkedGoal: goalFromEvent } = event.detail || {};

                // Support both old format and new format (from LongTermGoalsWidget)
                if (goalFromEvent) {
                    setLinkedGoal({ id: goalFromEvent.id, title: goalFromEvent.title, type: goalFromEvent.type });
                } else if (linkedGoalId) {
                    setLinkedGoal({ id: linkedGoalId, title: linkedGoalTitle, type: goalType || 'weekly' });
                }

                const effectiveGoalType = goalFromEvent?.type || goalType;

                // Set view mode based on goal type
                if (effectiveGoalType === 'weekly') {
                    // For weekly goals, show the weekly schedule view
                    setViewMode('weekly');
                    // Set to current week
                    const now = new Date();
                    const dayOfWeek = now.getDay();
                    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    const monday = new Date(now);
                    monday.setDate(now.getDate() - daysToSubtract);
                    monday.setHours(0, 0, 0, 0);
                    setSelectedWeekStart(monday);
                } else if (effectiveGoalType === 'monthly') {
                    // For monthly goals, show the calendar view
                    setViewMode('calendar-full');
                    // Set to current month
                    setCurrentMonth(new Date());
                } else if (effectiveGoalType === 'yearly') {
                    // For yearly goals, just open activity picker (simpler)
                    setViewMode('calendar-full'); // Default view
                }

                setShowActivityPicker(true); // Open activity picker immediately
            };

            window.addEventListener('open-schedule-popup', handleOpenWithGoal as EventListener);

            // Check for pending calendar event from email
            const pendingEvent = localStorage.getItem('pendingCalendarEvent');
            if (pendingEvent) {
                try {
                    const eventData = JSON.parse(pendingEvent);

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

            return () => {
                window.removeEventListener('open-schedule-popup', handleOpenWithGoal as EventListener);
            };
        }
    }, [isOpen, initialSchedule, initialCustomGoals]);

    // Handle linkedGoalData prop changes
    useEffect(() => {
        if (linkedGoalData && isOpen) {
            setLinkedGoal({ id: linkedGoalData.id, title: linkedGoalData.title, type: linkedGoalData.type });

            // Set view mode based on goal type
            if (linkedGoalData.type === 'weekly') {
                setViewMode('weekly');
                const now = new Date();
                const dayOfWeek = now.getDay();
                const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                const monday = new Date(now);
                monday.setDate(now.getDate() - daysToSubtract);
                monday.setHours(0, 0, 0, 0);
                setSelectedWeekStart(monday);
            } else if (linkedGoalData.type === 'monthly') {
                setViewMode('calendar-full');
                setCurrentMonth(new Date());
            } else if (linkedGoalData.type === 'yearly') {
                setViewMode('calendar-full');
            }

            setShowActivityPicker(true);
        }
    }, [linkedGoalData, isOpen]);

    // 목표 타입에 따른 날짜 범위 계산 (주간: 금주, 월간: 당월, 연간: 당해년도)
    const getGoalDateRange = (goalType: 'weekly' | 'monthly' | 'yearly'): { startDate: string; endDate: string } => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date;

        if (goalType === 'weekly') {
            // 금주 월요일 ~ 일요일
            const dayOfWeek = now.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate = new Date(now);
            startDate.setDate(now.getDate() - daysToMonday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
        } else if (goalType === 'monthly') {
            // 당월 1일 ~ 말일
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else {
            // 당해년도 1월 1일 ~ 12월 31일
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        }

        return {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
        };
    };

    const resetPickers = () => {
        setShowActivityPicker(false);
        setShowDurationPicker(false);
        setShowTimePicker(false);
        setPendingActivity(null);
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

        if (isRecurring) {
            // Determine the day of week for recurring schedule
            // Note: weekly view should NOT create recurring schedules
            const targetDayOfWeek = viewMode === 'daily-detail'
                ? (selectedDate?.getDay() ?? new Date().getDay())
                : new Date().getDay();

            // Check for time conflict
            if (hasTimeConflict(selectedTimeSlot, endTime, undefined, targetDayOfWeek)) {
                toast.warning('해당 시간대에 이미 일정이 있습니다.');
                return;
            }

            // Recurring: Add template with daysOfWeek only (rendering will apply to all matching days)
            const templateGoal: CustomGoal = {
                id: Date.now().toString(),
                text: selectedActivity.label,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: selectedActivity.color,
                daysOfWeek: [targetDayOfWeek],
                notificationEnabled: notificationEnabled,
            };

            setCustomGoals([...customGoals, templateGoal]);
        } else {
            // One-time: Add for specific date only
            let targetDate: Date;
            if (viewMode === 'daily-detail' && selectedDate) {
                targetDate = selectedDate;
            } else if (viewMode === 'weekly') {
                // For weekly view, calculate the specific date based on selectedWeekStart and selectedDayOfWeek
                targetDate = new Date(selectedWeekStart);
                const daysToAdd = selectedDayOfWeek === 0 ? 6 : selectedDayOfWeek - 1;
                targetDate.setDate(selectedWeekStart.getDate() + daysToAdd);
            } else {
                // Fallback
                const today = new Date();
                targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            }

            // Check for time conflict
            if (hasTimeConflict(selectedTimeSlot, endTime, targetDate)) {
                toast.warning('해당 시간대에 이미 일정이 있습니다.');
                return;
            }

            // 목표 연결 시 날짜 범위 적용
            const goalDateRange = linkedGoal ? getGoalDateRange(linkedGoal.type) : null;

            const newGoal: CustomGoal = {
                id: Date.now().toString(),
                text: selectedActivity.label,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: selectedActivity.color,
                specificDate: formatDate(targetDate),
                notificationEnabled: notificationEnabled,
                ...(linkedGoal && {
                    linkedGoalId: linkedGoal.id,
                    linkedGoalType: linkedGoal.type,
                    // 목표 기간 내로 제한 (specificDate는 이미 설정되어 있으므로 범위 체크용)
                }),
            };
            setCustomGoals([...customGoals, newGoal]);
            setLinkedGoal(null); // Clear after adding
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
            // Calculate the specific date for this day in the selected week
            const targetDate = new Date(selectedWeekStart);
            const daysToAdd = selectedDayOfWeek === 0 ? 6 : selectedDayOfWeek - 1; // Convert to offset from Monday
            targetDate.setDate(selectedWeekStart.getDate() + daysToAdd);

            // Check for time conflict
            if (hasTimeConflict(selectedTimeSlot, endTime, targetDate)) {
                toast.warning('해당 시간대에 이미 일정이 있습니다.');
                return;
            }

            // Add as specific date goal (not recurring)
            const newGoal: CustomGoal = {
                id: Date.now().toString(),
                text: selectedActivity.label,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: selectedActivity.color,
                specificDate: formatDate(targetDate), // 특정 날짜에만 추가
                notificationEnabled: notificationEnabled,
                ...(linkedGoal && {
                    linkedGoalId: linkedGoal.id,
                    linkedGoalType: linkedGoal.type,
                }),
            };
            setCustomGoals([...customGoals, newGoal]);
            setLinkedGoal(null); // Clear after adding
        } else if (viewMode === 'daily-detail' && selectedDate) {
            // Check for time conflict
            if (hasTimeConflict(selectedTimeSlot, endTime, selectedDate)) {
                toast.warning('해당 시간대에 이미 일정이 있습니다.');
                return;
            }

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
                ...(linkedGoal && {
                    linkedGoalId: linkedGoal.id,
                    linkedGoalType: linkedGoal.type,
                }),
            };
            setCustomGoals([...customGoals, newGoal]);
            setLinkedGoal(null); // Clear after adding
        }

        resetPickers();
    };

    const handleCustomActivityAdd = () => {
        if (!selectedTimeSlot || !customActivityText.trim()) return;

        const timeOfDay = getTimeOfDay(selectedTimeSlot);
        const endTime = calculateEndTime(selectedTimeSlot, duration);

        if (viewMode === 'weekly') {
            // Check for time conflict
            if (hasTimeConflict(selectedTimeSlot, endTime, undefined, selectedDayOfWeek)) {
                toast.warning('해당 시간대에 이미 일정이 있습니다.');
                return;
            }

            // 목표 연결 시 날짜 범위 적용 (반복 일정)
            const goalDateRange = linkedGoal ? getGoalDateRange(linkedGoal.type) : null;

            const newGoal: CustomGoal = {
                id: Date.now().toString(),
                text: customActivityText,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: 'primary',
                daysOfWeek: [selectedDayOfWeek],
                startDate: goalDateRange?.startDate || formatDate(new Date()), // 목표 시작일 또는 오늘
                ...(goalDateRange && { endDate: goalDateRange.endDate }), // 목표 종료일
                notificationEnabled: notificationEnabled,
                ...(linkedGoal && { linkedGoalId: linkedGoal.id, linkedGoalType: linkedGoal.type }),
            };
            setCustomGoals([...customGoals, newGoal]);
            setLinkedGoal(null); // Clear after adding
        } else if (viewMode === 'daily-detail' && selectedDate) {
            // Check for time conflict
            if (hasTimeConflict(selectedTimeSlot, endTime, selectedDate)) {
                toast.warning('해당 시간대에 이미 일정이 있습니다.');
                return;
            }

            const newGoal: CustomGoal = {
                id: Date.now().toString(),
                text: customActivityText,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: 'primary',
                specificDate: formatDate(selectedDate),
                notificationEnabled: notificationEnabled,
                ...(linkedGoal && {
                    linkedGoalId: linkedGoal.id,
                    linkedGoalType: linkedGoal.type,
                }),
            };
            setCustomGoals([...customGoals, newGoal]);
            setLinkedGoal(null); // Clear after adding
        }

        setCustomActivityText("");
        resetPickers();
    };

    // Check if the selected activity is a recurring schedule
    const isSelectedActivityRecurring = (): boolean => {
        if (!selectedActivityId) return false;
        const activity = customGoals.find(g => g.id === selectedActivityId);
        return !!(activity?.daysOfWeek && activity.daysOfWeek.length > 0 && !activity.specificDate);
    };

    const handleDeleteActivity = (deleteAllRecurring: boolean = true) => {
        // ID 기반 삭제를 우선 시도 (시간 미정 일정도 삭제 가능)
        if (!selectedActivityId && !selectedTimeSlot) return;

        // Find the activity being deleted to notify TodaySuggestions
        let deletedActivityText: string | null = null;
        let activityToDelete: CustomGoal | undefined;

        // ID로 먼저 찾기
        if (selectedActivityId) {
            activityToDelete = customGoals.find(g => g.id === selectedActivityId);
        }

        // ID로 못 찾으면 시간 기반으로 찾기 (범위 포함)
        if (!activityToDelete && selectedTimeSlot) {
            activityToDelete = customGoals.find(g => {
                if (viewMode === 'weekly') {
                    if (!g.daysOfWeek?.includes(selectedDayOfWeek)) return false;
                    // Check both exact start time and time within range
                    if (g.startTime === selectedTimeSlot) return true;
                    if (g.startTime && g.endTime && isTimeInRange(selectedTimeSlot, g.startTime, g.endTime)) return true;
                    return false;
                } else if ((viewMode === 'calendar-full' || viewMode === 'daily-detail') && selectedDate) {
                    const isSpecificDateMatch = g.specificDate === formatDate(selectedDate);
                    const isRecurringMatch = g.daysOfWeek?.includes(selectedDate.getDay()) && !g.specificDate;
                    if (!isSpecificDateMatch && !isRecurringMatch) return false;
                    // Check both exact start time and time within range
                    if (g.startTime === selectedTimeSlot) return true;
                    if (g.startTime && g.endTime && isTimeInRange(selectedTimeSlot, g.startTime, g.endTime)) return true;
                    return false;
                }
                return false;
            });
        }

        if (activityToDelete) {
            deletedActivityText = activityToDelete.text;
        } else {
            return;
        }

        const isRecurring = activityToDelete.daysOfWeek && activityToDelete.daysOfWeek.length > 0 && !activityToDelete.specificDate;

        if (isRecurring && !deleteAllRecurring && selectedDate) {
            // "이 날만 삭제" - 해당 날짜에 대한 예외 일정 생성 (빈 일정으로 덮어쓰기 대신 반복에서 제외)
            // 간단한 방법: 해당 요일을 daysOfWeek에서 제거
            const dayOfWeek = selectedDate.getDay();
            const updatedDaysOfWeek = activityToDelete.daysOfWeek?.filter(d => d !== dayOfWeek) || [];

            if (updatedDaysOfWeek.length === 0) {
                // 모든 요일이 제거되면 일정 자체를 삭제
                setCustomGoals(prevGoals => prevGoals.filter(g => g.id !== activityToDelete!.id));
            } else {
                // 해당 요일만 제거
                setCustomGoals(prevGoals => prevGoals.map(g => {
                    if (g.id === activityToDelete!.id) {
                        return { ...g, daysOfWeek: updatedDaysOfWeek };
                    }
                    return g;
                }));
            }
        } else {
            // 전체 삭제 (일회성 일정이거나 모든 반복 삭제)
            const activityIdToDelete = activityToDelete.id;
            setCustomGoals(prevGoals => prevGoals.filter(g => g.id !== activityIdToDelete));
        }

        // Clean up localStorage and notify TodaySuggestions if this was an AI-suggested schedule
        if (deletedActivityText) {
            const today = new Date().toISOString().split('T')[0];
            const storedKey = `added_suggestions_${today}`;
            const stored = localStorage.getItem(storedKey);

            if (stored) {
                try {
                    const addedSchedules = JSON.parse(stored);
                    if (Array.isArray(addedSchedules) && addedSchedules.includes(deletedActivityText)) {
                        // Remove from localStorage
                        const updatedSchedules = addedSchedules.filter((text: string) => text !== deletedActivityText);
                        localStorage.setItem(storedKey, JSON.stringify(updatedSchedules));

                        // Notify TodaySuggestions to update its state
                        window.dispatchEvent(new CustomEvent('schedule-deleted', {
                            detail: { scheduleText: deletedActivityText }
                        }));

                    }
                } catch (error) {
                    console.error('[SchedulePopup] localStorage 업데이트 실패:', error);
                }
            }
        }

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

    // Check if a time slot conflicts with existing schedules
    const hasTimeConflict = (startTime: string, endTime: string, targetDate?: Date, targetDayOfWeek?: number): boolean => {
        for (const goal of customGoals) {
            if (!goal.startTime || !goal.endTime) continue;

            // Check if this goal applies to the target context
            let isApplicable = false;

            if (viewMode === 'weekly' && targetDayOfWeek !== undefined) {
                // Weekly view: check if goal exists on this day of week
                isApplicable = goal.daysOfWeek?.includes(targetDayOfWeek) ?? false;
            } else if ((viewMode === 'calendar-full' || viewMode === 'daily-detail') && targetDate) {
                // Daily view: check if goal exists on this specific date
                const isSpecificDate = goal.specificDate === formatDate(targetDate);
                const isRecurringOnThisDay = (goal.daysOfWeek?.includes(targetDate.getDay()) ?? false) && !goal.specificDate;
                isApplicable = isSpecificDate || isRecurringOnThisDay;
            }

            if (!isApplicable) continue;

            // Check for time overlap
            const [newStart, newEnd] = [startTime, endTime].map(t => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            });
            const [existingStart, existingEnd] = [goal.startTime, goal.endTime].map(t => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            });

            // Two time ranges overlap if one starts before the other ends
            const hasOverlap = newStart < existingEnd && newEnd > existingStart;
            if (hasOverlap) {
                return true;
            }
        }
        return false;
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

    // Get the actual goal object at a specific time (including goals that span this time)
    const getGoalAtTime = (time: string): CustomGoal | null => {
        for (const goal of customGoals) {
            // Weekly view: show goals for selected day of week
            if (viewMode === 'weekly' && goal.daysOfWeek?.includes(selectedDayOfWeek)) {
                // Check if time is at start OR within the time range
                if (goal.startTime === time) {
                    return goal;
                }
                if (goal.startTime && goal.endTime && isTimeInRange(time, goal.startTime, goal.endTime)) {
                    return goal;
                }
            }

            // Daily Detail view: show goals for selected date (both specific date and recurring)
            if ((viewMode === 'calendar-full' || viewMode === 'daily-detail') && selectedDate) {
                const dateStr = formatDate(selectedDate);
                const isSpecificDate = goal.specificDate === dateStr;
                // 반복 일정: startDate~endDate 범위 내에서만 표시
                let isRecurringOnThisDay = goal.daysOfWeek?.includes(selectedDate.getDay()) && !goal.specificDate;
                if (isRecurringOnThisDay && goal.startDate && dateStr < goal.startDate) {
                    isRecurringOnThisDay = false;
                }
                if (isRecurringOnThisDay && goal.endDate && dateStr > goal.endDate) {
                    isRecurringOnThisDay = false;
                }

                if (isSpecificDate || isRecurringOnThisDay) {
                    // Check if time is at start OR within the time range
                    if (goal.startTime === time) {
                        return goal;
                    }
                    if (goal.startTime && goal.endTime && isTimeInRange(time, goal.startTime, goal.endTime)) {
                        return goal;
                    }
                }
            }
        }
        return null;
    };

    const getScheduledActivityAtTime = (time: string) => {
        // Custom goals (including core activities now stored as customGoals)
        for (const goal of customGoals) {
            // Weekly view: show goals for specific dates in the selected week
            if (viewMode === 'weekly') {
                // Calculate the date for each day of week in the selected week
                const daysOfWeekToCheck = [0, 1, 2, 3, 4, 5, 6]; // All days
                for (const dayOfWeek of daysOfWeekToCheck) {
                    const targetDate = new Date(selectedWeekStart);
                    targetDate.setDate(selectedWeekStart.getDate() + (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                    const dateStr = formatDate(targetDate);

                    // Check if this goal applies to this specific date
                    const isSpecificDate = goal.specificDate === dateStr;
                    let isRecurringOnThisDay = goal.daysOfWeek?.includes(dayOfWeek) && !goal.specificDate;
                    if (isRecurringOnThisDay && goal.startDate && dateStr < goal.startDate) {
                        isRecurringOnThisDay = false;
                    }
                    if (isRecurringOnThisDay && goal.endDate && dateStr > goal.endDate) {
                        isRecurringOnThisDay = false;
                    }

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
                        }
                    }
                }
            }

            // Daily Detail view: show goals for selected date (both specific date and recurring)
            if (viewMode === 'daily-detail' && selectedDate) {
                // Check if this goal applies to the selected date
                const dateStr = formatDate(selectedDate);
                const isSpecificDate = goal.specificDate === dateStr;
                // 반복 일정: startDate~endDate 범위 내에서만 표시
                let isRecurringOnThisDay = goal.daysOfWeek?.includes(selectedDate.getDay());
                if (isRecurringOnThisDay && goal.startDate && dateStr < goal.startDate) {
                    isRecurringOnThisDay = false;
                }
                if (isRecurringOnThisDay && goal.endDate && dateStr > goal.endDate) {
                    isRecurringOnThisDay = false;
                }

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

                    {/* 반복 일정인 경우 삭제 옵션 제공 */}
                    {isSelectedActivityRecurring() && viewMode === 'daily-detail' ? (
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">이 일정은 반복 일정입니다</p>
                            <Button
                                variant="outline"
                                className="w-full justify-start text-orange-500 hover:text-orange-500 hover:bg-orange-500/10 border-orange-500/30"
                                onClick={() => handleDeleteActivity(false)}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                이 요일만 삭제
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start text-red-400 hover:text-red-400 hover:bg-red-500/10 border-red-500/30"
                                onClick={() => handleDeleteActivity(true)}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                모든 반복 삭제
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full justify-start text-red-400 hover:text-red-400 hover:bg-red-500/10 border-red-500/30"
                            onClick={() => handleDeleteActivity(true)}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            삭제하기
                        </Button>
                    )}
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

                            {/* Goal Selector for custom activities */}
                            <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-medium flex items-center gap-1.5">
                                        <Flag className="w-3.5 h-3.5 text-primary" />
                                        목표와 연결 (선택)
                                    </label>
                                    {linkedGoal && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setLinkedGoal(null)}
                                            className="h-5 px-1.5 text-[10px]"
                                        >
                                            <X className="w-2.5 h-2.5 mr-0.5" />
                                            해제
                                        </Button>
                                    )}
                                </div>
                                {linkedGoal ? (
                                    <div className="p-1.5 bg-primary/10 rounded border border-primary/20 text-xs">
                                        <span className="text-primary font-medium">✓ {linkedGoal.title}</span>
                                    </div>
                                ) : availableGoals.length > 0 ? (
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            const goal = availableGoals.find(g => g.id === e.target.value);
                                            if (goal) {
                                                setLinkedGoal({ id: goal.id, title: goal.title, type: goal.type });
                                            }
                                        }}
                                        className="w-full p-1.5 border rounded text-xs bg-white"
                                    >
                                        <option value="">목표 선택...</option>
                                        {availableGoals.map((goal) => (
                                            <option key={goal.id} value={goal.id}>
                                                [{goal.type === 'weekly' ? '주간' : goal.type === 'monthly' ? '월간' : '연간'}] {goal.title}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-[10px] text-muted-foreground">
                                        연결 가능한 목표 없음
                                    </p>
                                )}
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

            {/* Goal Selector - shows after activity picked, before duration */}
            {selectedActivity && !showDurationPicker && !isAddingCustom && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-muted/30 rounded-lg border border-border/50"
                >
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Flag className="w-4 h-4 text-primary" />
                            목표와 연결 (선택사항)
                        </label>
                        {linkedGoal && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setLinkedGoal(null)}
                                className="h-6 px-2 text-xs"
                            >
                                <X className="w-3 h-3 mr-1" />
                                연결 해제
                            </Button>
                        )}
                    </div>
                    {linkedGoal ? (
                        <div className="p-2 bg-primary/10 rounded border border-primary/20 text-sm">
                            <span className="text-primary font-medium">✓ {linkedGoal.title}</span>
                        </div>
                    ) : availableGoals.length > 0 ? (
                        <div className="space-y-2">
                            <select
                                value=""
                                onChange={(e) => {
                                    const goal = availableGoals.find(g => g.id === e.target.value);
                                    if (goal) {
                                        setLinkedGoal({ id: goal.id, title: goal.title, type: goal.type });
                                    }
                                }}
                                className="w-full p-2 border rounded-lg text-sm bg-white"
                            >
                                <option value="">목표 선택...</option>
                                {availableGoals.map((goal) => (
                                    <option key={goal.id} value={goal.id}>
                                        [{goal.type === 'weekly' ? '주간' : goal.type === 'monthly' ? '월간' : '연간'}] {goal.title}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                                이 일정을 장기 목표와 연결하면 목표 진행률이 자동으로 업데이트됩니다
                            </p>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            연결 가능한 목표가 없습니다
                        </p>
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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-0 top-0 w-full h-full bg-white z-[60] overflow-hidden flex flex-col pt-[env(safe-area-inset-top)] md:pt-0 md:left-1/2 md:top-[5%] md:-translate-x-1/2 md:w-full md:max-w-5xl md:h-[85vh] md:rounded-2xl md:border md:border-border md:shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex flex-col gap-2 p-3 md:p-6 border-b border-border shrink-0 bg-white">
                            {/* Top row: Title and close button */}
                            <div className="flex justify-between items-center">
                                <h2 className="text-base md:text-xl font-bold flex items-center gap-1.5 md:gap-2">
                                    <Clock className="w-4 h-4 md:w-5 md:h-5 text-primary" /> 일정 관리
                                </h2>
                                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted h-8 w-8 md:h-10 md:w-10">
                                    <X className="w-4 h-4 md:w-5 md:h-5" />
                                </Button>
                            </div>

                            {/* View Switcher - separate row on mobile */}
                            <div className="flex bg-muted rounded-lg p-0.5 md:p-1 border border-border w-fit">
                                <button
                                    onClick={() => setViewMode('calendar-full')}
                                    className={cn(
                                        "px-3 md:px-4 py-1.5 md:py-1.5 text-xs md:text-sm font-medium rounded-md transition-all",
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
                                        "px-3 md:px-4 py-1.5 md:py-1.5 text-xs md:text-sm font-medium rounded-md transition-all",
                                        viewMode === 'weekly'
                                            ? "bg-primary text-white shadow-lg"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    주간 시간표
                                </button>
                            </div>
                        </div>

                        {/* CONTENT AREA */}
                        <div className="flex-1 overflow-hidden relative">
                            {/* MODE 1: FULL CALENDAR */}
                            {viewMode === 'calendar-full' && (
                                <CalendarView
                                    currentMonth={currentMonth}
                                    customGoals={customGoals}
                                    onPrevMonth={handlePrevMonth}
                                    onNextMonth={handleNextMonth}
                                    onDateSelect={handleDateSelect}
                                    formatDate={formatDate}
                                    getDaysInMonth={getDaysInMonth}
                                    isSameDay={isSameDay}
                                />
                            )}

                            {/* MODE 2: DAILY DETAIL - Clean card-based design */}
                            {viewMode === 'daily-detail' && selectedDate && (
                                <DailyDetailView
                                    selectedDate={selectedDate}
                                    customGoals={customGoals}
                                    showEditOptions={showEditOptions}
                                    showTimePicker={showTimePicker}
                                    showActivityPicker={showActivityPicker}
                                    showDurationPicker={showDurationPicker}
                                    selectedActivityId={selectedActivityId}
                                    selectedTimeSlot={selectedTimeSlot}
                                    activityMemo={activityMemo}
                                    pendingActivity={pendingActivity}
                                    isAddingCustom={isAddingCustom}
                                    customActivityText={customActivityText}
                                    duration={duration}
                                    setShowEditOptions={setShowEditOptions}
                                    setShowTimePicker={setShowTimePicker}
                                    setShowActivityPicker={setShowActivityPicker}
                                    setShowDurationPicker={setShowDurationPicker}
                                    setSelectedTimeSlot={setSelectedTimeSlot}
                                    setSelectedActivityId={setSelectedActivityId}
                                    setActivityMemo={setActivityMemo}
                                    setPendingActivity={setPendingActivity}
                                    setIsAddingCustom={setIsAddingCustom}
                                    setCustomActivityText={setCustomActivityText}
                                    setDuration={setDuration}
                                    setCustomGoals={setCustomGoals}
                                    handleBackToCalendar={handleBackToCalendar}
                                    resetPickers={resetPickers}
                                    handleMemoUpdate={handleMemoUpdate}
                                    handleDeleteActivity={handleDeleteActivity}
                                    isSelectedActivityRecurring={isSelectedActivityRecurring}
                                    formatDate={formatDate}
                                    getColorClasses={getColorClasses}
                                    activityToolsRenderer={renderActivityTools}
                                />
                            )}

                            {/* MODE 3: WEEKLY VIEW (Calendar grid layout) */}
                            {viewMode === 'weekly' && (
                                <WeeklyView
                                    selectedWeekStart={selectedWeekStart}
                                    setSelectedWeekStart={setSelectedWeekStart}
                                    selectedDayOfWeek={selectedDayOfWeek}
                                    setSelectedDayOfWeek={setSelectedDayOfWeek}
                                    customGoals={customGoals}
                                    setCustomGoals={setCustomGoals}
                                    showEditOptions={showEditOptions}
                                    setShowEditOptions={setShowEditOptions}
                                    showTimePicker={showTimePicker}
                                    setShowTimePicker={setShowTimePicker}
                                    showActivityPicker={showActivityPicker}
                                    selectedTimeSlot={selectedTimeSlot}
                                    setSelectedTimeSlot={setSelectedTimeSlot}
                                    selectedActivityId={selectedActivityId}
                                    setSelectedActivityId={setSelectedActivityId}
                                    activityMemo={activityMemo}
                                    setActivityMemo={setActivityMemo}
                                    pendingActivity={pendingActivity}
                                    setPendingActivity={setPendingActivity}
                                    isAddingCustom={isAddingCustom}
                                    setIsAddingCustom={setIsAddingCustom}
                                    customActivityText={customActivityText}
                                    setCustomActivityText={setCustomActivityText}
                                    duration={duration}
                                    setDuration={setDuration}
                                    resetPickers={resetPickers}
                                    formatDate={formatDate}
                                    getColorClasses={getColorClasses}
                                    handleDeleteActivity={handleDeleteActivity}
                                    handleMemoUpdate={handleMemoUpdate}
                                    isSelectedActivityRecurring={isSelectedActivityRecurring}
                                    activityToolsRenderer={() => renderActivityTools()}
                                />
                            )}

                        </div>

                        {/* Footer (Simplified) */}
                        <div className="flex justify-end gap-3 p-4 md:p-6 pb-[calc(1rem+env(safe-area-inset-bottom)+80px)] md:pb-6 border-t border-border shrink-0 bg-white">
                            <Button variant="ghost" onClick={onClose}>닫기</Button>
                            <Button onClick={handleSave} className="bg-primary text-primary-foreground hover:bg-primary/90">
                                <Check className="w-4 h-4 mr-2" />
                                저장하기
                            </Button>
                        </div>
                    </motion.div>

                    <style jsx global>{`
                        .custom-scrollbar,
                        .hide-scrollbar {
                            -ms-overflow-style: none;  /* IE and Edge */
                            scrollbar-width: none;  /* Firefox */
                        }
                        .custom-scrollbar::-webkit-scrollbar,
                        .hide-scrollbar::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>
                </>
            )}
        </AnimatePresence>
    );
}
