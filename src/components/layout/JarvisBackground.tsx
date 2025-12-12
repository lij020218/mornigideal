"use client";

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export function JarvisBackground() {
    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#030712] pointer-events-none">
            {/* Deep Radial Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.03),rgba(15,23,42,0.8),#030712)]" />

            {/* Hexagonal Grid Overlay */}
            <div className="absolute inset-0 opacity-[0.07]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60L4.02 45V15L30 0z' stroke='%2306b6d4' stroke-width='1' fill='none'/%3E%3C/svg%3E")`,
                    backgroundSize: '60px 60px'
                }}
            />

            {/* Rotating Tech Ring (Subtle) */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-cyan-500/5 rounded-full border-dashed opacity-30"
            />

            <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-blue-500/5 rounded-full opacity-30"
            />
        </div>
    );
}
