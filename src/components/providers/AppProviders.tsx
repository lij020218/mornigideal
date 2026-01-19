"use client";

import { ReactNode } from "react";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { FocusSleepModeProvider } from "@/contexts/FocusSleepModeContext";
import { ChatNotificationProvider } from "@/contexts/ChatNotificationContext";
import { AppUsageInitializer } from "@/components/AppUsageInitializer";
import { FocusModeOverlay, SleepModeIndicator, SleepModePrompt, FocusModePrompt, FocusWarningToast } from "@/components/features/modes";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { GlobalScheduleRecommender } from "@/components/GlobalScheduleRecommender";
import { GlobalScheduleNotificationManager } from "@/components/GlobalScheduleNotificationManager";

interface AppProvidersProps {
    children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
    return (
        <SessionProvider>
            <FocusSleepModeProvider>
                <ChatNotificationProvider>
                    <AppUsageInitializer />
                    <GlobalScheduleRecommender />
                    <GlobalScheduleNotificationManager />
                    <FocusModeOverlay />
                    <SleepModeIndicator />
                    <SleepModePrompt />
                    <FocusModePrompt />
                    <FocusWarningToast />
                    <Sidebar />
                    <Header />
                    {children}
                </ChatNotificationProvider>
            </FocusSleepModeProvider>
        </SessionProvider>
    );
}
