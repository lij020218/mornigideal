"use client";

import { ReactNode } from "react";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { FocusSleepModeProvider } from "@/contexts/FocusSleepModeContext";
import { ChatNotificationProvider } from "@/contexts/ChatNotificationContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { AppUsageInitializer } from "@/components/AppUsageInitializer";
import { FocusModeOverlay, SleepModeIndicator, SleepModePrompt, FocusModePrompt, FocusWarningToast } from "@/components/features/modes";
import { ScheduleFeedbackPrompt } from "@/components/features/modes/ScheduleFeedbackPrompt";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { GlobalScheduleRecommender } from "@/components/GlobalScheduleRecommender";
import { GlobalScheduleNotificationManager } from "@/components/GlobalScheduleNotificationManager";

interface AppProvidersProps {
    children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
    return (
        <ErrorBoundary>
            <SessionProvider>
                <FocusSleepModeProvider>
                    <ChatNotificationProvider>
                        <Toaster
                            position="top-center"
                            richColors
                            toastOptions={{
                                duration: 3000,
                                style: { fontSize: '14px' },
                            }}
                        />
                        <OfflineIndicator />
                        <AppUsageInitializer />
                        <GlobalScheduleRecommender />
                        <GlobalScheduleNotificationManager />
                        <FocusModeOverlay />
                        <SleepModeIndicator />
                        <SleepModePrompt />
                        <FocusModePrompt />
                        <FocusWarningToast />
                        <ScheduleFeedbackPrompt />
                        <Sidebar />
                        <Header />
                        {children}
                    </ChatNotificationProvider>
                </FocusSleepModeProvider>
            </SessionProvider>
        </ErrorBoundary>
    );
}
