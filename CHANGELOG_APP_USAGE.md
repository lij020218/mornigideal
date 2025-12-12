# 앱 사용 시간 추적 및 일일 브리핑 통합 - 변경 사항

## 📅 2025-12-09

### ✨ 새로운 기능

#### 1. 앱 사용 시간 자동 추적 시스템
- **자동 추적**: Page Visibility API를 사용한 자동 세션 추적
- **위치**: `src/lib/appUsageTracking.ts`
- **기능**:
  - 앱이 foreground/background로 전환될 때 자동으로 시작/종료
  - localStorage에 세션 데이터 저장
  - 일일/주간 통계 자동 생성

#### 2. 앱 사용 추적 UI 컴포넌트
- **컴포넌트**: `src/components/features/dashboard/AppUsageTracker.tsx`
- **기능**:
  - 오늘 총 사용 시간 표시
  - 주간 사용 추이 차트
  - 가장 많이 사용한 앱 TOP 3
  - SNS 앱 사용 목표 설정
  - 목표 초과 시 실시간 경고

#### 3. 🆕 일일 브리핑에 디지털 습관 분석 추가
- **컴포넌트**: `src/components/features/dashboard/DailyBriefingPopup.tsx`
- **위치**: Step 2 (어제의 활동 요약 후)
- **기능**:
  - **어제의 디지털 사용 패턴 분석**
  - 가장 많이 사용한 앱 TOP 3 시각화
  - SNS 과다 사용 경고 (2시간 초과 시)
  - 구체적인 개선 권장사항
  - 균형 잡힌 습관 유지 시 긍정 피드백

#### 4. 자동 초기화
- **컴포넌트**: `src/components/AppUsageInitializer.tsx`
- **위치**: `src/app/layout.tsx`에 추가
- **기능**: 앱 시작 시 자동으로 사용 시간 추적 활성화

### 📝 수정된 파일

#### 새로 생성된 파일
1. `src/lib/appUsageTracking.ts` - 사용 시간 추적 라이브러리
2. `src/components/features/dashboard/AppUsageTracker.tsx` - UI 컴포넌트
3. `src/components/AppUsageInitializer.tsx` - 초기화 컴포넌트
4. `docs/APP_USAGE_TRACKING.md` - 상세 문서

#### 수정된 파일
1. `src/app/layout.tsx`
   - `AppUsageInitializer` 추가

2. `src/components/features/dashboard/Dashboard.tsx`
   - `AppUsageTracker` 컴포넌트 추가
   - `RecommendedMedia`와 2열 그리드 레이아웃

3. `src/components/features/dashboard/DailyBriefingPopup.tsx`
   - `analyzeYesterdayUsage` 함수 임포트
   - Step 2에 "어제의 디지털 사용 패턴" 추가
   - SNS 경고 및 권장사항 표시
   - 긍정 피드백 메시지

### 🎯 사용자 경험 개선

#### Before (기존)
```
일일 브리핑:
1. 인사
2. 어제 활동 요약
3. 오늘 일정
4. 응원 메시지
```

#### After (개선)
```
일일 브리핑:
1. 인사
2. 어제 활동 요약
3. 🆕 어제의 디지털 사용 패턴 (데이터 있을 경우)
   - TOP 3 앱 사용 시간
   - SNS 과다 사용 경고 (2시간 초과 시)
   - 구체적인 개선 제안
   - 긍정 피드백 (균형 잡힌 경우)
4. 오늘 일정
5. 응원 메시지
```

### 💡 주요 알고리즘

#### SNS 과다 사용 감지
```typescript
const SNS_APPS = ['Instagram', 'TikTok', 'Twitter/X', 'Facebook', 'YouTube'];
const EXCESSIVE_SNS_THRESHOLD = 120; // 2시간 (분)

if (totalSnsMinutes > EXCESSIVE_SNS_THRESHOLD) {
  // 빨간색 경고 + 구체적인 권장사항
} else if (totalSnsMinutes > 60) {
  // 노란색 주의 + 개선 제안
} else {
  // 초록색 긍정 피드백
}
```

### 📊 데이터 구조

#### AppSession
```typescript
{
  appName: "Instagram",
  startTime: 1234567890,
  endTime: 1234568000,
  duration: 110000, // 밀리초
  date: "2025-12-09"
}
```

#### YesterdayUsageAnalysis
```typescript
{
  totalTime: 12600000,
  hasData: true,
  topApps: [
    { name: "Instagram", time: 7200000, percentage: 57.1 }
  ],
  snsApps: [
    { name: "Instagram", time: 7200000 }
  ],
  totalSnsTime: 12600000,
  warning: "어제 SNS에 3시간 30분을...",
  recommendation: "특히 Instagram에..."
}
```

### 🔒 프라이버시

- **로컬 저장소만 사용**: 모든 데이터는 localStorage에만 저장
- **서버 전송 없음**: 개인 정보가 외부로 전송되지 않음
- **사용자 제어**: 언제든지 데이터 삭제 가능

### 🎨 UI/UX 특징

#### 색상 코딩
- 🔴 빨간색: SNS 2시간 초과 (심각한 경고)
- 🟡 노란색: SNS 1-2시간 (주의)
- 🟢 초록색: 균형 잡힌 사용 (긍정 피드백)

#### 애니메이션
- 진행률 바 애니메이션
- Step 전환 애니메이션
- 차트 등장 애니메이션

### 📱 모바일 최적화

1. **반응형 레이아웃**
   - 모바일: 1열
   - 태블릿/데스크톱: 2열

2. **터치 친화적**
   - 큰 버튼 크기
   - 제스처 지원

3. **성능 최적화**
   - 데이터 30일 자동 정리
   - 효율적인 localStorage 사용

### 🚀 향후 계획

1. **React Native 통합**
   - 네이티브 Screen Time API
   - 백그라운드 추적
   - 푸시 알림

2. **AI 분석 강화**
   - 패턴 학습
   - 맞춤형 권장사항
   - 생산성 점수

3. **소셜 기능**
   - 친구와 비교
   - 챌린지
   - 리더보드

### 📚 문서

상세한 사용 가이드는 [APP_USAGE_TRACKING.md](./docs/APP_USAGE_TRACKING.md)를 참조하세요.

---

**변경 사항 요약**: 앱 사용 시간 추적 시스템을 구축하고, 일일 브리핑에 어제의 디지털 습관 분석을 통합하여 사용자가 성장 흐름을 방해하는 SNS 과다 사용을 인식하고 개선할 수 있도록 했습니다.
