import { describe, it, expect } from 'vitest';
import { isImportantSchedule } from '@/lib/proactiveNotificationService';

describe('isImportantSchedule', () => {
    // -------------------------------------------------------
    // Meeting / presentation keywords
    // -------------------------------------------------------
    describe('meeting and presentation keywords', () => {
        it.each([
            ['회의'],
            ['미팅'],
            ['meeting'],
            ['면접'],
            ['발표'],
            ['프레젠테이션'],
        ])('returns true for "%s"', (keyword) => {
            expect(isImportantSchedule(keyword)).toBe(true);
        });
    });

    // -------------------------------------------------------
    // Deadline keywords
    // -------------------------------------------------------
    describe('deadline keywords', () => {
        it.each([
            ['마감'],
            ['데드라인'],
            ['deadline'],
            ['시험'],
            ['테스트'],
        ])('returns true for "%s"', (keyword) => {
            expect(isImportantSchedule(keyword)).toBe(true);
        });
    });

    // -------------------------------------------------------
    // Appointment / medical keywords
    // -------------------------------------------------------
    describe('appointment and medical keywords', () => {
        it.each([
            ['약속'],
            ['상담'],
            ['진료'],
            ['예약'],
        ])('returns true for "%s"', (keyword) => {
            expect(isImportantSchedule(keyword)).toBe(true);
        });
    });

    // -------------------------------------------------------
    // Case-insensitive matching
    // -------------------------------------------------------
    describe('case variations', () => {
        it.each([
            ['MEETING'],
            ['Meeting'],
            ['DEADLINE'],
            ['Deadline'],
        ])('returns true for "%s" (case-insensitive)', (keyword) => {
            expect(isImportantSchedule(keyword)).toBe(true);
        });
    });

    // -------------------------------------------------------
    // Keywords embedded in longer text
    // -------------------------------------------------------
    describe('keyword inside longer text', () => {
        it.each([
            ['오후 2시 회의 참석'],
            ['내일 면접 준비'],
            ['프로젝트 마감일'],
            ['오전 10시 진료 예정'],
            ['팀 미팅 자료 준비'],
            ['Weekly team meeting at 3pm'],
            ['Final deadline for submission'],
        ])('returns true for "%s"', (text) => {
            expect(isImportantSchedule(text)).toBe(true);
        });
    });

    // -------------------------------------------------------
    // Non-important schedules
    // -------------------------------------------------------
    describe('non-important schedules', () => {
        it.each([
            ['점심 식사'],
            ['운동'],
            ['독서'],
            ['산책'],
            ['청소'],
            ['빨래'],
            ['grocery shopping'],
        ])('returns false for "%s"', (text) => {
            expect(isImportantSchedule(text)).toBe(false);
        });
    });

    // -------------------------------------------------------
    // Empty string
    // -------------------------------------------------------
    it('returns false for an empty string', () => {
        expect(isImportantSchedule('')).toBe(false);
    });
});
