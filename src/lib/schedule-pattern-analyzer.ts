import db from "@/lib/db";

/**
 * Schedule Pattern Analyzer
 *
 * 사용자의 실제 일정 데이터를 분석하여 생활 패턴을 추출
 */

export interface SchedulePattern {
    wakeUpTime: string | null; // 평균 기상 시간 (예: "07:00")
    sleepTime: string | null; // 평균 취침 시간 (예: "23:00")
    workStartTime: string | null; // 평균 업무 시작 시간
    workEndTime: string | null; // 평균 업무 종료 시간
    lunchTime: string | null; // 평균 점심 시간

    // 요일별 자유 시간 블록
    freeTimeBlocks: {
        [key: string]: Array<{ start: string; end: string }>; // { "mon": [{ start: "18:00", end: "20:00" }] }
    };

    // 반복 일정들 (주 1회 이상 반복되는 일정)
    recurringSchedules: Array<{
        title: string;
        dayOfWeek: string;
        timeBlock: string;
        frequency: number; // 최근 4주 중 몇 번 발생했는지
    }>;

    // 활동 시간대 분포
    activityDistribution: {
        morning: number; // 0-1 (오전 활동 비율)
        afternoon: number;
        evening: number;
    };

    // 바쁜 요일 vs 여유로운 요일
    busyDays: string[]; // ["mon", "wed", "fri"]
    relaxedDays: string[]; // ["sat", "sun"]
}

/**
 * 사용자의 최근 4주 일정을 분석하여 패턴 추출
 */
export async function analyzeSchedulePatterns(userEmail: string): Promise<SchedulePattern> {
    console.log(`[Schedule Analyzer] Analyzing patterns for ${userEmail}`);

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    // 사용자의 프로필에서 customGoals 가져오기 (최근 4주)
    const supabase = db.client;
    const { data: userData, error } = await supabase
        .from('users')
        .select('profile')
        .eq('email', userEmail)
        .maybeSingle();

    if (error || !userData) {
        console.log(`[Schedule Analyzer] No user data found:`, error?.message);
        return getEmptyPattern();
    }

    const customGoals = userData.profile?.customGoals || [];

    // customGoals를 스케줄 데이터 형식으로 변환
    const scheduleData = customGoals
        .filter((goal: any) => {
            if (!goal.specificDate) return false;
            const goalDate = new Date(goal.specificDate);
            return goalDate >= fourWeeksAgo;
        })
        .map((goal: any) => {
            const specificDate = new Date(goal.specificDate);
            return {
                title: goal.text || '',
                date: goal.specificDate,
                day_of_week: specificDate.toLocaleDateString('en-US', { weekday: 'short' }),
                hour: specificDate.getHours(),
                minute: specificDate.getMinutes(),
                duration: goal.duration || 60,
                color: goal.color || '',
                completed: goal.completed || false,
            };
        })
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (scheduleData.length === 0) {
        console.log(`[Schedule Analyzer] No schedule data found`);
        return getEmptyPattern();
    }

    console.log(`[Schedule Analyzer] Found ${scheduleData.length} schedules`);

    // 1. 기상/취침 시간 분석
    const { wakeUpTime, sleepTime } = analyzeWakeSleepTimes(scheduleData);

    // 2. 업무 시간 분석
    const { workStartTime, workEndTime } = analyzeWorkHours(scheduleData);

    // 3. 점심 시간 분석
    const lunchTime = analyzeLunchTime(scheduleData);

    // 4. 요일별 자유 시간 블록 계산
    const freeTimeBlocks = calculateFreeTimeBlocks(scheduleData);

    // 5. 반복 일정 탐지
    const recurringSchedules = detectRecurringSchedules(scheduleData);

    // 6. 활동 시간대 분포
    const activityDistribution = calculateActivityDistribution(scheduleData);

    // 7. 바쁜 요일 vs 여유로운 요일
    const { busyDays, relaxedDays } = categorizeDaysByBusyness(scheduleData);

    const pattern: SchedulePattern = {
        wakeUpTime,
        sleepTime,
        workStartTime,
        workEndTime,
        lunchTime,
        freeTimeBlocks,
        recurringSchedules,
        activityDistribution,
        busyDays,
        relaxedDays,
    };

    console.log(`[Schedule Analyzer] Pattern analysis complete:`, {
        wakeUpTime,
        sleepTime,
        workStartTime,
        workEndTime,
        busyDaysCount: busyDays.length,
        recurringSchedulesCount: recurringSchedules.length,
    });

    return pattern;
}

/**
 * 기상/취침 시간 분석
 */
function analyzeWakeSleepTimes(schedules: any[]): { wakeUpTime: string | null; sleepTime: string | null } {
    // "기상", "일어나기", "wake" 등의 키워드로 기상 일정 찾기
    const wakeKeywords = ['기상', '일어나', 'wake', '아침'];
    const sleepKeywords = ['취침', '잠', 'sleep', '자기'];

    const wakeSchedules = schedules.filter(s =>
        wakeKeywords.some(kw => s.title?.toLowerCase().includes(kw))
    );

    const sleepSchedules = schedules.filter(s =>
        sleepKeywords.some(kw => s.title?.toLowerCase().includes(kw))
    );

    let wakeUpTime = null;
    let sleepTime = null;

    // 기상 시간 평균 계산
    if (wakeSchedules.length > 0) {
        const avgHour = Math.round(
            wakeSchedules.reduce((sum, s) => sum + parseInt(s.hour), 0) / wakeSchedules.length
        );
        const avgMinute = Math.round(
            wakeSchedules.reduce((sum, s) => sum + parseInt(s.minute || 0), 0) / wakeSchedules.length
        );
        wakeUpTime = `${String(avgHour).padStart(2, '0')}:${String(avgMinute).padStart(2, '0')}`;
    } else {
        // 기상 일정이 없으면 가장 이른 일정 시간으로 추정
        const earlySchedules = schedules.filter(s => parseInt(s.hour) >= 5 && parseInt(s.hour) <= 9);
        if (earlySchedules.length > 0) {
            const avgHour = Math.round(
                earlySchedules.reduce((sum, s) => sum + parseInt(s.hour), 0) / earlySchedules.length
            );
            wakeUpTime = `${String(avgHour - 1).padStart(2, '0')}:00`; // 1시간 전으로 추정
        }
    }

    // 취침 시간 평균 계산
    if (sleepSchedules.length > 0) {
        const avgHour = Math.round(
            sleepSchedules.reduce((sum, s) => sum + parseInt(s.hour), 0) / sleepSchedules.length
        );
        const avgMinute = Math.round(
            sleepSchedules.reduce((sum, s) => sum + parseInt(s.minute || 0), 0) / sleepSchedules.length
        );
        sleepTime = `${String(avgHour).padStart(2, '0')}:${String(avgMinute).padStart(2, '0')}`;
    } else {
        // 취침 일정이 없으면 가장 늦은 일정 시간으로 추정
        const lateSchedules = schedules.filter(s => parseInt(s.hour) >= 21 && parseInt(s.hour) <= 23);
        if (lateSchedules.length > 0) {
            const avgHour = Math.round(
                lateSchedules.reduce((sum, s) => sum + parseInt(s.hour), 0) / lateSchedules.length
            );
            sleepTime = `${String(avgHour + 1).padStart(2, '0')}:00`; // 1시간 후로 추정
        }
    }

    return { wakeUpTime, sleepTime };
}

/**
 * 업무 시간 분석
 */
function analyzeWorkHours(schedules: any[]): { workStartTime: string | null; workEndTime: string | null } {
    const workKeywords = ['업무', '일', '회의', '미팅', 'work', 'meeting', '프로젝트', '개발'];

    const workSchedules = schedules.filter(s =>
        workKeywords.some(kw => s.title?.toLowerCase().includes(kw))
    );

    if (workSchedules.length === 0) {
        return { workStartTime: null, workEndTime: null };
    }

    // 업무 시작 시간: 가장 이른 업무 일정의 평균
    const startHours = workSchedules.map(s => parseInt(s.hour)).sort((a, b) => a - b);
    const avgStartHour = Math.round(startHours.slice(0, Math.ceil(startHours.length / 3)).reduce((a, b) => a + b, 0) / Math.ceil(startHours.length / 3));

    // 업무 종료 시간: 가장 늦은 업무 일정의 평균
    const endHours = workSchedules.map(s => parseInt(s.hour)).sort((a, b) => b - a);
    const avgEndHour = Math.round(endHours.slice(0, Math.ceil(endHours.length / 3)).reduce((a, b) => a + b, 0) / Math.ceil(endHours.length / 3));

    return {
        workStartTime: `${String(avgStartHour).padStart(2, '0')}:00`,
        workEndTime: `${String(avgEndHour).padStart(2, '0')}:00`,
    };
}

/**
 * 점심 시간 분석
 */
function analyzeLunchTime(schedules: any[]): string | null {
    const lunchKeywords = ['점심', '식사', 'lunch', '밥'];

    const lunchSchedules = schedules.filter(s =>
        lunchKeywords.some(kw => s.title?.toLowerCase().includes(kw)) &&
        parseInt(s.hour) >= 11 && parseInt(s.hour) <= 14
    );

    if (lunchSchedules.length === 0) return null;

    const avgHour = Math.round(
        lunchSchedules.reduce((sum, s) => sum + parseInt(s.hour), 0) / lunchSchedules.length
    );
    const avgMinute = Math.round(
        lunchSchedules.reduce((sum, s) => sum + parseInt(s.minute || 0), 0) / lunchSchedules.length
    );

    return `${String(avgHour).padStart(2, '0')}:${String(avgMinute).padStart(2, '0')}`;
}

/**
 * 요일별 자유 시간 블록 계산
 */
function calculateFreeTimeBlocks(schedules: any[]): { [key: string]: Array<{ start: string; end: string }> } {
    const dayMap: { [key: string]: string } = {
        'Mon': 'mon', 'Tue': 'tue', 'Wed': 'wed', 'Thu': 'thu', 'Fri': 'fri', 'Sat': 'sat', 'Sun': 'sun'
    };

    const freeTimeBlocks: { [key: string]: Array<{ start: string; end: string }> } = {};

    // 요일별로 일정 그룹화
    const schedulesByDay: { [key: string]: any[] } = {};
    schedules.forEach(s => {
        const day = dayMap[s.day_of_week] || s.day_of_week.toLowerCase();
        if (!schedulesByDay[day]) schedulesByDay[day] = [];
        schedulesByDay[day].push(s);
    });

    // 각 요일별 자유 시간 계산
    Object.keys(dayMap).forEach(dayKey => {
        const day = dayMap[dayKey];
        const daySchedules = schedulesByDay[day] || [];

        if (daySchedules.length === 0) {
            // 일정이 없는 날은 전체가 자유 시간
            freeTimeBlocks[day] = [{ start: "06:00", end: "23:00" }];
            return;
        }

        // 시간순 정렬
        daySchedules.sort((a, b) => parseInt(a.hour) - parseInt(b.hour));

        const freeBlocks: Array<{ start: string; end: string }> = [];
        let lastEndHour = 6; // 오전 6시부터 시작

        daySchedules.forEach(schedule => {
            const scheduleHour = parseInt(schedule.hour);
            const duration = parseInt(schedule.duration || 60);
            const scheduleEndHour = scheduleHour + Math.ceil(duration / 60);

            // 마지막 일정 종료 시간과 현재 일정 시작 시간 사이에 간격이 있으면 자유 시간
            if (scheduleHour - lastEndHour >= 2) { // 최소 2시간 이상 간격
                freeBlocks.push({
                    start: `${String(lastEndHour).padStart(2, '0')}:00`,
                    end: `${String(scheduleHour).padStart(2, '0')}:00`,
                });
            }

            lastEndHour = Math.max(lastEndHour, scheduleEndHour);
        });

        // 마지막 일정 이후부터 23시까지 자유 시간
        if (lastEndHour < 23) {
            freeBlocks.push({
                start: `${String(lastEndHour).padStart(2, '0')}:00`,
                end: "23:00",
            });
        }

        freeTimeBlocks[day] = freeBlocks;
    });

    return freeTimeBlocks;
}

/**
 * 반복 일정 탐지
 */
function detectRecurringSchedules(schedules: any[]): Array<{ title: string; dayOfWeek: string; timeBlock: string; frequency: number }> {
    const dayMap: { [key: string]: string } = {
        'Mon': 'mon', 'Tue': 'tue', 'Wed': 'wed', 'Thu': 'thu', 'Fri': 'fri', 'Sat': 'sat', 'Sun': 'sun'
    };

    // 제목 + 요일 + 시간대로 그룹화
    const groups: { [key: string]: any[] } = {};

    schedules.forEach(s => {
        const day = dayMap[s.day_of_week] || s.day_of_week.toLowerCase();
        const hour = parseInt(s.hour);
        const timeBlock = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        const key = `${s.title}_${day}_${timeBlock}`;

        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
    });

    // 2회 이상 반복된 일정만 추출
    const recurring: Array<{ title: string; dayOfWeek: string; timeBlock: string; frequency: number }> = [];

    Object.entries(groups).forEach(([key, scheduleGroup]) => {
        if (scheduleGroup.length >= 2) { // 최소 2회 이상
            const [title, day, timeBlock] = key.split('_');
            recurring.push({
                title,
                dayOfWeek: day,
                timeBlock,
                frequency: scheduleGroup.length,
            });
        }
    });

    // 빈도 높은 순으로 정렬
    recurring.sort((a, b) => b.frequency - a.frequency);

    return recurring.slice(0, 10); // 상위 10개만
}

/**
 * 활동 시간대 분포 계산
 */
function calculateActivityDistribution(schedules: any[]): { morning: number; afternoon: number; evening: number } {
    let morning = 0, afternoon = 0, evening = 0;

    schedules.forEach(s => {
        const hour = parseInt(s.hour);
        if (hour >= 5 && hour < 12) morning++;
        else if (hour >= 12 && hour < 18) afternoon++;
        else if (hour >= 18 && hour < 23) evening++;
    });

    const total = morning + afternoon + evening || 1;

    return {
        morning: morning / total,
        afternoon: afternoon / total,
        evening: evening / total,
    };
}

/**
 * 바쁜 요일 vs 여유로운 요일 분류
 */
function categorizeDaysByBusyness(schedules: any[]): { busyDays: string[]; relaxedDays: string[] } {
    const dayMap: { [key: string]: string } = {
        'Mon': 'mon', 'Tue': 'tue', 'Wed': 'wed', 'Thu': 'thu', 'Fri': 'fri', 'Sat': 'sat', 'Sun': 'sun'
    };

    const dayCounts: { [key: string]: number } = {
        mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0
    };

    schedules.forEach(s => {
        const day = dayMap[s.day_of_week] || s.day_of_week.toLowerCase();
        dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    const avgCount = Object.values(dayCounts).reduce((a, b) => a + b, 0) / 7;

    const busyDays: string[] = [];
    const relaxedDays: string[] = [];

    Object.entries(dayCounts).forEach(([day, count]) => {
        if (count > avgCount * 1.2) {
            busyDays.push(day);
        } else if (count < avgCount * 0.8) {
            relaxedDays.push(day);
        }
    });

    return { busyDays, relaxedDays };
}

function getEmptyPattern(): SchedulePattern {
    return {
        wakeUpTime: null,
        sleepTime: null,
        workStartTime: null,
        workEndTime: null,
        lunchTime: null,
        freeTimeBlocks: {},
        recurringSchedules: [],
        activityDistribution: { morning: 0.33, afternoon: 0.33, evening: 0.34 },
        busyDays: [],
        relaxedDays: [],
    };
}
