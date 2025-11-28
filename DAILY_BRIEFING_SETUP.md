# 일일 브리핑 사전 생성 설정 가이드

## 개요
매일 오전 5시에 모든 사용자의 일일 브리핑을 미리 생성하여 Supabase에 저장합니다.
사용자가 아침에 일어나면 로딩/버퍼링 없이 즉시 브리핑을 볼 수 있습니다.

## 아키텍처

### 1. Cron 작업 (오전 5시)
- **경로**: `/api/cron/generate-daily-briefing`
- **실행 시간**: 매일 오전 5시 (KST 기준)
- **작업**:
  1. Supabase `users` 테이블에서 모든 사용자 조회
  2. 각 사용자의 프로필 정보로 개인화된 브리핑 생성
  3. `daily_briefings` 테이블에 저장

### 2. 브리핑 로드 플로우 (사용자가 앱 열 때)
1. **localStorage 확인** (가장 빠름)
2. **Supabase에서 사전 생성된 브리핑 조회** (`/api/daily-briefing/get`)
3. **실시간 생성** (fallback, 사전 생성 실패 시)

## 필수 설정 단계

### 1. Supabase 테이블 생성
`create-daily-briefings-table.sql` 파일을 Supabase SQL Editor에서 실행:
```sql
CREATE TABLE IF NOT EXISTS daily_briefings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    date DATE NOT NULL,
    briefing_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(email, date)
);
```

### 2. Vercel Cron 설정 확인
`vercel.json`에서 cron 작업이 올바르게 설정되었는지 확인:
```json
{
  "crons": [
    {
      "path": "/api/cron/generate-daily-briefing",
      "schedule": "0 5 * * *"
    }
  ]
}
```

### 3. 환경 변수 설정 (Vercel)
- `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY`: Gemini API 키
- `CRON_SECRET` (선택): Cron 엔드포인트 보안용

### 4. Vercel에 배포
```bash
vercel --prod
```

## 테스트

### 1. 로컬에서 Cron 작업 테스트
```bash
curl http://localhost:3000/api/cron/generate-daily-briefing
```

### 2. Production에서 Cron 작업 테스트
```bash
curl https://your-domain.vercel.app/api/cron/generate-daily-briefing \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 3. 사전 생성된 브리핑 확인
Supabase SQL Editor에서:
```sql
SELECT * FROM daily_briefings
WHERE date = CURRENT_DATE
ORDER BY created_at DESC;
```

## 비용 최적화

### 현재 구성
- **Cron 작업**: Gemini Flash (`gemini-2.0-flash-exp`) - 저렴함
- **실시간 생성 (fallback)**: Gemini Flash - 저렴함

### 예상 비용 (100명 기준)
- **일일**: 100 요청 × 2,000 tokens/요청 ≈ 200K tokens
- **월간**: 200K × 30일 = 6M tokens
- **비용**: 6M tokens × $0.075/1M = **$0.45/월**

## 모니터링

### Vercel Logs
Vercel 대시보드 → Functions → `/api/cron/generate-daily-briefing`에서 실행 로그 확인

### 성공 여부 확인
1. Cron 작업이 매일 5시에 실행되는지 확인
2. `daily_briefings` 테이블에 데이터가 쌓이는지 확인
3. 사용자가 브리핑을 빠르게 로드하는지 테스트

## 문제 해결

### 브리핑이 생성되지 않는 경우
1. Vercel Logs에서 에러 확인
2. Supabase `users` 테이블에 사용자 데이터가 있는지 확인
3. `GEMINI_API_KEY`가 올바르게 설정되었는지 확인

### 사용자가 여전히 로딩을 경험하는 경우
1. 브라우저 콘솔에서 `[Header]` 로그 확인
2. `/api/daily-briefing/get`가 정상적으로 응답하는지 확인
3. localStorage가 제대로 작동하는지 확인
