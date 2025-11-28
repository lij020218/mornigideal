# 트렌드 브리핑 시스템 아키텍처

## 개요
매일 오전 4시-5시 사이에 3단계 Cron 작업을 통해 개인화된 트렌드 브리핑을 사전 생성하여 사용자가 즉시 로딩 없이 볼 수 있도록 합니다.

## 시스템 플로우

### 1단계: 뉴스 수집 (오전 4:00)
**경로**: `/api/batch-news`
**작업**: 21개 RSS 피드에서 최신 뉴스 100개 수집

- **RSS 소스**: Reuters, BBC, TechCrunch, Bloomberg, WSJ, NYT, ESPN, 한국경제, 조선일보 등
- **분야**: 비즈니스, 경제, IT, AI, 스포츠, 금융, 투자 등
- **처리**: GPT-5-mini로 요약 + 한국어 번역 (배치 병렬 처리)
- **저장**: `cached_news` 테이블에 저장

### 2단계: 개인화 트렌드 브리핑 생성 (오전 4:30)
**경로**: `/api/cron/generate-trend-briefings`
**작업**: 각 사용자에게 맞춤형 트렌드 브리핑 생성

#### 프로세스:
1. **뉴스 선택**:
   - Gemini Flash가 사용자 프로필 분석
   - 100개 중 사용자와 관련성 높은 6-8개 선택
   - 직무, 목표, 관심사 기반 필터링

2. **인사이트 생성**:
   - 선택된 뉴스에 대한 개인화된 분석
   - 각 뉴스의 사용자와의 연관성 설명
   - 실행 가능한 조언 (action items)
   - 전체 트렌드의 핵심 메시지

3. **저장**: `trend_briefings` 테이블에 저장

### 3단계: 일일 브리핑 생성 (오전 5:00)
**경로**: `/api/cron/generate-daily-briefing`
**작업**: 종합 모닝 브리핑 생성 (어제 목표 리뷰 + 오늘 스케줄 + 트렌드 요약)

## 데이터 구조

### cached_news 테이블
```sql
- id: UUID
- title: TEXT (원문 제목)
- title_korean: TEXT (한국어 제목)
- original_url: TEXT
- source_name: TEXT
- pub_date: TIMESTAMP
- category: TEXT (AI, Business, Tech, Finance, Sports 등)
- interests: JSONB (관련 태그 배열)
- summary_korean: TEXT (2-3문장 요약)
- relevance_score: INTEGER (1-10)
- is_active: BOOLEAN
```

### trend_briefings 테이블
```sql
- id: UUID
- email: TEXT (사용자 이메일)
- date: DATE
- briefing_data: JSONB
  {
    "overall_insight": "전체 인사이트",
    "key_message": "핵심 메시지",
    "trends": [
      {
        "title": "제목",
        "summary": "요약",
        "insight": "개인화된 인사이트",
        "url": "링크",
        "source": "출처",
        "category": "카테고리",
        "relevance": "연관성 설명"
      }
    ],
    "action_items": ["조언1", "조언2", "조언3"]
  }
- selected_articles: JSONB (선택된 뉴스 ID 배열)
```

## 사용자 경험 플로우

### 1. 사용자가 앱 열 때
```
Dashboard 로드
  ↓
TrendBriefingSection 마운트
  ↓
1. /api/trend-briefing/get 호출
  ↓
2. Supabase에서 오늘 날짜 브리핑 조회
  ↓
3-a. 있으면: 즉시 표시 (로딩 없음!)
3-b. 없으면: 실시간 생성 (fallback)
```

### 2. 새로고침 버튼 클릭 시
- forceRefresh=true로 실시간 생성
- 관심사 변경 후 맞춤형 재생성

## Cron 작업 스케줄

```json
{
  "crons": [
    {
      "path": "/api/batch-news",
      "schedule": "0 4 * * *"  // 오전 4:00
    },
    {
      "path": "/api/cron/generate-trend-briefings",
      "schedule": "30 4 * * *"  // 오전 4:30
    },
    {
      "path": "/api/cron/generate-daily-briefing",
      "schedule": "0 5 * * *"  // 오전 5:00
    }
  ]
}
```

## 비용 최적화

### 모델 선택
- **뉴스 수집/요약**: GPT-5-mini ($0.15/1M tokens)
- **개인화 생성**: Gemini Flash ($0.075/1M tokens)
- **일일 브리핑**: Gemini Flash ($0.075/1M tokens)

### 예상 비용 (100명 기준)
- **뉴스 수집**: 100개 × 1K tokens = 100K tokens/일
  - 월간: 3M tokens × $0.15/1M = **$0.45**

- **트렌드 브리핑**: 100명 × 3K tokens/요청 = 300K tokens/일
  - 월간: 9M tokens × $0.075/1M = **$0.68**

- **일일 브리핑**: 100명 × 2K tokens/요청 = 200K tokens/일
  - 월간: 6M tokens × $0.075/1M = **$0.45**

**총 월간 비용**: ~$1.60 (100명 기준)

## 필수 설정 단계

### 1. Supabase 테이블 생성
```sql
-- create-trend-briefings-table.sql 실행
CREATE TABLE IF NOT EXISTS trend_briefings (...);
```

### 2. Vercel 배포
```bash
vercel --prod
```

### 3. 환경 변수 확인
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (선택)

## 테스트

### 로컬 테스트
```bash
# 1. 뉴스 수집 (30초-1분 소요)
curl http://localhost:3000/api/batch-news

# 2. 트렌드 브리핑 생성 (사용자당 2-3초)
curl http://localhost:3000/api/cron/generate-trend-briefings

# 3. 일일 브리핑 생성 (사용자당 2-3초)
curl http://localhost:3000/api/cron/generate-daily-briefing

# 4. 사용자별 확인
curl http://localhost:3000/api/trend-briefing/get \
  -H "Cookie: your-session-cookie"
```

### Production 테스트
```bash
curl https://your-domain.vercel.app/api/cron/generate-trend-briefings \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 모니터링

### Vercel Logs
Functions 탭에서 각 Cron 작업 실행 로그 확인

### Supabase 쿼리
```sql
-- 오늘 수집된 뉴스 확인
SELECT COUNT(*), category
FROM cached_news
WHERE created_at::date = CURRENT_DATE
GROUP BY category;

-- 오늘 생성된 트렌드 브리핑 확인
SELECT email, created_at
FROM trend_briefings
WHERE date = CURRENT_DATE
ORDER BY created_at DESC;

-- 사용자별 선택된 뉴스 수 확인
SELECT
  email,
  jsonb_array_length(selected_articles) as article_count
FROM trend_briefings
WHERE date = CURRENT_DATE;
```

## 주요 이점

### 사용자 경험
- ✅ **로딩 없음**: 사전 생성으로 즉시 표시
- ✅ **개인화**: 각 사용자에게 맞춤형 인사이트
- ✅ **다양성**: 100개 뉴스 풀에서 선택
- ✅ **신선함**: 매일 오전 최신 뉴스

### 시스템 효율
- ✅ **비용 효율**: Mini/Flash 모델 사용
- ✅ **확장성**: 사용자 증가해도 Cron 1회 실행
- ✅ **안정성**: Fallback으로 실시간 생성 지원
- ✅ **캐싱**: 여러 레벨 캐싱 (DB → localStorage)

## 문제 해결

### 브리핑이 표시되지 않는 경우
1. Supabase에서 `trend_briefings` 테이블 데이터 확인
2. Vercel Logs에서 Cron 작업 실행 여부 확인
3. 브라우저 콘솔에서 `[TrendBriefing]` 로그 확인

### 뉴스가 수집되지 않는 경우
1. `/api/batch-news` 수동 실행해서 에러 확인
2. RSS 피드 URL이 유효한지 확인
3. OpenAI API 키 확인

### 사용자별로 다른 브리핑을 받지 못하는 경우
1. `users` 테이블에 profile 정보 확인
2. Gemini API 호출 로그 확인
3. 선택 로직 프롬프트 검토
