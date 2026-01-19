# Fi.eri (A.ideal 2.0)

AI 기반 개인 성장 OS - 나의 하루, 학습, 성장을 운영해주는 AI 시스템

---

## 📱 MOBILE APP ONLY

**Fi.eri는 모바일 앱 전용으로 배포됩니다.**

현재 Next.js 웹 버전은 개발/테스트 용도이며, 최종 배포는 React Native 앱으로 진행합니다.

### 배포 일정
- **~2월**: 베타 테스트 (Capacitor로 빠르게 앱 래핑 → 피드백 수집)
- **2월~3월**: React Native (Expo)로 전체 UI 전환
- **3월**: iOS App Store / Google Play Store **정식 출시**

### 배포 전략
1. **베타 버전 (Capacitor)**: 현재 Next.js 코드를 앱으로 래핑하여 빠르게 테스터에게 배포
2. **정식 버전 (React Native)**: 완전 네이티브 앱으로 재개발 후 3월 출시

### 기술 스택 (앱 버전)
- **Frontend**: React Native + Expo
- **Backend**: Separate API Server (현재 Next.js API routes 분리)
- **Database**: Supabase
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Auth**: Firebase Auth

---

## 🔐 Security First

**⚠️ CRITICAL: Never commit API keys to Git!**

Before starting development, please read [SECURITY.md](./SECURITY.md) for important security guidelines.

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/lij020218/mornigideal.git
cd "a.ideal 2.0"
```

### 2. Set up environment variables

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local and add your actual API keys
# NEVER commit this file!
```

Required API keys:
- OpenAI API Key (https://platform.openai.com/api-keys)
- Google Gemini API Key (https://ai.google.dev/)
- Supabase credentials (https://supabase.com/)
- Google OAuth credentials (for Gmail integration)

See `.env.example` for all required variables.

### 3. Install dependencies

```bash
npm install
```

### 4. Run the development server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
