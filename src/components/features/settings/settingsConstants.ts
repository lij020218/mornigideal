import { Crown, Zap, RefreshCw, Target } from "lucide-react";

export interface UserProfile {
    job: string;
    goal: string;
    level: string;
    interests: string[];
    name: string;
}

export interface UserSettings {
    wakeUpTime: string;
    sleepTime: string;
    exerciseEnabled: boolean;
    location: string;
}

// Note: 현재 알림 설정은 각 일정별로 notificationEnabled 플래그로 관리됩니다.
// 아래 인터페이스는 향후 기능 확장을 위해 유지합니다.
export interface NotificationSettings {
    dailyReminder: boolean;      // 준비 중
    scheduleAlerts: boolean;     // 일정별 설정으로 대체됨
    trendAlerts: boolean;        // 준비 중
    weeklyReport: boolean;       // 자동 생성 (설정 불필요)
    emailNotifications: boolean; // 준비 중
    soundEnabled: boolean;       // 준비 중
    reminderMinutes: number;     // 준비 중
}

export interface AppearanceSettings {
    theme: "system" | "light" | "dark";
    fontSize: "small" | "medium" | "large";
    language: "ko" | "en";
    compactMode: boolean;
    animationsEnabled: boolean;
}

export interface AISettings {
    responseStyle: "concise" | "detailed" | "balanced";
    learningDifficulty: "easy" | "moderate" | "challenging";
    autoSuggestions: boolean;
    proactiveInsights: boolean;
}

export const locationOptions = [
    { id: 'Seoul,KR', label: '서울' },
    { id: 'Busan,KR', label: '부산' },
    { id: 'Incheon,KR', label: '인천' },
    { id: 'Daegu,KR', label: '대구' },
    { id: 'Daejeon,KR', label: '대전' },
    { id: 'Gwangju,KR', label: '광주' },
    { id: 'Ulsan,KR', label: '울산' },
    { id: 'Sejong,KR', label: '세종' },
    { id: 'Suwon,KR', label: '수원' },
    { id: 'Yongin,KR', label: '용인' },
    { id: 'Goyang,KR', label: '고양' },
    { id: 'Seongnam,KR', label: '성남' },
    { id: 'Jeonju,KR', label: '전주' },
    { id: 'Cheongju,KR', label: '청주' },
    { id: 'Changwon,KR', label: '창원' },
    { id: 'Jeju,KR', label: '제주' },
];

export const goalOptions = [
    { id: "expert", label: "업계 최고의 전문가 되기", icon: Crown },
    { id: "promotion", label: "빠른 승진 및 연봉 인상", icon: Zap },
    { id: "switch", label: "성공적인 직무 전환", icon: RefreshCw },
    { id: "balance", label: "워라밸 개선", icon: Target },
];

export const interestOptions = [
    { id: "tech", label: "기술/IT" },
    { id: "business", label: "비즈니스" },
    { id: "design", label: "디자인" },
    { id: "marketing", label: "마케팅" },
    { id: "finance", label: "금융/재테크" },
    { id: "health", label: "건강/운동" },
    { id: "language", label: "외국어" },
    { id: "creative", label: "창작/예술" },
];
