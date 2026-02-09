/**
 * 입력 검증 유틸리티
 */

// YYYY-MM-DD 형식 검증
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(date: string): boolean {
    if (!DATE_REGEX.test(date)) return false;
    const parsed = new Date(date + 'T00:00:00Z');
    return !isNaN(parsed.getTime());
}

// HH:MM 형식 검증
const TIME_REGEX = /^\d{2}:\d{2}$/;

export function isValidTime(time: string): boolean {
    if (!TIME_REGEX.test(time)) return false;
    const [h, m] = time.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// 문자열 길이 제한
export function isValidString(str: unknown, maxLength: number = 1000): str is string {
    return typeof str === 'string' && str.length <= maxLength;
}

// 정수 범위 검증
export function isValidInt(value: string | null, min: number = 1, max: number = 10000): number | null {
    if (!value) return null;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < min || parsed > max) return null;
    return parsed;
}

// 이메일 형식 검증
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email) && email.length <= 254;
}
