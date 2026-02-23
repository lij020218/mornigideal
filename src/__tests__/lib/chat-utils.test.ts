/**
 * Tests for chat-utils.ts pure functions
 *
 * These are keyword-based classifiers and parsers — no API/DB calls.
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeScheduleName,
    parseRepeatDays,
    validateAndAdjustTime,
    parseScheduleWithMemo,
    classifyIntent,
    getRequiredDataSources,
    type UserIntent,
} from '@/lib/chat-utils';

// ============================================
// normalizeScheduleName
// ============================================

describe('normalizeScheduleName', () => {
    it('normalizes meal names', () => {
        expect(normalizeScheduleName('아침밥')).toBe('아침 식사');
        expect(normalizeScheduleName('점심')).toBe('점심 식사');
        expect(normalizeScheduleName('저녁밥')).toBe('저녁 식사');
        expect(normalizeScheduleName('breakfast')).toBe('아침 식사');
        expect(normalizeScheduleName('lunch')).toBe('점심 식사');
    });

    it('normalizes sleep/wake names', () => {
        expect(normalizeScheduleName('일어나기')).toBe('기상');
        expect(normalizeScheduleName('잠자기')).toBe('취침');
        expect(normalizeScheduleName('wake up')).toBe('기상');
        expect(normalizeScheduleName('sleep')).toBe('취침');
    });

    it('normalizes work names', () => {
        expect(normalizeScheduleName('출근')).toBe('업무 시작');
        expect(normalizeScheduleName('퇴근')).toBe('업무 종료');
        expect(normalizeScheduleName('work')).toBe('업무 시작');
    });

    it('normalizes exercise names', () => {
        expect(normalizeScheduleName('헬스')).toBe('운동');
        expect(normalizeScheduleName('요가')).toBe('운동');
        expect(normalizeScheduleName('gym')).toBe('운동');
    });

    it('normalizes learning names', () => {
        expect(normalizeScheduleName('책 읽기')).toBe('독서');
        expect(normalizeScheduleName('study')).toBe('공부');
    });

    it('returns original text when no match', () => {
        expect(normalizeScheduleName('전화 통화')).toBe('전화 통화');
        expect(normalizeScheduleName('random text')).toBe('random text');
    });

    it('is case-insensitive', () => {
        expect(normalizeScheduleName('BREAKFAST')).toBe('아침 식사');
        expect(normalizeScheduleName('Sleep')).toBe('취침');
    });

    it('trims whitespace', () => {
        expect(normalizeScheduleName('  헬스  ')).toBe('운동');
    });
});

// ============================================
// parseRepeatDays
// ============================================

describe('parseRepeatDays', () => {
    it('parses 매일', () => {
        expect(parseRepeatDays('매일')).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(parseRepeatDays('every day')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('parses 평일', () => {
        expect(parseRepeatDays('평일')).toEqual([1, 2, 3, 4, 5]);
        expect(parseRepeatDays('weekday')).toEqual([1, 2, 3, 4, 5]);
    });

    it('parses 주말', () => {
        expect(parseRepeatDays('주말')).toEqual([0, 6]);
        expect(parseRepeatDays('weekend')).toEqual([0, 6]);
    });

    it('parses 매주 specific days', () => {
        expect(parseRepeatDays('매주 월수금')).toEqual([1, 3, 5]);
        expect(parseRepeatDays('매주 화목')).toEqual([2, 4]);
        expect(parseRepeatDays('매주 토일')).toEqual([6, 0]);
    });

    it('returns null for no day pattern', () => {
        expect(parseRepeatDays('내일')).toBeNull();
        expect(parseRepeatDays('random text')).toBeNull();
    });
});

// ============================================
// validateAndAdjustTime
// ============================================

describe('validateAndAdjustTime', () => {
    it('returns suggested time when in the future', () => {
        expect(validateAndAdjustTime('15:00', '10:00')).toBe('15:00');
        expect(validateAndAdjustTime('23:00', '22:00')).toBe('23:00');
    });

    it('returns same time when equal', () => {
        expect(validateAndAdjustTime('10:00', '10:00')).toBe('10:00');
    });

    it('adjusts past time to 30 min from now', () => {
        expect(validateAndAdjustTime('09:00', '10:00')).toBe('10:30');
        expect(validateAndAdjustTime('08:00', '14:00')).toBe('14:30');
    });

    it('returns empty string when adjustment exceeds 23:00', () => {
        expect(validateAndAdjustTime('01:00', '22:45')).toBe('');
    });
});

// ============================================
// parseScheduleWithMemo
// ============================================

describe('parseScheduleWithMemo', () => {
    it('returns plain text when no memo pattern', () => {
        const result = parseScheduleWithMemo('운동 추가해줘');
        expect(result.text).toBe('운동 추가해줘');
        expect(result.memo).toBe('');
    });
});

// ============================================
// classifyIntent
// ============================================

describe('classifyIntent', () => {
    const msg = (content: string) => [{ role: 'user', content }];

    it('returns "chat" for empty/missing messages', () => {
        expect(classifyIntent([])).toBe('chat');
        expect(classifyIntent([{ role: 'user', content: '' }])).toBe('chat');
    });

    it('classifies schedule intents', () => {
        expect(classifyIntent(msg('일정 추가해줘'))).toBe('schedule');
        expect(classifyIntent(msg('내일 오전 9시에 미팅'))).toBe('schedule');
        expect(classifyIntent(msg('일정 삭제해줘'))).toBe('schedule');
    });

    it('classifies search intents', () => {
        expect(classifyIntent(msg('맛집 추천해줘'))).toBe('search');
        expect(classifyIntent(msg('근처 카페 찾아줘'))).toBe('search');
        expect(classifyIntent(msg('최신 뉴스 알려줘'))).toBe('search');
    });

    it('classifies goal intents', () => {
        expect(classifyIntent(msg('이번 주 목표 달성률'))).toBe('goal');
        expect(classifyIntent(msg('습관 통계'))).toBe('goal');
    });

    it('classifies analysis intents', () => {
        expect(classifyIntent(msg('시간 분석해줘'))).toBe('analysis');
        expect(classifyIntent(msg('수면 패턴 보여줘'))).toBe('analysis');
    });

    it('classifies settings intents', () => {
        expect(classifyIntent(msg('설정 변경해줘'))).toBe('settings');
        expect(classifyIntent(msg('글자 크기 크게'))).toBe('settings');
        expect(classifyIntent(msg('글씨 크게'))).toBe('settings');
    });

    it('defaults to "chat" for general conversation', () => {
        expect(classifyIntent(msg('안녕하세요'))).toBe('chat');
        expect(classifyIntent(msg('오늘 기분이 좋아'))).toBe('chat');
    });

    it('uses last user message in multi-message conversation', () => {
        const messages = [
            { role: 'user', content: '안녕' },
            { role: 'assistant', content: '안녕하세요!' },
            { role: 'user', content: '일정 추가해줘' },
        ];
        expect(classifyIntent(messages)).toBe('schedule');
    });

    it('compound keywords take priority', () => {
        // "일정 검색" → search (not schedule, even though "일정" is schedule keyword)
        expect(classifyIntent(msg('일정 검색해줘'))).toBe('search');
        // "시간 분석" → analysis
        expect(classifyIntent(msg('시간 분석 해줘'))).toBe('analysis');
    });
});

// ============================================
// getRequiredDataSources
// ============================================

describe('getRequiredDataSources', () => {
    it('schedule intent needs full schedule', () => {
        const result = getRequiredDataSources('schedule', 'Free');
        expect(result.needsFullSchedule).toBe(true);
        expect(result.needsRag).toBe(false);
    });

    it('chat intent needs trend and full schedule', () => {
        const result = getRequiredDataSources('chat', 'Free');
        expect(result.needsTrend).toBe(true);
        expect(result.needsFullSchedule).toBe(true);
        expect(result.needsRag).toBe(true);
    });

    it('analysis intent needs RAG', () => {
        const result = getRequiredDataSources('analysis', 'Free');
        expect(result.needsRag).toBe(true);
    });

    it('Max plan enables event logs for schedule/analysis/goal', () => {
        expect(getRequiredDataSources('schedule', 'Max').needsEventLogs).toBe(true);
        expect(getRequiredDataSources('analysis', 'Max').needsEventLogs).toBe(true);
        expect(getRequiredDataSources('goal', 'Max').needsEventLogs).toBe(true);
    });

    it('Free plan disables event logs', () => {
        expect(getRequiredDataSources('schedule', 'Free').needsEventLogs).toBe(false);
        expect(getRequiredDataSources('analysis', 'Free').needsEventLogs).toBe(false);
    });

    it('search intent needs trend and RAG', () => {
        const result = getRequiredDataSources('search', 'Free');
        expect(result.needsTrend).toBe(true);
        expect(result.needsRag).toBe(true);
        expect(result.needsFullSchedule).toBe(false);
    });
});
