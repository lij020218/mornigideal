# 앱 사용 시간 추적 기능

모바일 중심의 앱 사용 시간 추적 및 관리 시스템입니다.

## 🎯 주요 기능

### 1. 자동 사용 시간 추적
- **Page Visibility API** 기반 자동 추적
- 앱이 foreground/background 상태 감지
- 정확한 세션 단위 기록

### 2. 앱별 사용 제한 설정
- Instagram, YouTube, TikTok 등 주요 앱 지원
- 일일 사용 목표 시간 설정 (분 단위)
- 목표 초과 시 실시간 알림

### 3. 시각화 및 통계
- 오늘 총 사용 시간
- 주간 사용 추이 차트
- 앱별 사용 비율

### 4. 🆕 일일 브리핑 통합
- **어제의 디지털 사용 패턴 분석**
- 가장 많이 사용한 앱 TOP 3 표시
- SNS 과다 사용 경고 및 권장사항
- 성장 흐름에 방해될 수 있는 패턴 자동 감지
- 균형 잡힌 디지털 습관 유지 시 긍정 피드백

## 📱 모바일 환경 최적화

### PWA (Progressive Web App) 지원
```typescript
// 모바일 브라우저에서 홈 화면에 추가 가능
// Service Worker와 함께 오프라인 추적 지원
```

### 작동 원리

1. **Foreground 감지**
   ```typescript
   // 앱이 화면에 표시될 때 세션 시작
   document.addEventListener('visibilitychange', () => {
     if (!document.hidden) {
       startAppSession('a.ideal');
     }
   });
   ```

2. **Background 감지**
   ```typescript
   // 앱이 백그라운드로 이동할 때 세션 종료
   if (document.hidden) {
     endAppSession();
   }
   ```

3. **데이터 저장**
   ```typescript
   // localStorage에 세션 데이터 저장
   {
     appName: "a.ideal",
     startTime: 1234567890,
     endTime: 1234568000,
     duration: 110000, // 110초
     date: "2025-12-09"
   }
   ```

## 🚀 사용 방법

### 1. 앱 초기화

메인 레이아웃에 `AppUsageInitializer` 추가:

```tsx
// app/layout.tsx 또는 _app.tsx
import { AppUsageInitializer } from '@/components/AppUsageInitializer';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AppUsageInitializer />
        {children}
      </body>
    </html>
  );
}
```

### 2. 대시보드에 컴포넌트 추가

```tsx
import { AppUsageTracker } from '@/components/features/dashboard/AppUsageTracker';

export function Dashboard() {
  return (
    <div>
      <AppUsageTracker />
    </div>
  );
}
```

### 3. 다른 앱 추적 (선택사항)

YouTube, Instagram 등 다른 앱의 사용 시간을 수동으로 기록:

```tsx
import { startAppSession, endAppSession } from '@/lib/appUsageTracking';

// YouTube 링크 클릭 시
function handleYouTubeClick() {
  startAppSession('YouTube');
  window.open('https://youtube.com', '_blank');
  // 창이 닫힐 때 endAppSession 호출
}
```

## 📊 데이터 구조

### AppSession
```typescript
interface AppSession {
  appName: string;        // 앱 이름 (예: "Instagram")
  startTime: number;      // 시작 타임스탬프 (ms)
  endTime?: number;       // 종료 타임스탬프 (ms)
  duration?: number;      // 총 사용 시간 (ms)
  date: string;          // 날짜 (YYYY-MM-DD)
}
```

### AppUsageGoal
```typescript
interface AppUsageGoal {
  appName: string;           // 앱 이름
  dailyLimitMinutes: number; // 일일 제한 (분)
  enabled: boolean;          // 활성화 여부
  color?: string;           // 그래데이션 색상
}
```

## 🛠️ API 함수

### 추적 관련
```typescript
// 세션 시작
startAppSession(appName: string): void

// 세션 종료
endAppSession(): void

// 자동 추적 초기화 (Page Visibility API)
initializeAppTracking(appName: string): void
```

### 통계 조회
```typescript
// 특정 날짜 통계
getDailyStats(date: string): DailyStats

// 주간 통계 (최근 7일)
getWeeklyStats(): DailyStats[]

// 모든 세션 조회
getAllSessions(): AppSession[]
```

### 목표 관리
```typescript
// 목표 저장
saveAppGoals(goals: AppUsageGoal[]): void

// 목표 조회
getAppGoals(): AppUsageGoal[]

// 제한 초과 확인
isLimitExceeded(appName: string, date?: string): boolean

// 남은 시간 조회 (분)
getRemainingTime(appName: string): number | null
```

### 유틸리티
```typescript
// 시간 포맷팅 (예: "1시간 30분")
formatDuration(ms: number): string

// 짧은 포맷 (예: "1h")
formatDurationShort(ms: number): string

// 오늘 날짜 (KST)
getTodayDate(): string

// 오래된 데이터 정리 (30일 이상)
cleanOldData(): void
```

## 💾 데이터 백업/복원

### 데이터 내보내기
```typescript
import { exportUsageData } from '@/lib/appUsageTracking';

const jsonData = exportUsageData();
// JSON 파일로 저장
const blob = new Blob([jsonData], { type: 'application/json' });
const url = URL.createObjectURL(blob);
```

### 데이터 가져오기
```typescript
import { importUsageData } from '@/lib/appUsageTracking';

const success = importUsageData(jsonString);
if (success) {
  console.log('데이터 복원 완료');
}
```

## 📈 사용 예시

### 1. YouTube 사용 제한 설정

```typescript
import { saveAppGoals } from '@/lib/appUsageTracking';

saveAppGoals([
  {
    appName: 'YouTube',
    dailyLimitMinutes: 60, // 하루 1시간
    enabled: true,
    color: 'from-red-500 to-red-600'
  }
]);
```

### 2. 오늘 Instagram 사용 시간 확인

```typescript
import { getDailyStats, getTodayDate } from '@/lib/appUsageTracking';

const stats = getDailyStats(getTodayDate());
const instagramUsage = stats.appBreakdown['Instagram'] || 0;
console.log(`오늘 Instagram: ${instagramUsage / 60000}분`);
```

### 3. 주간 사용 패턴 분석

```typescript
import { getWeeklyStats } from '@/lib/appUsageTracking';

const weeklyStats = getWeeklyStats();
weeklyStats.forEach(day => {
  console.log(`${day.date}: ${day.totalTime / 60000}분`);
});
```

## 🎨 UI 커스터마이징

### 앱 아이콘 및 색상 추가

```tsx
// AppUsageTracker.tsx에서 수정
const POPULAR_APPS = [
  {
    name: "Custom App",
    icon: "🎮",
    color: "from-purple-500 to-pink-500"
  },
  // ... 기존 앱들
];
```

### 차트 스타일 변경

```tsx
// 그래데이션 색상 변경
<div className="bg-gradient-to-t from-blue-500 to-purple-500" />

// 차트 높이 조정
<div className="h-32"> {/* 기본 높이 */}
```

## 🔒 프라이버시

- 모든 데이터는 **로컬 저장소 (localStorage)**에만 저장됩니다
- 서버로 전송되지 않습니다
- 사용자가 언제든지 데이터를 삭제할 수 있습니다

```typescript
// 모든 데이터 삭제
localStorage.removeItem('app_usage_sessions');
localStorage.removeItem('app_usage_goals');
localStorage.removeItem('app_usage_current_session');
```

## 📱 React Native 통합 (향후 계획)

React Native 앱으로 전환 시 추가 기능:

### 1. 네이티브 앱 사용 시간 추적
```typescript
// iOS: Screen Time API
// Android: UsageStatsManager

import { AppState } from 'react-native';

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    startAppSession('a.ideal');
  } else {
    endAppSession();
  }
});
```

### 2. 백그라운드 추적
```typescript
// 백그라운드에서도 다른 앱 사용 감지
import BackgroundTimer from 'react-native-background-timer';
```

### 3. 푸시 알림
```typescript
// 목표 초과 시 푸시 알림
import PushNotification from 'react-native-push-notification';

if (isLimitExceeded('Instagram')) {
  PushNotification.localNotification({
    title: "사용 시간 초과",
    message: "Instagram 사용 목표를 초과했습니다!"
  });
}
```

## 🐛 문제 해결

### Q: 사용 시간이 기록되지 않아요
**A:** Page Visibility API가 지원되는 브라우저인지 확인하세요.
```typescript
if (typeof document.hidden !== 'undefined') {
  // 지원됨
}
```

### Q: 데이터가 사라졌어요
**A:** localStorage 용량 제한 또는 브라우저 캐시 삭제로 인해 발생할 수 있습니다. 정기적으로 데이터를 백업하세요.

### Q: 모바일에서 백그라운드 추적이 안 돼요
**A:** 웹 앱은 백그라운드에서 다른 앱 추적이 불가능합니다. 네이티브 앱 개발이 필요합니다.

## 🔔 일일 브리핑 통합 사용 예시

### 시나리오 1: SNS 과다 사용 경고

```typescript
// 어제 Instagram 2시간, YouTube 1시간 30분 사용

// 일일 브리핑에 자동으로 표시되는 내용:
{
  warning: "어제 SNS에 3시간 30분을 사용하셨습니다. 목표 시간을 90분 초과했습니다.",
  recommendation: "특히 Instagram에 2시간를 할애했습니다. 오늘은 학습 자료나 생산적인 콘텐츠에 더 많은 시간을 투자해보는 건 어떨까요?"
}
```

**사용자 경험:**
- 아침 일일 브리핑을 열면 "어제의 디지털 사용 패턴" 화면 표시
- 빨간색 경고 아이콘과 함께 과다 사용 메시지
- 구체적인 앱별 사용 시간과 개선 제안
- 사용자는 자신의 습관을 인식하고 오늘 목표 설정

### 시나리오 2: 균형 잡힌 사용

```typescript
// 어제 Instagram 30분, a.ideal 2시간 사용

// 일일 브리핑에 표시:
{
  message: "훌륭합니다! 균형 잡힌 디지털 습관을 유지하고 계시네요.",
  snsTime: "30분"
}
```

**사용자 경험:**
- 초록색 엄지척 아이콘과 긍정 메시지
- 건강한 디지털 습관에 대한 칭찬
- 동기부여 효과

### 일일 브리핑 통합 코드

```typescript
// DailyBriefingPopup.tsx에서 자동으로 분석
import { analyzeYesterdayUsage } from '@/lib/appUsageTracking';

const analysis = analyzeYesterdayUsage();

// analysis 객체:
{
  totalTime: 12600000, // 3.5시간 (밀리초)
  hasData: true,
  topApps: [
    { name: "Instagram", time: 7200000, percentage: 57.1 },
    { name: "YouTube", time: 5400000, percentage: 42.9 }
  ],
  snsApps: [
    { name: "Instagram", time: 7200000 },
    { name: "YouTube", time: 5400000 }
  ],
  totalSnsTime: 12600000,
  warning: "어제 SNS에 3시간 30분을 사용하셨습니다...",
  recommendation: "특히 Instagram에..."
}
```

## 📚 참고 자료

- [Page Visibility API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [PWA Best Practices](https://web.dev/pwa/)
- [React Native App State](https://reactnative.dev/docs/appstate)

## 🎉 완료!

이제 앱 사용 시간 추적 기능이 완전히 설정되었습니다. 사용자는:

1. **자동으로** 앱 사용 시간이 추적됩니다
2. **대시보드**에서 실시간으로 사용 패턴을 확인할 수 있습니다
3. **일일 브리핑**에서 어제의 디지털 습관을 되돌아보고 개선점을 받습니다
4. **목표 설정**으로 SNS 사용을 능동적으로 관리할 수 있습니다

이 모든 기능이 통합되어 사용자의 **성장 흐름**을 방해하는 요소를 자동으로 감지하고 경고합니다!
