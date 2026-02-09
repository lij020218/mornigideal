"use client";

import { useState, useEffect } from "react";

/** 주어진 문자열 배열을 intervalMs 간격으로 순환 */
export function usePlaceholderRotation(items: string[], intervalMs = 4000): string {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % items.length);
        }, intervalMs);
        return () => clearInterval(interval);
    }, [items.length, intervalMs]);

    return items[index];
}
