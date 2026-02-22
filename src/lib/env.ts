/**
 * Environment Variable Validation
 *
 * 서버 시작 시 필수 환경변수를 검증하여 런타임 크래시를 방지합니다.
 * instrumentation.ts에서 import하여 앱 시작 시 실행됩니다.
 */

const required = [
  'OPENAI_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
] as const;

// JWT_SECRET은 3개 중 하나만 있으면 됨
const jwtSecretCandidates = ['JWT_SECRET', 'NEXTAUTH_SECRET', 'AUTH_SECRET'] as const;

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  const hasJwtSecret = jwtSecretCandidates.some((key) => process.env[key]);
  if (!hasJwtSecret) {
    missing.push(`JWT_SECRET (or NEXTAUTH_SECRET or AUTH_SECRET)`);
  }

  if (missing.length > 0) {
    throw new Error(
      `[ENV] Missing required environment variables:\n` +
      missing.map((k) => `  - ${k}`).join('\n') +
      `\n\nCheck .env.local or Vercel environment settings.`
    );
  }
}
