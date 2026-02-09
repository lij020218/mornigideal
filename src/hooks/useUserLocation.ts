"use client";

import { useState, useEffect } from "react";

/** 브라우저 위치 정보 (허용 시 1회 획득) */
export function useUserLocation(): { latitude: number; longitude: number; city?: string } | null {
    const [location, setLocation] = useState<{ latitude: number; longitude: number; city?: string } | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                });
            },
            () => {}, // 거부 시 무시
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 30 * 60 * 1000 }
        );
    }, []);

    return location;
}
