"use client";

import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        const handleOffline = () => setIsOffline(true);
        const handleOnline = () => setIsOffline(false);

        // 초기 상태 설정
        setIsOffline(!navigator.onLine);

        window.addEventListener("offline", handleOffline);
        window.addEventListener("online", handleOnline);

        return () => {
            window.removeEventListener("offline", handleOffline);
            window.removeEventListener("online", handleOnline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" />
            인터넷 연결을 확인해주세요
        </div>
    );
}
