/**
 * Logger Utility
 *
 * 환경 기반 로깅. 프로덕션에서는 debug/info 로그를 출력하지 않고,
 * error/warn만 출력하여 민감 정보 노출을 방지합니다.
 */

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  /** 디버그 로그 — 개발 환경에서만 출력 */
  debug: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },

  /** 정보 로그 — 개발 환경에서만 출력 */
  info: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },

  /** 경고 로그 — 항상 출력 */
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },

  /** 에러 로그 — 항상 출력 */
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};
