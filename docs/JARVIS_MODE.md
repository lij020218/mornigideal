# Jarvis Mode (자비스 모드)

**Fi.eri Max Plan 전용 AI 비서 시스템**

## 개요

Jarvis Mode는 Max 플랜 사용자를 위한 상주형 AI 비서입니다. 사용자가 요청하지 않아도 자동으로 상황을 파악하고, 필요한 순간에 적절히 개입하여 일정 관리, 루틴 유지, 리소스 준비 등을 지원합니다.

### 핵심 철학

- **Proactive, not Reactive**: 사용자가 물어보기 전에 먼저 파악하고 행동
- **Cost-Efficient**: 80% 규칙 기반 + 20% LLM으로 비용 85% 절감
- **Safe by Design**: 가드레일로 과도한 개입 방지
- **Learning System**: 사용자 피드백으로 지속적 개선

---

## 아키텍처

### 전체 루프

```
Observer → State → Policy → Brain → Hands → Reflection
   ↑                                           ↓
   └───────────────── Feedback ────────────────┘
```

### 1. Observer (관찰)

**파일**: `src/lib/jarvis/observer.ts`

모든 사용자 활동을 `event_logs` 테이블에 기록:

- 일정 생성/완료/스킵/미완료
- 앱 열기/닫기
- 학습 활동
- 채팅 메시지
- 목표 진척

**주요 메서드**:
```typescript
await observer.logEvent(EventType.SCHEDULE_COMPLETED, {
    scheduleId: 'abc123',
    scheduleType: '운동',
    completedAt: new Date()
});

const recentEvents = await observer.getRecentEvents(24); // 최근 24시간
const hasConsecutiveSkips = await observer.detectConsecutiveSkips('운동', 3);
```

---

### 2. State (상태)

**파일**: `src/lib/jarvis/state-updater.ts`

EventLog를 기반으로 5가지 상태 점수를 **규칙 기반**으로 계산 (LLM 없음):

| 상태 | 범위 | 설명 |
|------|------|------|
| `energy_level` | 0-100 | 완료한 일정 많으면 UP, 스킵 많으면 DOWN |
| `stress_level` | 0-100 | 일정 과밀하면 UP, 마감 임박하면 UP |
| `focus_window_score` | 0-100 | 최근 집중 세션 있으면 UP |
| `routine_deviation_score` | 0-100 | 연속 루틴 스킵하면 UP |
| `deadline_pressure_score` | 0-100 | 내일/모레 중요 일정 있으면 UP |

**주기**: 매 10분마다 자동 업데이트

**주요 메서드**:
```typescript
await stateUpdater.updateAllStates();
const currentState = await stateUpdater.getCurrentState();
```

---

### 3. Policy (판단)

**파일**: `src/lib/jarvis/policy-engine.ts`

개입 필요성을 **규칙 기반**으로 판단 (LLM 없음):

#### 개입 점수 계산

```typescript
score = 0
if (stress_level > 75) score += stress_level * 0.3
if (routine_deviation_score > 60) score += routine_deviation_score * 0.2
if (deadline_pressure_score > 80) score += deadline_pressure_score * 0.4
if (energy_level < 30) score += (100 - energy_level) * 0.2
```

#### 개입 레벨 결정

| 레벨 | 이름 | 설명 | 예시 |
|------|------|------|------|
| L0 | Observe | 관찰만 (로그) | 데이터만 수집 |
| L1 | Silent Prep | 조용한 준비 | 체크리스트 미리 생성 |
| L2 | Soft | 제안 알림 | "오늘 운동 어때요?" |
| L3 | Direct | 확인 후 실행 | "일정을 내일로 옮길까요?" |
| L4 | Auto | 자동 실행 (옵트인) | 자동으로 버퍼 추가 |

#### 가드레일

**개입하지 않는 경우**:
- Quiet Hours (기본: 23:00 - 07:00)
- 최근 6시간 내 이미 개입함 (쿨다운)
- 사용자가 비활성화함
- 개입 점수 < 75

**주요 메서드**:
```typescript
const decision = await policyEngine.shouldIntervene();
// {
//   shouldIntervene: true,
//   level: InterventionLevel.L2_SOFT,
//   reasonCodes: ['high_stress', 'deadline_soon'],
//   score: 82
// }
```

---

### 4. Brain (복잡한 판단)

**파일**: `src/lib/jarvis/brain.ts`

PolicyEngine이 개입이 필요하다고 판단하면, LLM을 사용하여 **구체적인 개입 계획** 생성:

#### 입력 컨텍스트

```typescript
{
    userEmail: string;
    currentState: { energy_level, stress_level, ... };
    recentEvents: EventLog[];
    upcomingSchedules: CustomGoal[];
    userProfile: UserProfile;
    preferences: JarvisPreferences;
    decision: { level, reasonCodes, score };
}
```

#### 출력 계획

```typescript
{
    actionType: ActionType;  // 'notification_sent', 'schedule_moved', etc.
    actionPayload: { ... };  // 액션별 구체적 데이터
    message: string;         // 사용자에게 보여줄 메시지
    reasoning: string;       // 왜 이 개입이 필요한지
}
```

#### LLM 가드레일

**절대 사용 금지 단어**:
- 진단, 병, 우울증, 불안장애, 정신질환, 치료, 약, 처방

**확인 필수 액션**:
- delete_schedule
- move_schedule
- send_email
- make_payment

**주요 메서드**:
```typescript
const plan = await brain.planIntervention(context);
// {
//   actionType: 'schedule_suggested',
//   actionPayload: { suggestedTime: '15:00', reason: '에너지 높을 때' },
//   message: '오늘 오후 3시에 운동하는 건 어떨까요?',
//   reasoning: '에너지 레벨이 높고 일정 여유가 있어서 지금이 좋은 타이밍입니다.'
// }
```

---

### 5. Hands (실행)

**파일**: `src/lib/jarvis/hands.ts`

Brain이 생성한 계획을 **실제로 실행**:

#### 레벨별 실행 방식

| 레벨 | 실행 방식 | 테이블 |
|------|-----------|--------|
| L0 | 로그만 | `intervention_logs` |
| L1 | 리소스 생성 | `jarvis_resources` |
| L2 | 알림 전송 | `jarvis_notifications` |
| L3 | 확인 요청 | `jarvis_confirmation_requests` |
| L4 | 자동 실행 + 알림 | `users.profile`, `jarvis_notifications` |

#### 액션 타입

**준비 액션** (L1):
- `resource_prep`: 링크, 문서 등 미리 준비
- `checklist_created`: 체크리스트 생성

**알림 액션** (L2):
- `notification_sent`: 제안 알림
- `reminder_sent`: 리마인더

**일정 조정** (L3, L4):
- `schedule_moved`: 일정 이동
- `schedule_buffer_added`: 버퍼 추가
- `schedule_suggested`: 일정 제안

**주요 메서드**:
```typescript
const result = await hands.execute(plan, level, reasonCodes);
// {
//   success: true,
//   interventionLogId: 'uuid',
//   requiresUserConfirmation: false
// }

// 사용자 피드백 업데이트
await hands.updateFeedback(interventionLogId, UserFeedback.ACCEPTED);
```

---

### 6. Reflection (학습)

**파일**: (미래 구현)

`intervention_logs`의 `user_feedback`를 분석하여:
- 어떤 개입이 효과적인지 학습
- 개입 임계치 조정
- 사용자별 선호도 파악

---

## 데이터베이스 스키마

### Core Tables

#### 1. user_states
```sql
CREATE TABLE user_states (
    id UUID PRIMARY KEY,
    user_email TEXT NOT NULL UNIQUE,

    -- 상태 점수 (0-100)
    energy_level INTEGER DEFAULT 70,
    stress_level INTEGER DEFAULT 30,
    focus_window_score INTEGER DEFAULT 70,
    routine_deviation_score INTEGER DEFAULT 0,
    deadline_pressure_score INTEGER DEFAULT 20,

    -- 타임스탬프
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    last_intervention_at TIMESTAMPTZ,
    state_updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. event_logs
```sql
CREATE TABLE event_logs (
    id UUID PRIMARY KEY,
    user_email TEXT NOT NULL,

    event_type TEXT NOT NULL, -- 'schedule_completed', 'schedule_missed', etc.
    payload JSONB DEFAULT '{}',

    source TEXT, -- 'gcal', 'manual', 'auto'
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. intervention_logs
```sql
CREATE TABLE intervention_logs (
    id UUID PRIMARY KEY,
    user_email TEXT NOT NULL,

    intervention_level INTEGER NOT NULL CHECK (intervention_level BETWEEN 0 AND 4),
    reason_codes TEXT[] DEFAULT '{}',

    action_type TEXT NOT NULL,
    action_payload JSONB DEFAULT '{}',

    user_feedback TEXT, -- 'accepted', 'ignored', 'dismissed', 'auto_executed'
    outcome_score INTEGER,

    intervened_at TIMESTAMPTZ DEFAULT NOW(),
    feedback_at TIMESTAMPTZ
);
```

#### 4. jarvis_preferences
```sql
CREATE TABLE jarvis_preferences (
    id UUID PRIMARY KEY,
    user_email TEXT NOT NULL UNIQUE,

    enabled BOOLEAN DEFAULT TRUE,

    max_intervention_level INTEGER DEFAULT 2,
    auto_action_opt_in BOOLEAN DEFAULT FALSE,

    notification_style TEXT DEFAULT 'friendly', -- 'brief', 'friendly', 'jarvis_tone'
    quiet_hours_start INTEGER DEFAULT 23,
    quiet_hours_end INTEGER DEFAULT 7,

    schedule_coaching_enabled BOOLEAN DEFAULT TRUE,
    routine_monitoring_enabled BOOLEAN DEFAULT TRUE,
    resource_preparation_enabled BOOLEAN DEFAULT TRUE,

    intervention_cooldown_minutes INTEGER DEFAULT 360
);
```

### Support Tables

#### 5. jarvis_notifications (L2)
```sql
CREATE TABLE jarvis_notifications (
    id UUID PRIMARY KEY,
    user_email TEXT NOT NULL,

    type TEXT NOT NULL, -- 'jarvis_suggestion', 'jarvis_auto_action'
    message TEXT NOT NULL,
    action_type TEXT,
    action_payload JSONB DEFAULT '{}',

    read_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 6. jarvis_confirmation_requests (L3)
```sql
CREATE TABLE jarvis_confirmation_requests (
    id UUID PRIMARY KEY,
    user_email TEXT NOT NULL,
    intervention_log_id UUID NOT NULL,

    message TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_payload JSONB DEFAULT '{}',

    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 7. jarvis_resources (L1)
```sql
CREATE TABLE jarvis_resources (
    id UUID PRIMARY KEY,
    user_email TEXT NOT NULL,

    resource_type TEXT NOT NULL, -- 'checklist', 'links', 'briefing', 'suggestion'
    title TEXT NOT NULL,
    content JSONB DEFAULT '{}',

    related_schedule_id TEXT,

    accessed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 사용법

### 1. 초기 설정

```bash
# 1. 데이터베이스 마이그레이션 실행
# Supabase Dashboard에서 SQL Editor로 실행:
# - supabase/migrations/20260121000000_create_jarvis_tables.sql
# - supabase/migrations/20260121000001_create_jarvis_support_tables.sql

# 2. 환경 변수 설정 (.env.local)
ANTHROPIC_API_KEY=sk-ant-...
CRON_SECRET=your-secret-key

# 3. Vercel에 배포 (cron job 자동 활성화)
vercel --prod
```

### 2. 수동 실행 (테스트)

```bash
# 특정 사용자에 대해 Jarvis 실행
curl -X POST https://your-app.vercel.app/api/jarvis/run \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{"userEmail": "test@example.com"}'
```

### 3. 자동 실행 (프로덕션)

Vercel Cron이 10분마다 자동으로 `/api/jarvis/run` 호출:

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/jarvis/run",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

---

## 개발 가이드

### 새로운 EventType 추가

```typescript
// 1. src/types/jarvis.ts에 추가
export enum EventType {
    // ... 기존 이벤트
    NEW_EVENT_TYPE = 'new_event_type'
}

// 2. 이벤트 로깅
await observer.logEvent(EventType.NEW_EVENT_TYPE, {
    customData: 'value'
});

// 3. StateUpdater에서 점수 계산에 반영 (필요시)
private async calculateEnergyLevel(): Promise<number> {
    const newEvents = events.filter(e => e.event_type === EventType.NEW_EVENT_TYPE);
    // ... 점수 계산 로직
}
```

### 새로운 ActionType 추가

```typescript
// 1. src/types/jarvis.ts에 추가
export enum ActionType {
    // ... 기존 액션
    NEW_ACTION = 'new_action'
}

// 2. Hands에서 실행 로직 구현
private async executeAuto(plan: InterventionPlan, reasonCodes: string[]): Promise<ExecutionResult> {
    switch (plan.actionType) {
        case ActionType.NEW_ACTION:
            actionResult = await this.performNewAction(plan.actionPayload);
            break;
        // ...
    }
}

private async performNewAction(payload: any): Promise<any> {
    // 실제 액션 실행 로직
}
```

### 새로운 ReasonCode 추가

```typescript
// 1. src/types/jarvis.ts에 추가
export const REASON_CODES = {
    // ... 기존 코드
    NEW_REASON: 'new_reason'
};

// 2. PolicyEngine에서 점수 계산에 추가
private calculateInterventionScore(state: any): { score: number; reasonCodes: string[] } {
    // ...
    if (someCondition) {
        score += someValue;
        reasonCodes.push(REASON_CODES.NEW_REASON);
    }
}

// 3. Brain에서 번역 추가
private translateReasonCode(code: string): string {
    const translations = {
        // ...
        [REASON_CODES.NEW_REASON]: '새로운 이유'
    };
}
```

---

## 비용 분석

### LLM 호출 빈도

- **규칙 기반 (무료)**:
  - Observer: 매 이벤트마다 (DB write only)
  - StateUpdater: 10분마다 (계산만)
  - PolicyEngine: 10분마다 (계산만)

- **LLM 호출 (유료)**:
  - Brain: 개입 점수 ≥ 75일 때만
  - 예상: 하루 2-3회 / 사용자

### 예상 비용 (Max 사용자 100명 기준)

**All-LLM 방식** (매 10분 LLM 호출):
- 100명 × 144회/일 × $0.015 = **$216/일**

**Jarvis 방식** (규칙 기반 + 선택적 LLM):
- 100명 × 2.5회/일 × $0.015 = **$3.75/일**

**절감률: 98.3%** 🎉

---

## 모니터링

### 주요 메트릭

```sql
-- 오늘 개입 횟수 (레벨별)
SELECT intervention_level, COUNT(*) as count
FROM intervention_logs
WHERE intervened_at >= CURRENT_DATE
GROUP BY intervention_level;

-- 사용자 피드백 분포
SELECT user_feedback, COUNT(*) as count
FROM intervention_logs
WHERE user_feedback IS NOT NULL
GROUP BY user_feedback;

-- 가장 많은 개입 이유
SELECT UNNEST(reason_codes) as reason, COUNT(*) as count
FROM intervention_logs
WHERE intervened_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY reason
ORDER BY count DESC;

-- 사용자별 개입 수락률
SELECT
    user_email,
    COUNT(CASE WHEN user_feedback = 'accepted' THEN 1 END)::float /
    COUNT(*) * 100 as acceptance_rate
FROM intervention_logs
WHERE user_feedback IS NOT NULL
GROUP BY user_email;
```

---

## 로드맵

### Phase 1: MVP (현재)
- ✅ Observer, State, Policy, Brain, Hands 구현
- ✅ L0-L4 개입 레벨
- ✅ 규칙 기반 점수 계산
- ✅ LLM 개입 계획 생성
- ✅ 데이터베이스 스키마
- ✅ Cron job 설정

### Phase 2: 통합
- [ ] UI 컴포넌트 (알림, 확인 다이얼로그)
- [ ] 사용자 설정 페이지
- [ ] 기존 시스템과 통합 (일정, 목표, 학습)

### Phase 3: 학습
- [ ] Reflection 모듈 구현
- [ ] 피드백 기반 임계치 자동 조정
- [ ] 사용자별 맞춤화

### Phase 4: 확장
- [ ] 더 많은 도메인 (건강, 학습, 재정)
- [ ] 멀티모달 입력 (음성, 이미지)
- [ ] 예측 모델 (미래 상태 예측)

---

## FAQ

### Q: Jarvis가 너무 자주 개입하면?

A: `jarvis_preferences` 테이블에서 설정 조정:
```sql
UPDATE jarvis_preferences
SET intervention_cooldown_minutes = 720 -- 12시간
WHERE user_email = 'user@example.com';
```

### Q: L4 자동 실행 활성화 방법?

A: 사용자가 명시적으로 옵트인해야 함:
```sql
UPDATE jarvis_preferences
SET auto_action_opt_in = TRUE
WHERE user_email = 'user@example.com';
```

### Q: 특정 시간대에 개입 받지 않으려면?

A: Quiet Hours 설정:
```sql
UPDATE jarvis_preferences
SET quiet_hours_start = 22, quiet_hours_end = 9
WHERE user_email = 'user@example.com';
```

### Q: Jarvis 완전히 비활성화?

A:
```sql
UPDATE jarvis_preferences
SET enabled = FALSE
WHERE user_email = 'user@example.com';
```

---

## 보안 고려사항

1. **Row Level Security (RLS)**: 모든 테이블에 적용, 사용자는 자신의 데이터만 접근
2. **Cron Secret**: `/api/jarvis/run` 엔드포인트는 인증 필요
3. **금지 표현 필터**: LLM 응답에서 의학적 표현 차단
4. **확인 필수 액션**: 위험한 액션은 L3 이상에서만 실행
5. **자동 실행 제한**: L4는 옵트인 필요

---

## 라이선스

MIT License

## 작성자

Fi.eri Team

## 버전

v1.0.0 (2026-01-21)
