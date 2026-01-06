"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lightbulb, Plus, Clock, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Suggestion {
    id: string;
    title: string;
    description: string;
    action: string;
    category: "exercise" | "learning" | "productivity" | "wellness";
    estimatedTime: string;
    priority: "high" | "medium" | "low";
    icon: string;
}

interface TodaySuggestionsProps {
    userProfile: {
        job: string;
        goal: string;
        level: string;
    } | null;
    currentTime: Date;
    onAddToSchedule?: (suggestion: Suggestion) => void;
}

export function TodaySuggestions({ userProfile, currentTime, onAddToSchedule }: TodaySuggestionsProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());
    const [selectedVariant, setSelectedVariant] = useState(0);

    const hour = currentTime.getHours();

    // Load added suggestions from localStorage on mount
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const storedKey = `added_suggestions_${today}`;
        const stored = localStorage.getItem(storedKey);

        if (stored) {
            try {
                const addedIds = JSON.parse(stored);
                setAddedSuggestions(new Set(addedIds));
            } catch (e) {
                console.error('Failed to parse stored suggestions:', e);
            }
        }

        // Clean up old stored suggestions from previous days
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('added_suggestions_') && key !== storedKey) {
                localStorage.removeItem(key);
            }
        });
    }, []);

    // Generate time-based suggestions - only regenerate when hour changes or user profile changes
    useEffect(() => {
        generateSuggestions();
    }, [hour, userProfile]);

    // Rotate variant every 30 minutes instead of every second
    useEffect(() => {
        const rotationInterval = setInterval(() => {
            setSelectedVariant(prev => (prev + 1) % 3);
        }, 30 * 60 * 1000); // 30 minutes

        return () => clearInterval(rotationInterval);
    }, []);

    // Get specific actionable suggestions based on job and goal
    const getSpecificSuggestion = (job: string, goal: string): Suggestion => {
        // Parse goal to extract key information
        const goalLower = goal.toLowerCase();

        // AI/Tech Startup related
        if (goalLower.includes("ai") || goalLower.includes("인공지능") || goalLower.includes("머신러닝")) {
            if (goalLower.includes("창업") || goalLower.includes("스타트업")) {
                const suggestions = [
                    {
                        id: "ai-startup-mvp",
                        title: "AI 서비스 MVP 프로토타입 제작",
                        description: "간단한 AI 기능을 가진 최소 기능 제품을 만들어 시장 검증",
                        action: "AI MVP 프로토타입 제작",
                        category: "productivity" as const,
                        estimatedTime: "1시간",
                        priority: "high" as const,
                        icon: "🤖"
                    },
                    {
                        id: "ai-startup-research",
                        title: "AI 스타트업 시장 조사",
                        description: "성공한 AI 스타트업 3개 분석 및 비즈니스 모델 연구",
                        action: "AI 스타트업 사례 분석",
                        category: "learning" as const,
                        estimatedTime: "45분",
                        priority: "high" as const,
                        icon: "📊"
                    },
                    {
                        id: "ai-startup-pitch",
                        title: "투자 피칭 자료 작성",
                        description: "AI 서비스의 핵심 가치 제안과 비즈니스 모델 정리",
                        action: "피칭덱 작성",
                        category: "productivity" as const,
                        estimatedTime: "1시간",
                        priority: "high" as const,
                        icon: "💼"
                    }
                ];
                return suggestions[selectedVariant % suggestions.length];
            }
        }

        // Development related
        if (job.includes("개발자") || job.includes("developer") || job.includes("엔지니어")) {
            const suggestions = [
                {
                    id: "dev-coding-practice",
                    title: "알고리즘 문제 풀이",
                    description: "LeetCode/백준에서 중급 난이도 문제 1개 해결",
                    action: "알고리즘 문제 풀이",
                    category: "learning" as const,
                    estimatedTime: "30분",
                    priority: "high" as const,
                    icon: "💻"
                },
                {
                    id: "dev-side-project",
                    title: "사이드 프로젝트 개발",
                    description: "개인 프로젝트에 새로운 기능 1개 추가 및 커밋",
                    action: "사이드 프로젝트 작업",
                    category: "productivity" as const,
                    estimatedTime: "1시간",
                    priority: "high" as const,
                    icon: "🚀"
                },
                {
                    id: "dev-tech-study",
                    title: "신기술 학습 및 실습",
                    description: "관심있는 프레임워크/라이브러리 튜토리얼 따라하기",
                    action: "신기술 실습",
                    category: "learning" as const,
                    estimatedTime: "45분",
                    priority: "medium" as const,
                    icon: "⚡"
                }
            ];
            return suggestions[selectedVariant % suggestions.length];
        }

        // Marketing related
        if (job.includes("마케터") || job.includes("marketer") || job.includes("마케팅")) {
            const suggestions = [
                {
                    id: "marketing-campaign",
                    title: "광고 캠페인 A/B 테스트 분석",
                    description: "진행 중인 캠페인의 성과 데이터 분석 및 개선안 도출",
                    action: "캠페인 성과 분석",
                    category: "productivity" as const,
                    estimatedTime: "30분",
                    priority: "high" as const,
                    icon: "📈"
                },
                {
                    id: "marketing-content",
                    title: "콘텐츠 마케팅 아이디어 기획",
                    description: "타겟 고객을 위한 블로그/SNS 콘텐츠 3개 기획",
                    action: "콘텐츠 기획",
                    category: "productivity" as const,
                    estimatedTime: "45분",
                    priority: "high" as const,
                    icon: "✍️"
                },
                {
                    id: "marketing-competitor",
                    title: "경쟁사 마케팅 전략 분석",
                    description: "주요 경쟁사 2개의 최근 마케팅 활동 분석",
                    action: "경쟁사 분석",
                    category: "learning" as const,
                    estimatedTime: "30분",
                    priority: "medium" as const,
                    icon: "🔍"
                }
            ];
            return suggestions[selectedVariant % suggestions.length];
        }

        // Design related
        if (job.includes("디자이너") || job.includes("designer")) {
            const suggestions = [
                {
                    id: "design-practice",
                    title: "UI 디자인 연습",
                    description: "Dribbble/Behance 작품 1개 따라하며 스킬 향상",
                    action: "UI 디자인 연습",
                    category: "productivity" as const,
                    estimatedTime: "1시간",
                    priority: "high" as const,
                    icon: "🎨"
                },
                {
                    id: "design-portfolio",
                    title: "포트폴리오 프로젝트 작업",
                    description: "진행 중인 디자인 프로젝트 개선 및 완성도 향상",
                    action: "포트폴리오 작업",
                    category: "productivity" as const,
                    estimatedTime: "45분",
                    priority: "high" as const,
                    icon: "📱"
                }
            ];
            return suggestions[selectedVariant % suggestions.length];
        }

        // Business/Strategy related
        if (job.includes("경영") || job.includes("전략") || job.includes("컨설턴트")) {
            const suggestions = [
                {
                    id: "business-case-study",
                    title: "비즈니스 케이스 스터디",
                    description: "성공/실패 사례 1개 분석하고 인사이트 정리",
                    action: "케이스 스터디 분석",
                    category: "learning" as const,
                    estimatedTime: "45분",
                    priority: "high" as const,
                    icon: "📚"
                },
                {
                    id: "business-plan",
                    title: "사업 계획서 작성",
                    description: "아이디어를 구체화한 간단한 사업 계획 문서 작성",
                    action: "사업 계획서 작성",
                    category: "productivity" as const,
                    estimatedTime: "1시간",
                    priority: "high" as const,
                    icon: "📋"
                }
            ];
            return suggestions[selectedVariant % suggestions.length];
        }

        // Default fallback - goal-based suggestion
        return {
            id: "goal-specific",
            title: `${goal} 실전 연습`,
            description: "목표 달성을 위한 구체적인 실습 활동 30분",
            action: `${goal} 실습`,
            category: "productivity",
            estimatedTime: "30분",
            priority: "high",
            icon: "🎯"
        };
    };

    const generateSuggestions = () => {
        if (!userProfile) {
            setSuggestions([]);
            return;
        }

        const { job, goal } = userProfile;
        const newSuggestions: Suggestion[] = [];

        // Morning suggestions (5-12)
        if (hour >= 5 && hour < 12) {
            newSuggestions.push({
                id: "morning-exercise",
                title: "아침 스트레칭으로 하루 시작",
                description: "에너지를 충전하고 집중력을 높이는 10분 스트레칭",
                action: "아침 스트레칭",
                category: "exercise",
                estimatedTime: "10분",
                priority: "high",
                icon: "🧘"
            });

            newSuggestions.push({
                id: "morning-reading",
                title: `${job} 관련 아티클 읽기`,
                description: "최신 업계 트렌드를 파악하는 15분 독서",
                action: `${job} 아티클 읽기`,
                category: "learning",
                estimatedTime: "15분",
                priority: "medium",
                icon: "📰"
            });

            newSuggestions.push({
                id: "morning-planning",
                title: "오늘의 우선순위 3가지 정하기",
                description: "하루를 효율적으로 시작하기 위한 핵심 목표 설정",
                action: "오늘의 우선순위 정하기",
                category: "productivity",
                estimatedTime: "10분",
                priority: "high",
                icon: "📋"
            });
        }

        // Afternoon suggestions (12-18)
        if (hour >= 12 && hour < 18) {
            // Generate specific actionable suggestions based on job and goal
            const specificSuggestion = getSpecificSuggestion(job, goal);
            newSuggestions.push(specificSuggestion);

            newSuggestions.push({
                id: "afternoon-break",
                title: "에너지 재충전 휴식",
                description: "5분 명상 또는 가벼운 산책으로 집중력 회복",
                action: "휴식 및 명상",
                category: "wellness",
                estimatedTime: "5분",
                priority: "medium",
                icon: "🌿"
            });

            newSuggestions.push({
                id: "afternoon-networking",
                title: "업계 네트워킹 시간",
                description: "LinkedIn/커뮤니티에서 동료와 소통하고 인사이트 공유",
                action: "네트워킹",
                category: "productivity",
                estimatedTime: "20분",
                priority: "medium",
                icon: "🤝"
            });
        }

        // Evening suggestions (18-22)
        if (hour >= 18 && hour < 22) {
            newSuggestions.push({
                id: "evening-review",
                title: "오늘 하루 성장 복습",
                description: "배운 내용을 정리하고 내일의 계획 세우기",
                action: "하루 복습 및 정리",
                category: "productivity",
                estimatedTime: "15분",
                priority: "high",
                icon: "📝"
            });

            newSuggestions.push({
                id: "evening-exercise",
                title: "저녁 운동으로 마무리",
                description: "30분 가벼운 운동으로 건강 관리",
                action: "저녁 운동",
                category: "exercise",
                estimatedTime: "30분",
                priority: "medium",
                icon: "🏃"
            });

            newSuggestions.push({
                id: "evening-reading",
                title: "자기계발 독서",
                description: job === "개발자"
                    ? "기술 서적 또는 개발 블로그 읽기"
                    : job === "마케터"
                    ? "마케팅 트렌드 및 사례 연구"
                    : "자기계발서 또는 업계 전문서 읽기",
                action: "독서",
                category: "learning",
                estimatedTime: "30분",
                priority: "medium",
                icon: "📚"
            });
        }

        setSuggestions(newSuggestions); // Always show exactly 3 suggestions
    };

    const handleAddToSchedule = async (suggestion: Suggestion) => {
        try {
            setLoading(true);

            const now = new Date();
            const today = now.toISOString().split('T')[0];

            // Find next available time slot instead of just current hour + 1
            const response = await fetch("/api/user/schedule/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: suggestion.action,
                    specificDate: today,
                    // Let the backend API find the next available time slot
                    findAvailableSlot: true,
                    estimatedDuration: suggestion.estimatedTime,
                }),
            });

            if (response.ok) {
                const newAddedSet = new Set(addedSuggestions).add(suggestion.id);
                setAddedSuggestions(newAddedSet);

                // Save to localStorage so it persists across refreshes
                const today = new Date().toISOString().split('T')[0];
                const storedKey = `added_suggestions_${today}`;
                localStorage.setItem(storedKey, JSON.stringify(Array.from(newAddedSet)));

                if (onAddToSchedule) {
                    onAddToSchedule(suggestion);
                }

                // Keep the suggestion visible longer before removing
                setTimeout(() => {
                    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
                }, 5000); // 5 seconds - don't remove from addedSuggestions to keep "추가됨" state
            }
        } catch (error) {
            console.error("Failed to add suggestion to schedule:", error);
        } finally {
            setLoading(false);
        }
    };

    const getCategoryColor = (category: string) => {
        const colors = {
            exercise: "from-pink-500/20 to-rose-500/20 border-pink-500/30",
            learning: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
            productivity: "from-purple-500/20 to-indigo-500/20 border-purple-500/30",
            wellness: "from-green-500/20 to-emerald-500/20 border-green-500/30",
        };
        return colors[category as keyof typeof colors] || colors.productivity;
    };

    const getPriorityBadge = (priority: string) => {
        if (priority === "high") {
            return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 font-bold border border-red-500/30">HIGH</span>;
        }
        return null;
    };

    if (suggestions.length === 0) {
        return null;
    }

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
        >
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                    오늘의 AI 제안
                </h2>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateSuggestions}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    새로고침
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {suggestions.map((suggestion, index) => {
                    const isAdded = addedSuggestions.has(suggestion.id);

                    return (
                        <motion.div
                            key={suggestion.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={cn(
                                "relative overflow-hidden rounded-xl border p-5 bg-gradient-to-br backdrop-blur-sm group hover:shadow-lg transition-all",
                                getCategoryColor(suggestion.category),
                                isAdded && "opacity-50"
                            )}
                        >
                            {/* Priority Badge */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-2xl">{suggestion.icon}</span>
                                {getPriorityBadge(suggestion.priority)}
                            </div>

                            {/* Content */}
                            <div className="space-y-2 mb-4">
                                <h3 className="font-bold text-base text-foreground leading-snug">
                                    {suggestion.title}
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {suggestion.description}
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    {suggestion.estimatedTime}
                                </div>

                                {isAdded ? (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="flex items-center gap-1.5 text-xs text-green-400 font-medium"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        추가됨
                                    </motion.div>
                                ) : (
                                    <Button
                                        size="sm"
                                        onClick={() => handleAddToSchedule(suggestion)}
                                        disabled={loading}
                                        className="h-7 px-3 text-xs bg-primary/80 hover:bg-primary border-none opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        {loading ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <>
                                                <Plus className="w-3.5 h-3.5 mr-1" />
                                                일정 추가
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </motion.section>
    );
}
