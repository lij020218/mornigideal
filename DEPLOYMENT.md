# Vercel 배포 가이드

## 사전 준비

### 1. Gemini API 키 발급
1. [Google AI Studio](https://makersuite.google.com/app/apikey) 방문
2. 새 API 키 생성
3. API 키 복사하여 저장

### 2. NextAuth Secret 생성
```bash
# 터미널에서 실행하여 랜덤 시크릿 생성
openssl rand -base64 32
```

## Vercel 배포 단계

### 1. Vercel 프로젝트 생성
1. [Vercel](https://vercel.com) 로그인
2. "Add New Project" 클릭
3. GitHub 저장소 `lij020218/mornigideal` 선택
4. "Import" 클릭

### 2. 환경 변수 설정
Vercel 프로젝트 설정에서 다음 환경 변수 추가:

```
GEMINI_API_KEY=your_actual_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-exp
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your_generated_secret
CRON_SECRET=your_random_cron_secret
NODE_ENV=production
```

**중요**:
- `NEXTAUTH_URL`은 Vercel에서 제공하는 실제 도메인으로 변경
- `NEXTAUTH_SECRET`은 위에서 생성한 랜덤 시크릿 사용
- `CRON_SECRET`도 보안을 위해 랜덤 문자열 사용

### 3. 빌드 및 배포 설정
Vercel이 자동으로 감지하지만, 필요시 다음 설정 확인:

- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Node Version**: 18.x 이상

### 4. 배포 실행
1. "Deploy" 버튼 클릭
2. 빌드 완료 대기 (약 2-3분)
3. 배포 완료 후 제공된 URL로 접속

## 배포 후 설정

### 1. Cron Job 설정 (선택사항)
매일 자동으로 트렌드 뉴스를 생성하려면:

1. Vercel 프로젝트 설정 → Cron Jobs
2. 새 Cron Job 추가:
   - **Path**: `/api/cron/generate-daily-news`
   - **Schedule**: `0 6 * * *` (매일 오전 6시)
   - **Headers**:
     ```
     Authorization: Bearer your_cron_secret
     ```

### 2. 도메인 설정 (선택사항)
1. Vercel 프로젝트 설정 → Domains
2. 커스텀 도메인 추가
3. DNS 레코드 설정
4. `NEXTAUTH_URL` 환경 변수를 새 도메인으로 업데이트

## 트러블슈팅

### 빌드 실패
- 환경 변수가 올바르게 설정되었는지 확인
- Vercel 빌드 로그 확인
- Node 버전 확인 (18.x 이상 필요)

### Runtime 에러
- Vercel Function Logs에서 에러 확인
- 환경 변수가 프로덕션 환경에 제대로 설정되었는지 확인

### API 호출 실패
- Gemini API 키가 유효한지 확인
- API 사용량 제한 확인

## 로컬 개발 환경

로컬에서 개발하려면:

1. `.env.local` 파일 생성
2. `.env.example` 내용 복사 후 실제 값으로 변경
3. `npm install` 실행
4. `npm run dev` 실행

## 주요 기능

- ✅ TypeScript 완전 지원
- ✅ Next.js 16 최신 버전
- ✅ Gemini AI 통합
- ✅ NextAuth 인증
- ✅ 일정 알림 시스템
- ✅ 개인화 학습 커리큘럼
- ✅ 트렌드 브리핑

## 지원

문제가 발생하면 GitHub Issues에 등록해주세요:
https://github.com/lij020218/mornigideal/issues
