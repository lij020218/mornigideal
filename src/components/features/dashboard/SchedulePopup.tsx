"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Trash2, Clock, Sun, Moon, Coffee, Briefcase, Dumbbell, BookOpen, Target, Edit3, Check, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Heart, Gamepad2, Users, MapPin, FileText, Film, Tv, Music, Flag } from "lucide-react";
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
    const [viewMode, setViewMode] = useState<'calendar-full' | 'daily-detail' | 'weekly'>('calendar-full');

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
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
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
    const [linkedGoal, setLinkedGoal] = useState<{ id: string; title: string } | null>(null);
    const [availableGoals, setAvailableGoals] = useState<Array<{ id: string; title: string; type: string }>>([]);
    const [showGoalSelector, setShowGoalSelector] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialSchedule) setSchedule(initialSchedule);
            if (initialCustomGoals) setCustomGoals(initialCustomGoals);

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
                const { linkedGoalId, linkedGoalTitle, goalType } = event.detail;
                setLinkedGoal({ id: linkedGoalId, title: linkedGoalTitle });

                // Set view mode based on goal type
                if (goalType === 'weekly') {
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
                } else if (goalType === 'monthly') {
                    // For monthly goals, show the calendar view
                    setViewMode('calendar-full');
                    // Set to current month
                    setCurrentMonth(new Date());
                } else if (goalType === 'yearly') {
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

            return () => {
                window.removeEventListener('open-schedule-popup', handleOpenWithGoal as EventListener);
            };
        }
    }, [isOpen, initialSchedule, initialCustomGoals]);

    // Handle linkedGoalData prop changes
    useEffect(() => {
        if (linkedGoalData && isOpen) {
            console.log('[SchedulePopup] Setting linkedGoal from prop:', linkedGoalData);
            setLinkedGoal({ id: linkedGoalData.id, title: linkedGoalData.title });

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
                alert('해당 시간대에 이미 일정이 있습니다. 다른 시간을 선택해주세요.');
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
                alert('해당 시간대에 이미 일정이 있습니다. 다른 시간을 선택해주세요.');
                return;
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
                ...(linkedGoal && { linkedGoalId: linkedGoal.id }),
            };
            console.log('[SchedulePopup] Adding schedule with linkedGoal:', linkedGoal, 'newGoal:', newGoal);
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
                alert('해당 시간대에 이미 일정이 있습니다. 다른 시간을 선택해주세요.');
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
                ...(linkedGoal && { linkedGoalId: linkedGoal.id }),
            };
            setCustomGoals([...customGoals, newGoal]);
            setLinkedGoal(null); // Clear after adding
        } else if (viewMode === 'daily-detail' && selectedDate) {
            // Check for time conflict
            if (hasTimeConflict(selectedTimeSlot, endTime, selectedDate)) {
                alert('해당 시간대에 이미 일정이 있습니다. 다른 시간을 선택해주세요.');
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
                ...(linkedGoal && { linkedGoalId: linkedGoal.id }),
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
                alert('해당 시간대에 이미 일정이 있습니다. 다른 시간을 선택해주세요.');
                return;
            }

            const newGoal: CustomGoal = {
                id: Date.now().toString(),
                text: customActivityText,
                time: timeOfDay,
                startTime: selectedTimeSlot,
                endTime: endTime,
                color: 'primary',
                daysOfWeek: [selectedDayOfWeek],
                startDate: formatDate(new Date()), // 오늘부터 반복 시작
                notificationEnabled: notificationEnabled,
                ...(linkedGoal && { linkedGoalId: linkedGoal.id }),
            };
            setCustomGoals([...customGoals, newGoal]);
            setLinkedGoal(null); // Clear after adding
        } else if (viewMode === 'daily-detail' && selectedDate) {
            // Check for time conflict
            if (hasTimeConflict(selectedTimeSlot, endTime, selectedDate)) {
                alert('해당 시간대에 이미 일정이 있습니다. 다른 시간을 선택해주세요.');
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
                ...(linkedGoal && { linkedGoalId: linkedGoal.id }),
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
            console.log('[SchedulePopup] Deleting activity:', activityToDelete.id, activityToDelete.text, 'deleteAllRecurring:', deleteAllRecurring);
        } else {
            console.log('[SchedulePopup] No activity found to delete. selectedActivityId:', selectedActivityId, 'selectedTimeSlot:', selectedTimeSlot);
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

                        console.log('[SchedulePopup] AI 추천 일정 삭제 및 localStorage 업데이트:', deletedActivityText);
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
                                        setLinkedGoal({ id: goal.id, title: goal.title });
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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-0 top-0 w-full h-full bg-white z-50 overflow-hidden flex flex-col md:left-1/2 md:top-[5%] md:-translate-x-1/2 md:w-full md:max-w-5xl md:h-[85vh] md:rounded-2xl md:border md:border-border md:shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center p-3 md:p-6 border-b border-border shrink-0 bg-white">
                            <div className="flex items-center gap-2 md:gap-4">
                                <h2 className="text-base md:text-xl font-bold flex items-center gap-1.5 md:gap-2">
                                    <Clock className="w-4 h-4 md:w-5 md:h-5 text-primary" /> 일정 관리
                                </h2>

                                {/* View Switcher */}
                                <div className="flex bg-muted rounded-lg p-0.5 md:p-1 border border-border">
                                    <button
                                        onClick={() => setViewMode('calendar-full')}
                                        className={cn(
                                            "px-2 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-medium rounded-md transition-all",
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
                                            "px-2 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-medium rounded-md transition-all",
                                            viewMode === 'weekly'
                                                ? "bg-primary text-white shadow-lg"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        주간
                                    </button>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted h-8 w-8 md:h-10 md:w-10">
                                <X className="w-4 h-4 md:w-5 md:h-5" />
                            </Button>
                        </div>

                        {/* CONTENT AREA */}
                        <div className="flex-1 overflow-hidden relative">
                            {/* MODE 1: FULL CALENDAR */}
                            {viewMode === 'calendar-full' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-3 md:p-6 h-full flex flex-col"
                                >
                                    {/* Calendar Header */}
                                    <div className="flex items-center justify-between mb-3 md:mb-6">
                                        <h3 className="text-lg md:text-2xl font-bold">
                                            {currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월
                                        </h3>
                                        <div className="flex gap-1 md:gap-2">
                                            <Button variant="outline" size="sm" onClick={handlePrevMonth} className="h-8 px-2 md:px-3 text-xs md:text-sm">
                                                <ChevronLeft className="w-4 h-4" />
                                                <span className="hidden md:inline ml-1">이전 달</span>
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={handleNextMonth} className="h-8 px-2 md:px-3 text-xs md:text-sm">
                                                <span className="hidden md:inline mr-1">다음 달</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Days Header */}
                                    <div className="grid grid-cols-7 gap-1 md:gap-4 mb-1 md:mb-2 text-center">
                                        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                                            <div key={d} className={cn("text-xs md:text-sm font-medium text-muted-foreground py-1 md:py-2", i === 0 && "text-red-500", i === 6 && "text-blue-500")}>
                                                {d}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Calendar Grid - Scrollable Container */}
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                                        <div className="grid grid-cols-7 gap-1 md:gap-4">
                                            {/* Empty cells for start of month */}
                                            {Array.from({ length: getDaysInMonth(currentMonth).firstDayOfMonth }).map((_, i) => (
                                                <div key={`empty-${i}`} className="bg-transparent" />
                                            ))}

                                            {/* Days */}
                                            {Array.from({ length: getDaysInMonth(currentMonth).daysInMonth }).map((_, i) => {
                                                const day = i + 1;
                                                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                                                const isToday = isSameDay(date, new Date());

                                                // Get all goals for this date with their colors
                                                const goalsForDate = customGoals?.filter(g => {
                                                    const dateStr = formatDate(date);
                                                    if (g.specificDate) return g.specificDate === dateStr;
                                                    // 반복 일정: startDate~endDate 범위 내에서만 표시
                                                    if (g.daysOfWeek && g.daysOfWeek.includes(date.getDay()) && !g.specificDate) {
                                                        // startDate가 있으면 해당 날짜 이후에만 표시
                                                        if (g.startDate && dateStr < g.startDate) return false;
                                                        // endDate가 있으면 해당 날짜까지만 표시
                                                        if (g.endDate && dateStr > g.endDate) return false;
                                                        return true;
                                                    }
                                                    return false;
                                                }) || [];

                                                // Get unique colors (max 4 to display)
                                                const uniqueColors = [...new Set(goalsForDate.map(g => g.color || 'primary'))].slice(0, 4);

                                                // Color mapping for schedule indicators
                                                const getIndicatorColor = (color: string) => {
                                                    const colorMap: Record<string, string> = {
                                                        yellow: 'bg-yellow-400',
                                                        blue: 'bg-blue-400',
                                                        purple: 'bg-purple-400',
                                                        violet: 'bg-violet-400',
                                                        green: 'bg-green-400',
                                                        emerald: 'bg-emerald-400',
                                                        red: 'bg-red-400',
                                                        rose: 'bg-rose-400',
                                                        orange: 'bg-orange-400',
                                                        pink: 'bg-pink-400',
                                                        amber: 'bg-amber-400',
                                                        cyan: 'bg-cyan-400',
                                                        sky: 'bg-sky-400',
                                                        teal: 'bg-teal-400',
                                                        indigo: 'bg-indigo-400',
                                                        primary: 'bg-primary',
                                                    };
                                                    return colorMap[color] || 'bg-primary';
                                                };

                                                return (
                                                    <motion.button
                                                        key={day}
                                                        style={{ aspectRatio: '1/1' }}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => handleDateSelect(day)}
                                                        className={cn(
                                                            "relative rounded-lg md:rounded-2xl border p-1 md:p-3 flex flex-col items-start justify-between transition-all group",
                                                            isToday
                                                                ? "bg-primary/10 border-primary text-foreground shadow-sm"
                                                                : "bg-white border-border hover:border-primary/50 hover:shadow-sm text-foreground"
                                                        )}
                                                    >
                                                        <div className="flex justify-between items-start w-full">
                                                            <span className={cn(
                                                                "text-sm md:text-2xl font-light tracking-tight",
                                                                isToday && "text-primary font-bold"
                                                            )}>{day}</span>

                                                            {isToday && (
                                                                <span className="hidden md:inline text-[10px] font-medium bg-primary text-white px-2 py-0.5 rounded-full">
                                                                    TODAY
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Schedule indicators - colored bars */}
                                                        {uniqueColors.length > 0 && (
                                                            <div className="flex flex-col gap-0.5 mt-auto w-full">
                                                                {uniqueColors.slice(0, 2).map((color, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className={cn(
                                                                            "h-0.5 md:h-1 rounded-full",
                                                                            getIndicatorColor(color)
                                                                        )}
                                                                        style={{ width: `${Math.min(100, 40 + idx * 15)}%` }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="absolute inset-0 rounded-lg md:rounded-2xl ring-1 ring-primary/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                                    </motion.button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* MODE 2: DAILY DETAIL - Clean card-based design */}
                            {viewMode === 'daily-detail' && selectedDate && (
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
                                        "bg-muted/50 overflow-y-auto custom-scrollbar",
                                        // Mobile: fixed bottom sheet when active
                                        (showEditOptions || showTimePicker)
                                            ? "fixed md:relative bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto z-10 rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-l border-border p-4 md:p-5 max-h-[60vh] md:max-h-none w-full md:w-80"
                                            : "hidden md:block w-80 border-l border-border p-5"
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
                                            renderActivityTools()
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                                                <CalendarIcon className="w-8 h-8 mb-3 opacity-50" />
                                                <p className="text-sm">왼쪽에서 일정을 선택하거나<br />기존 일정을 클릭하세요</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* MODE 3: WEEKLY VIEW (Calendar grid layout) */}
                            {viewMode === 'weekly' && (
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
                                                {DAYS_OF_WEEK.map((day) => (
                                                    <div
                                                        key={day.id}
                                                        onClick={() => {
                                                            setSelectedDayOfWeek(day.id);
                                                            resetPickers();
                                                        }}
                                                        className={cn(
                                                            "flex-1 py-2 md:py-4 text-center cursor-pointer transition-all border-r border-border/30 last:border-r-0",
                                                            selectedDayOfWeek === day.id
                                                                ? "bg-gradient-to-br from-primary/10 to-purple-500/5"
                                                                : "hover:bg-muted/30",
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "text-xs md:text-sm font-bold transition-colors",
                                                            selectedDayOfWeek === day.id && "text-primary",
                                                            day.id === 0 && selectedDayOfWeek !== day.id && "text-red-500",
                                                            day.id === 6 && selectedDayOfWeek !== day.id && "text-blue-500"
                                                        )}>
                                                            {day.label}
                                                        </span>
                                                        {selectedDayOfWeek === day.id && (
                                                            <motion.div
                                                                layoutId="weeklyDayIndicator"
                                                                className="mx-auto mt-1 md:mt-1.5 w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-primary"
                                                            />
                                                        )}
                                                    </div>
                                                ))}
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
                                                            startDate: formatDate(new Date()), // 오늘부터 반복 시작
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
