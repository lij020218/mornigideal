"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function BackgroundBlobs() {
    // Only render on client to avoid hydration mismatch with random positions if we were to use them
    // But here we'll use CSS animations for consistency

    return (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[#0a0a0a]" />

            {/* Main gradients */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/20 blur-[100px] animate-blob" />
            <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/10 blur-[100px] animate-blob animation-delay-2000" />
            <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[120px] animate-blob animation-delay-4000" />

            {/* Subtle overlay texture */}
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02]" />
        </div>
    );
}
