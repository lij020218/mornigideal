"use client";

import { useEffect } from "react";
import { initializeAppTracking } from "@/lib/appUsageTracking";

/**
 * App Usage Initializer Component
 *
 * 이 컴포넌트는 앱이 로드될 때 자동으로 사용 시간 추적을 시작합니다.
 * 메인 레이아웃이나 최상위 컴포넌트에 추가하세요.
 */
export function AppUsageInitializer() {
    useEffect(() => {
        // Initialize app usage tracking
        initializeAppTracking('fieri');

        // Cleanup function
        return () => {
            // No cleanup needed - visibility change listener is global
        };
    }, []);

    // This component doesn't render anything
    return null;
}
