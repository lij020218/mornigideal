# React Native 마이그레이션 가이드

현재 Next.js 웹앱을 React Native 모바일 앱으로 전환하는 가이드입니다.

## 🎯 마이그레이션 전략

### 단계별 접근
1. **React Native 프로젝트 생성** (Expo 사용 추천)
2. **공통 로직 라이브러리화** (비즈니스 로직 분리)
3. **UI 컴포넌트 재작성** (React Native 컴포넌트로)
4. **네이티브 기능 추가** (진짜 앱 사용 시간 추적 등)

---

## 📦 1단계: React Native 프로젝트 생성

### Expo 사용 (추천)

```bash
# Expo CLI 설치
npm install -g expo-cli

# 새 프로젝트 생성
npx create-expo-app a-ideal-mobile --template

# TypeScript 템플릿 선택
cd a-ideal-mobile
```

### 또는 React Native CLI

```bash
npx react-native init AIdealMobile --template react-native-template-typescript
```

---

## 🔄 2단계: 공통 코드 분리

현재 프로젝트에서 **비즈니스 로직**을 별도 패키지로 분리합니다.

### 재사용 가능한 코드

#### ✅ 100% 재사용 가능
- `src/lib/appUsageTracking.ts` (일부 수정 필요)
- `src/lib/dailyGoals.ts`
- `src/lib/scheduleNotifications.ts`
- `src/lib/newsCache.ts`

#### ⚠️ 수정 필요
- localStorage → AsyncStorage
- fetch → React Native fetch (동일 API)
- Date/시간 로직 (그대로 사용 가능)

### 공통 패키지 구조

```
packages/
  shared/
    src/
      lib/
        appUsageTracking.ts
        dailyGoals.ts
        types.ts
      utils/
        storage.ts  # AsyncStorage 추상화
        api.ts      # API 클라이언트
```

---

## 📱 3단계: 네이티브 앱 사용 시간 추적

웹과 달리 **진짜 다른 앱 사용 시간**을 추적할 수 있습니다!

### iOS - Screen Time API

```typescript
// react-native-device-usage (커뮤니티 패키지)
npm install react-native-device-usage

// ios/Podfile에 추가
pod 'DeviceUsage'

// 사용 예시
import DeviceUsage from 'react-native-device-usage';

// 오늘 사용 시간 가져오기
const usageStats = await DeviceUsage.getTodayUsage();

// 결과:
{
  "com.instagram.app": {
    name: "Instagram",
    usageTime: 7200000, // 2시간 (밀리초)
    lastUsed: "2025-12-09T10:30:00Z"
  },
  "com.google.youtube": {
    name: "YouTube",
    usageTime: 5400000, // 1.5시간
    lastUsed: "2025-12-09T12:15:00Z"
  }
}
```

### Android - UsageStatsManager

```typescript
// react-native-usage-stats
npm install react-native-usage-stats

import UsageStats from 'react-native-usage-stats';

// 권한 요청 (AndroidManifest.xml)
<uses-permission android:name="android.permission.PACKAGE_USAGE_STATS"/>

// 오늘 사용 통계
const stats = await UsageStats.queryUsageStats({
  startTime: todayStart,
  endTime: now,
  interval: 'daily'
});

// 결과:
[
  {
    packageName: "com.instagram.android",
    appName: "Instagram",
    totalTimeInForeground: 7200000 // 2시간
  },
  {
    packageName: "com.google.android.youtube",
    appName: "YouTube",
    totalTimeInForeground: 5400000
  }
]
```

### 통합 AppUsageTracker (React Native 버전)

```typescript
// src/lib/appUsageTracking.native.ts

import { Platform } from 'react-native';
import DeviceUsage from 'react-native-device-usage'; // iOS
import UsageStats from 'react-native-usage-stats'; // Android
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getTodayAppUsage(): Promise<AppUsageData> {
  if (Platform.OS === 'ios') {
    const data = await DeviceUsage.getTodayUsage();
    return normalizeIOSData(data);
  } else {
    const stats = await UsageStats.queryUsageStats({
      startTime: getTodayStart(),
      endTime: Date.now(),
      interval: 'daily'
    });
    return normalizeAndroidData(stats);
  }
}

// localStorage → AsyncStorage
export async function saveDailyStats(stats: DailyStats) {
  const key = `daily_stats_${getTodayDate()}`;
  await AsyncStorage.setItem(key, JSON.stringify(stats));
}

export async function getDailyStats(date: string): Promise<DailyStats | null> {
  const key = `daily_stats_${date}`;
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}
```

---

## 🎨 4단계: UI 컴포넌트 변환

### Before (Web - Next.js)

```tsx
// src/components/features/dashboard/AppUsageTracker.tsx
import { Button } from "@/components/ui/button";

export function AppUsageTracker() {
  return (
    <div className="bg-white/5 p-4 rounded-xl">
      <h2 className="text-xl font-bold">앱 사용 시간</h2>
      <Button onClick={handleRefresh}>새로고침</Button>
    </div>
  );
}
```

### After (React Native)

```tsx
// src/components/AppUsageTracker.native.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function AppUsageTracker() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>앱 사용 시간</Text>
      <TouchableOpacity style={styles.button} onPress={handleRefresh}>
        <Text style={styles.buttonText}>새로고침</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff'
  },
  button: {
    backgroundColor: '#8B5CF6',
    padding: 12,
    borderRadius: 8,
    marginTop: 12
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600'
  }
});
```

### 스타일링 대안: Tamagui (추천)

Tailwind CSS와 유사한 경험:

```bash
npm install tamagui @tamagui/config
```

```tsx
import { View, Text, Button } from 'tamagui';

export function AppUsageTracker() {
  return (
    <View bg="$background" p="$4" br="$4">
      <Text fontSize="$6" fontWeight="bold">앱 사용 시간</Text>
      <Button mt="$3" onPress={handleRefresh}>
        새로고침
      </Button>
    </View>
  );
}
```

---

## 🔔 5단계: 푸시 알림 추가

웹에서는 불가능했던 **네이티브 푸시 알림**을 추가합니다.

### Firebase Cloud Messaging 설정

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

### 일일 브리핑 알림

```typescript
// src/services/notifications.ts
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';

export async function scheduleDailyBriefing() {
  // 매일 오전 8시에 알림
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: getTomorrowAt8AM(),
    repeatFrequency: RepeatFrequency.DAILY
  };

  await notifee.createTriggerNotification(
    {
      title: 'Good Morning! ☀️',
      body: '오늘의 브리핑이 준비되었습니다',
      data: { screen: 'DailyBriefing' },
      android: {
        channelId: 'daily-briefing',
        smallIcon: 'ic_notification',
        pressAction: { id: 'default' }
      },
      ios: {
        sound: 'default'
      }
    },
    trigger
  );
}
```

### SNS 과다 사용 경고 알림

```typescript
// src/services/usageMonitor.ts
import { analyzeYesterdayUsage } from '@/lib/appUsageTracking';
import notifee from '@notifee/react-native';

export async function checkAndNotifyExcessiveUsage() {
  const analysis = await analyzeYesterdayUsage();

  if (analysis.warning) {
    await notifee.displayNotification({
      title: '⚠️ 디지털 습관 경고',
      body: analysis.warning,
      data: {
        screen: 'AppUsageTracker',
        recommendation: analysis.recommendation
      },
      android: {
        channelId: 'usage-warnings',
        importance: AndroidImportance.HIGH,
        color: '#FF6B6B'
      }
    });
  }
}
```

---

## 📊 6단계: 네이티브 차트 추가

React Native용 차트 라이브러리:

```bash
npm install react-native-chart-kit react-native-svg
```

```tsx
import { LineChart } from 'react-native-chart-kit';

export function WeeklyUsageChart({ data }: { data: DailyStats[] }) {
  return (
    <LineChart
      data={{
        labels: ['월', '화', '수', '목', '금', '토', '일'],
        datasets: [{
          data: data.map(d => d.totalTime / 3600000) // 시간 단위
        }]
      }}
      width={Dimensions.get('window').width - 32}
      height={220}
      chartConfig={{
        backgroundColor: '#1a1a1a',
        backgroundGradientFrom: '#1E2923',
        backgroundGradientTo: '#08130D',
        decimalPlaces: 1,
        color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        style: {
          borderRadius: 16
        },
        propsForDots: {
          r: '6',
          strokeWidth: '2',
          stroke: '#8B5CF6'
        }
      }}
      bezier
      style={{
        marginVertical: 8,
        borderRadius: 16
      }}
    />
  );
}
```

---

## 🗂️ 7단계: 프로젝트 구조

### Monorepo 구조 (추천)

```
a-ideal/
├── apps/
│   ├── web/              # 기존 Next.js 앱
│   │   └── src/
│   └── mobile/           # 새 React Native 앱
│       ├── ios/
│       ├── android/
│       └── src/
│           ├── screens/
│           │   ├── Dashboard.tsx
│           │   ├── DailyBriefing.tsx
│           │   └── AppUsageTracker.tsx
│           ├── components/
│           └── navigation/
│
├── packages/
│   ├── shared/           # 공통 비즈니스 로직
│   │   ├── lib/
│   │   │   ├── appUsageTracking.ts
│   │   │   ├── dailyGoals.ts
│   │   │   └── api.ts
│   │   └── types/
│   │       └── index.ts
│   │
│   └── ui/               # 공통 UI 컴포넌트 (선택)
│       └── components/
│
└── package.json          # 루트 패키지
```

### 설정

```json
// package.json (루트)
{
  "name": "a-ideal",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:web": "cd apps/web && npm run dev",
    "dev:mobile": "cd apps/mobile && expo start",
    "build:web": "cd apps/web && npm run build",
    "build:mobile:ios": "cd apps/mobile && eas build --platform ios",
    "build:mobile:android": "cd apps/mobile && eas build --platform android"
  }
}
```

---

## 🚀 8단계: 배포

### iOS - App Store

```bash
# EAS Build 사용 (Expo)
npm install -g eas-cli
eas login
eas build:configure

# iOS 빌드
eas build --platform ios

# TestFlight 배포
eas submit --platform ios
```

### Android - Play Store

```bash
# Android 빌드
eas build --platform android

# Play Store 배포
eas submit --platform android
```

---

## 📱 실제 앱 기능 강화

### 1. 백그라운드 작업

```typescript
// src/services/backgroundTask.ts
import BackgroundFetch from 'react-native-background-fetch';

BackgroundFetch.configure({
  minimumFetchInterval: 15, // 15분마다
  stopOnTerminate: false,
  startOnBoot: true
}, async (taskId) => {
  console.log('[BackgroundFetch] Task:', taskId);

  // 앱 사용 시간 수집
  const usage = await getTodayAppUsage();
  await saveDailyStats(usage);

  // 과다 사용 체크
  await checkAndNotifyExcessiveUsage();

  BackgroundFetch.finish(taskId);
}, (taskId) => {
  console.log('[BackgroundFetch] TIMEOUT:', taskId);
  BackgroundFetch.finish(taskId);
});
```

### 2. 위젯 (iOS/Android)

```typescript
// 홈 화면 위젯으로 오늘 사용 시간 표시
import { WidgetProvider } from 'react-native-android-widget';

export function DailyUsageWidget() {
  const stats = useTodayStats();

  return (
    <WidgetProvider>
      <View>
        <Text>{formatDuration(stats.totalTime)}</Text>
        <Text>오늘 사용 시간</Text>
      </View>
    </WidgetProvider>
  );
}
```

### 3. 생체 인증

```typescript
import ReactNativeBiometrics from 'react-native-biometrics';

export async function authenticateUser() {
  const { success } = await ReactNativeBiometrics.simplePrompt({
    promptMessage: 'a.ideal 로그인',
    cancelButtonText: '취소'
  });

  return success;
}
```

---

## 💰 비용 및 시간 예상

### 개발 시간
- **기본 기능 이전**: 2-3주
- **네이티브 기능 추가**: 1-2주
- **테스트 & 버그 수정**: 1주
- **총**: 4-6주

### 비용
- **개발자 계정**
  - Apple Developer: $99/년
  - Google Play: $25 (일회성)
- **서비스**
  - Firebase (무료 티어 가능)
  - Expo EAS: $29/월 (또는 무료 티어)

---

## ✅ 체크리스트

### Phase 1: 기본 설정
- [ ] React Native 프로젝트 생성
- [ ] 공통 로직 분리 (monorepo)
- [ ] AsyncStorage 설정
- [ ] 네비게이션 설정

### Phase 2: 핵심 기능
- [ ] 대시보드 UI 구현
- [ ] 일일 브리핑 팝업
- [ ] 앱 사용 시간 추적 (네이티브)
- [ ] 트렌드 브리핑 표시

### Phase 3: 네이티브 기능
- [ ] 푸시 알림 설정
- [ ] 백그라운드 작업
- [ ] Screen Time API 통합 (iOS)
- [ ] UsageStats 통합 (Android)

### Phase 4: 배포
- [ ] 아이콘 & 스플래시 스크린
- [ ] 앱스토어 스크린샷
- [ ] 개인정보 처리방침
- [ ] TestFlight 베타 테스트
- [ ] App Store 출시

---

## 🎉 완료 후 얻는 것

✅ **iOS + Android 앱** (한 번에!)
✅ **진짜 앱 사용 시간 추적** (Instagram, YouTube 등)
✅ **푸시 알림** (일일 브리핑, 과다 사용 경고)
✅ **백그라운드 작업** (자동 데이터 수집)
✅ **앱스토어 출시** (수익화 가능)
✅ **오프라인 지원**
✅ **더 나은 성능**

---

**다음 단계:** React Native 프로젝트를 생성하고 싶으시면 말씀해주세요. 함께 시작하겠습니다! 🚀
