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

            console.error(`[ToolExecutor] ${toolCall.toolName} failed (${isTransient ? 'transient' : 'permanent'}):`, error);
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
            console.error('[ToolExecutor] GCal sync failed (push):', e instanceof Error ? e.message : e);
        }

        return {
            success: true,
            data: newGoal,
            humanReadableSummary: `"${args.text}" 일정을 ${args.startTime}에 추가했습니다.`,
        };
    }

    private async deleteSchedule(args: DeleteScheduleArgs): Promise<ToolResult> {
        const userData = await this.getUserData();
        if (!userData) {
            return { success: false, error: '사용자 없음', humanReadableSummary: '사용자 정보를 찾을 수 없습니다.' };
        }

        const customGoals = userData.profile?.customGoals || [];
        const targetText = (args.text || '').toLowerCase();
        const targetTime = args.startTime || '';

        const filtered = customGoals.filter((g: CustomGoal) => {
            const matchesText = (g.text || '').toLowerCase().includes(targetText);
            const matchesTime = !targetTime || g.startTime === targetTime;
            return !(matchesText && matchesTime);
        });

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
            const deletedGoals = customGoals.filter((g: CustomGoal) => {
                const matchesText = (g.text || '').toLowerCase().includes(targetText);
                const matchesTime = !targetTime || g.startTime === targetTime;
                return matchesText && matchesTime;
            });
            if (deletedGoals.length > 0) {
                const { hasGCalLinked, GoogleCalendarService } = await import('@/lib/googleCalendarService');
                if (await hasGCalLinked(this.userEmail)) {
                    const gcal = new GoogleCalendarService(this.userEmail);
                    for (const goal of deletedGoals) {
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
            console.error('[ToolExecutor] GCal sync failed (delete):', e instanceof Error ? e.message : e);
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
            const count = args.count || 3;
            const focusArea = args.focus || 'auto';

            // 병렬로 분석 데이터 수집 (공유 컨텍스트 풀 사용)
            const { getSharedDailyState, getSharedWorkRestBalance } = await import('@/lib/shared-context');
            const [dailyState, workRest, patterns] = await Promise.all([
                getSharedDailyState(this.userEmail).catch(() => null) as Promise<any>,
                getSharedWorkRestBalance(this.userEmail).catch(() => null) as Promise<any>,
                import('@/lib/schedule-pattern-analyzer').then(m => m.analyzeSchedulePatterns(this.userEmail)).catch(() => null),
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

            // 추천 일정 생성
            const suggestions = generateScheduleSuggestions(
                effectiveFocus, count, freeSlots, profile, dailyState, workRest, patterns
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
            const result = await generateSmartSuggestions(this.userEmail, {
                requestCount: args.requestCount || 3,
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

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
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

function generateScheduleSuggestions(
    focus: string,
    count: number,
    freeSlots: string[],
    profile: UserProfile,
    dailyState: { stress_level: number; energy_level: number; completion_rate?: number } | null,
    workRest: { workIntensity?: string; restStatus?: string; recommendationType?: string; emptyHoursToday?: number } | null,
    patterns: unknown,
): ScheduleSuggestion[] {
    const pool = SUGGESTION_POOL[focus] || SUGGESTION_POOL.balanced;
    const suggestions: ScheduleSuggestion[] = [];

    // 사용자 관심사/직업 기반 필터링
    const userGoal = profile?.goal || '';
    const userField = profile?.field || '';
    const interests = profile?.interests || [];

    // 풀에서 랜덤하게 선택 (빈 시간에 맞춰)
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const usedSlots = new Set<string>();

    for (const item of shuffled) {
        if (suggestions.length >= count) break;
        if (freeSlots.length === 0) break;

        // 아직 사용하지 않은 첫 번째 빈 시간 찾기
        const slot = freeSlots.find(s => !usedSlots.has(s));
        if (!slot) break;

        usedSlots.add(slot);
        const startHour = parseInt(slot.split(':')[0]);
        const endMinutes = startHour * 60 + item.duration;
        const endHour = Math.floor(endMinutes / 60);
        const endMin = endMinutes % 60;

        // 이유 생성
        let reason = '';
        if (focus === 'rest' && dailyState) {
            reason = `스트레스 ${dailyState.stress_level}/10, 에너지 ${dailyState.energy_level}/10 — 휴식이 필요합니다.`;
        } else if (focus === 'productivity' && workRest) {
            reason = `오늘 여유 시간 ${Math.round(workRest.emptyHoursToday || 0)}시간 — 생산적으로 활용하세요.`;
        } else if (focus === 'exercise') {
            reason = '규칙적인 운동으로 컨디션을 유지하세요.';
        } else if (focus === 'learning') {
            reason = userGoal ? `"${userGoal}" 목표 달성을 위한 학습 시간입니다.` : '꾸준한 학습이 성장의 핵심입니다.';
        } else {
            reason = '균형 잡힌 하루를 위한 추천입니다.';
        }

        // 사용자 분야 맞춤 텍스트 조정
        let text = item.text;
        if (item.category === 'learning' && userField) {
            if (text === '온라인 강의 수강') text = `${userField} 관련 강의 수강`;
            if (text === '기술 블로그 읽기') text = `${userField} 트렌드 읽기`;
        }

        suggestions.push({
            text,
            startTime: slot,
            endTime: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`,
            reason,
            category: item.category,
        });
    }

    return suggestions;
}
