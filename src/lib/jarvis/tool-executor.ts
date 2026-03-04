/**
 * Jarvis Tool Executor
 * 도구 호출을 기존 서비스에 연결하는 브릿지
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import { ToolCall, ToolResult } from './tools';
import { StateUpdater } from './state-updater';
import type { CustomGoal, LongTermGoal, UserProfile, AddScheduleArgs, DeleteScheduleArgs, UpdateScheduleArgs, SuggestScheduleArgs, CreateChecklistArgs, PrepareScheduleArgs, SaveLearningArgs, FocusType } from '@/lib/types';
import type { MemoryType } from '@/lib/jarvis-memory';
import { logAgentAction } from '@/lib/agent-action-log';
import { logger } from '@/lib/logger';

export class ToolExecutor {
    private userEmail: string;
    private userPlan: string;
    private cachedUserData: { profile: UserProfile } | null = null;

    constructor(userEmail: string, userPlan: string) {
        this.userEmail = userEmail;
        this.userPlan = userPlan;
    }

    /**
     * Fetch user data once per ToolExecutor lifecycle, then return cached.
     * Eliminates N+1: previously 6 methods each queried users.profile independently.
     */
    private async getUserData(): Promise<{ profile: UserProfile } | null> {
        if (this.cachedUserData) return this.cachedUserData;
        const { data } = await supabaseAdmin
            .from('users')
            .select('profile')
            .eq('email', this.userEmail)
            .maybeSingle();
        this.cachedUserData = data;
        return data;
    }

    /** Invalidate cache after profile mutations (add/delete/update). */
    private async invalidateCache(): Promise<void> {
        this.cachedUserData = null;
        // 공유 컨텍스트 풀도 무효화
        try {
            const { invalidateUserContext } = await import('@/lib/shared-context');
            invalidateUserContext(this.userEmail);
        } catch { /* ignore */ }
    }

    async execute(toolCall: ToolCall): Promise<ToolResult> {
        const startTime = Date.now();
        try {
            const result = await this.dispatch(toolCall);

            // Log successful schedule-related actions for cross-agent dedup
            if (result.success && ['add_schedule', 'update_schedule', 'delete_schedule', 'suggest_schedule'].includes(toolCall.toolName)) {
                logAgentAction(this.userEmail, 'react', toolCall.toolName, toolCall.arguments || {}).catch(() => {});
            }

            return result;
        } catch (error) {
            const isTransient = error instanceof Error &&
                (error.message.includes('timeout') || error.message.includes('ECONNRESET') || error.message.includes('connection'));

            logger.error(`[ToolExecutor] ${toolCall.toolName} failed (${isTransient ? 'transient' : 'permanent'}):`, error);
            return {
                success: false,
                error: String(error),
                humanReadableSummary: isTransient
                    ? `도구 "${toolCall.toolName}" 일시적 오류 — 다시 시도할 수 있습니다.`
                    : `도구 "${toolCall.toolName}" 실행 실패: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    private async dispatch(toolCall: ToolCall): Promise<ToolResult> {
        const args = toolCall.arguments;

        switch (toolCall.toolName) {
            case 'get_today_schedules':
                return this.getSchedulesByDate(this.formatDate(new Date()));
            case 'get_schedule_by_date':
                return this.getSchedulesByDate(args.date);
            case 'add_schedule':
                return this.addSchedule(args as AddScheduleArgs);
            case 'delete_schedule':
                return this.deleteSchedule(args as DeleteScheduleArgs);
            case 'update_schedule':
                return this.updateSchedule(args as UpdateScheduleArgs);
            case 'web_search':
                return this.webSearch(args.query);
            case 'search_user_memory':
                return this.searchUserMemory(args.query);
            case 'get_user_state':
                return this.getUserState();
            case 'get_goals':
                return this.getGoals(args.goalType || 'all');
            case 'add_goal':
                return this.addGoal(args as { title: string; type: string; description?: string; category?: string; targetDate?: string });
            case 'update_goal':
                return this.updateGoal(args as { goalId: string; type: string; progress?: number; completed?: boolean });
            case 'get_schedule_patterns':
                return this.getSchedulePatterns();
            case 'create_checklist':
                return this.createChecklist(args as CreateChecklistArgs);
            case 'prepare_schedule':
                return this.prepareSchedule(args as PrepareScheduleArgs);
            case 'save_learning':
                return this.saveLearning(args as SaveLearningArgs);
            case 'suggest_schedule':
                return this.suggestSchedule(args as SuggestScheduleArgs);
            case 'log_mood':
                return this.logMood(args.mood, args.energy, args.note);
            // === Capability-backed tools ===
            case 'get_smart_suggestions':
                return this.getSmartSuggestions(args);
            case 'get_prep_advice':
                return this.getPrepAdvice(args);
            case 'get_habit_insights':
                return this.getHabitInsights();
            case 'get_resource_recommendations':
                return this.getResourceRecommendations(args);
            case 'respond_to_user':
                return {
                    success: true,
                    data: args,
                    humanReadableSummary: '사용자 응답 전달 완료',
                };
            default:
                return {
                    success: false,
                    error: `Unknown tool: ${toolCall.toolName}`,
                    humanReadableSummary: `알 수 없는 도구: ${toolCall.toolName}`,
                };
        }
    }

    // ================================================
    // 일정 조회/관리
    // ================================================

    private async getSchedulesByDate(dateStr: string): Promise<ToolResult> {
        const userData = await this.getUserData();
        if (!userData) {
            return { success: false, error: '사용자 없음', humanReadableSummary: '사용자 정보를 찾을 수 없습니다.' };
        }

        const customGoals = userData.profile?.customGoals || [];
        const dayOfWeek = new Date(dateStr).getDay();

        const schedules = customGoals
            .filter((g: CustomGoal) =>
                g.specificDate === dateStr ||
                (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate)
            )
            .map((g: CustomGoal) => ({
                text: g.text,
                startTime: g.startTime || '시간 미정',
                endTime: g.endTime || '',
                completed: g.completed || false,
                location: g.location || '',
                memo: g.memo || '',
                isRepeating: !!g.daysOfWeek,
            }))
            .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        const summary = schedules.length > 0
            ? `${dateStr} 일정 ${schedules.length}개:\n${schedules.map(s => `- ${s.startTime} ${s.text}${s.completed ? ' (완료)' : ''}`).join('\n')}`
            : `${dateStr}에 등록된 일정이 없습니다.`;

        return { success: true, data: schedules, humanReadableSummary: summary };
    }

    private async addSchedule(args: AddScheduleArgs): Promise<ToolResult> {
        const userData = await this.getUserData();
        if (!userData) {
            return { success: false, error: '사용자 없음', humanReadableSummary: '사용자 정보를 찾을 수 없습니다.' };
        }

        const customGoals = userData.profile?.customGoals || [];

        // specificDate와 daysOfWeek 동시 설정 방지
        if (args.specificDate && args.daysOfWeek && args.daysOfWeek.length > 0) {
            // specificDate 우선 (일회성 일정으로 처리)
            args.daysOfWeek = undefined;
        }

        // 중복 일정 체크 (같은 텍스트 + 같은 시간 + 같은 날짜/반복 요일)
        const scheduleDate = args.specificDate || null;
        const scheduleDays = args.daysOfWeek || null;
        const isDuplicate = customGoals.some((g: any) => {
            if (g.text !== args.text || g.startTime !== args.startTime) return false;
            // 반복 일정 중복: 같은 daysOfWeek 조합
            if (scheduleDays && g.daysOfWeek) {
                const sorted1 = [...scheduleDays].sort().join(',');
                const sorted2 = [...g.daysOfWeek].sort().join(',');
                return sorted1 === sorted2;
            }
            // 단일 일정 중복: 같은 specificDate
            return (g.specificDate || null) === scheduleDate;
        });
        if (isDuplicate) {
            return { success: false, error: '중복 일정', humanReadableSummary: `"${args.text}" 일정이 이미 같은 시간에 존재합니다.` };
        }

        const newGoal = {
            id: `goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            text: args.text,
            startTime: args.startTime,
            endTime: args.endTime || '',
            specificDate: args.specificDate || null,
            daysOfWeek: args.daysOfWeek || null,
            color: args.color || 'primary',
            location: args.location || '',
            memo: args.memo || '',
            completed: false,
            createdAt: new Date().toISOString(),
        };

        const { error } = await supabaseAdmin
            .from('users')
            .update({ profile: { ...userData.profile, customGoals: [...customGoals, newGoal] } })
            .eq('email', this.userEmail);

        if (error) {
            return { success: false, error: error.message, humanReadableSummary: `일정 추가 실패: ${error.message}` };
        }
        this.invalidateCache();

        // GCal 연동된 사용자면 push
        try {
            const { hasGCalLinked, GoogleCalendarService } = await import('@/lib/googleCalendarService');
            if (await hasGCalLinked(this.userEmail)) {
                const gcal = new GoogleCalendarService(this.userEmail);
                await gcal.pushEvent(newGoal);
            }
        } catch (e) {
            logger.error('[ToolExecutor] GCal sync failed (push):', e instanceof Error ? e.message : e);
        }

        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const repeatInfo = args.daysOfWeek && args.daysOfWeek.length > 0
            ? ` (매주 ${args.daysOfWeek.map(d => dayNames[d]).join('·')} 반복)`
            : args.specificDate ? ` (${args.specificDate})` : '';

        return {
            success: true,
            data: newGoal,
            humanReadableSummary: `"${args.text}" 일정을 ${args.startTime}에 추가했습니다.${repeatInfo}`,
        };
    }

    private async deleteSchedule(args: DeleteScheduleArgs): Promise<ToolResult> {
        const userData = await this.getUserData();
        if (!userData) {
            return { success: false, error: '사용자 없음', humanReadableSummary: '사용자 정보를 찾을 수 없습니다.' };
        }

        const customGoals = userData.profile?.customGoals || [];
        const targetText = (args.text || '').toLowerCase().trim();
        const targetTime = args.startTime || '';

        // 정확 매칭 우선, 없으면 부분 매칭 (1개만 매칭될 때)
        const exactMatches = customGoals.filter((g: CustomGoal) => {
            const matchesText = (g.text || '').toLowerCase().trim() === targetText;
            const matchesTime = !targetTime || g.startTime === targetTime;
            return matchesText && matchesTime;
        });

        const partialMatches = customGoals.filter((g: CustomGoal) => {
            const matchesText = (g.text || '').toLowerCase().includes(targetText);
            const matchesTime = !targetTime || g.startTime === targetTime;
            return matchesText && matchesTime;
        });

        const toDelete = exactMatches.length > 0 ? exactMatches : partialMatches;

        if (toDelete.length === 0) {
            return { success: false, error: '일정 없음', humanReadableSummary: `"${args.text}" 일정을 찾을 수 없습니다.` };
        }

        // 부분 매칭으로 여러 개 걸리면 경고 후 정확 매칭만 삭제
        if (exactMatches.length === 0 && partialMatches.length > 1) {
            const names = partialMatches.map((g: CustomGoal) => `"${g.text}"`).join(', ');
            return {
                success: false,
                error: '다중 매칭',
                humanReadableSummary: `"${args.text}"와 유사한 일정이 ${partialMatches.length}개 있어요: ${names}. 정확한 이름을 알려주세요.`,
            };
        }

        const toDeleteIds = new Set(toDelete.map((g: CustomGoal) => g.id));
        const filtered = customGoals.filter((g: CustomGoal) => !toDeleteIds.has(g.id));

        if (filtered.length === customGoals.length) {
            return { success: false, error: '일정 없음', humanReadableSummary: `"${args.text}" 일정을 찾을 수 없습니다.` };
        }

        const { error } = await supabaseAdmin
            .from('users')
            .update({ profile: { ...userData.profile, customGoals: filtered } })
            .eq('email', this.userEmail);

        if (error) {
            return { success: false, error: error.message, humanReadableSummary: `일정 삭제 실패: ${error.message}` };
        }
        this.invalidateCache();

        // GCal 연동된 사용자면 삭제 동기화
        try {
            if (toDelete.length > 0) {
                const { hasGCalLinked, GoogleCalendarService } = await import('@/lib/googleCalendarService');
                if (await hasGCalLinked(this.userEmail)) {
                    const gcal = new GoogleCalendarService(this.userEmail);
                    for (const goal of toDelete) {
                        const { data: mapping } = await supabaseAdmin
                            .from('calendar_sync_mapping')
                            .select('gcal_event_id')
                            .eq('user_email', this.userEmail)
                            .eq('local_goal_id', goal.id)
                            .maybeSingle();
                        if (mapping) {
                            await gcal.deleteEvent(mapping.gcal_event_id);
                        }
                    }
                }
            }
        } catch (e) {
            logger.error('[ToolExecutor] GCal sync failed (delete):', e instanceof Error ? e.message : e);
        }

        return { success: true, humanReadableSummary: `"${args.text}" 일정을 삭제했습니다.` };
    }

    private async updateSchedule(args: UpdateScheduleArgs): Promise<ToolResult> {
        const userData = await this.getUserData();
        if (!userData) {
            return { success: false, error: '사용자 없음', humanReadableSummary: '사용자 정보를 찾을 수 없습니다.' };
        }

        const customGoals = userData.profile?.customGoals || [];
        const targetText = (args.originalText || '').toLowerCase();
        let found = false;

        const updated = customGoals.map((g: CustomGoal) => {
            if ((g.text || '').toLowerCase().includes(targetText) && g.startTime === args.originalTime) {
                found = true;
                return {
                    ...g,
                    text: args.newText || g.text,
                    startTime: args.newStartTime || g.startTime,
                };
            }
            return g;
        });

        if (!found) {
            return { success: false, error: '일정 없음', humanReadableSummary: `"${args.originalText}" 일정을 찾을 수 없습니다.` };
        }

        const { error } = await supabaseAdmin
            .from('users')
            .update({ profile: { ...userData.profile, customGoals: updated } })
            .eq('email', this.userEmail);

        if (error) {
            return { success: false, error: error.message, humanReadableSummary: `일정 수정 실패: ${error.message}` };
        }
        this.invalidateCache();

        return { success: true, humanReadableSummary: `"${args.originalText}" 일정을 수정했습니다.` };
    }

    // ================================================
    // 검색/지식
    // ================================================

    private async webSearch(query: string): Promise<ToolResult> {
        try {
            const { tavily } = await import('@tavily/core');
            const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || '' });
            const response = await tvly.search(query, { maxResults: 5 });

            const results = (response.results || []).map((r: { title: string; url: string; content?: string }) => ({
                title: r.title,
                url: r.url,
                snippet: r.content?.substring(0, 200),
            }));

            const summary = results.length > 0
                ? `"${query}" 검색 결과 ${results.length}개:\n${results.map((r, i) => `${i + 1}. ${r.title}`).join('\n')}`
                : `"${query}" 검색 결과가 없습니다.`;

            return { success: true, data: results, humanReadableSummary: summary };
        } catch (error) {
            return { success: false, error: String(error), humanReadableSummary: `웹 검색 실패: ${error instanceof Error ? error.message : String(error)}` };
        }
    }

    private async searchUserMemory(query: string): Promise<ToolResult> {
        try {
            const { getRelevantContext } = await import('@/lib/jarvis-memory');
            const context = await getRelevantContext(this.userEmail, query);

            return {
                success: true,
                data: context,
                humanReadableSummary: context
                    ? `관련 기억 검색 결과:\n${context.substring(0, 500)}`
                    : '관련 기억을 찾지 못했습니다.',
            };
        } catch (error) {
            return { success: false, error: String(error), humanReadableSummary: '메모리 검색 실패' };
        }
    }

    // ================================================
    // 상태/컨텍스트
    // ================================================

    private async getUserState(): Promise<ToolResult> {
        const stateUpdater = new StateUpdater(this.userEmail);
        const state = await stateUpdater.getCurrentState();

        if (!state) {
            return { success: false, error: '상태 없음', humanReadableSummary: '사용자 상태 정보가 없습니다.' };
        }

        const summary = [
            `에너지: ${state.energy_level}/100`,
            `스트레스: ${state.stress_level}/100`,
            `집중력: ${state.focus_window_score}/100`,
            `루틴 이탈: ${state.routine_deviation_score}/100`,
            `마감 압박: ${state.deadline_pressure_score}/100`,
        ].join(', ');

        return { success: true, data: state, humanReadableSummary: `현재 상태: ${summary}` };
    }

    private async getGoals(goalType: string): Promise<ToolResult> {
        const userData = await this.getUserData();
        const longTermGoals = userData?.profile?.longTermGoals || {};
        const types = goalType === 'all' ? ['weekly', 'monthly', 'yearly'] : [goalType];

        const goals: Array<{ type: string; title: string; progress: number; completed: boolean; dueDate?: string }> = [];
        types.forEach(type => {
            ((longTermGoals as Record<string, LongTermGoal[]>)[type] || []).forEach((g: LongTermGoal & { dueDate?: string }) => {
                goals.push({ type, title: g.title, progress: g.progress || 0, completed: g.completed || false, dueDate: g.dueDate });
            });
        });

        const activeGoals = goals.filter(g => !g.completed);
        const summary = activeGoals.length > 0
            ? `활성 목표 ${activeGoals.length}개:\n${activeGoals.map(g => `- [${g.type}] ${g.title} (${g.progress}%)`).join('\n')}`
            : '등록된 활성 목표가 없습니다.';

        return { success: true, data: goals, humanReadableSummary: summary };
    }

    private async addGoal(args: { title: string; type: string; description?: string; category?: string; targetDate?: string }): Promise<ToolResult> {
        const goalType = args.type as 'weekly' | 'monthly' | 'yearly';
        if (!['weekly', 'monthly', 'yearly'].includes(goalType)) {
            return { success: false, error: 'invalid type', humanReadableSummary: '목표 타입은 weekly, monthly, yearly 중 하나여야 합니다.' };
        }

        const userData = await this.getUserData();
        if (!userData) {
            return { success: false, error: '사용자 없음', humanReadableSummary: '사용자 정보를 찾을 수 없습니다.' };
        }

        const longTermGoals = userData.profile?.longTermGoals || {};
        const currentGoals = {
            weekly: (longTermGoals as Record<string, LongTermGoal[]>).weekly || [],
            monthly: (longTermGoals as Record<string, LongTermGoal[]>).monthly || [],
            yearly: (longTermGoals as Record<string, LongTermGoal[]>).yearly || [],
        };

        const now = new Date().toISOString();
        const newGoal: LongTermGoal = {
            id: `goal-${Date.now()}`,
            type: goalType,
            title: args.title,
            description: args.description || '',
            category: args.category || 'general',
            targetDate: args.targetDate,
            progress: 0,
            milestones: [],
            completed: false,
            createdAt: now,
            updatedAt: now,
        };

        currentGoals[goalType].push(newGoal);

        await supabaseAdmin
            .from('users')
            .update({ profile: { ...userData.profile, longTermGoals: currentGoals } })
            .eq('email', this.userEmail);

        this.cachedUserData = null; // 캐시 무효화

        const typeLabel = { weekly: '주간', monthly: '월간', yearly: '연간' }[goalType];
        return {
            success: true,
            data: newGoal,
            humanReadableSummary: `${typeLabel} 목표 "${args.title}"을(를) 추가했습니다.`,
        };
    }

    private async updateGoal(args: { goalId: string; type: string; progress?: number; completed?: boolean }): Promise<ToolResult> {
        const goalType = args.type as 'weekly' | 'monthly' | 'yearly';
        if (!['weekly', 'monthly', 'yearly'].includes(goalType)) {
            return { success: false, error: 'invalid type', humanReadableSummary: '목표 타입은 weekly, monthly, yearly 중 하나여야 합니다.' };
        }

        const userData = await this.getUserData();
        if (!userData) {
            return { success: false, error: '사용자 없음', humanReadableSummary: '사용자 정보를 찾을 수 없습니다.' };
        }

        const longTermGoals = userData.profile?.longTermGoals || {};
        const currentGoals = {
            weekly: (longTermGoals as Record<string, LongTermGoal[]>).weekly || [],
            monthly: (longTermGoals as Record<string, LongTermGoal[]>).monthly || [],
            yearly: (longTermGoals as Record<string, LongTermGoal[]>).yearly || [],
        };

        const goalList = currentGoals[goalType];
        const index = goalList.findIndex((g: LongTermGoal) => g.id === args.goalId);
        if (index === -1) {
            return { success: false, error: 'goal not found', humanReadableSummary: '해당 목표를 찾을 수 없습니다.' };
        }

        const now = new Date().toISOString();
        if (args.progress !== undefined) {
            goalList[index].progress = Math.min(100, Math.max(0, args.progress));
            if (goalList[index].progress >= 100) {
                goalList[index].completed = true;
            }
        }
        if (args.completed !== undefined) {
            goalList[index].completed = args.completed;
            if (args.completed) goalList[index].progress = 100;
        }
        goalList[index].updatedAt = now;

        await supabaseAdmin
            .from('users')
            .update({ profile: { ...userData.profile, longTermGoals: currentGoals } })
            .eq('email', this.userEmail);

        this.cachedUserData = null;

        const goal = goalList[index];
        return {
            success: true,
            data: goal,
            humanReadableSummary: args.completed
                ? `목표 "${goal.title}"을(를) 완료 처리했습니다!`
                : `목표 "${goal.title}" 진행률을 ${goal.progress}%로 업데이트했습니다.`,
        };
    }

    private async getSchedulePatterns(): Promise<ToolResult> {
        try {
            const { analyzeSchedulePatterns } = await import('@/lib/schedule-pattern-analyzer');
            const patterns = await analyzeSchedulePatterns(this.userEmail);

            return {
                success: true,
                data: patterns,
                humanReadableSummary: `일정 패턴 분석 완료: 기상 ${patterns.wakeUpTime || '미확인'}, 취침 ${patterns.sleepTime || '미확인'}, 바쁜 요일: ${patterns.busyDays?.join(', ') || '없음'}`,
            };
        } catch (error) {
            return { success: false, error: String(error), humanReadableSummary: '일정 패턴 분석 실패' };
        }
    }

    // ================================================
    // 일정 추천
    // ================================================

    private async suggestSchedule(args: SuggestScheduleArgs): Promise<ToolResult> {
        try {
            const isFree = this.userPlan === 'free';
            const count = isFree ? 1 : (args.count || 3);
            const focusArea = args.focus || 'auto';

            // 병렬로 분석 데이터 수집 (공유 컨텍스트 풀 사용)
            const { getSharedDailyState, getSharedWorkRestBalance, getSharedSuggestionPreferences } = await import('@/lib/shared-context');
            const [dailyState, workRest, patterns, suggestionPrefs] = await Promise.all([
                getSharedDailyState(this.userEmail).catch(() => null) as Promise<any>,
                getSharedWorkRestBalance(this.userEmail).catch(() => null) as Promise<any>,
                import('@/lib/schedule-pattern-analyzer').then(m => m.analyzeSchedulePatterns(this.userEmail)).catch(() => null),
                getSharedSuggestionPreferences(this.userEmail).catch(() => null) as Promise<any>,
            ]);

            // 오늘 일정 가져오기 (cached)
            const userData = await this.getUserData();
            const profile = userData?.profile || {};
            const customGoals = profile.customGoals || [];
            const now = new Date();
            const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const todayStr = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
            const dayOfWeek = kst.getDay();
            const currentHour = kst.getHours();

            const todayGoals = customGoals.filter((g: CustomGoal) => {
                if (g.specificDate === todayStr) return true;
                if (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate) return true;
                return false;
            });

            // 빈 시간대 찾기
            const occupiedTimes = todayGoals
                .filter((g: CustomGoal) => g.startTime)
                .map((g: CustomGoal) => ({
                    start: parseInt(g.startTime!.split(':')[0]),
                    end: g.endTime ? parseInt(g.endTime.split(':')[0]) : parseInt(g.startTime!.split(':')[0]) + 1,
                }));

            const freeSlots: string[] = [];
            for (let h = Math.max(currentHour + 1, 7); h <= 22; h++) {
                const isOccupied = occupiedTimes.some(t => h >= t.start && h < t.end);
                if (!isOccupied) {
                    freeSlots.push(`${String(h).padStart(2, '0')}:00`);
                }
            }

            // 추천 방향 결정
            let effectiveFocus = focusArea;
            if (effectiveFocus === 'auto' && workRest) {
                effectiveFocus = workRest.recommendationType === 'rest' ? 'rest'
                    : workRest.recommendationType === 'productivity' ? 'productivity'
                    : workRest.recommendationType === 'leisure' ? 'rest'
                    : 'balanced';
            }
            if (effectiveFocus === 'auto' && dailyState) {
                effectiveFocus = dailyState.stress_level >= 7 ? 'rest'
                    : dailyState.energy_level >= 7 ? 'productivity'
                    : 'balanced';
            }
            if (effectiveFocus === 'auto') effectiveFocus = 'balanced';

            // 추천 일정 생성 (선호도 반영)
            const suggestions = generateScheduleSuggestions(
                effectiveFocus, count, freeSlots, profile, dailyState, workRest, patterns, suggestionPrefs
            );

            const summaryParts = suggestions.map(s => `${s.startTime} ${s.text}`);
            return {
                success: true,
                data: {
                    suggestions,
                    focus: effectiveFocus,
                    freeSlots: freeSlots.slice(0, 5),
                    dailyState: dailyState ? {
                        energy: dailyState.energy_level,
                        stress: dailyState.stress_level,
                        completionRate: dailyState.completion_rate,
                    } : null,
                    workRest: workRest ? {
                        intensity: workRest.workIntensity,
                        restStatus: workRest.restStatus,
                    } : null,
                },
                humanReadableSummary: `${effectiveFocus} 기반 ${suggestions.length}개 일정 추천: ${summaryParts.join(', ')}`,
            };
        } catch (error) {
            return { success: false, error: String(error), humanReadableSummary: '일정 추천 실패' };
        }
    }

    // ================================================
    // 액션 실행
    // ================================================

    private async createChecklist(args: CreateChecklistArgs): Promise<ToolResult> {
        const { error } = await supabaseAdmin
            .from('jarvis_resources')
            .insert({
                user_email: this.userEmail,
                resource_type: 'checklist',
                title: args.title,
                content: { items: args.items || [], relatedSchedule: args.scheduleId },
                related_schedule_id: args.scheduleId || null,
                created_at: new Date().toISOString(),
            });

        if (error) {
            return { success: false, error: error.message, humanReadableSummary: `체크리스트 생성 실패: ${error.message}` };
        }

        const items = args.items || [];
        return {
            success: true,
            data: { title: args.title, items },
            humanReadableSummary: `"${args.title}" 체크리스트 생성 완료 (${items.length}개 항목)`,
        };
    }

    private async prepareSchedule(args: PrepareScheduleArgs): Promise<ToolResult> {
        try {
            const { generatePrep } = await import('@/lib/schedulePrepService');
            const schedule = { text: args.scheduleText, startTime: args.startTime };
            const prep = await generatePrep(schedule, this.userEmail, this.userPlan);

            const checklistStr = prep.checklist.map((c, i) => `${i + 1}. ${c}`).join('\n');
            const summary = `"${prep.scheduleName}" 준비 체크리스트 (${prep.prepType}):\n${checklistStr}`;

            return {
                success: true,
                data: prep,
                humanReadableSummary: summary,
            };
        } catch (error) {
            return { success: false, error: String(error), humanReadableSummary: '일정 준비 자료 생성 실패' };
        }
    }

    private async saveLearning(args: SaveLearningArgs): Promise<ToolResult> {
        try {
            const { saveMemory } = await import('@/lib/jarvis-memory');
            await saveMemory(this.userEmail, args.content, (args.category || 'insight') as MemoryType, {});

            return {
                success: true,
                humanReadableSummary: `"${args.content.substring(0, 30)}..." 학습 기록 저장 완료`,
            };
        } catch (error) {
            return { success: false, error: String(error), humanReadableSummary: '학습 기록 저장 실패' };
        }
    }

    // ================================================
    // 기분/에너지 기록
    // ================================================

    private async logMood(mood: number, energy: number, note?: string): Promise<ToolResult> {
        try {
            const { kvAppend } = await import('@/lib/kv-store');

            const now = new Date();
            const monthKey = `mood_checkins_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            const entry = {
                date: now.toISOString().split('T')[0],
                time: now.toISOString(),
                mood,
                energy,
                note: note || '',
            };

            await kvAppend(this.userEmail, monthKey, entry, 500);

            // user_states.energy_level도 동시 업데이트
            const energyLevel = energy * 20; // 1-5 → 20-100
            await supabaseAdmin
                .from('user_states')
                .update({ energy_level: energyLevel, state_updated_at: now.toISOString() })
                .eq('user_email', this.userEmail);

            const moodEmojis = ['', '😫', '😔', '😐', '😊', '😄'];
            return {
                success: true,
                data: entry,
                humanReadableSummary: `기분 ${moodEmojis[mood] || mood}/5, 에너지 ${energy}/5 기록 완료${note ? ` (${note})` : ''}`,
            };
        } catch (error) {
            return { success: false, error: String(error), humanReadableSummary: '기분 기록 실패' };
        }
    }

    // ================================================
    // Capability-backed tools
    // ================================================

    private async getSmartSuggestions(args: Record<string, any>): Promise<ToolResult> {
        try {
            const { generateSmartSuggestions } = await import('@/lib/capabilities/smart-suggestions');
            const isFree = this.userPlan === 'free';
            const result = await generateSmartSuggestions(this.userEmail, {
                requestCount: isFree ? 1 : (args.requestCount || 3),
                currentHour: args.currentHour,
            });

            if (!result.success) {
                return { success: false, error: result.error, humanReadableSummary: `AI 일정 추천 실패: ${result.error}` };
            }

            const suggestions = result.data!.suggestions;
            const summary = suggestions.length > 0
                ? `AI 맞춤 추천 ${suggestions.length}개:\n${suggestions.map(s => `- ${s.icon} ${s.title} (${s.estimatedTime})`).join('\n')}`
                : 'AI 추천 결과가 없습니다.';

            return { success: true, data: result.data, humanReadableSummary: summary };
        } catch (error) {
            return { success: false, error: String(error), humanReadableSummary: 'AI 일정 추천 실패' };
        }
    }

    private async getPrepAdvice(args: Record<string, any>): Promise<ToolResult> {
        try {
            const { generateSchedulePrep } = await import('@/lib/capabilities/schedule-prep');
            const result = await generateSchedulePrep(this.userEmail, {
                scheduleText: args.scheduleText,
                startTime: args.startTime,
                timeUntil: args.timeUntil,
            });

            if (!result.success) {
                return { success: false, error: result.error, humanReadableSummary: `준비 조언 생성 실패: ${result.error}` };
            }

            return {
                success: true,
                data: result.data,
                humanReadableSummary: `"${args.scheduleText}" 준비 조언: ${result.data!.advice.substring(0, 100)}...`,
            };
        } catch (error) {
            return { success: false, error: String(error), humanReadableSummary: '준비 조언 생성 실패' };
        }
    }

    private async getHabitInsights(): Promise<ToolResult> {
        try {
            const { generateHabitInsights } = await import('@/lib/capabilities/habit-insights');
            const result = await generateHabitInsights(this.userEmail, {});

            if (!result.success && !result.data) {
                return { success: false, error: result.error, humanReadableSummary: '습관 분석 실패' };
            }

            const data = result.data!;
            return {
                success: true,
                data,
                humanReadableSummary: `${data.emoji} ${data.insight} — ${data.suggestion}`,
            };
        } catch (error) {
            return { success: false, error: String(error), humanReadableSummary: '습관 분석 실패' };
        }
    }

    private async getResourceRecommendations(args: Record<string, any>): Promise<ToolResult> {
        try {
            const { generateResourceRecommendation } = await import('@/lib/capabilities/resource-recommend');
            const result = await generateResourceRecommendation(this.userEmail, {
                activity: args.activity,
                category: args.category,
                context: args.context,
                timeUntil: args.timeUntil,
            });

            if (!result.success) {
                return { success: false, error: result.error, humanReadableSummary: `리소스 추천 실패: ${result.error}` };
            }

            return {
                success: true,
                data: result.data,
                humanReadableSummary: `"${args.activity}" 리소스: ${result.data!.recommendation.substring(0, 100)}...`,
            };
        } catch (error) {
            return { success: false, error: String(error), humanReadableSummary: '리소스 추천 실패' };
        }
    }

    // ================================================
    // 유틸리티
    // ================================================

    /** KST 기준 YYYY-MM-DD (서버 TZ와 무관하게 일관된 날짜) */
    private formatDate(date: Date): string {
        const kst = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const year = kst.getFullYear();
        const month = String(kst.getMonth() + 1).padStart(2, '0');
        const day = String(kst.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

// ================================================
// 일정 추천 생성 (규칙 기반, LLM 불필요)
// ================================================

interface ScheduleSuggestion {
    text: string;
    startTime: string;
    endTime: string;
    reason: string;
    category: string;
}

const SUGGESTION_POOL: Record<string, Array<{ text: string; duration: number; category: string }>> = {
    rest: [
        { text: '짧은 산책', duration: 15, category: 'wellness' },
        { text: '스트레칭 & 심호흡', duration: 10, category: 'wellness' },
        { text: '명상', duration: 15, category: 'wellness' },
        { text: '가벼운 요가', duration: 20, category: 'exercise' },
        { text: '음악 들으며 휴식', duration: 15, category: 'wellness' },
        { text: '눈 휴식 + 물 마시기', duration: 10, category: 'wellness' },
    ],
    productivity: [
        { text: '집중 업무 블록', duration: 60, category: 'work' },
        { text: '이메일 & 메시지 정리', duration: 30, category: 'work' },
        { text: '미뤄둔 작업 처리', duration: 45, category: 'work' },
        { text: '주간 계획 정리', duration: 20, category: 'planning' },
        { text: '문서 정리 & 리뷰', duration: 30, category: 'work' },
    ],
    exercise: [
        { text: '조깅', duration: 30, category: 'exercise' },
        { text: '홈트레이닝', duration: 30, category: 'exercise' },
        { text: '자전거 타기', duration: 40, category: 'exercise' },
        { text: '수영', duration: 45, category: 'exercise' },
        { text: '스트레칭 루틴', duration: 20, category: 'exercise' },
    ],
    learning: [
        { text: '온라인 강의 수강', duration: 30, category: 'learning' },
        { text: '독서 30분', duration: 30, category: 'learning' },
        { text: '기술 블로그 읽기', duration: 20, category: 'learning' },
        { text: '사이드 프로젝트', duration: 60, category: 'learning' },
        { text: '영어 공부', duration: 25, category: 'learning' },
    ],
    balanced: [
        { text: '가벼운 산책', duration: 15, category: 'wellness' },
        { text: '집중 업무 블록', duration: 45, category: 'work' },
        { text: '독서', duration: 30, category: 'learning' },
        { text: '스트레칭', duration: 10, category: 'exercise' },
        { text: '자기계발 시간', duration: 30, category: 'learning' },
    ],
};

// 목표/관심사 → 관련 카테고리 매핑
const GOAL_CATEGORY_MAP: Record<string, string[]> = {
    '개발': ['learning', 'work'], '프로그래밍': ['learning', 'work'], '코딩': ['learning', 'work'],
    '건강': ['exercise', 'wellness'], '운동': ['exercise'], '다이어트': ['exercise', 'wellness'],
    '자기계발': ['learning'], '독서': ['learning'], '공부': ['learning'],
    '커리어': ['work', 'learning'], '취업': ['work', 'learning'], '이직': ['work', 'learning'],
    '마케팅': ['work', 'learning'], '디자인': ['work', 'learning'],
    '재테크': ['learning'], '투자': ['learning'],
    '영어': ['learning'], '외국어': ['learning'],
    '명상': ['wellness'], '마음챙김': ['wellness'],
};

// 반복 일정 title → 카테고리 추론용 키워드
const RECURRING_CATEGORY_KEYWORDS: Record<string, RegExp> = {
    exercise: /운동|헬스|요가|필라테스|러닝|조깅|수영|웨이트|등산|자전거|스트레칭|홈트|크로스핏|배드민턴|테니스|축구|농구|탁구/,
    wellness: /명상|휴식|산책|스킨케어|일기|정리|청소|수면|취침|낮잠/,
    learning: /공부|학습|독서|책|강의|스터디|과제|영어|코딩|자격증/,
    work: /업무|회의|미팅|프로젝트|개발|기획|보고서|작업/,
    planning: /계획|정리|리뷰|회고/,
};

function generateScheduleSuggestions(
    focus: string,
    count: number,
    freeSlots: string[],
    profile: UserProfile,
    dailyState: { stress_level: number; energy_level: number; completion_rate?: number } | null,
    workRest: { workIntensity?: string; restStatus?: string; recommendationType?: string; emptyHoursToday?: number } | null,
    patterns: unknown,
    prefs?: { categoryWeights?: Record<string, number>; timeCategoryScores?: Record<string, Record<string, number>> } | null,
): ScheduleSuggestion[] {
    const basePool = SUGGESTION_POOL[focus] || SUGGESTION_POOL.balanced;
    const userGoal = profile?.goal || '';
    const userField = profile?.field || '';
    const interests = profile?.interests || [];

    // ── 1. 후보 풀 구성: 고정 풀 + 반복 일정 동적 추가 ──
    type PoolItem = { text: string; duration: number; category: string; fromRecurring?: boolean };
    const pool: PoolItem[] = [...basePool];
    const typedPatterns = patterns as { recurringSchedules?: Array<{ title: string; timeBlock: string; frequency: number }> } | null;
    const recurring = typedPatterns?.recurringSchedules || [];

    // 반복 일정에서 빈도 2회 이상 → 풀에 동적 추가
    const addedTitles = new Set(pool.map(p => p.text));
    for (const rs of recurring) {
        if (rs.frequency < 2 || addedTitles.has(rs.title)) continue;
        let category = 'wellness';
        for (const [cat, regex] of Object.entries(RECURRING_CATEGORY_KEYWORDS)) {
            if (regex.test(rs.title)) { category = cat; break; }
        }
        pool.push({ text: rs.title, duration: 30, category, fromRecurring: true });
        addedTitles.add(rs.title);
    }

    // ── 2. 목표-카테고리 매핑 ──
    const goalCategories = new Set<string>();
    const goalText = `${userGoal} ${interests.join(' ')}`;
    for (const [keyword, cats] of Object.entries(GOAL_CATEGORY_MAP)) {
        if (goalText.includes(keyword)) cats.forEach(c => goalCategories.add(c));
    }

    // ── 3. 카테고리별 완료율 계산 ──
    const categoryCompletionRate: Record<string, number> = {};
    // recurringSchedules에는 완료율이 없으므로 빈도를 proxy로 사용
    // frequency 높을수록 사용자가 꾸준히 하는 활동 → 높은 점수
    const maxFreq = Math.max(1, ...recurring.map(r => r.frequency));
    for (const rs of recurring) {
        let cat = 'wellness';
        for (const [c, regex] of Object.entries(RECURRING_CATEGORY_KEYWORDS)) {
            if (regex.test(rs.title)) { cat = c; break; }
        }
        // 빈도 기반 비율 (0~1)
        const rate = rs.frequency / maxFreq;
        categoryCompletionRate[cat] = Math.max(categoryCompletionRate[cat] || 0, rate);
    }

    // ── 4. 슬롯 시간 → 시간대 매핑 ──
    const getTimeBlock = (hour: number): string => {
        if (hour < 12) return 'morning';
        if (hour < 18) return 'afternoon';
        return 'evening';
    };

    // ── 5. (활동 × 슬롯) 조합 점수 계산 ──
    type ScoredCandidate = {
        item: PoolItem;
        slot: string;
        score: number;
        factors: { catWeight: number; timeBonus: number; goalBonus: number; completionBonus: number; freqBonus: number };
    };

    const candidates: ScoredCandidate[] = [];
    for (const item of pool) {
        for (const slot of freeSlots) {
            const hour = parseInt(slot.split(':')[0]);
            const block = getTimeBlock(hour);

            // 점수 요소 계산
            const catWeight = prefs?.categoryWeights?.[item.category] ?? 1.0;
            const timeBonus = prefs?.timeCategoryScores?.[block]?.[item.category] ?? 1.0;
            const goalBonus = goalCategories.has(item.category) ? 1.5 : 1.0;
            const completionBonus = 0.5 + (categoryCompletionRate[item.category] || 0.5);
            const freqBonus = item.fromRecurring ? 0.5 : 0;

            const score = catWeight * timeBonus * goalBonus * completionBonus + freqBonus;

            // 약간의 랜덤성 추가 (±15%) — 매번 동일한 추천 방지
            const jitter = 0.85 + Math.random() * 0.3;
            candidates.push({
                item, slot,
                score: score * jitter,
                factors: { catWeight, timeBonus, goalBonus, completionBonus, freqBonus },
            });
        }
    }

    // 점수 높은 순 정렬
    candidates.sort((a, b) => b.score - a.score);

    // ── 6. Greedy 할당 (같은 카테고리 최대 2개) ──
    const suggestions: ScheduleSuggestion[] = [];
    const usedSlots = new Set<string>();
    const usedTexts = new Set<string>();
    const categoryCount: Record<string, number> = {};

    for (const c of candidates) {
        if (suggestions.length >= count) break;
        if (usedSlots.has(c.slot)) continue;
        if (usedTexts.has(c.item.text)) continue;
        if ((categoryCount[c.item.category] || 0) >= 2) continue;

        usedSlots.add(c.slot);
        usedTexts.add(c.item.text);
        categoryCount[c.item.category] = (categoryCount[c.item.category] || 0) + 1;

        const startHour = parseInt(c.slot.split(':')[0]);
        const endMinutes = startHour * 60 + c.item.duration;
        const endHour = Math.floor(endMinutes / 60);
        const endMin = endMinutes % 60;

        // ── 이유 텍스트: 점수 기여도 기반 동적 생성 ──
        let reason: string;
        const { freqBonus, goalBonus, timeBonus, completionBonus } = c.factors;
        if (freqBonus > 0) {
            reason = '자주 하시는 활동이에요.';
        } else if (goalBonus > 1.0 && userGoal) {
            reason = `'${userGoal}' 목표 달성에 도움이 돼요.`;
        } else if (timeBonus > 1.2) {
            reason = '이 시간대에 잘 실천하셨어요.';
        } else if (completionBonus > 1.0) {
            reason = '꾸준히 하고 계신 활동이에요.';
        } else if (focus === 'rest' && dailyState) {
            reason = `스트레스 ${dailyState.stress_level}/10, 에너지 ${dailyState.energy_level}/10 — 휴식이 필요합니다.`;
        } else if (focus === 'productivity' && workRest) {
            reason = `오늘 여유 시간 ${Math.round(workRest.emptyHoursToday || 0)}시간 — 생산적으로 활용하세요.`;
        } else {
            reason = '균형 잡힌 하루를 위한 추천입니다.';
        }

        // 사용자 분야 맞춤 텍스트 조정
        let text = c.item.text;
        if (c.item.category === 'learning' && userField) {
            if (text === '온라인 강의 수강') text = `${userField} 관련 강의 수강`;
            if (text === '기술 블로그 읽기') text = `${userField} 트렌드 읽기`;
        }

        suggestions.push({
            text,
            startTime: c.slot,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
            reason,
            category: c.item.category,
        });
    }

    return suggestions;
}
