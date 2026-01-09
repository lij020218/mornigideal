# 데이터 생명주기 관리 시스템

## 개요

a.ideal 2.0은 사용자 데이터의 무한정 증가를 방지하고, 성능과 비용을 최적화하기 위해 **중요도 기반 자동 데이터 정리** 시스템을 구현했습니다.

## 핵심 개념

### 1. 데이터 계층 구조

```
Raw Events (user_events)
    ↓ (90일 후 집계)
Daily Features (user_features_daily)
    ↓ (1년 후 집계)
Weekly Features (user_features_weekly)
    ↓ (2년 후 삭제)
삭제
```

### 2. 중요도 기반 보관

모든 이벤트는 중요도 점수(1-10)를 가지며, 중요도가 높을수록 오래 보관됩니다.

| 중요도 | 점수 | 예시 | 보관 기간 |
|--------|------|------|-----------|
| 매우 높음 | 10 | 목표 달성, 습관 형성 | 영구 보관 |
| 높음 | 7-8 | 운동 완료, 학습 세션 | 1년+ |
| 중간 | 5-6 | 일정 추가, 작업 완료 | 90일 |
| 낮음 | 3-4 | 일정 변경, 건너뛰기 | 30일 |
| 매우 낮음 | 1-2 | 페이지 조회, 알림 무시 | 7일 |

## 테이블별 보관 정책

### user_events (원본 이벤트)
- **보관 기간**: 90일
- **이후 처리**: daily features로 집계 후 삭제
- **예외**: 중요도 8점 이상 이벤트는 더 오래 보관

### user_features_daily (일간 집계)
- **보관 기간**: 1년 (365일)
- **이후 처리**: weekly features로 재집계 후 삭제

### user_features_weekly (주간 집계)
- **보관 기간**: 2년 (104주)
- **이후 처리**: 완전 삭제

### timeblock_success_rate (성공률 통계)
- **보관 기간**: 무제한
- **이유**: 계속 업데이트되는 누적 통계이므로 삭제하지 않음

### user_constraints, user_preferences (사용자 설정)
- **보관 기간**: 영구 보관
- **이유**: 필수 설정 정보

### user_context_cache (캐시)
- **보관 기간**: 7일
- **이유**: 1주일 이상 접속하지 않은 사용자 캐시는 자동 삭제

## 자동 정리 스케줄

### 일일 정리 (매일 새벽 3시)
```
┌─────────────────────────────────┐
│ 1. 만료된 캐시 삭제             │
│ 2. 90일+ 이벤트 집계 & 삭제     │
│ 3. 1년+ daily 집계 & 삭제       │
│ 4. 중복 데이터 제거             │
│ 5. 고아 레코드 정리             │
│ 6. 용량 제한 확인               │
└─────────────────────────────────┘
```

## 사용자별 용량 제한

| 데이터 유형 | 최대 개수 | 경고 임계값 |
|-------------|-----------|-------------|
| 이벤트 로그 | 10,000개 | 8,000개 (80%) |
| 일간 집계 | 365개 | 292개 (80%) |
| 주간 집계 | 104개 | 83개 (80%) |

용량 제한 도달 시:
- 가장 오래되고 중요도 낮은 데이터부터 자동 삭제
- 사용자에게 알림 표시

## API 엔드포인트

### 데이터 통계 조회
```bash
GET /api/admin/data-cleanup
```

응답:
```json
{
  "userEmail": "user@example.com",
  "stats": {
    "totalEvents": 2500,
    "totalDailyFeatures": 120,
    "totalWeeklyFeatures": 15,
    "dataRange": {
      "oldest": "2024-01-01T00:00:00Z",
      "newest": "2024-12-31T23:59:59Z"
    },
    "usagePercentage": {
      "events": 25.0,
      "daily": 32.9,
      "weekly": 14.4
    }
  }
}
```

### 수동 정리 실행
```bash
POST /api/admin/data-cleanup
Content-Type: application/json

{
  "dryRun": false
}
```

응답:
```json
{
  "success": true,
  "report": {
    "executedAt": "2024-01-15T03:00:00Z",
    "totalRecordsDeleted": 1250,
    "totalRecordsAggregated": 450,
    "byTable": {
      "user_events": { "deleted": 1000, "aggregated": 0 },
      "user_features_daily": { "deleted": 250, "aggregated": 450 }
    },
    "errors": [],
    "executionTimeMs": 2500
  }
}
```

### Cron Job (자동 실행)
```bash
GET /api/cron/daily-cleanup?secret=<CRON_SECRET>
```

## 집계 규칙

### user_events → user_features_daily

```sql
SELECT
  user_email,
  DATE(start_at) as date,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE event_type LIKE '%_completed') as completed_tasks,
  COUNT(*) FILTER (WHERE event_type = 'workout_completed') as workout_count,
  AVG((metadata->>'hours')::float) FILTER (WHERE event_type = 'sleep_logged') as sleep_hours
FROM user_events
GROUP BY user_email, DATE(start_at)
```

### user_features_daily → user_features_weekly

```sql
SELECT
  user_email,
  DATE_TRUNC('week', date) as week_start,
  SUM(workout_count) as total_workouts,
  AVG(sleep_hours) as avg_sleep_hours,
  AVG(completed_tasks::float / total_tasks) as workout_completion_rate
FROM user_features_daily
GROUP BY user_email, DATE_TRUNC('week', date)
```

## 중복 제거 규칙

동일한 이벤트가 60초 이내에 여러 번 기록되면 중복으로 간주하고 제거합니다.

```typescript
// 중복 조건
{
  user_email: 같음,
  event_type: 같음,
  start_at: 60초 이내 차이
}
```

## 설정 파일

### 보관 정책 (`src/lib/data-lifecycle-policy.ts`)

```typescript
export const DATA_RETENTION_POLICIES: DataRetentionPolicy[] = [
  {
    tableName: 'user_events',
    retentionDays: 90,
    aggregateBeforeDelete: true,
    importance: 'high',
  },
  // ...
];
```

### 이벤트 중요도 (`src/lib/data-lifecycle-policy.ts`)

```typescript
export const EVENT_IMPORTANCE_SCORES: Record<string, number> = {
  'goal_achieved': 10,
  'workout_completed': 8,
  'schedule_added': 5,
  'workout_skipped': 3,
  // ...
};
```

## UI 컴포넌트

설정 페이지에서 데이터 관리 섹션 추가:

```tsx
import { DataManagement } from "@/components/features/settings/DataManagement";

<DataManagement />
```

기능:
- ✅ 실시간 데이터 용량 확인
- ✅ 진행 바로 사용률 시각화
- ✅ 수동 정리 버튼
- ✅ 자동 정리 안내
- ✅ 용량 부족 경고

## 환경 변수

`.env.local`에 추가:

```bash
# Cron job 보안 시크릿
CRON_SECRET=your-secret-key-here

# 관리자 이메일 (선택)
ADMIN_EMAILS=admin@example.com,admin2@example.com
```

## 배포 (Vercel)

`vercel.json`에 Cron 설정이 자동으로 추가되었습니다:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Vercel 대시보드에서 확인:
1. Project Settings → Cron Jobs
2. `/api/cron/daily-cleanup` 확인
3. 실행 로그 모니터링

## 모니터링

### 로그 확인

```typescript
console.log('[Data Cleanup] Completed:', {
  deleted: 1250,
  aggregated: 450,
  errors: 0,
  executionTimeMs: 2500
});
```

### 에러 알림

5개 이상의 에러 발생 시 관리자에게 알림:

```typescript
if (report.errors.length > 5) {
  // TODO: Slack/이메일 알림
}
```

## 테스트

### Dry Run (테스트 실행)

```bash
curl -X POST https://your-domain.com/api/admin/data-cleanup \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

실제 삭제 없이 통계만 확인합니다.

### 로컬 테스트

```bash
# 브라우저 콘솔에서:
fetch('/api/admin/data-cleanup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dryRun: true })
})
.then(res => res.json())
.then(console.log);
```

## 마이그레이션

기존 사용자 데이터가 있는 경우:

1. 첫 실행 시 자동으로 집계 데이터 생성
2. 오래된 raw 이벤트 정리
3. 점진적으로 용량 정리

## FAQ

**Q: 중요한 데이터가 삭제될 수 있나요?**
A: 중요도 8점 이상 이벤트는 더 오래 보관되며, 집계 데이터로 변환되어 통계는 유지됩니다.

**Q: 정리된 데이터를 복구할 수 있나요?**
A: 삭제된 raw 이벤트는 복구 불가하지만, 집계 데이터(daily/weekly)에 요약되어 남아있습니다.

**Q: 자동 정리를 비활성화할 수 있나요?**
A: `vercel.json`에서 cron 설정을 제거하면 자동 정리가 중단됩니다. 하지만 용량 제한을 위해 권장하지 않습니다.

**Q: 성능 영향은 없나요?**
A: 사용자가 적은 새벽 3시에 실행되며, 배치 처리(1000개씩)로 부하를 분산합니다.

## 향후 개선 사항

- [ ] 사용자별 보관 정책 커스터마이징
- [ ] 데이터 내보내기 (export to JSON/CSV)
- [ ] 장기 아카이빙 (S3/GCS)
- [ ] 실시간 용량 알림 (Slack/이메일)
- [ ] 관리자 대시보드
- [ ] 정리 스케줄 커스터마이징
