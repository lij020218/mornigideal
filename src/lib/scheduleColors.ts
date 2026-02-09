/**
 * 일정 컬러 매핑 — 앱 전체에서 공유
 *
 * 'primary' → 'purple'로 정규화 (primary는 테마에서 검정이라 혼동 방지)
 */

const COLORS = [
    'yellow', 'purple', 'green', 'blue', 'red', 'orange', 'pink',
    'amber', 'indigo', 'cyan', 'teal', 'emerald', 'violet', 'rose', 'sky',
] as const;

export type ScheduleColor = (typeof COLORS)[number] | 'primary';

export function normalizeColor(color?: string | null): string {
    if (!color || color === 'primary') return 'purple';
    return color;
}

// ============================================
// 아이콘 배경 그라디언트 (일정 카드 아이콘용)
// ============================================

export const iconBgMap: Record<string, string> = {
    yellow: "bg-gradient-to-br from-yellow-500 to-orange-500",
    purple: "bg-gradient-to-br from-purple-500 to-pink-500",
    green: "bg-gradient-to-br from-green-500 to-emerald-500",
    blue: "bg-gradient-to-br from-blue-500 to-cyan-500",
    red: "bg-gradient-to-br from-red-500 to-orange-500",
    orange: "bg-gradient-to-br from-orange-500 to-amber-500",
    pink: "bg-gradient-to-br from-pink-500 to-purple-500",
    amber: "bg-gradient-to-br from-amber-500 to-orange-500",
    indigo: "bg-gradient-to-br from-indigo-500 to-purple-500",
    cyan: "bg-gradient-to-br from-cyan-500 to-blue-500",
    teal: "bg-gradient-to-br from-teal-500 to-cyan-500",
    emerald: "bg-gradient-to-br from-emerald-500 to-green-500",
    violet: "bg-gradient-to-br from-violet-500 to-purple-500",
    rose: "bg-gradient-to-br from-rose-500 to-pink-500",
    sky: "bg-gradient-to-br from-sky-500 to-blue-500",
};

// ============================================
// 카드 배경 그라디언트 (20% opacity)
// ============================================

export const cardBgMap: Record<string, string> = {
    yellow: "bg-gradient-to-br from-yellow-500/20 to-orange-500/20",
    purple: "bg-gradient-to-br from-purple-500/20 to-pink-500/20",
    green: "bg-gradient-to-br from-green-500/20 to-emerald-500/20",
    blue: "bg-gradient-to-br from-blue-500/20 to-cyan-500/20",
    red: "bg-gradient-to-br from-red-500/20 to-orange-500/20",
    orange: "bg-gradient-to-br from-orange-500/20 to-amber-500/20",
    pink: "bg-gradient-to-br from-pink-500/20 to-purple-500/20",
    amber: "bg-gradient-to-br from-amber-500/20 to-orange-500/20",
    indigo: "bg-gradient-to-br from-indigo-500/20 to-purple-500/20",
    cyan: "bg-gradient-to-br from-cyan-500/20 to-blue-500/20",
    teal: "bg-gradient-to-br from-teal-500/20 to-cyan-500/20",
    emerald: "bg-gradient-to-br from-emerald-500/20 to-green-500/20",
    violet: "bg-gradient-to-br from-violet-500/20 to-purple-500/20",
    rose: "bg-gradient-to-br from-rose-500/20 to-pink-500/20",
    sky: "bg-gradient-to-br from-sky-500/20 to-blue-500/20",
};

// ============================================
// 카드 보더 (50% opacity)
// ============================================

export const cardBorderMap: Record<string, string> = {
    yellow: "border-yellow-500/50",
    purple: "border-purple-500/50",
    green: "border-green-500/50",
    blue: "border-blue-500/50",
    red: "border-red-500/50",
    orange: "border-orange-500/50",
    pink: "border-pink-500/50",
    amber: "border-amber-500/50",
    indigo: "border-indigo-500/50",
    cyan: "border-cyan-500/50",
    teal: "border-teal-500/50",
    emerald: "border-emerald-500/50",
    violet: "border-violet-500/50",
    rose: "border-rose-500/50",
    sky: "border-sky-500/50",
};

// ============================================
// 카드 섀도우 (15% opacity glow)
// ============================================

export const cardShadowMap: Record<string, string> = {
    yellow: "shadow-[0_0_15px_rgba(234,179,8,0.15)]",
    purple: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
    green: "shadow-[0_0_15px_rgba(34,197,94,0.15)]",
    blue: "shadow-[0_0_15px_rgba(59,130,246,0.15)]",
    red: "shadow-[0_0_15px_rgba(239,68,68,0.15)]",
    orange: "shadow-[0_0_15px_rgba(249,115,22,0.15)]",
    pink: "shadow-[0_0_15px_rgba(236,72,153,0.15)]",
    amber: "shadow-[0_0_15px_rgba(245,158,11,0.15)]",
    indigo: "shadow-[0_0_15px_rgba(99,102,241,0.15)]",
    cyan: "shadow-[0_0_15px_rgba(6,182,212,0.15)]",
    teal: "shadow-[0_0_15px_rgba(20,184,166,0.15)]",
    emerald: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
    violet: "shadow-[0_0_15px_rgba(139,92,246,0.15)]",
    rose: "shadow-[0_0_15px_rgba(244,63,94,0.15)]",
    sky: "shadow-[0_0_15px_rgba(14,165,233,0.15)]",
};

// ============================================
// 뱃지 스타일 (진행 중 / 예정)
// ============================================

export const inProgressBadgeMap: Record<string, string> = {
    yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    purple: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    green: "bg-green-500/20 text-green-300 border-green-500/30",
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    red: "bg-red-500/20 text-red-300 border-red-500/30",
    orange: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    pink: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    amber: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    indigo: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    cyan: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    teal: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    violet: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    rose: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    sky: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    primary: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

export const scheduledBadgeMap: Record<string, string> = {
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    pink: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    indigo: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    teal: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    sky: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    primary: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

// ============================================
// 소프트 카드 배경 (15% opacity — 예정 일정용)
// ============================================

export const softCardBgMap: Record<string, string> = {
    yellow: "bg-gradient-to-br from-yellow-500/15 to-orange-500/15",
    purple: "bg-gradient-to-br from-purple-500/15 to-pink-500/15",
    green: "bg-gradient-to-br from-green-500/15 to-emerald-500/15",
    blue: "bg-gradient-to-br from-blue-500/15 to-cyan-500/15",
    red: "bg-gradient-to-br from-red-500/15 to-orange-500/15",
    orange: "bg-gradient-to-br from-orange-500/15 to-amber-500/15",
    pink: "bg-gradient-to-br from-pink-500/15 to-purple-500/15",
    amber: "bg-gradient-to-br from-amber-500/15 to-orange-500/15",
    indigo: "bg-gradient-to-br from-indigo-500/15 to-purple-500/15",
    cyan: "bg-gradient-to-br from-cyan-500/15 to-blue-500/15",
    teal: "bg-gradient-to-br from-teal-500/15 to-cyan-500/15",
    emerald: "bg-gradient-to-br from-emerald-500/15 to-green-500/15",
    violet: "bg-gradient-to-br from-violet-500/15 to-purple-500/15",
    rose: "bg-gradient-to-br from-rose-500/15 to-pink-500/15",
    sky: "bg-gradient-to-br from-sky-500/15 to-blue-500/15",
};

// ============================================
// 소프트 보더 (40% opacity — 예정 일정용)
// ============================================

export const softCardBorderMap: Record<string, string> = {
    yellow: "border-yellow-500/40",
    purple: "border-purple-500/40",
    green: "border-green-500/40",
    blue: "border-blue-500/40",
    red: "border-red-500/40",
    orange: "border-orange-500/40",
    pink: "border-pink-500/40",
    amber: "border-amber-500/40",
    indigo: "border-indigo-500/40",
    cyan: "border-cyan-500/40",
    teal: "border-teal-500/40",
    emerald: "border-emerald-500/40",
    violet: "border-violet-500/40",
    rose: "border-rose-500/40",
    sky: "border-sky-500/40",
};

// ============================================
// 소프트 섀도우 (10% — 예정 일정용)
// ============================================

export const softCardShadowMap: Record<string, string> = {
    yellow: "shadow-[0_0_10px_rgba(234,179,8,0.1)]",
    purple: "shadow-[0_0_10px_rgba(168,85,247,0.1)]",
    green: "shadow-[0_0_10px_rgba(34,197,94,0.1)]",
    blue: "shadow-[0_0_10px_rgba(59,130,246,0.1)]",
    red: "shadow-[0_0_10px_rgba(239,68,68,0.1)]",
    orange: "shadow-[0_0_10px_rgba(249,115,22,0.1)]",
    pink: "shadow-[0_0_10px_rgba(236,72,153,0.1)]",
    amber: "shadow-[0_0_10px_rgba(245,158,11,0.1)]",
    indigo: "shadow-[0_0_10px_rgba(99,102,241,0.1)]",
    cyan: "shadow-[0_0_10px_rgba(6,182,212,0.1)]",
    teal: "shadow-[0_0_10px_rgba(20,184,166,0.1)]",
    emerald: "shadow-[0_0_10px_rgba(16,185,129,0.1)]",
    violet: "shadow-[0_0_10px_rgba(139,92,246,0.1)]",
    rose: "shadow-[0_0_10px_rgba(244,63,94,0.1)]",
    sky: "shadow-[0_0_10px_rgba(14,165,233,0.1)]",
};

// ============================================
// 아이콘 섀도우 (30% — 아이콘 배경용)
// ============================================

export const iconShadowMap: Record<string, string> = {
    yellow: "shadow-yellow-500/30",
    purple: "shadow-purple-500/30",
    green: "shadow-green-500/30",
    blue: "shadow-blue-500/30",
    red: "shadow-red-500/30",
    orange: "shadow-orange-500/30",
    pink: "shadow-pink-500/30",
    amber: "shadow-amber-500/30",
    indigo: "shadow-indigo-500/30",
    cyan: "shadow-cyan-500/30",
    teal: "shadow-teal-500/30",
    emerald: "shadow-emerald-500/30",
    violet: "shadow-violet-500/30",
    rose: "shadow-rose-500/30",
    sky: "shadow-sky-500/30",
};

// ============================================
// 헬퍼 함수
// ============================================

export function getIconBg(color?: string | null): string {
    const c = normalizeColor(color);
    return iconBgMap[c] || iconBgMap.purple;
}

export function getCardBg(color?: string | null): string {
    const c = normalizeColor(color);
    return cardBgMap[c] || cardBgMap.purple;
}

export function getCardBorder(color?: string | null): string {
    const c = normalizeColor(color);
    return cardBorderMap[c] || cardBorderMap.purple;
}

export function getCardShadow(color?: string | null): string {
    const c = normalizeColor(color);
    return cardShadowMap[c] || cardShadowMap.purple;
}

export function getBadgeStyle(color?: string | null, isInProgress?: boolean): string {
    const c = normalizeColor(color);
    const map = isInProgress ? inProgressBadgeMap : scheduledBadgeMap;
    return map[c] || map.purple;
}

/** 진행 중 일정 카드 스타일 (bg + border + shadow + ring) */
export function getInProgressCardStyle(color?: string | null): string {
    const c = normalizeColor(color);
    return `${cardBgMap[c] || cardBgMap.purple} border ${cardBorderMap[c] || cardBorderMap.purple} ${cardShadowMap[c] || cardShadowMap.purple} ring-1 ${cardBorderMap[c] || cardBorderMap.purple}`;
}

/** 예정 일정 카드 스타일 (소프트 bg + border + shadow) */
export function getUpcomingCardStyle(color?: string | null): string {
    const c = normalizeColor(color);
    return `${softCardBgMap[c] || softCardBgMap.purple} border ${softCardBorderMap[c] || softCardBorderMap.purple} ${softCardShadowMap[c] || softCardShadowMap.purple}`;
}

/** 아이콘 배경 + 섀도우 + 링 (카드 내 아이콘용) */
export function getIconStyle(color?: string | null): string {
    const c = normalizeColor(color);
    return `${iconBgMap[c] || iconBgMap.purple} ${iconShadowMap[c] || iconShadowMap.purple} ring-2 ring-white/20`;
}
