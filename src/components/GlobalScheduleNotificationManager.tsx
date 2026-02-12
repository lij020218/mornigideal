"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ScheduleNotificationManager } from "@/components/features/dashboard/ScheduleNotificationManager";
import type { CustomGoal } from "@/components/features/dashboard/SchedulePopup";

/**
 * Global wrapper for ScheduleNotificationManager
 * Fetches user's custom goals and passes them to the notification manager
 * This runs on all pages, not just the dashboard
 */
export function GlobalScheduleNotificationManager() {
    const { data: session, status } = useSession();
    const [customGoals, setCustomGoals] = useState<CustomGoal[]>([]);

    useEffect(() => {
        if (status !== "authenticated" || !session?.user?.email) return;

        const fetchGoals = async () => {
            try {
                const response = await fetch('/api/user/profile');
                if (response.ok) {
                    const data = await response.json();
                    const goals = data.profile?.customGoals || [];
                    setCustomGoals(goals);
                }
            } catch (error) {
                console.error('[GlobalScheduleNotificationManager] Failed to fetch goals:', error);
            }
        };

        fetchGoals();

        // Refetch goals periodically (every 5 minutes) in case they change
        const intervalId = setInterval(fetchGoals, 5 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, [session, status]);

    // Don't render if not authenticated
    if (status !== "authenticated") {
        return null;
    }

    return <ScheduleNotificationManager goals={customGoals} />;
}
