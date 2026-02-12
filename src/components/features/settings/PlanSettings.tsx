/**
 * 플랜 설정 컴포넌트
 * - 현재 플랜 표시
 * - 플랜 비교 및 선택
 * - 사용량 통계 표시
 */

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Crown,
    Zap,
    Star,
    Check,
    Sparkles,
    Brain,
    AlertTriangle,
    Newspaper,
    Infinity,
    RefreshCw,
    ChevronRight
} from "lucide-react";
import { useUserPlan, UserPlanType, PlanFeatures } from "@/hooks/useUserPlan";
import { toast } from "sonner";

// 플랜별 아이콘 및 색상
const PLAN_STYLES: Record<UserPlanType, {
    icon: React.ReactNode;
    gradient: string;
    badge: string;
    border: string;
}> = {
    free: {
        icon: <Star className="w-5 h-5 text-white" />,
        gradient: "from-gray-500 to-gray-600",
        badge: "bg-gray-500/20 text-gray-700",
        border: "border-gray-500/30",
    },
    pro: {
        icon: <Zap className="w-5 h-5 text-white" />,
        gradient: "from-blue-500 to-purple-600",
        badge: "bg-blue-500/20 text-blue-600",
        border: "border-blue-500/30",
    },
    max: {
        icon: <Crown className="w-5 h-5 text-white" />,
        gradient: "from-amber-500 to-orange-600",
        badge: "bg-amber-500/20 text-amber-600",
        border: "border-amber-500/30",
    },
};

// 플랜 상세 정보
const PLAN_INFO: Record<UserPlanType, {
    name: string;
    nameKo: string;
    price: string;
    description: string;
    features: { icon: React.ReactNode; text: string; highlight?: boolean }[];
}> = {
    free: {
        name: "Free",
        nameKo: "무료",
        price: "무료",
        description: "AI 일정 비서 + 선제적 알림",
        features: [
            { icon: <Check className="w-4 h-4 text-green-500" />, text: "일일 AI 호출 30회" },
            { icon: <Check className="w-4 h-4 text-green-500" />, text: "AI 채팅 + 일정 관리" },
            { icon: <Check className="w-4 h-4 text-green-500" />, text: "컨텍스트 융합 (날씨+일정)" },
            { icon: <Check className="w-4 h-4 text-green-500" />, text: "선제적 알림 + 메모리 서피싱" },
        ],
    },
    pro: {
        name: "Pro",
        nameKo: "프로",
        price: "₩6,900",
        description: "ReAct 에이전트 + 스마트 알림",
        features: [
            { icon: <Check className="w-4 h-4 text-green-500" />, text: "일일 AI 호출 100회" },
            { icon: <Check className="w-4 h-4 text-green-500" />, text: "Free의 모든 기능" },
            { icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />, text: "리스크 알림", highlight: true },
            { icon: <Newspaper className="w-4 h-4 text-blue-500" />, text: "스마트 뉴스 브리핑", highlight: true },
        ],
    },
    max: {
        name: "Max",
        nameKo: "맥스",
        price: "₩14,900",
        description: "AI가 당신을 기억합니다",
        features: [
            { icon: <Infinity className="w-4 h-4 text-amber-500" />, text: "무제한 AI 호출", highlight: true },
            { icon: <Check className="w-4 h-4 text-green-500" />, text: "Pro의 모든 기능" },
            { icon: <Brain className="w-4 h-4 text-purple-500" />, text: "AI 장기 기억 (RAG)", highlight: true },
            { icon: <Sparkles className="w-4 h-4 text-amber-500" />, text: "자동 실행 모드", highlight: true },
        ],
    },
};

export function PlanSettings() {
    const { plan, usage, isLoading, error, refetch } = useUserPlan();
    const [selectedPlan, setSelectedPlan] = useState<UserPlanType | null>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    if (isLoading) {
        return (
            <Card className="glass-card border-none">
                <CardContent className="py-12">
                    <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-muted-foreground">플랜 정보 로딩 중...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || !plan) {
        return (
            <Card className="glass-card border-none">
                <CardContent className="py-8">
                    <div className="text-center space-y-4">
                        <p className="text-red-400">플랜 정보를 불러올 수 없습니다.</p>
                        <Button variant="outline" onClick={refetch}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            다시 시도
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const currentPlanStyle = PLAN_STYLES[plan.plan];
    const currentPlanInfo = PLAN_INFO[plan.plan];

    const handleUpgrade = (targetPlan: UserPlanType) => {
        setSelectedPlan(targetPlan);
        setShowUpgradeModal(true);
    };

    const handleConfirmUpgrade = async () => {
        // 실제 결제 시스템 연동 전까지는 안내 메시지만 표시
        toast.info(`${PLAN_INFO[selectedPlan!].nameKo} 플랜으로 업그레이드하려면 결제가 필요합니다. 결제 시스템은 준비 중입니다.`);
        setShowUpgradeModal(false);
        setSelectedPlan(null);
    };

    return (
        <Card className="glass-card border-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Crown className="w-5 h-5 text-primary" />
                    플랜 & 결제
                </CardTitle>
                <CardDescription>현재 구독 플랜을 확인하고 업그레이드할 수 있습니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* 현재 플랜 표시 */}
                <div className={`p-4 rounded-xl bg-gradient-to-r ${currentPlanStyle.gradient} border ${currentPlanStyle.border}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-full bg-white/20 flex items-center justify-center`}>
                                {currentPlanStyle.icon}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-white">{currentPlanInfo.nameKo}</h3>
                                    <Badge className="bg-white/20 text-white">현재 플랜</Badge>
                                </div>
                                <p className="text-sm text-white/80">{currentPlanInfo.description}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-white">{currentPlanInfo.price}</p>
                            <p className="text-sm text-white/70">/월</p>
                        </div>
                    </div>

                    {/* 사용량 표시 (무제한이 아닌 경우) */}
                    {plan.dailyAiCallsLimit !== null && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-white/80">오늘 AI 사용량</span>
                                <span className="font-medium text-white">
                                    {usage?.totalCalls || 0} / {plan.dailyAiCallsLimit}회
                                </span>
                            </div>
                            <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white/80 transition-all"
                                    style={{
                                        width: `${Math.min(100, ((usage?.totalCalls || 0) / plan.dailyAiCallsLimit) * 100)}%`
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {plan.dailyAiCallsLimit === null && (
                        <div className="mt-4 pt-4 border-t border-white/20">
                            <div className="flex items-center gap-2 text-sm text-white/80">
                                <Infinity className="w-4 h-4 text-white" />
                                <span>무제한 AI 호출</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 플랜 비교 */}
                <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground">플랜 비교</h4>

                    {(["free", "pro", "max"] as UserPlanType[]).map((planType) => {
                        const info = PLAN_INFO[planType];
                        const style = PLAN_STYLES[planType];
                        const isCurrent = plan.plan === planType;
                        const isUpgrade =
                            (plan.plan === "free" && (planType === "pro" || planType === "max")) ||
                            (plan.plan === "pro" && planType === "max");

                        return (
                            <div
                                key={planType}
                                className={`p-4 rounded-lg border transition-all ${
                                    isCurrent
                                        ? `${style.border} bg-gray-100`
                                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${style.gradient} flex items-center justify-center`}>
                                            {style.icon}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">{info.nameKo}</span>
                                                {isCurrent && (
                                                    <Badge variant="outline" className="text-xs">현재</Badge>
                                                )}
                                                {planType === "max" && !isCurrent && (
                                                    <Badge className="bg-amber-500/20 text-amber-600 text-xs">추천</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600">{info.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="font-bold text-gray-900">{info.price}</p>
                                            <p className="text-xs text-gray-500">/월</p>
                                        </div>
                                        {isUpgrade && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleUpgrade(planType)}
                                                className={`bg-gradient-to-r ${style.gradient} hover:opacity-90 text-white`}
                                            >
                                                업그레이드
                                                <ChevronRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* 기능 목록 (펼치기) */}
                                <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2">
                                    {info.features.map((feature, idx) => (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-2 text-sm ${
                                                feature.highlight ? "text-gray-900 font-medium" : "text-gray-600"
                                            }`}
                                        >
                                            {feature.icon}
                                            <span>{feature.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 업그레이드 모달 */}
                {showUpgradeModal && selectedPlan && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-200 space-y-4">
                            <div className="text-center">
                                <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-br ${PLAN_STYLES[selectedPlan].gradient} flex items-center justify-center mb-4`}>
                                    {PLAN_STYLES[selectedPlan].icon}
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">
                                    {PLAN_INFO[selectedPlan].nameKo} 플랜으로 업그레이드
                                </h3>
                                <p className="text-gray-600 mt-2">
                                    {PLAN_INFO[selectedPlan].price}/월
                                </p>
                            </div>

                            <div className="bg-gray-100 rounded-lg p-4 space-y-2">
                                <p className="text-sm font-medium text-gray-900">포함된 기능:</p>
                                {PLAN_INFO[selectedPlan].features.map((feature, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm">
                                        {feature.icon}
                                        <span className={feature.highlight ? "text-gray-900 font-medium" : "text-gray-600"}>
                                            {feature.text}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => {
                                        setShowUpgradeModal(false);
                                        setSelectedPlan(null);
                                    }}
                                >
                                    취소
                                </Button>
                                <Button
                                    className={`flex-1 bg-gradient-to-r ${PLAN_STYLES[selectedPlan].gradient} hover:opacity-90 text-white`}
                                    onClick={handleConfirmUpgrade}
                                >
                                    결제하기
                                </Button>
                            </div>

                            <p className="text-xs text-center text-gray-500">
                                결제 시스템 연동 후 실제 결제가 진행됩니다
                            </p>
                        </div>
                    </div>
                )}

                {/* 플랜 만료 정보 */}
                {plan.expiresAt && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-sm text-yellow-700">
                            플랜 만료일: {new Date(plan.expiresAt).toLocaleDateString('ko-KR')}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
