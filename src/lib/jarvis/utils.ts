/**
 * Jarvis 공유 유틸리티
 */

/**
 * YYYY-MM-DD 형식으로 날짜 포맷
 */
export function formatJarvisDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
