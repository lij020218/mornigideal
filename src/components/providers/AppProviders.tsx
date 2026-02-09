"use client";

import { ReactNode } from "react";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface AppProvidersProps {
    children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
    return (
        <ErrorBoundary>
            <SessionProvider>
                <Toaster
                    position="top-center"
                    richColors
                    toastOptions={{
                        duration: 3000,
                        style: { fontSize: '14px' },
                    }}
                />
                {children}
            </SessionProvider>
        </ErrorBoundary>
    );
}
