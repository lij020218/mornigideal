"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { CalendarCheck, Newspaper, ChevronLeft, ChevronRight } from "lucide-react";

interface SwipeableStatsProps {
    scheduleCompletion: {
        completed: number;
        total: number;
    };
    briefingCompletion: {
        read: number;
        total: number;
    };
}

function CircularProgress({
    percentage,
    size = 120,
    strokeWidth = 10,
    color = "amber"
}: {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    color?: "amber" | "blue";
}) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    const colorClasses = {
        amber: {
            stroke: "stroke-amber-500",
            text: "text-amber-600",
            bg: "stroke-amber-100",
        },
        blue: {
            stroke: "stroke-blue-500",
            text: "text-blue-600",
            bg: "stroke-blue-100",
        },
    };

    const colors = colorClasses[color];

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90" width={size} height={size}>
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    className={colors.bg}
                />
                {/* Progress circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className={colors.stroke}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    style={{
                        strokeDasharray: circumference,
                    }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("text-2xl sm:text-3xl font-bold", colors.text)}>
                    {Math.round(percentage)}%
                </span>
            </div>
        </div>
    );
}

export function SwipeableStats({ scheduleCompletion, briefingCompletion }: SwipeableStatsProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const schedulePercentage = scheduleCompletion.total > 0
        ? (scheduleCompletion.completed / scheduleCompletion.total) * 100
        : 0;

    const briefingPercentage = briefingCompletion.total > 0
        ? (briefingCompletion.read / briefingCompletion.total) * 100
        : 0;

    const cards = [
        {
            id: "schedule",
            title: "오늘 일정 달성률",
            icon: CalendarCheck,
            percentage: schedulePercentage,
            completed: scheduleCompletion.completed,
            total: scheduleCompletion.total,
            color: "amber" as const,
            message: schedulePercentage >= 70 ? "잘하고 있어요!" : schedulePercentage >= 30 ? "조금만 더 힘내요!" : "오늘도 파이팅!",
        },
        {
            id: "briefing",
            title: "트렌드 브리핑",
            icon: Newspaper,
            percentage: briefingPercentage,
            completed: briefingCompletion.read,
            total: briefingCompletion.total,
            color: "blue" as const,
            message: briefingPercentage >= 70 ? "트렌드 마스터!" : briefingPercentage >= 30 ? "꾸준히 읽고 있네요" : "오늘의 트렌드를 확인하세요",
        },
    ];

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 50;
        if (info.offset.x < -threshold && currentIndex < cards.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else if (info.offset.x > threshold && currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const goToNext = () => {
        if (currentIndex < cards.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const goToPrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    return (
        <div className="relative">
            {/* Navigation Arrows - Desktop */}
            <button
                onClick={goToPrev}
                className={cn(
                    "hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10",
                    "w-8 h-8 rounded-full bg-white shadow-lg items-center justify-center",
                    "hover:bg-gray-50 transition-all",
                    currentIndex === 0 && "opacity-30 pointer-events-none"
                )}
            >
                <ChevronLeft className="w-4 h-4" />
            </button>
            <button
                onClick={goToNext}
                className={cn(
                    "hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10",
                    "w-8 h-8 rounded-full bg-white shadow-lg items-center justify-center",
                    "hover:bg-gray-50 transition-all",
                    currentIndex === cards.length - 1 && "opacity-30 pointer-events-none"
                )}
            >
                <ChevronRight className="w-4 h-4" />
            </button>

            {/* Cards Container */}
            <div
                ref={containerRef}
                className="overflow-hidden rounded-2xl"
            >
                <motion.div
                    drag="x"
                    dragConstraints={containerRef}
                    dragElastic={0.1}
                    onDragEnd={handleDragEnd}
                    animate={{ x: -currentIndex * 100 + "%" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="flex cursor-grab active:cursor-grabbing"
                >
                    {cards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <div
                                key={card.id}
                                className="w-full flex-shrink-0 px-1"
                            >
                                <div className="glass-card rounded-2xl p-5 sm:p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center",
                                            card.color === "amber"
                                                ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white"
                                                : "bg-gradient-to-br from-blue-500 to-cyan-500 text-white"
                                        )}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <h3 className="font-bold text-sm sm:text-base">{card.title}</h3>
                                    </div>

                                    <div className="flex items-center justify-center gap-6 sm:gap-8">
                                        <CircularProgress
                                            percentage={card.percentage}
                                            size={100}
                                            strokeWidth={8}
                                            color={card.color}
                                        />

                                        <div className="flex flex-col gap-1">
                                            <p className="text-2xl sm:text-3xl font-bold">
                                                <span className={card.color === "amber" ? "text-amber-600" : "text-blue-600"}>
                                                    {card.completed}
                                                </span>
                                                <span className="text-muted-foreground text-lg">/{card.total}</span>
                                            </p>
                                            <p className="text-xs sm:text-sm text-muted-foreground">
                                                {card.message}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </motion.div>
            </div>

            {/* Dots Indicator */}
            <div className="flex justify-center gap-2 mt-3">
                {cards.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={cn(
                            "w-2 h-2 rounded-full transition-all",
                            index === currentIndex
                                ? "w-6 bg-gradient-to-r from-amber-500 to-orange-500"
                                : "bg-gray-200 hover:bg-gray-300"
                        )}
                    />
                ))}
            </div>

            {/* Swipe hint - Mobile only */}
            <p className="sm:hidden text-center text-[10px] text-muted-foreground mt-2">
                좌우로 스와이프
            </p>
        </div>
    );
}
