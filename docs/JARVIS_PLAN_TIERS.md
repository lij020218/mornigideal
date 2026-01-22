# Jarvis Mode - 플랜별 기능 차등화

## 📊 플랜 비교표

| 기능 | Free | Standard | Pro | Max |
|------|------|----------|-----|-----|
| **AI 호출 제한** | 10회/월 | **50회/월** | **100회/월** | **무제한** |
| **장기 기억** | ❌ | ❌ | ❌ | ✅ |
| **상태 모니터링** | ❌ | ✅ 간소화 | ✅ 전체 | ✅ 전체 |
| **개입 레벨** | L0 | **L1-L2** | **L1-L2** | **L0-L4** |
| **체크 주기** | - | 1시간 | 30분 | 10분 |
| **알림** | ❌ | ✅ | ✅ | ✅ |
| **리소스 준비** | ❌ | ❌ | ✅ | ✅ |
| **자동 실행** | ❌ | ❌ | ❌ | ✅ |

---

## 🎯 플랜별 상세 기능

### Free 플랜
```
Jarvis 비활성화
- 기본 챗봇만 사용 가능
- AI 호출: 10회/월 (챗봇 전용)
```

### Standard 플랜: "Smart Reminder"

#### 특징
- **당일 데이터만 사용** (장기 기억 없음)
- **간소화된 상태 모니터링** (에너지, 스트레스만)
- **기본 알림만** (L2)

#### 동작 방식
```typescript
// 1시간마다 체크
- 오늘 일정만 확인
- 오늘 완료/스킵만 카운트
- 간단한 점수 계산 (에너지, 스트레스)

if (점수 >= 80) {
    AI 호출 → 알림 전송 (L2)
}

// 예상 AI 호출: 1-2회/일 → 30-50회/월
```

#### 예시 알림
```
"오늘 3개 일정 중 2개를 스킵했어요.
 남은 1개라도 해볼까요?"
```

#### 제한사항
- ❌ 과거 패턴 분석 불가
- ❌ 루틴 이탈 감지 불가
- ❌ 리소스 준비 불가
- ✅ 당일 기준 간단한 리마인더만

---

### Pro 플랜: "Active Assistant"

#### 특징
- **주간 패턴 분석** (localStorage 활용)
- **전체 상태 모니터링** (5가지 지표)
- **리소스 준비** (L1) + **알림** (L2)

#### 동작 방식
```typescript
// 30분마다 체크
- 최근 7일 완료율 계산 (localStorage)
- 전체 상태 점수 계산 (에너지, 스트레스, 집중, 루틴, 마감)

if (점수 >= 75) {
    if (리소스 준비 필요) {
        체크리스트 미리 생성 (L1)
    }
    AI 호출 → 알림 전송 (L2)
}

// 예상 AI 호출: 2-3회/일 → 60-90회/월
```

#### 예시 개입

**L1 (Silent Prep)**:
```
[사용자 모르게 준비]
- 내일 중요 일정 감지
- 체크리스트 자동 생성
  ✓ 준비물 확인
  ✓ 이동 시간 고려
  ✓ 관련 문서 링크
```

**L2 (Soft Notification)**:
```
"이번 주 운동 완료율이 30%네요.
 내일 체크리스트 만들어뒀으니 확인해보세요!"
```

#### 제한사항
- ❌ 장기 기억 (DB 저장) 없음
- ❌ 자동 실행 불가
- ✅ 주간 패턴 분석 가능
- ✅ 리소스 미리 준비

---

### Max 플랜: "Jarvis Mode" (Full)

#### 특징
- **완전한 장기 기억** (event_logs 영구 저장)
- **패턴 감지** (연속 스킵, 루틴 이탈)
- **전체 개입 레벨** (L0-L4)
- **AI 호출 무제한**

#### 동작 방식
```typescript
// 10분마다 체크
- event_logs에서 모든 활동 분석
- 장기 패턴 감지 (3일 연속 스킵 등)
- 전체 상태 점수 계산

if (점수 >= 75) {
    if (긴급) {
        일정 자동 조정 (L4)
    } else if (중요) {
        확인 후 실행 (L3)
    } else {
        알림 또는 준비 (L1-L2)
    }
}

// AI 호출: 2-3회/일 (무제한이지만 쿨다운 적용)
```

#### 예시 개입

**L1 (Silent Prep)**:
```
[조용히 준비]
- 수술 전날 체크리스트 생성
- 관련 문서 링크 수집
```

**L2 (Soft)**:
```
"내일 수술이에요. 준비 체크리스트 확인하세요."
```

**L3 (Direct)**:
```
"3일 연속 운동 스킵 + 내일 마감.
 오늘 저녁 운동을 내일로 옮길까요?
 [옮기기] [그냥 둘게요]"
```

**L4 (Auto)**:
```
[자동 실행됨]
"일정이 과밀해서 저녁 영어 공부를
 내일 오후 3시로 자동 이동했어요."
```

#### 제한사항
- ✅ 제한 없음
- ✅ 모든 기능 사용 가능

---

## 💾 데이터 저장 방식

### Standard: localStorage 활용
```typescript
// event_logs 테이블에 저장 안 함
// 대신 클라이언트 localStorage 활용

localStorage.setItem('schedule_completions_2026-01-21', JSON.stringify({
    completed: ['schedule-1', 'schedule-2'],
    skipped: ['schedule-3']
}));

// 주간 패턴 분석
for (let i = 0; i < 7; i++) {
    const dateKey = getDateString(i);
    const data = localStorage.getItem(`schedule_completions_${dateKey}`);
    // 완료율 계산
}
```

### Pro: localStorage (Standard와 동일)
```typescript
// Standard와 같지만 더 많은 상태 계산
- energy_level (에너지)
- stress_level (스트레스)
- focus_window_score (집중)
- routine_deviation_score (루틴 이탈)
- deadline_pressure_score (마감 압박)
```

### Max: event_logs 테이블
```sql
-- 모든 활동을 DB에 영구 저장
INSERT INTO event_logs (user_email, event_type, payload, occurred_at)
VALUES ('user@example.com', 'schedule_completed', '{"scheduleId": "123"}', NOW());

-- 장기 패턴 분석 가능
SELECT * FROM event_logs
WHERE user_email = 'user@example.com'
AND event_type = 'schedule_missed'
AND occurred_at >= NOW() - INTERVAL '30 days';
```

---

## 📈 AI 호출 횟수 관리

### 추적 테이블
```sql
CREATE TABLE ai_usage_tracking (
    user_email TEXT,
    month TEXT, -- 'YYYY-MM'
    call_count INTEGER,
    last_call_at TIMESTAMPTZ
);
```

### 호출 전 체크
```typescript
// PolicyEngine에서 체크
const currentUsage = await supabase.rpc('get_ai_usage', {
    p_user_email: userEmail
});

if (currentUsage >= limit) {
    return { shouldIntervene: false, reasonCodes: ['ai_limit_exceeded'] };
}
```

### 호출 후 증가
```typescript
// Brain에서 LLM 호출 직후
await supabase.rpc('increment_ai_usage', {
    p_user_email: userEmail
});
```

### 사용량 조회 API
```bash
GET /api/jarvis/usage?email=user@example.com

{
    "plan": "Standard",
    "used": 35,
    "limit": 50,
    "remaining": 15,
    "percentage": 70,
    "month": "2026-01"
}
```

---

## 🔧 설정 방법

### Standard 사용자 초기화
```sql
-- user_states 생성 (간소화)
INSERT INTO user_states (user_email, energy_level, stress_level)
VALUES ('user@example.com', 70, 30);

-- jarvis_preferences 생성
INSERT INTO jarvis_preferences (
    user_email,
    enabled,
    max_intervention_level,
    intervention_cooldown_minutes
) VALUES (
    'user@example.com',
    TRUE,
    2, -- L2까지만
    360 -- 6시간 쿨다운
);

-- ai_usage_tracking 자동 생성 (첫 호출 시)
```

### Pro 사용자 초기화
```sql
-- Standard와 동일하지만 전체 상태 사용
INSERT INTO user_states (
    user_email,
    energy_level,
    stress_level,
    focus_window_score,
    routine_deviation_score,
    deadline_pressure_score
) VALUES ('user@example.com', 70, 30, 70, 0, 20);
```

### Max 사용자 초기화
```sql
-- 전체 테이블 사용 (기존 migration과 동일)
```

---

## 🎨 UI 차등화

### Standard: 간단한 알림
```tsx
<div className="jarvis-notification">
    <p>{message}</p>
    <button>확인</button>
</div>
```

### Pro: 리소스 포함 알림
```tsx
<div className="jarvis-notification">
    <p>{message}</p>
    <div className="resources">
        <h4>준비된 체크리스트</h4>
        <ul>{checklist.map(...)}</ul>
    </div>
    <button>확인</button>
</div>
```

### Max: 확인/자동 실행
```tsx
<div className="jarvis-confirmation">
    <p>{message}</p>
    <div className="actions">
        <button onClick={accept}>옮기기</button>
        <button onClick={dismiss}>그냥 둘게요</button>
    </div>
</div>
```

---

## 📊 비용 분석 (업데이트)

### Standard (100명 기준)
- AI 호출: 1.5회/일/사용자
- 100 × 1.5 × 30일 = 4,500회/월
- 4,500 × $0.015 = **$67.5/월**
- 사용자당: **$0.675/월**

### Pro (100명 기준)
- AI 호출: 2.5회/일/사용자
- 100 × 2.5 × 30일 = 7,500회/월
- 7,500 × $0.015 = **$112.5/월**
- 사용자당: **$1.125/월**

### Max (100명 기준)
- AI 호출: 2.5회/일/사용자 (무제한이지만 실제 사용)
- 100 × 2.5 × 30일 = 7,500회/월
- 7,500 × $0.015 = **$112.5/월**
- 사용자당: **$1.125/월**

### 가격 대비 수익성
| 플랜 | 월 가격 | AI 비용 | 순이익 |
|------|---------|---------|--------|
| Standard | $5 | $0.675 | **+$4.32** ✅ |
| Pro | $10 | $1.125 | **+$8.88** ✅ |
| Max | $20 | $1.125 | **+$18.88** ✅ |

---

## 🚀 배포

```bash
# 1. Supabase SQL 실행
# - 20260121000000_create_jarvis_tables.sql
# - 20260121000001_create_jarvis_support_tables.sql
# - 20260121000002_add_ai_usage_tracking.sql

# 2. Vercel 배포
vercel --prod

# 3. Cron job 자동 실행 (10분마다)
# Standard/Pro/Max 모두 포함

# 4. 사용량 확인
curl https://your-app.vercel.app/api/jarvis/usage?email=test@example.com
```

---

## 📝 마이그레이션 가이드

### 기존 Max 사용자 → 변경 없음
```sql
-- 모든 기능 그대로 사용
```

### 신규 Standard 사용자
```sql
-- 자동 초기화 (plan 컬럼 기반)
```

### Free → Standard 업그레이드
```sql
UPDATE users
SET profile = jsonb_set(profile, '{plan}', '"Standard"')
WHERE email = 'user@example.com';

-- user_states 자동 생성 (다음 cron 실행 시)
```

---

## ⚠️ 제한사항 처리

### AI 한도 초과 시
```typescript
// Standard/Pro 사용자가 한도 초과하면
{
    shouldIntervene: false,
    reasonCodes: ['ai_limit_exceeded']
}

// UI에 메시지 표시
"이번 달 AI 호출 한도를 모두 사용했어요.
 Max 플랜으로 업그레이드하면 무제한으로 사용 가능합니다."
```

### localStorage 제한
```typescript
// 30일 이상 오래된 데이터는 자동 삭제
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 30);

Object.keys(localStorage).forEach(key => {
    if (key.startsWith('schedule_completions_')) {
        const date = key.split('_').pop();
        if (new Date(date) < cutoff) {
            localStorage.removeItem(key);
        }
    }
});
```

---

## 📚 참고 링크

- [Jarvis Mode 메인 문서](./JARVIS_MODE.md)
- [API 레퍼런스](./API_REFERENCE.md)
- [플랜 업그레이드 가이드](./PLAN_UPGRADE.md)
