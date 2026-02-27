"use client";

import { useEffect, useState } from 'react';
import { getChatDate } from "@/lib/scheduleUtils";
import { timeToMinutes } from "@/lib/scheduleUtils";
import { isImportantSchedule } from "@/lib/proactiveNotificationService";
import type { Schedule, Message } from "@/types/dashboard";

interface AutoMessageDeps {
    session: any;
    todaySchedules: Schedule[];
    userProfile: any;
    trendBriefings: any[];
    userLocation: { latitude: number; longitude: number; city?: string } | null;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    messages: Message[];
}

export function useAutoMessages(deps: AutoMessageDeps): void {
    const { session, todaySchedules, userProfile, trendBriefings, userLocation, setMessages, messages } = deps;
    const [learningTipsShownFor, setLearningTipsShownFor] = useState<Set<string>>(new Set());

    // Fetch learning tips when there's a learning schedule
    useEffect(() => {
        if (!session?.user?.email || todaySchedules.length === 0) return;

        const fetchLearningTips = async () => {
            // 학습 일정 찾기 (isLearning: true 또는 learningData가 있는 일정)
            const learningSchedule = todaySchedules.find(
                (s: any) => s.isLearning && s.learningData && !s.completed && !s.skipped
            );

            if (!learningSchedule) {
                return;
            }

            const scheduleId = (learningSchedule as any).id;

            // 이미 표시한 학습 팁인지 확인
            if (learningTipsShownFor.has(scheduleId)) {
                return;
            }

            // localStorage에서도 확인 (페이지 새로고침 대응)
            const dismissedKey = `learning_tips_dismissed_${scheduleId}`;
            if (localStorage.getItem(dismissedKey)) {
                return;
            }

            const learningData = (learningSchedule as any).learningData;
            if (!learningData) return;
            try {
                const res = await fetch('/api/ai-learning-tip', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        learningData,
                        userLevel: 'intermediate',
                    }),
                });

                if (res.ok) {
                    const data = await res.json();

                    // 학습 팁을 채팅 메시지로 변환
                    let tipMessage = `📚 **${learningData.dayTitle || '오늘의 학습'}**\n\n`;
                    tipMessage += `${data.greeting}\n\n`;

                    if (learningData.objectives && learningData.objectives.length > 0) {
                        tipMessage += `**📌 학습 목표:**\n`;
                        learningData.objectives.forEach((obj: string) => {
                            tipMessage += `- ${obj}\n`;
                        });
                        tipMessage += `\n`;
                    }

                    if (data.tips && data.tips.length > 0) {
                        tipMessage += `**💡 학습 팁:**\n\n`;
                        data.tips.forEach((tip: any, index: number) => {
                            tipMessage += `${tip.emoji} **${tip.title}**\n${tip.content}\n\n`;
                        });
                    }

                    tipMessage += `${data.encouragement}`;

                    // 채팅 메시지로 추가
                    const message: Message = {
                        id: `learning-tip-${Date.now()}`,
                        role: 'assistant',
                        content: tipMessage,
                        timestamp: new Date(),
                    };
                    setMessages(prev => [...prev, message]);

                    // dismissed 상태 저장 (중복 방지)
                    const scheduleId = (learningSchedule as any).id;
                    localStorage.setItem(`learning_tips_dismissed_${scheduleId}`, 'true');
                    setLearningTipsShownFor(prev => new Set([...prev, scheduleId]));

                }
            } catch (error) {
                console.error('[Home] Failed to fetch learning tips:', error);
            }
        };

        fetchLearningTips();
    }, [session, todaySchedules, learningTipsShownFor]);

    // Auto-send schedule-based messages
    useEffect(() => {
        if (!session?.user) {
            return;
        }

        const checkAndSendScheduleMessages = () => {
            const now = new Date();
            const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const currentMinutes = kstNow.getHours() * 60 + kstNow.getMinutes();
            const today = getChatDate(); // Use KST timezone
            const hour = kstNow.getHours();

            // ─── 지능화 헬퍼 ───
            // Day Density 판단
            const dayDensity: 'light' | 'normal' | 'busy' =
                todaySchedules.length <= 2 ? 'light'
                : todaySchedules.length <= 5 ? 'normal' : 'busy';

            // 일일 자동 메시지 카운터 + 캡
            const msgCountKey = `auto_msg_count_${today}`;
            const MSG_CAP = 8;
            const sendAutoMessage = (message: Message, forceHigh = false): boolean => {
                const count = parseInt(localStorage.getItem(msgCountKey) || '0');
                if (count >= MSG_CAP && !forceHigh) {
                    return false;
                }
                localStorage.setItem(msgCountKey, String(count + 1));
                setMessages(prev => [...prev, message]);
                return true;
            };

            // 완료율 계산 (지나간 일정 기준)
            const completedCount = todaySchedules.filter(s => s.completed).length;
            const totalPast = todaySchedules.filter(s => {
                const end = s.endTime ? timeToMinutes(s.endTime) : timeToMinutes(s.startTime) + 60;
                return currentMinutes > end;
            }).length;
            const completionRate = totalPast > 0 ? Math.round((completedCount / totalPast) * 100) : -1;

            // 연속 완료 streak
            const completionStreak = (() => {
                let streak = 0;
                const sorted = [...todaySchedules]
                    .filter(s => s.endTime && currentMinutes > timeToMinutes(s.endTime))
                    .sort((a, b) => timeToMinutes(b.endTime!) - timeToMinutes(a.endTime!));
                for (const s of sorted) {
                    if (s.completed) streak++;
                    else break;
                }
                return streak;
            })();

            // 톤 결정
            const tone: 'momentum' | 'neutral' | 'gentle' =
                completionRate >= 70 ? 'momentum'
                : completionRate >= 40 ? 'neutral'
                : completionRate >= 0 ? 'gentle' : 'neutral';


            // 0. 아침 인사 메시지 (5-12시 사이 한 번만) - AI 기반
            // Use separate keys for rich AI greeting vs basic greeting
            const richGreetingKey = `rich_morning_greeting_${today}`;
            const legacyKey = `morning_greeting_${today}`;
            const alreadySentRichMorning = localStorage.getItem(richGreetingKey);
            const hasLegacyGreeting = localStorage.getItem(legacyKey);


            // Send AI greeting if: morning time AND rich greeting not sent yet
            // (legacy key is ignored for new rich greeting)
            if (hour >= 5 && hour < 12 && !alreadySentRichMorning) {
                localStorage.setItem(richGreetingKey, 'true');

                // AI에게 아침 인사 + 일정 추천 요청
                fetch('/api/ai-morning-greeting', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        todaySchedules: todaySchedules.map(s => ({
                            text: s.text,
                            startTime: s.startTime,
                            endTime: s.endTime,
                        })),
                        userProfile: userProfile,
                    }),
                })
                    .then(async res => {
                        const data = await res.json();
                        if (!res.ok) {
                            console.error('[AutoMessage] AI morning greeting API error:', data.error);
                            throw new Error(data.error || 'API error');
                        }
                        return data;
                    })
                    .then(data => {
                        if (!data.greeting) {
                            console.error('[AutoMessage] No greeting in response:', data);
                            throw new Error('No greeting in response');
                        }
                        const message: Message = {
                            id: `auto-morning-${Date.now()}`,
                            role: 'assistant',
                            content: data.greeting,
                            timestamp: now,
                        };
                        // Replace existing basic greeting if present, otherwise add new
                        setMessages(prev => {
                            // If first message is a basic greeting (short and starts with greeting text), replace it
                            if (prev.length > 0 && prev[0].role === 'assistant' &&
                                (prev[0].content.includes('좋은 아침이에요') || prev[0].content.includes('좋은 오후') ||
                                 prev[0].content.includes('좋은 저녁') || prev[0].content.includes('아직 깨어')) &&
                                prev[0].content.length < 200) { // Basic greetings are short
                                return [message, ...prev.slice(1)];
                            }
                            return [...prev, message];
                        });
                        // Context Continuity: 아침 인사에서 언급한 일정 ID 저장
                        const morningMentionedKey = `morning_mentioned_${today}`;
                        const morningMentionedIds = todaySchedules.slice(0, 4).map((s: any) => s.id);
                        localStorage.setItem(morningMentionedKey, JSON.stringify(morningMentionedIds));
                    })
                    .catch(err => {
                        console.error('[AutoMessage] Failed to fetch AI morning greeting:', err);
                        // Fallback - don't add if there's already a greeting
                        setMessages(prev => {
                            if (prev.length > 0 && prev[0].role === 'assistant') {
                                return prev;
                            }
                            const message: Message = {
                                id: `auto-morning-${Date.now()}`,
                                role: 'assistant',
                                content: '좋은 아침이에요! ☀️\n\n활기찬 하루 보내세요! 💪',
                                timestamp: now,
                            };
                            return [...prev, message];
                        });
                    });
            }

            // 선제적 알림 가져오기 (중요한 일정 미리 알림, 미완료 목표 등)
            const proactiveNotifKey = `proactive_notif_${today}_${hour}`;
            const alreadySentProactive = localStorage.getItem(proactiveNotifKey);

            if (!alreadySentProactive) {
                fetch('/api/fieri/proactive')
                    .then(res => res.json())
                    .then(data => {
                        const notifications = data.notifications || [];

                        // 중요한 알림만 메시지로 추가 (high/medium priority + schedule_reminder)
                        const importantNotifs = notifications.filter((n: any) =>
                            n.priority === 'high' || n.priority === 'medium' || n.type === 'schedule_reminder'
                        );

                        if (importantNotifs.length > 0) {
                            localStorage.setItem(proactiveNotifKey, 'true');

                            importantNotifs.forEach((notif: any, index: number) => {
                                setTimeout(() => {
                                    // 알림 타입별 액션 버튼 구성
                                    let actions: Message['actions'];
                                    if (notif.actionType === 'open_briefing') {
                                        actions = [{
                                            type: 'open_briefing' as const,
                                            label: '브리핑 열기',
                                            data: {}
                                        }];
                                    } else if (notif.actionType === 'view_schedule') {
                                        actions = [{
                                            type: 'add_schedule' as const,
                                            label: '일정 보기',
                                            data: { scheduleId: notif.actionPayload?.scheduleId }
                                        }];
                                    } else if (notif.actionType === 'view_uncompleted') {
                                        actions = [
                                            {
                                                type: 'show_goals' as const,
                                                label: '설정하기',
                                                data: {}
                                            },
                                            {
                                                type: 'dismiss_today_proactive' as const,
                                                label: '다음에',
                                                data: { notificationId: notif.id, notificationType: notif.type }
                                            },
                                        ];
                                    }

                                    const message: Message = {
                                        id: `proactive-${notif.id}-${Date.now()}`,
                                        role: 'assistant',
                                        content: `${notif.title}\n\n${notif.message}`,
                                        timestamp: new Date(),
                                        actions,
                                    };
                                    setMessages(prev => [...prev, message]);

                                    // 알림 표시됨으로 기록
                                    fetch('/api/fieri/proactive', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            action: 'mark_shown',
                                            notificationType: notif.type
                                        })
                                    }).catch(err => console.error('[Proactive] Failed to mark shown:', err));
                                }, index * 2000); // 2초 간격으로 메시지 추가
                            });
                        }
                    })
                    .catch(err => {
                        console.error('[AutoMessage] Failed to fetch proactive notifications:', err);
                    });
            }

            // 저녁 회고 (Evening Check) - 21시~22시 사이 한 번만
            const eveningCheckKey = `evening_check_${today}`;
            const alreadySentEveningCheck = localStorage.getItem(eveningCheckKey);

            if (hour >= 21 && hour < 22 && !alreadySentEveningCheck && todaySchedules.length > 0) {
                localStorage.setItem(eveningCheckKey, 'true');

                // 완료된 일정 ID 수집
                const completedIds = todaySchedules
                    .filter((s: Schedule) => s.completed)
                    .map((s: Schedule) => s.id);

                fetch('/api/ai-evening-check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        todaySchedules: todaySchedules.map((s: Schedule) => ({
                            id: s.id,
                            text: s.text,
                            startTime: s.startTime,
                            endTime: s.endTime,
                            completed: s.completed,
                            skipped: s.skipped
                        })),
                        completedScheduleIds: completedIds,
                        userProfile: userProfile,
                        todayMessages: messages.slice(-20).map(m => ({
                            role: m.role,
                            content: m.content
                        }))
                    }),
                })
                    .then(res => res.json())
                    .then(data => {
                        const message: Message = {
                            id: `evening-check-${Date.now()}`,
                            role: 'assistant',
                            content: `🌙 **저녁 회고**\n\n${data.message}`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    })
                    .catch(err => {
                        console.error('[AutoMessage] Failed to fetch Evening Check:', err);
                    });
            }

            // 일정이 없으면 여기서 종료
            if (todaySchedules.length === 0) {
                return;
            }

            todaySchedules.forEach(schedule => {
                const startMinutes = timeToMinutes(schedule.startTime);
                const endMinutes = schedule.endTime ? timeToMinutes(schedule.endTime) : startMinutes + 60;


                // 1. 일정 시작 10분 전 메시지
                const tenMinutesBefore = startMinutes - 10;
                const sentBeforeKey = `schedule_before_${schedule.id}_${today}`;
                const alreadySentBefore = !!localStorage.getItem(sentBeforeKey);


                if (currentMinutes >= tenMinutesBefore && currentMinutes < startMinutes && !alreadySentBefore) {
                    // busy 모드: 중요 일정만 prep 발송
                    if (dayDensity === 'busy' && !isImportantSchedule(schedule.text)) {
                    } else {
                        localStorage.setItem(sentBeforeKey, 'true');

                        const timeUntilStart = startMinutes - currentMinutes;

                        // Context Continuity: 아침 인사에서 이미 언급된 일정이면 짧은 메시지
                        const mentionedKey = `morning_mentioned_${today}`;
                        const mentionedIds: string[] = JSON.parse(localStorage.getItem(mentionedKey) || '[]');
                        const alreadyMentioned = mentionedIds.includes(schedule.id);

                        if (alreadyMentioned) {
                            const message: Message = {
                                id: `auto-before-${Date.now()}`,
                                role: 'assistant',
                                content: `"${schedule.text}" ${timeUntilStart}분 전이에요. 준비되셨나요?`,
                                timestamp: now,
                            };
                            sendAutoMessage(message, true);
                        } else {
                            // AI 준비 조언 요청
                            fetch('/api/ai-schedule-prep', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    schedule: { text: schedule.text, startTime: schedule.startTime },
                                    userProfile: userProfile,
                                    timeUntil: timeUntilStart
                                }),
                            }).then(res => res.json()).then(data => {
                                const advice = data.advice || `${timeUntilStart}분 후 "${schedule.text}" 일정이 시작됩니다! 준비하세요 🕐`;
                                const message: Message = {
                                    id: `auto-before-${Date.now()}`,
                                    role: 'assistant',
                                    content: advice,
                                    timestamp: now,
                                };
                                sendAutoMessage(message, true);
                            }).catch(() => {
                                const message: Message = {
                                    id: `auto-before-${Date.now()}`,
                                    role: 'assistant',
                                    content: `곧 "${schedule.text}" 일정이 ${schedule.startTime}에 시작됩니다.\n\n준비하실 것이 있나요? 필요하신 정보를 찾아드릴까요?`,
                                    timestamp: now,
                                };
                                sendAutoMessage(message, true);
                            });
                        }
                    }
                }

                // 2. 일정 시작 시 메시지
                const sentStartKey = `schedule_start_${schedule.id}_${today}`;
                const alreadySentStart = !!localStorage.getItem(sentStartKey);


                if (currentMinutes >= startMinutes && currentMinutes < startMinutes + 5 && !alreadySentStart) {
                    // busy 모드: 중요 일정만 start 발송
                    if (dayDensity === 'busy' && !isImportantSchedule(schedule.text)) {
                    } else {
                    localStorage.setItem(sentStartKey, 'true');

                    // 일정 특성에 맞는 시작 메시지 생성
                    const getScheduleStartMessage = (scheduleName: string) => {
                        const name = scheduleName.toLowerCase();

                        // 식사
                        if (/식사|점심|저녁|아침|밥|브런치|런치|디너|야식|간식/.test(name)) {
                            const mealEmojis: Record<string, string> = {
                                '아침': '🍳', '점심': '🍚', '저녁': '🍽️', '야식': '🌙', '브런치': '🥐', '간식': '🍪'
                            };
                            let emoji = '🍽️';
                            for (const [key, val] of Object.entries(mealEmojis)) {
                                if (name.includes(key)) { emoji = val; break; }
                            }
                            const msgs = ['맛있게 드세요!', '든든하게 드세요!', '맛있는 식사 되세요!'];
                            return { emoji, msg: msgs[Math.floor(Math.random() * msgs.length)] };
                        }

                        // 휴식/취침
                        if (/휴식|쉬는|낮잠|수면|취침|잠|기상|일어나/.test(name)) {
                            // 취침/수면은 수면 모드 안내 포함
                            if (/취침|잠|수면/.test(name)) {
                                return { emoji: '🌙', msg: '취침 모드를 켜서 수면 시간을 기록해보세요! 좋은 꿈 꾸세요 😴' };
                            }
                            const restMsgs: Record<string, { emoji: string; msg: string }> = {
                                '기상': { emoji: '☀️', msg: '상쾌한 아침 되세요!' },
                                '일어나': { emoji: '🌅', msg: '좋은 아침이에요!' },
                                '휴식': { emoji: '☕', msg: '편하게 쉬세요!' },
                                '낮잠': { emoji: '😌', msg: '달콤한 낮잠 되세요!' },
                            };
                            for (const [key, val] of Object.entries(restMsgs)) {
                                if (name.includes(key)) return val;
                            }
                            return { emoji: '☕', msg: '편하게 쉬세요!' };
                        }

                        // 여가
                        if (/게임|영화|드라마|유튜브|넷플릭스|독서|음악|산책/.test(name)) {
                            const leisureMsgs: Record<string, { emoji: string; msg: string }> = {
                                '게임': { emoji: '🎮', msg: '즐거운 시간 보내세요!' },
                                '영화': { emoji: '🎬', msg: '재미있게 보세요!' },
                                '드라마': { emoji: '📺', msg: '재미있게 보세요!' },
                                '유튜브': { emoji: '📱', msg: '즐거운 시청 되세요!' },
                                '넷플릭스': { emoji: '🍿', msg: '재미있게 보세요!' },
                                '독서': { emoji: '📚', msg: '즐거운 독서 시간 되세요!' },
                                '음악': { emoji: '🎵', msg: '좋은 음악과 함께하세요!' },
                                '산책': { emoji: '🚶', msg: '상쾌한 산책 되세요!' },
                            };
                            for (const [key, val] of Object.entries(leisureMsgs)) {
                                if (name.includes(key)) return val;
                            }
                            return { emoji: '🎉', msg: '즐거운 시간 보내세요!' };
                        }

                        // 운동
                        if (/운동|헬스|요가|필라테스|러닝|조깅|수영|등산/.test(name)) {
                            return { emoji: '💪', msg: '오늘도 화이팅!' };
                        }

                        // 업무/회의
                        if (/업무|출근|회의|미팅|프레젠테이션|발표|면접/.test(name)) {
                            return { emoji: '💼', msg: '화이팅!' };
                        }

                        // 공부
                        if (/공부|학습|강의|수업|시험|과제/.test(name)) {
                            return { emoji: '📖', msg: '집중해서 화이팅!' };
                        }

                        // 기본
                        return { emoji: '🕐', msg: '화이팅!' };
                    };

                    const { emoji, msg } = getScheduleStartMessage(schedule.text);
                    // 톤 적응: momentum + streak → 간결한 축하, gentle → 부드러운 톤
                    let startContent = `"${schedule.text}" 시간이에요 ${emoji}\n\n${msg}`;
                    if (tone === 'momentum' && completionStreak >= 3) {
                        startContent += `\n\n🔥 ${completionStreak}개 연속 완료 중!`;
                    }
                    const message: Message = {
                        id: `auto-start-${Date.now()}`,
                        role: 'assistant',
                        content: startContent,
                        timestamp: new Date(),
                    };
                    sendAutoMessage(message);
                    } // end busy gate
                }

                // 2.5. 일정 시작 30분 후 인사이트 (T+30) - work_mode 기반 결정
                const thirtyMinutesAfterStart = startMinutes + 30;
                const sentInsightKey = `schedule_insight_${schedule.id}_${today}`;
                const alreadySentInsight = !!localStorage.getItem(sentInsightKey);

                // work_mode가 있으면 그것을 우선 사용, 없으면 일정 이름으로 추론
                let shouldSendInsight = false;
                const workKeywords = ['업무', '회의', '학습', '공부', '프로젝트', '작업', '개발', '코딩', '미팅', '수업', '강의', '시작'];

                if (schedule.workMode) {
                    // 'focus' 모드는 인사이트 제공 안 함 (집중 중)
                    shouldSendInsight = schedule.workMode !== 'focus';
                } else {
                    // 업무/학습 관련 일정에 인사이트 제공
                    shouldSendInsight = workKeywords.some(keyword =>
                        schedule.text.includes(keyword)
                    );
                }

                // 디버그 로그 추가

                // Density 게이트: busy → 전부 스킵, normal → 중요 일정만
                const insightAllowed = dayDensity === 'light'
                    || (dayDensity === 'normal' && isImportantSchedule(schedule.text));

                if (insightAllowed && shouldSendInsight && currentMinutes >= thirtyMinutesAfterStart && currentMinutes < thirtyMinutesAfterStart + 5 && !alreadySentInsight) {
                    localStorage.setItem(sentInsightKey, 'true');

                    const message: Message = {
                        id: `auto-insight-${Date.now()}`,
                        role: 'assistant',
                        content: `"${schedule.text}" 시작한 지 30분이 지났네요!\n\n잠깐, 어떻게 진행되고 있는지 여쭤봐도 될까요?\n\n• 현재 어떻게 진행되고 있나요?\n• 혹시 막히는 부분이 있으신가요?\n• 필요한 자료나 정보가 있으면 말씀해주세요!\n\n도움이 필요하시면 언제든 말씀해주세요 😊`,
                        timestamp: new Date(),
                    };
                    sendAutoMessage(message);
                }

                // 3. 일정 종료 후 메시지
                const sentAfterKey = `schedule_after_${schedule.id}_${today}`;
                if (currentMinutes >= endMinutes && currentMinutes < endMinutes + 10 && !localStorage.getItem(sentAfterKey)) {
                    // busy 모드: completed 메시지 스킵 (day end summary에서 종합)
                    if (dayDensity === 'busy') {
                    } else {
                        localStorage.setItem(sentAfterKey, 'true');

                        // AI 맞춤형 피드백 요청 (tone 전달)
                        fetch('/api/ai-resource-recommend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                activityName: schedule.text,
                                context: 'schedule_completed',
                                userProfile: userProfile,
                                tone,
                                completionRate,
                                dayDensity,
                                location: userLocation,
                            }),
                        }).then(res => res.json()).then(data => {
                            const recommendation = data.recommendation || "어떠셨나요?\n• 간단히 기록하실 내용이 있나요?\n• 다음 액션 아이템을 정리해드릴까요?";
                            const message: Message = {
                                id: `auto-after-${Date.now()}`,
                                role: 'assistant',
                                content: `"${schedule.text}" 일정이 끝났습니다.\n\n${recommendation}`,
                                timestamp: now,
                                actions: data.actions || [],
                            };
                            sendAutoMessage(message);
                        }).catch(() => {
                            const message: Message = {
                                id: `auto-after-${Date.now()}`,
                                role: 'assistant',
                                content: `"${schedule.text}" 일정이 끝났습니다.\n\n어떠셨나요?\n• 간단히 기록하실 내용이 있나요?\n• 다음 액션 아이템을 정리해드릴까요?\n• 추가 일정이 필요하신가요?`,
                                timestamp: now,
                            };
                            sendAutoMessage(message);
                        });
                    }
                }
            });

            // 4. 빈 시간 감지 (다음 일정까지 30분 이상 남았을 때) — busy 모드 스킵
            if (dayDensity !== 'busy') {
                const nextSchedule = todaySchedules
                    .filter(s => !s.completed && !s.skipped)
                    .find(s => timeToMinutes(s.startTime) > currentMinutes);

                if (nextSchedule) {
                    const timeUntilNext = timeToMinutes(nextSchedule.startTime) - currentMinutes;
                    const sentGapKey = `schedule_gap_${nextSchedule.id}_${today}`;

                    if (timeUntilNext >= 30 && timeUntilNext <= 40 && !localStorage.getItem(sentGapKey)) {
                        localStorage.setItem(sentGapKey, 'true');

                        fetch('/api/ai-resource-recommend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                activityName: nextSchedule.text,
                                context: 'upcoming_schedule',
                                timeUntil: timeUntilNext,
                                userProfile: userProfile,
                                tone,
                                completionRate,
                                dayDensity,
                                location: userLocation,
                            }),
                        }).then(res => res.json()).then(data => {
                            const recommendation = data.recommendation || "준비할 시간이 충분하네요. 다음 일정을 위해 가볍게 준비해볼까요?";
                            const isLeisureSchedule = /여가|휴식|개인|자유|쉬기|break|rest|free/i.test(nextSchedule.text);

                            const content = isLeisureSchedule
                                ? `다음 일정 "${nextSchedule.text}"까지 ${timeUntilNext}분 남았어요.\n\n아직 확인하지 않은 트렌드 브리핑이 있다면 가볍게 읽어보는 건 어떨까요?`
                                : `다음 일정 "${nextSchedule.text}"까지 ${timeUntilNext}분 남았어요.\n\n${recommendation}`;

                            const message: Message = {
                                id: `auto-gap-${Date.now()}`,
                                role: 'assistant',
                                content,
                                timestamp: now,
                                actions: isLeisureSchedule ? [] : (data.actions || []),
                            };
                            sendAutoMessage(message);
                        }).catch(() => {
                            const isLeisureSchedule = /여가|휴식|개인|자유|쉬기|break|rest|free/i.test(nextSchedule.text);
                            const content = isLeisureSchedule
                                ? `다음 일정 "${nextSchedule.text}"까지 ${timeUntilNext}분 남았어요.\n\n아직 확인하지 않은 트렌드 브리핑이 있다면 가볍게 읽어보는 건 어떨까요?`
                                : `다음 일정 "${nextSchedule.text}"까지 ${timeUntilNext}분 남았어요.\n\n준비할 시간이 충분하네요. 다음 일정을 위해 가볍게 준비해볼까요?`;

                            const message: Message = {
                                id: `auto-gap-${Date.now()}`,
                                role: 'assistant',
                                content,
                                timestamp: now,
                            };
                            sendAutoMessage(message);
                        });
                    }
                }
            }

            // 5. 하루 마무리 (21시~24시 사이, 마지막 일정 종료 후) - AI 피드백
            // 조건: 21시~24시 사이 + 마지막 일정 종료 10분 후 + 아직 안 보낸 경우
            const lastSchedule = todaySchedules
                .filter(s => s.endTime)
                .sort((a, b) => timeToMinutes(b.endTime!) - timeToMinutes(a.endTime!))[0];

            const sentDayEndKey = `day_end_${today}`;
            const isEveningTime = hour >= 21 && hour < 24; // 21시~24시 사이
            const hasSchedulesEnded = lastSchedule ? currentMinutes >= timeToMinutes(lastSchedule.endTime!) + 10 : false;
            const shouldSendDaySummary = isEveningTime && (hasSchedulesEnded || !lastSchedule) && !localStorage.getItem(sentDayEndKey);

            if (shouldSendDaySummary && todaySchedules.length > 0) {
                localStorage.setItem(sentDayEndKey, 'true');

                const completed = todaySchedules.filter(s => s.completed).length;
                const total = todaySchedules.length;

                // Calculate tomorrow's date
                const tomorrow = new Date(kstNow);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
                const tomorrowDayOfWeek = tomorrow.getDay();

                // Get tomorrow's schedules
                const allGoals = userProfile?.profile?.customGoals || [];
                const tomorrowSchedules = allGoals.filter((goal: any) => {
                    if (goal.specificDate) {
                        return goal.specificDate === tomorrowStr;
                    }
                    if (goal.daysOfWeek?.includes(tomorrowDayOfWeek)) {
                        if (goal.startDate && tomorrowStr < goal.startDate) return false;
                        if (goal.endDate && tomorrowStr > goal.endDate) return false;
                        return true;
                    }
                    return false;
                }).sort((a: any, b: any) => {
                    const aTime = a.startTime || '00:00';
                    const bTime = b.startTime || '00:00';
                    return aTime.localeCompare(bTime);
                });


                // AI 하루 마무리 요청 - gpt-5.2 사용
                fetch('/api/ai-day-summary', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        todaySchedules: todaySchedules.map(s => ({
                            text: s.text,
                            startTime: s.startTime,
                            endTime: s.endTime,
                            completed: s.completed
                        })),
                        completedCount: completed,
                        totalCount: total,
                        userProfile: userProfile,
                        tomorrowSchedules: tomorrowSchedules.map((s: any) => ({
                            text: s.text,
                            startTime: s.startTime,
                            endTime: s.endTime
                        })),
                        userPlan: userProfile?.plan || 'Free'
                    }),
                }).then(res => res.json()).then(data => {
                    const summary = data.summary || `오늘 하루 고생 많으셨어요! 🌙\n\n오늘의 성과: ${completed}/${total}개 완료\n\n충분한 휴식 취하시고, 내일 또 만나요!`;
                    const message: Message = {
                        id: `auto-dayend-${Date.now()}`,
                        role: 'assistant',
                        content: summary,
                        timestamp: now,
                    };
                    setMessages(prev => [...prev, message]);
                }).catch(err => {
                    console.error('[AutoMessage] Failed to fetch AI day summary:', err);
                    // Fallback
                    const message: Message = {
                        id: `auto-dayend-${Date.now()}`,
                        role: 'assistant',
                        content: `오늘 일정이 모두 끝났어요! 🎉\n\n오늘의 성과:\n✅ 완료: ${completed}/${total}개\n\n내일을 위한 제안이 필요하신가요?`,
                        timestamp: now,
                    };
                    setMessages(prev => [...prev, message]);
                });
            }

            // 6. 주간 리포트 + 피드백 (일요일 21시 이후 또는 월요일 아침 9시 이전)
            const dayOfWeek = kstNow.getDay(); // 0: 일요일, 1: 월요일
            const isSunday = dayOfWeek === 0;
            const isMonday = dayOfWeek === 1;
            const isSundayEvening = isSunday && hour >= 21; // 일요일 21시 이후
            const isMondayMorning = isMonday && hour < 9; // 월요일 9시 이전

            // 주간 리포트: 하루에 한 번만 전송 (키로 중복 방지)
            const weeklyReportKey = `weekly_report_${today}`;
            if ((isSundayEvening || isMondayMorning) && !localStorage.getItem(weeklyReportKey)) {
                localStorage.setItem(weeklyReportKey, 'true');

                // Fetch weekly report
                fetch('/api/weekly-report')
                    .then(res => res.json())
                    .then(async (reportData) => {
                        if (reportData.success && reportData.report) {
                            const report = reportData.report;

                            // Build report message
                            let reportContent = `## 📊 이번 주 성장 리포트\n\n`;
                            reportContent += `**${report.period.start} ~ ${report.period.end}** (Week ${report.period.weekNumber})\n\n`;

                            // Key metrics
                            reportContent += `### 핵심 지표\n`;
                            reportContent += `- 📅 일정 완료율: **${report.scheduleAnalysis.completionRate.toFixed(0)}%** (${report.scheduleAnalysis.completedSchedules}/${report.scheduleAnalysis.totalSchedules})\n`;
                            reportContent += `- 📚 브리핑 읽기: **${report.trendBriefingAnalysis.totalRead}개**\n`;
                            reportContent += `- 🔥 일관성 점수: **${report.growthMetrics.consistencyScore.toFixed(0)}점**\n\n`;

                            // AI Narrative
                            if (report.narrative) {
                                reportContent += `### AI 분석\n${report.narrative}\n\n`;
                            }

                            // Achievements
                            if (report.insights.achievements?.length > 0) {
                                reportContent += `### ✨ 이번 주 성취\n`;
                                report.insights.achievements.forEach((a: string) => {
                                    reportContent += `- ${a}\n`;
                                });
                                reportContent += `\n`;
                            }

                            // Recommendations
                            if (report.insights.recommendations?.length > 0) {
                                reportContent += `### 💡 다음 주 추천\n`;
                                report.insights.recommendations.forEach((r: string) => {
                                    reportContent += `- ${r}\n`;
                                });
                            }

                            reportContent += `\n새로운 한 주도 화이팅! 🎉`;

                            const message: Message = {
                                id: `auto-weekly-report-${Date.now()}`,
                                role: 'assistant',
                                content: reportContent,
                                timestamp: now,
                            };
                            setMessages(prev => [...prev, message]);
                        }
                    })
                    .catch(err => {
                        console.error('[AutoMessage] Failed to fetch weekly report:', err);
                        // Fallback: basic message
                        const message: Message = {
                            id: `auto-weekly-report-${Date.now()}`,
                            role: 'assistant',
                            content: `한 주 동안 고생 많으셨어요! 🎉\n\n이번 주도 열심히 달려오셨네요.\n새로운 한 주도 화이팅입니다!`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    });
            }

            // 7. 주간 목표 리셋 - 새로운 주 시작 시 (주차 기반 체크)
            // ISO 주차 계산 (월요일 시작)
            const getWeekNumber = (date: Date): string => {
                const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
                const dayNum = d.getUTCDay() || 7;
                d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
                return `${d.getUTCFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
            };

            const currentWeek = getWeekNumber(kstNow);
            const lastResetWeek = localStorage.getItem('weekly_goals_last_reset_week');

            // 새로운 주이고, 아직 리셋하지 않은 경우
            if (currentWeek !== lastResetWeek) {
                localStorage.setItem('weekly_goals_last_reset_week', currentWeek);

                // Reset weekly goals
                fetch('/api/user/long-term-goals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        goal: { type: 'weekly' },
                        action: 'resetWeekly',
                    }),
                })
                    .then(res => res.json())
                    .then(data => {

                        const archivedGoals = data.archived?.goals || [];
                        const completedCount = archivedGoals.filter((g: any) => g.completed).length;

                        // 지난주 목표가 있었을 때만 메시지 표시
                        if (archivedGoals.length > 0) {
                            const message: Message = {
                                id: `auto-weekly-reset-${Date.now()}`,
                                role: 'assistant',
                                content: `새로운 한 주가 시작되었어요! 🌅\n\n지난주 목표가 아카이브되었습니다.\n✅ 완료: ${completedCount}/${archivedGoals.length}개\n\n이번 주 목표를 설정해보세요!\n\n[성장 페이지에서 목표 설정하기](/growth)`,
                                timestamp: now,
                            };
                            setMessages(prev => [...prev, message]);
                        }
                    })
                    .catch(err => {
                        console.error('[AutoMessage] Failed to reset weekly goals:', err);
                        // 실패 시 다음에 다시 시도할 수 있도록 키 제거
                        localStorage.removeItem('weekly_goals_last_reset_week');
                    });
            }

            // 8. 트렌드 브리핑 읽기 알림 (10시, 14시, 18시, 22시 - 4시간 간격)
            const briefingReminderHours = [10, 14, 18, 22];
            if (briefingReminderHours.includes(hour)) {
                const briefingReminderKey = `briefing_reminder_${today}_${hour}`;
                if (!localStorage.getItem(briefingReminderKey)) {
                    // Check if there are unread briefings
                    const readBriefings = JSON.parse(localStorage.getItem(`read_briefings_${today}`) || '[]');
                    const unreadCount = trendBriefings.filter(b => !readBriefings.includes(b.id)).length;

                    if (unreadCount > 0) {
                        localStorage.setItem(briefingReminderKey, 'true');

                        const message: Message = {
                            id: `auto-briefing-reminder-${Date.now()}`,
                            role: 'assistant',
                            content: `아직 안 읽은 트렌드 브리핑이 ${unreadCount}개 있어요 📰\n\n잠깐 시간 내서 확인해보실래요? 최신 트렌드 놓치기 아까울 것 같아요! 🚀`,
                            timestamp: now,
                        };
                        setMessages(prev => [...prev, message]);
                    }
                }
            }

            // 9. 빈 시간대 일정 추천 (12시, 16시, 19시에 일정이 없으면) - AI 기반
            const idleCheckHours = [12, 16, 19];
            if (idleCheckHours.includes(hour)) {
                const idleCheckKey = `idle_check_${today}_${hour}`;
                if (!localStorage.getItem(idleCheckKey)) {
                    // Check if there's no schedule in the next 2 hours
                    const twoHoursLater = currentMinutes + 120;
                    const hasUpcomingSchedule = todaySchedules.some(s => {
                        const sMinutes = timeToMinutes(s.startTime);
                        return sMinutes >= currentMinutes && sMinutes <= twoHoursLater;
                    });

                    if (!hasUpcomingSchedule) {
                        localStorage.setItem(idleCheckKey, 'true');

                        // Fetch AI-powered recommendations based on user patterns
                        fetch('/api/ai-schedule-recommendations', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                date: today,
                                currentSchedules: todaySchedules.map(s => ({
                                    text: s.text,
                                    startTime: s.startTime,
                                    endTime: s.endTime,
                                    start_time: `${today}T${s.startTime}:00`,
                                    end_time: `${today}T${s.endTime}:00`,
                                })),
                            }),
                        }).then(res => res.json()).then(data => {
                            const recommendations = data.recommendations || [];

                            if (recommendations.length > 0) {
                                // Pick top priority recommendation
                                const topRec = recommendations.sort((a: any, b: any) => {
                                    const priority = { high: 3, medium: 2, low: 1 };
                                    return (priority[b.priority as keyof typeof priority] || 0) - (priority[a.priority as keyof typeof priority] || 0);
                                })[0];

                                const timeContext = hour === 12 ? '점심' : hour === 16 ? '오후' : '저녁';
                                const message: Message = {
                                    id: `auto-idle-${Date.now()}`,
                                    role: 'assistant',
                                    content: `${timeContext} 시간에 등록된 일정이 없네요!\n\n💡 추천: ${topRec.scheduleText} (${topRec.suggestedDuration}분)\n시작 시간: ${topRec.suggestedStartTime}\n\n${topRec.reason}\n\n일정 추가하실래요?`,
                                    timestamp: now,
                                    actions: [{
                                        type: 'add_schedule',
                                        label: `${topRec.scheduleText} 추가하기`,
                                        data: {
                                            text: topRec.scheduleText,
                                            startTime: topRec.suggestedStartTime,
                                            duration: topRec.suggestedDuration,
                                        }
                                    }]
                                };
                                setMessages(prev => [...prev, message]);
                            } else {
                                // Fallback to generic message
                                const timeContext = hour === 12 ? '점심' : hour === 16 ? '오후' : '저녁';
                                const activities = hour === 12
                                    ? '산책하거나, 맛있는 점심 먹거나, 잠깐 휴식하는 건 어때요? ☕'
                                    : hour === 16
                                    ? '가볍게 스트레칭하거나, 책 읽거나, 목표 관련 작업하기 좋은 시간이에요 📚'
                                    : '하루 마무리하면서 독서하거나, 내일 계획 세우거나, 편하게 쉬어도 좋아요 🌙';
                                const message: Message = {
                                    id: `auto-idle-${Date.now()}`,
                                    role: 'assistant',
                                    content: `${timeContext} 시간에 등록된 일정이 없네요!\n\n${activities}\n\n일정 추가하실래요?`,
                                    timestamp: now,
                                };
                                setMessages(prev => [...prev, message]);
                            }
                        }).catch(err => {
                            console.error('[AutoMessage] Failed to fetch recommendations:', err);
                            // Fallback to generic message
                            const timeContext = hour === 12 ? '점심' : hour === 16 ? '오후' : '저녁';
                            const activities = hour === 12
                                ? '산책하거나, 맛있는 점심 먹거나, 잠깐 휴식하는 건 어때요? ☕'
                                : hour === 16
                                ? '가볍게 스트레칭하거나, 책 읽거나, 목표 관련 작업하기 좋은 시간이에요 📚'
                                : '하루 마무리하면서 독서하거나, 내일 계획 세우거나, 편하게 쉬어도 좋아요 🌙';
                            const message: Message = {
                                id: `auto-idle-${Date.now()}`,
                                role: 'assistant',
                                content: `${timeContext} 시간에 등록된 일정이 없네요!\n\n${activities}\n\n일정 추가하실래요?`,
                                timestamp: now,
                            };
                            setMessages(prev => [...prev, message]);
                        });
                    }
                }
            }
        };

        // 1분마다 체크
        const interval = setInterval(checkAndSendScheduleMessages, 60000);
        // 초기 실행
        checkAndSendScheduleMessages();

        return () => clearInterval(interval);
    }, [session, todaySchedules, userProfile, trendBriefings]);
}
