"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Sparkles, Loader2, Minimize2, Calendar, Youtube, Newspaper, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendBriefingDetail } from "@/components/features/dashboard/TrendBriefingDetail";

interface ChatAction {
    type: "add_schedule" | "open_link" | "open_curriculum";
    label: string;
    data: Record<string, any>;
}

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    actions?: ChatAction[];
}

// TrendBriefing format matching TrendBriefingDetail props
interface TrendBriefing {
    id: string;
    title: string;
    category: string;
    summary: string;
    time: string;
    imageColor: string;
    originalUrl: string;
    imageUrl?: string;
    source: string;
    relevance?: string;
}

interface RotatingCard {
    id: string;
    type: 'schedule' | 'briefing' | 'youtube' | 'news' | 'habit' | 'weather' | 'proactive';
    title: string;
    message: string;
    actionText: string;
    actionType: 'add_schedule' | 'open_briefing' | 'open_link';
    actionUrl?: string;
    color: string;
    icon: string;
    briefingData?: TrendBriefing;
    scheduleData?: {
        text: string;
        startTime: string;
        endTime?: string;
        specificDate?: string;
    };
}

// MediaItem interface matching RecommendedMedia
interface MediaItem {
    id: string;
    title: string;
    channel: string;
    type: 'youtube';
    tags: string[];
    duration: string;
    description: string;
}

interface FloatingAIAssistantProps {
    showSuggestions?: boolean;
    // Data from dashboard
    briefings?: TrendBriefing[];
    recommendations?: MediaItem[];
    userProfile?: {
        job?: string;
        goal?: string;
        customGoals?: any[];
    };
}

const CARD_ICONS: Record<string, React.ElementType> = {
    Calendar: Calendar,
    CalendarPlus: Calendar,
    Youtube: Youtube,
    Newspaper: Newspaper,
    Search: Search,
};

export function FloatingAIAssistant({
    showSuggestions = false,
    briefings: propsBriefings = [],
    recommendations = [],
    userProfile
}: FloatingAIAssistantProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [cards, setCards] = useState<RotatingCard[]>([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [selectedBriefing, setSelectedBriefing] = useState<TrendBriefing | null>(null);
    const [isDismissed, setIsDismissed] = useState(false);
    const [fetchedBriefings, setFetchedBriefings] = useState<TrendBriefing[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch briefings directly if props are empty
    useEffect(() => {
        if (!showSuggestions) return;

        // If props have briefings, use them
        if (propsBriefings.length > 0) {
            setFetchedBriefings(propsBriefings);
            return;
        }

        // Otherwise fetch from API
        const fetchBriefings = async () => {
            try {
                const response = await fetch('/api/trend-briefing/get');
                if (response.ok) {
                    const data = await response.json();
                    if (data.trends && data.trends.length > 0) {
                        console.log('[FloatingAI] Fetched briefings from API:', data.trends.length);
                        setFetchedBriefings(data.trends);
                    }
                }
            } catch (e) {
                console.error('[FloatingAI] Failed to fetch briefings:', e);
            }
        };

        fetchBriefings();
    }, [showSuggestions, propsBriefings]);

    // Use fetched briefings (either from props or API)
    const briefings = fetchedBriefings.length > 0 ? fetchedBriefings : propsBriefings;

    // Generate cards from props data
    useEffect(() => {
        if (!showSuggestions) return;

        console.log('[FloatingAI] Received briefings:', briefings?.length, briefings);
        console.log('[FloatingAI] Received recommendations:', recommendations?.length);
        console.log('[FloatingAI] UserProfile:', userProfile);

        const generatedCards: RotatingCard[] = [];
        const now = new Date();
        const currentHour = now.getHours();
        const today = now.toISOString().split('T')[0];
        const dayOfWeek = now.getDay();

        // CARD 1: Schedule (Blue)
        const customGoals = userProfile?.customGoals || [];
        const todayGoals = customGoals.filter((g: any) =>
            g.specificDate === today ||
            (g.daysOfWeek?.includes(dayOfWeek) && !g.specificDate)
        ).sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));

        const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const upcomingGoal = todayGoals.find((g: any) => g.startTime && g.startTime > currentTimeStr);

        // Check if upcoming goal is within 30 minutes
        const isWithin30Min = upcomingGoal && (() => {
            const [goalHour, goalMin] = upcomingGoal.startTime.split(':').map(Number);
            const goalTime = goalHour * 60 + goalMin;
            const currentTime = currentHour * 60 + now.getMinutes();
            return goalTime - currentTime <= 30 && goalTime - currentTime > 0;
        })();

        // Late night (midnight to 6 AM) - suggest sleep
        if (currentHour >= 0 && currentHour < 6) {
            generatedCards.push({
                id: 'schedule-sleep',
                type: 'schedule',
                title: '?åô Ï∑®Ïπ®??Í∂åÌï¥?úÎ¶Ω?àÎã§',
                message: 'Ï∂©Î∂Ñ???òÎ©¥?Ä ?¥Ïùº???±Í≥ºÎ•?Ï¢åÏö∞?©Îãà?? ?∏Ïïà??Î∞??òÏÑ∏??',
                actionText: '?òÎ©¥ Î™®Îìú',
                actionType: 'open_link',
                color: 'bg-indigo-50 border-indigo-200',
                icon: 'Moon',
            });
        } else if (isWithin30Min && upcomingGoal) {
            // Within 30 minutes - show reminder
            generatedCards.push({
                id: 'schedule-reminder',
                type: 'schedule',
                title: `Next: ${upcomingGoal.startTime} schedule`,
                message: `"${upcomingGoal.text}" starts soon.`,
                actionText: 'Open',
                actionType: 'open_link',
                color: 'bg-blue-50 border-blue-200',
                icon: 'Calendar',
            });
        } else if (upcomingGoal) {
            // Free time until next schedule - PROACTIVE SUGGESTIONS based on time & context
            const job = userProfile?.job || '';
            const goal = userProfile?.goal || '';
            const timeUntilNext = upcomingGoal.startTime ? (() => {
                const [goalHour, goalMin] = upcomingGoal.startTime.split(':').map(Number);
                const goalTime = goalHour * 60 + goalMin;
                const currentTime = currentHour * 60 + now.getMinutes();
                return goalTime - currentTime;
            })() : 999;

            // ?çΩÔ∏?MEAL TIME SUGGESTIONS (7-9 AM, 11-1 PM, 6-8 PM)
            const getMealSuggestion = () => {
                if (currentHour >= 7 && currentHour < 9) {
                    const breakfastOptions = [
                        { text: '?•ó ?§Ìä∏Î∞ÄÍ≥?Í≥ºÏùºÎ°?Í±¥Í∞ï???ÑÏπ® ?úÏûë?òÎäî Í±??¥Îñ†?∏Ïöî?', action: '?ÑÏπ® Î®πÍ∏∞', schedule: '?ÑÏπ® ?ùÏÇ¨', time: '30Î∂? },
                        { text: '?ç≥ ?®Î∞±Ïß??§ÌÅ¨?®Î∏îÍ≥??ÑÎ≥¥Ïπ¥ÎèÑ ?†Ïä§?∏Îäî ?¥Îñ†?†Í???', action: '?ùÏÇ¨?òÍ∏∞', schedule: '?ÑÏπ® ?ùÏÇ¨', time: '30Î∂? },
                        { text: '?•§ Í∑∏Î¶∞ ?§Î¨¥?îÎ°ú ?ÅÏñë??Í∞ÑÌé∏?òÍ≤å Ï±ÑÏõåÎ≥¥ÏÑ∏??, action: '?ùÏÇ¨?òÍ∏∞', schedule: '?ÑÏπ® ?ùÏÇ¨', time: '20Î∂? },
                    ];
                    return breakfastOptions[Math.floor(Math.random() * breakfastOptions.length)];
                } else if (currentHour >= 11 && currentHour < 13) {
                    const lunchOptions = [
                        { text: '?ç± ?êÎü¨??Î≥ºÎ°ú Í∞ÄÎ≥çÍ≤å ?êÏã¨???úÏãú??Í±??¥Îñ®ÍπåÏöî?', action: '?êÏã¨ Î®πÍ∏∞', schedule: '?êÏã¨ ?ùÏÇ¨', time: '40Î∂? },
                        { text: '?•ô ????¥ÏÇ¥ ?åÎìú?ÑÏπòÎ°??êÎÑàÏßÄ Ï∂©Ï†Ñ?òÏÑ∏??, action: '?ùÏÇ¨?òÍ∏∞', schedule: '?êÏã¨ ?ùÏÇ¨', time: '40Î∂? },
                        { text: '?ç≤ ?úÏû•Ï∞åÍ∞ú?Ä ?°Í≥°Î∞•ÏúºÎ°??†Îì†???êÏã¨ ?¥Îñ†?∏Ïöî?', action: '?ùÏÇ¨?òÍ∏∞', schedule: '?êÏã¨ ?ùÏÇ¨', time: '50Î∂? },
                    ];
                    return lunchOptions[Math.floor(Math.random() * lunchOptions.length)];
                } else if (currentHour >= 18 && currentHour < 20) {
                    const dinnerOptions = [
                        { text: '?•ó ?∞Ïñ¥ Íµ¨Ïù¥?Ä Ï±ÑÏÜåÎ°??ÅÏñë Í∑†Ìòï ?°Ìûå ?Ä???úÏÑ∏??, action: '?Ä??Î®πÍ∏∞', schedule: '?Ä???ùÏÇ¨', time: '50Î∂? },
                        { text: '?çó ????¥ÏÇ¥ ?§ÌÖå?¥ÌÅ¨?Ä Í≥†Íµ¨Îß??¥Îñ†?∏Ïöî?', action: '?ùÏÇ¨?òÍ∏∞', schedule: '?Ä???ùÏÇ¨', time: '45Î∂? },
                        { text: '?•ò ?êÎ? ?êÎü¨?úÎ°ú Í∞ÄÎ≥çÍ≤å ?Ä?ÅÏùÑ ÎßàÎ¨¥Î¶¨Ìïò?∏Ïöî', action: '?ùÏÇ¨?òÍ∏∞', schedule: '?Ä???ùÏÇ¨', time: '30Î∂? },
                    ];
                    return dinnerOptions[Math.floor(Math.random() * dinnerOptions.length)];
                }
                return null;
            };

            // ?ìö READING TIME SUGGESTIONS (8-10 PM or weekends)
            const getReadingSuggestion = () => {
                const books = job.includes('ÎßàÏ???) || job.includes('ÎßàÏ???) ? [
                    { text: '?ìñ ?åÍ∑∏Î°úÏä§ ?¥ÌÇπ???ΩÏúºÎ©??±Ïû• ?ÑÎûµ??Î∞∞ÏõåÎ≥¥ÏÑ∏??, action: '?ÖÏÑú?òÍ∏∞', schedule: '?ÖÏÑú - Í∑∏Î°ú???¥ÌÇπ', time: '30Î∂? },
                    { text: '?ìï ?åÎßàÏºÄ?∞Ïùò ?º„ÄçÎ°ú ?§Î¨¥ ?∏ÏÇ¨?¥Ìä∏Î•??ªÏñ¥Î≥¥ÏÑ∏??, action: 'Ï±??ΩÍ∏∞', schedule: '?ÖÏÑú - ÎßàÏ??∞Ïùò ??, time: '40Î∂? },
                ] : job.includes('Í∞úÎ∞ú') || job.includes('?îÏ??àÏñ¥') ? [
                    { text: '?ìó ?åÌÅ¥Î¶?ÏΩîÎìú????Ï±ïÌÑ∞Î°?ÏΩîÎî© Ï≤†Ìïô??Î∞∞ÏõåÎ≥¥ÏÑ∏??, action: '?ÖÏÑú?òÍ∏∞', schedule: '?ÖÏÑú - ?¥Î¶∞ ÏΩîÎìú', time: '30Î∂? },
                    { text: '?ìò ?åÎ¶¨?©ÌÜ†ÎßÅ„Ä??ΩÏúºÎ©??§Í≥Ñ Í∞êÍ∞Å???§ÏõåÎ≥¥ÏÑ∏??, action: 'Ï±??ΩÍ∏∞', schedule: '?ÖÏÑú - Î¶¨Ìå©?†ÎßÅ', time: '40Î∂? },
                ] : [
                    { text: '?ìö ?åÎ???Ï∂îÏõîÏ∞®ÏÑ†?çÏúºÎ°?Î∂Ä???êÎ¶¨Î•?Î∞∞ÏõåÎ≥¥ÏÑ∏??, action: '?ÖÏÑú?òÍ∏∞', schedule: '?ÖÏÑú - Î∂Ä??Ï∂îÏõîÏ∞®ÏÑ†', time: '40Î∂? },
                    { text: '?ìï ?åÏïÑÏ£??ëÏ? ?µÍ????ò„ÄçÏúºÎ°??±Ïû• ?úÏä§?úÏùÑ ÎßåÎìú?∏Ïöî', action: 'Ï±??ΩÍ∏∞', schedule: '?ÖÏÑú - ?µÍ?????, time: '30Î∂? },
                ];
                return books[Math.floor(Math.random() * books.length)];
            };

            // ?í™ EXERCISE SUGGESTIONS (6-8 AM, 6-8 PM)
            const getExerciseSuggestion = () => {
                if (currentHour >= 6 && currentHour < 8) {
                    const morningExercise = [
                        { text: '?èÉ?ç‚ôÇÔ∏??ÑÏπ® Ï°∞ÍπÖ 30Î∂ÑÏúºÎ°??òÎ£®Î•??úÍ∏∞Ï∞®Í≤å ?úÏûë?òÏÑ∏??', action: '?¥Îèô?òÍ∏∞', schedule: 'Ï°∞ÍπÖ', time: '30Î∂? },
                        { text: '?ßò ?îÍ?Î°?Î™∏Í≥º ÎßàÏùå??Íπ®ÏõåÎ≥¥Îäî Í±??¥Îñ†?∏Ïöî?', action: '?¥Îèô?òÍ∏∞', schedule: '?îÍ?', time: '20Î∂? },
                        { text: '?í™ Í∞ÑÎã®???àÌä∏?àÏù¥?ùÏúºÎ°??êÎÑàÏßÄÎ•?Ï∂©Ï†Ñ?òÏÑ∏??, action: '?¥Îèô?òÍ∏∞', schedule: '?àÌä∏?àÏù¥??, time: '25Î∂? },
                    ];
                    return morningExercise[Math.floor(Math.random() * morningExercise.length)];
                } else if (currentHour >= 18 && currentHour < 21) {
                    const eveningExercise = [
                        { text: '?èãÔ∏??¨Ïä§?•Ïóê??Í∑ºÎ†• ?¥Îèô ?¥Îñ†?∏Ïöî? ?§Ìä∏?àÏä§???†Î†§Î≥¥ÏÑ∏??, action: '?¥Îèô?òÍ∏∞', schedule: '?¨Ïä§', time: '60Î∂? },
                        { text: '?èä ?òÏòÅ?ºÎ°ú ?òÎ£®???ºÎ°úÎ•??Ä?¥Î≥¥?∏Ïöî', action: '?¥Îèô?òÍ∏∞', schedule: '?òÏòÅ', time: '45Î∂? },
                        { text: '?ö¥ ?êÏ†ÑÍ±??ÄÎ©??Ä??Î∞îÎûå ?¨Îäî Í±??¥Îñ®ÍπåÏöî?', action: '?¥Îèô?òÍ∏∞', schedule: '?êÏ†ÑÍ±?, time: '40Î∂? },
                    ];
                    return eveningExercise[Math.floor(Math.random() * eveningExercise.length)];
                }
                return null;
            };

            // ?éØ SKILL DEVELOPMENT (personalized by job)
            const getSkillSuggestion = () => {
                if (job.includes('ÎßàÏ???) || job.includes('ÎßàÏ???)) {
                    return [
                        { text: '?ìä Í≤ΩÏüÅ??SNS Î∂ÑÏÑù?òÎ©∞ ?∏ÏÇ¨?¥Ìä∏Î•??ìÏïÑÎ≥¥ÏÑ∏??, action: 'Î∂ÑÏÑù?òÍ∏∞', schedule: 'Í≤ΩÏüÅ??Î∂ÑÏÑù', time: '30Î∂? },
                        { text: '?çÔ∏è Î∏îÎ°úÍ∑?Í∏Ä ?òÎÇò ?ëÏÑ±?òÎ©∞ ÏΩòÌÖêÏ∏???üâ???§ÏõåÎ≥¥ÏÑ∏??, action: 'Í∏Ä?∞Í∏∞', schedule: 'Î∏îÎ°úÍ∑??ëÏÑ±', time: '40Î∂? },
                    ][Math.floor(Math.random() * 2)];
                } else if (job.includes('Í∞úÎ∞ú') || job.includes('?îÏ??àÏñ¥')) {
                    return [
                        { text: '?íª ?åÍ≥†Î¶¨Ï¶ò Î¨∏Ï†ú ?òÎÇò ?ÄÎ©??êÎáåÎ•?Íπ®ÏõåÎ≥¥ÏÑ∏??, action: 'ÏΩîÎî©?òÍ∏∞', schedule: '?åÍ≥†Î¶¨Ï¶ò ?Ä??, time: '30Î∂? },
                        { text: '?îß ?àÎ°ú???ºÏù¥Î∏åÎü¨Î¶?Î¨∏ÏÑú ?ΩÏúºÎ©?Í∏∞Ïà†??Î∞∞ÏõåÎ≥¥ÏÑ∏??, action: '?ôÏäµ?òÍ∏∞', schedule: 'Í∏∞Ïà† ?ôÏäµ', time: '40Î∂? },
                    ][Math.floor(Math.random() * 2)];
                } else {
                    return [
                        { text: '?? ?®Îùº??Í∞ïÏùò ??Ï±ïÌÑ∞ ?§ÏúºÎ©??±Ïû•?¥Î≥¥?∏Ïöî', action: '?ôÏäµ?òÍ∏∞', schedule: '?®Îùº??Í∞ïÏùò', time: '30Î∂? },
                        { text: '?çÔ∏è ?§Îäò Î∞∞Ïö¥ Í≤ÉÏùÑ ?ïÎ¶¨?òÎ©∞ ?¥Í≤É?ºÎ°ú ÎßåÎìú?∏Ïöî', action: '?ïÎ¶¨?òÍ∏∞', schedule: '?ôÏäµ ?ïÎ¶¨', time: '20Î∂? },
                    ][Math.floor(Math.random() * 2)];
                }
            };

            // PRIORITY: Meal > Exercise > Reading > Skills
            let selectedSuggestion;
            const mealSuggestion = getMealSuggestion();
            const exerciseSuggestion = getExerciseSuggestion();
            const readingSuggestion = (currentHour >= 20 && currentHour < 22) || dayOfWeek === 0 || dayOfWeek === 6 ? getReadingSuggestion() : null;

            if (mealSuggestion) {
                selectedSuggestion = mealSuggestion;
            } else if (exerciseSuggestion && timeUntilNext >= 40) {
                selectedSuggestion = exerciseSuggestion;
            } else if (readingSuggestion && timeUntilNext >= 30) {
                selectedSuggestion = readingSuggestion;
            } else {
                selectedSuggestion = getSkillSuggestion();
            }

            // Evening productive relaxation suggestions (fallback)
            const eveningProductiveSuggestions = [
                { text: '?ìñ ?Ä???ÖÏÑúÎ°??òÎ£®Î•??òÎ??àÍ≤å ÎßàÎ¨¥Î¶¨Ìïò?∏Ïöî', action: '?ÖÏÑú?òÍ∏∞', icon: 'Sparkles', schedule: '?ÖÏÑú', time: '30Î∂? },
                { text: '?çÔ∏è ?òÎ£®Î•??åÏïÑÎ≥¥Î©∞ ?±Ïû• ?ºÍ∏∞Î•??ëÏÑ±?¥Î≥¥?∏Ïöî', action: '?ºÍ∏∞ ?∞Í∏∞', icon: 'Sparkles', schedule: '?ºÍ∏∞ ?ëÏÑ±', time: '15Î∂? },
                { text: '?éØ ?¥Ïùº??Î™©ÌëúÎ•?Íµ¨Ï≤¥?ÅÏúºÎ°?Í≥ÑÌöç?¥Î≥¥?∏Ïöî', action: 'Í≥ÑÌöç ?∏Ïö∞Í∏?, icon: 'Sparkles', schedule: '?¥Ïùº Í≥ÑÌöç', time: '20Î∂? },
                { text: '?í≠ ?§Îäò Î∞∞Ïö¥ ÍµêÌõà???ïÎ¶¨?òÍ≥† ?¥Ïû¨?îÌïò?∏Ïöî', action: 'Î≥µÏäµ?òÍ∏∞', icon: 'Sparkles', schedule: '?ôÏäµ Î≥µÏäµ', time: '25Î∂? },
                { text: '?éì ?®Îùº??Í∞ïÏùòÎ°??àÎ°ú??ÏßÄ?ùÏùÑ ?µÎìù?òÏÑ∏??, action: 'Í∞ïÏùò ?£Í∏∞', icon: 'Sparkles', schedule: '?®Îùº??Í∞ïÏùò', time: '30Î∂? },
                { text: '?åü ?±Í≥µ???¨Îûå?§Ïùò ?∏ÌÑ∞Î∑∞Î? Î≥¥Î©∞ ?ÅÍ∞ê???ªÏúº?∏Ïöî', action: '?ÅÍ∞ê ?ªÍ∏∞', icon: 'Sparkles', schedule: '?∏ÌÑ∞Î∑??úÏ≤≠', time: '20Î∂? },
                { text: '?ìù ÎØ∏Î§Ñ??Í≥ºÏ†ú???ÑÎ°ú?ùÌä∏Î•?ÏßÑÌñâ?¥Î≥¥?∏Ïöî', action: 'Í≥ºÏ†ú ÏßÑÌñâ', icon: 'Sparkles', schedule: '?ÑÎ°ú?ùÌä∏', time: '40Î∂? },
                { text: '?ß† Î™ÖÏÉÅ?ºÎ°ú ÎßàÏùå???ïÎ¶¨?òÍ≥† ÏßëÏ§ë?•ÏùÑ ?åÎ≥µ?òÏÑ∏??, action: 'Î™ÖÏÉÅ?òÍ∏∞', icon: 'Sparkles', schedule: 'Î™ÖÏÉÅ', time: '15Î∂? },
            ];

            // Weekend productive suggestions
            const weekendSuggestions = [
                { text: '?ìö Ï£ºÎßê ?ÑÎ°ú?ùÌä∏Î°??àÎ°ú??Í≤ÉÏóê ?ÑÏ†Ñ?¥Î≥¥?∏Ïöî!', action: '?ÑÎ°ú?ùÌä∏ ?úÏûë', icon: 'Sparkles' },
                { text: '?éØ ?¥Î≤à Ï£?Î™©ÌëúÎ•?Î¶¨Î∑∞?òÍ≥† ?§Ïùå Ï£ºÎ? Ï§ÄÎπÑÌïò?∏Ïöî', action: 'Ï£ºÍ∞Ñ Î¶¨Î∑∞', icon: 'Sparkles' },
                { text: '?í° ?âÏÜå Í¥Ä?¨Ïûà??Î∂ÑÏïºÎ•?ÍπäÏù¥ ?êÍµ¨?¥Î≥¥?∏Ïöî', action: '?¨Ìôî ?ôÏäµ', icon: 'Sparkles' },
                { text: '?§ù ?§Ìä∏?åÌÇπ ?¥Î≤§?∏ÎÇò ?§ÌÑ∞??Î™®ÏûÑ??Ï∞∏Ïó¨?¥Î≥¥?∏Ïöî', action: '?§Ìä∏?åÌÇπ', icon: 'Sparkles' },
                { text: '???¨Ìä∏?¥Î¶¨?§ÎÇò ?¥Î†•?úÎ? ?ÖÎç∞?¥Ìä∏?òÏÑ∏??, action: 'Ïª§Î¶¨??Í¥ÄÎ¶?, icon: 'Sparkles' },
                { text: '?é® Ï∑®Î? ?úÎèô?ºÎ°ú Ï∞ΩÏùò?•ÏùÑ Î∞úÌúò?¥Î≥¥?∏Ïöî', action: 'Ï∑®Î? Í∞úÎ∞ú', icon: 'Sparkles' },
            ];

            // Use selected proactive suggestion
            if (!selectedSuggestion) {
                selectedSuggestion = eveningProductiveSuggestions[Math.floor(Math.random() * eveningProductiveSuggestions.length)];
            }

            // Calculate duration in minutes from time string
            const durationMinutes = selectedSuggestion.time ? parseInt(selectedSuggestion.time) : 30;

            // Calculate start and end time
            const startHour = currentHour;
            const startMin = Math.ceil(now.getMinutes() / 10) * 10; // Round up to nearest 10min
            const startTime = `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;

            const endTotalMin = startHour * 60 + startMin + durationMinutes;
            const endHour = Math.floor(endTotalMin / 60);
            const endMin = endTotalMin % 60;
            const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;

            generatedCards.push({
                id: 'schedule-suggest',
                type: 'schedule',
                title: `?í™ ${upcomingGoal.startTime}ÍπåÏ? ${selectedSuggestion.time || '?úÍ∞Ñ'} ?àÏñ¥??,
                message: selectedSuggestion.text,
                actionText: '?ºÏ†ï??Ï∂îÍ?',
                actionType: 'add_schedule',
                scheduleData: {
                    text: selectedSuggestion.schedule || selectedSuggestion.action,
                    startTime: startTime,
                    endTime: endTime,
                    specificDate: today,
                },
                color: 'bg-blue-50 border-blue-200',
                icon: 'Sparkles',
            });
        } else {
            // No more schedules today - continue productive evening activities
            const eveningGrowthSuggestions = [
                { text: '?ìñ ?Ä???ÖÏÑúÎ°??òÎ£®Î•??òÎ??àÍ≤å ÎßàÎ¨¥Î¶¨Ìïò?∏Ïöî', action: '?ÖÏÑú?òÍ∏∞' },
                { text: '?çÔ∏è ?òÎ£®Î•??åÏïÑÎ≥¥Î©∞ ?±Ïû• ?ºÍ∏∞Î•??ëÏÑ±?¥Î≥¥?∏Ïöî', action: '?ºÍ∏∞ ?∞Í∏∞' },
                { text: '?éØ ?¥Ïùº??Î™©ÌëúÎ•?Íµ¨Ï≤¥?ÅÏúºÎ°?Í≥ÑÌöç?¥Î≥¥?∏Ïöî', action: 'Í≥ÑÌöç ?∏Ïö∞Í∏? },
                { text: '?í≠ ?§Îäò Î∞∞Ïö¥ ÍµêÌõà???ïÎ¶¨?òÍ≥† ?¥Ïû¨?îÌïò?∏Ïöî', action: 'Î≥µÏäµ?òÍ∏∞' },
                { text: '?éì ?®Îùº??Í∞ïÏùòÎ°??àÎ°ú??ÏßÄ?ùÏùÑ ?µÎìù?òÏÑ∏??, action: 'Í∞ïÏùò ?£Í∏∞' },
                { text: '?ìù ÎØ∏Î§Ñ??Í≥ºÏ†ú???ÑÎ°ú?ùÌä∏Î•?ÏßÑÌñâ?¥Î≥¥?∏Ïöî', action: 'Í≥ºÏ†ú ÏßÑÌñâ' },
            ];

            const randomSuggestion = eveningGrowthSuggestions[Math.floor(Math.random() * eveningGrowthSuggestions.length)];

            generatedCards.push({
                id: 'schedule-evening',
                type: 'schedule',
                title: '?? ÏßÄÍ∏àÎèÑ ?±Ïû•?????àÏäµ?àÎã§!',
                message: randomSuggestion.text,
                actionText: randomSuggestion.action,
                actionType: 'open_link',
                color: 'bg-indigo-50 border-indigo-200',
                icon: 'Sparkles',
            });
        }

        // CARD 2: Trend Briefing from props (Orange)
        if (briefings.length > 0) {
            const randomBriefing = briefings[Math.floor(Math.random() * briefings.length)];
            generatedCards.push({
                id: 'briefing-card',
                type: 'briefing',
                title: `?ì∞ ${randomBriefing.title?.substring(0, 25)}...`,
                message: '?ÑÏßÅ ???∏Î†å??Î∏åÎ¶¨?ëÏùÑ ?ΩÏ? ?äÏúº?®Ïñ¥?? ÏßÄÍ∏??ïÏù∏?¥Î≥¥?∏Ïöî!',
                actionText: 'Î∏åÎ¶¨??Î≥¥Í∏∞',
                actionType: 'open_briefing',
                briefingData: randomBriefing,
                color: 'bg-orange-50 border-orange-200',
                icon: 'Newspaper',
            });
        }

        // CARD 3: YouTube from localStorage (Red)
        // RecommendedMedia stores in localStorage: daily_rec_${job}_${goal}
        let youtubeRecs = recommendations;
        if (youtubeRecs.length === 0 && typeof window !== 'undefined') {
            try {
                const cacheKey = `daily_rec_${userProfile?.job || ''}_${userProfile?.goal || ''}`;
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const { items } = JSON.parse(cached);
                    youtubeRecs = items || [];
                }
            } catch (e) {
                console.log('[FloatingAI] localStorage read failed');
            }
        }

        if (youtubeRecs.length > 0) {
            const randomRec = youtubeRecs[Math.floor(Math.random() * youtubeRecs.length)];
            generatedCards.push({
                id: 'youtube-card',
                type: 'youtube',
                title: `?é¨ ${randomRec.title?.substring(0, 25)}...`,
                message: `${randomRec.channel}??Ï∂îÏ≤ú ?ÅÏÉÅ`,
                actionText: 'Î≥¥Îü¨Í∞ÄÍ∏?,
                actionType: 'open_link',
                actionUrl: `https://www.youtube.com/watch?v=${randomRec.id}`,
                color: 'bg-red-50 border-red-200',
                icon: 'Youtube',
            });
        }

        // CARD 4: Personalized Industry Info (Purple)
        const getIndustryInfo = () => {
            const job = userProfile?.job || '';

            // Student-focused suggestions
            if (job.includes('?ôÏÉù') || job.includes('?Ä?ôÏÉù') || job.includes('Ï∑®Ï???)) {
                const studentInfo = [
                    { title: '?èÜ Í≥µÎ™®???ïÎ≥¥', message: '?¥Î≤à Ï£?ÎßàÍ∞ê?òÎäî Í≥µÎ™®?ÑÏùÑ ?ïÏù∏?òÏÑ∏??, url: 'https://www.thinkcontest.com', action: 'Í≥µÎ™®??Î≥¥Í∏∞' },
                    { title: '?íº ?∏ÌÑ¥??Ï±ÑÏö©', message: '?ÄÍ∏∞ÏóÖ/?§Ì??∏ÏóÖ ?∏ÌÑ¥ Ï±ÑÏö© Í≥µÍ≥†', url: 'https://www.wanted.co.kr/wdlist/518', action: 'Ï±ÑÏö©Í≥µÍ≥† Î≥¥Í∏∞' },
                    { title: '?ìö ?•ÌïôÍ∏??ïÎ≥¥', message: '?†Ï≤≠ Í∞Ä?•Ìïú ?•ÌïôÍ∏àÏùÑ ?ïÏù∏?òÏÑ∏??, url: 'https://www.kosaf.go.kr', action: '?•ÌïôÍ∏?Î≥¥Í∏∞' },
                    { title: '?çÔ∏è ?êÏÜå????, message: '?©Í≤© ?êÏÜå???ëÏÑ±Î≤ïÏùÑ ?åÏïÑÎ≥¥ÏÑ∏??, url: 'https://www.jobplanet.co.kr', action: 'Ï∑®ÏóÖ ??Î≥¥Í∏∞' },
                ];
                return studentInfo[Math.floor(Math.random() * studentInfo.length)];
            }

            // Marketer suggestions
            if (job.includes('ÎßàÏ???) || job.includes('ÎßàÏ???)) {
                const marketerInfo = [
                    { title: '?ìä ÎßàÏ????∏Î†å??, message: '2024 ?îÏ???ÎßàÏ????∏Î†å??Î¶¨Ìè¨??, url: 'https://www.thinkwithgoogle.com', action: 'Î¶¨Ìè¨??Î≥¥Í∏∞' },
                    { title: '?èÖ Í¥ëÍ≥† ?¥Ïõå??, message: '?òÏÉÅ?ëÏóê???ÅÍ∞ê???ªÏñ¥Î≥¥ÏÑ∏??, url: 'https://www.adic.or.kr', action: '?òÏÉÅ??Î≥¥Í∏∞' },
                    { title: '?ìà SNS ?∏ÏÇ¨?¥Ìä∏', message: '?∏Ïä§?ÄÍ∑∏Îû®/?±ÌÜ° ?åÍ≥†Î¶¨Ï¶ò Î∂ÑÏÑù', url: 'https://business.instagram.com/blog', action: '?∏ÏÇ¨?¥Ìä∏ Î≥¥Í∏∞' },
                ];
                return marketerInfo[Math.floor(Math.random() * marketerInfo.length)];
            }

            // Developer suggestions
            if (job.includes('Í∞úÎ∞ú') || job.includes('?îÏ??àÏñ¥') || job.includes('?ÑÎ°úÍ∑∏ÎûòÎ®?)) {
                const devInfo = [
                    { title: '?íª Í∏∞Ïà† Î∏îÎ°úÍ∑?, message: '?¥Î≤à Ï£??∏Í∏∞ Í∏∞Ïà† ?ÑÌã∞??, url: 'https://velog.io', action: '?ÑÌã∞??Î≥¥Í∏∞' },
                    { title: '?? ?¥Ïª§???ïÎ≥¥', message: 'Ï∞∏Í? Í∞Ä?•Ìïú ?¥Ïª§?§ÏùÑ ?ïÏù∏?òÏÑ∏??, url: 'https://devpost.com/hackathons', action: '?¥Ïª§??Î≥¥Í∏∞' },
                    { title: '?ì¶ ?§Ìîà?åÏä§', message: 'Ï£ºÎ™©Î∞õÎäî GitHub ?ÑÎ°ú?ùÌä∏', url: 'https://github.com/trending', action: '?∏Î†å??Î≥¥Í∏∞' },
                    { title: '?í° Í∞úÎ∞ú??Ïª®Ìçº?∞Ïä§', message: '?ìÏπòÎ©?????Í∞úÎ∞ú Ïª®Ìçº?∞Ïä§', url: 'https://festa.io/categories/28', action: 'Ïª®Ìçº?∞Ïä§ Î≥¥Í∏∞' },
                ];
                return devInfo[Math.floor(Math.random() * devInfo.length)];
            }

            // Designer suggestions
            if (job.includes('?îÏûê??) || job.includes('?îÏûê?¥ÎÑà')) {
                const designerInfo = [
                    { title: '?é® ?îÏûê???∏Î†å??, message: '2024 UI/UX ?îÏûê???∏Î†å??, url: 'https://www.awwwards.com', action: '?∏Î†å??Î≥¥Í∏∞' },
                    { title: '?èÜ ?îÏûê???¥Ïõå??, message: 'Red Dot/IF ?òÏÉÅ???¥Ìé¥Î≥¥Í∏∞', url: 'https://www.red-dot.org', action: '?òÏÉÅ??Î≥¥Í∏∞' },
                    { title: '???ÅÍ∞ê Í∞§Îü¨Î¶?, message: 'Behance?êÏÑú ?ÅÍ∞ê ?ªÍ∏∞', url: 'https://www.behance.net', action: 'Í∞§Îü¨Î¶?Î≥¥Í∏∞' },
                ];
                return designerInfo[Math.floor(Math.random() * designerInfo.length)];
            }

            // General professional suggestions
            const generalInfo = [
                { title: '?ìà Ïª§Î¶¨???±Ïû•', message: `${job || 'ÏßÅÏû•??}???ÑÌïú ??üâ ?•ÏÉÅ ??, url: 'https://www.linkedin.com/learning', action: '?ôÏäµ?òÍ∏∞' },
                { title: '?í° ?ÖÍ≥Ñ ?¥Ïä§', message: `${job || '?ÖÍ≥Ñ'} ÏµúÏã† ?ôÌñ• ?ïÏù∏`, url: `https://news.google.com/search?q=${encodeURIComponent((job || '') + ' ?∏Î†å??)}`, action: '?¥Ïä§ Î≥¥Í∏∞' },
                { title: '?éØ ?êÍ∏∞Í≥ÑÎ∞ú', message: '?±Í≥ºÎ•??íÏù¥???ÖÎ¨¥ ?§ÌÇ¨', url: 'https://www.coursera.org', action: 'ÏΩîÏä§ Î≥¥Í∏∞' },
            ];
            return generalInfo[Math.floor(Math.random() * generalInfo.length)];
        };

        const industryInfo = getIndustryInfo();
        generatedCards.push({
            id: 'news-card',
            type: 'news',
            title: industryInfo.title,
            message: industryInfo.message,
            actionText: industryInfo.action,
            actionType: 'open_link',
            actionUrl: industryInfo.url,
            color: 'bg-purple-50 border-purple-200',
            icon: 'Search',
        });

        setCards(generatedCards);
    }, [showSuggestions, briefings, recommendations, userProfile]);

    // 20-second rotation timer
    useEffect(() => {
        if (!showSuggestions || cards.length === 0 || isOpen) return;

        const timer = setInterval(() => {
            setCurrentCardIndex((prev) => (prev + 1) % cards.length);
        }, 20000); // 20 seconds

        return () => clearInterval(timer);
    }, [showSuggestions, cards.length, isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Listen for custom events to add messages from external components
    useEffect(() => {
        const handleChatMessage = (event: CustomEvent) => {
            console.log("[FloatingAIAssistant] Ï±ÑÌåÖ Î©îÏãúÏßÄ ?¥Î≤§???òÏã†:", event.detail);
            const { role, content } = event.detail;
            const newMessage: Message = {
                id: `external-${Date.now()}`,
                role: role,
                content: content,
            };
            setMessages((prev) => {
                console.log("[FloatingAIAssistant] Î©îÏãúÏßÄ Ï∂îÍ??? Í∏∞Ï°¥:", prev.length, "??", prev.length + 1);
                return [...prev, newMessage];
            });
        };

        const handleChatOpen = () => {
            console.log("[FloatingAIAssistant] Ï±ÑÌåÖ ?§Ìîà ?¥Î≤§???òÏã†");
            setIsOpen(true);
        };

        console.log("[FloatingAIAssistant] ?¥Î≤§??Î¶¨Ïä§???±Î°ù??);
        window.addEventListener('ai-chat-message', handleChatMessage as EventListener);
        window.addEventListener('ai-chat-open', handleChatOpen);

        return () => {
            console.log("[FloatingAIAssistant] ?¥Î≤§??Î¶¨Ïä§???úÍ±∞??);
            window.removeEventListener('ai-chat-message', handleChatMessage as EventListener);
            window.removeEventListener('ai-chat-open', handleChatOpen);
        };
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content: input.trim(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/ai-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMessage].map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                }),
            });

            if (!res.ok) throw new Error("Failed to get response");

            const data = await res.json();
            const assistantMessage: Message = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: data.message,
                actions: data.actions || [],
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [
                ...prev,
                {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: "Ï£ÑÏÜ°?©Îãà?? ?ëÎãµ??Í∞Ä?∏Ïò§?îÎç∞ ?§Ìå®?àÏäµ?àÎã§.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Handle action button clicks in chat
    const handleChatAction = async (action: ChatAction, messageId: string) => {
        if (action.type === "add_schedule") {
            try {
                const res = await fetch("/api/user/schedule/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(action.data),
                });

                if (!res.ok) throw new Error("Failed to add schedule");
                const result = await res.json();

                setMessages((prev) => [
                    ...prev,
                    {
                        id: `system-${Date.now()}`,
                        role: "assistant",
                        content: `??${result.message || "?ºÏ†ï??Ï∂îÍ??òÏóà?µÎãà??"}`,
                    },
                ]);

                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === messageId
                            ? { ...m, actions: m.actions?.filter((a) => a !== action) }
                            : m
                    )
                );
            } catch (error) {
                setMessages((prev) => [
                    ...prev,
                    { id: `error-${Date.now()}`, role: "assistant", content: "???ºÏ†ï Ï∂îÍ????§Ìå®?àÏäµ?àÎã§." },
                ]);
            }
        } else if (action.type === "open_link" && action.data.url) {
            window.open(action.data.url, "_blank");
        }
    };

    // Handle card action clicks
    const handleCardAction = async (card: RotatingCard) => {
        if (card.actionType === 'open_briefing' && card.briefingData) {
            setSelectedBriefing(card.briefingData);
        } else if (card.actionType === 'add_schedule') {
            const scheduleData = card.scheduleData;
            if (!scheduleData) {
                return;
            }
            try {
                const res = await fetch("/api/user/schedule/add", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(scheduleData),
                });
                if (res.ok) {
                    // Notify Dashboard to refresh schedule
                    console.log("[FloatingAI] ?ºÏ†ï ?ÖÎç∞?¥Ìä∏ ?¥Î≤§??Î∞úÏÜ°");
                    window.dispatchEvent(new CustomEvent('schedule-updated'));

                    // Get AI resource recommendations
                    console.log("[FloatingAI] AI Î¶¨ÏÜå???îÏ≤≠ ?úÏûë:", scheduleData.text);
                    const resourceResponse = await fetch("/api/ai-resource-recommend", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            activity: scheduleData.text,
                            category: card.type === 'schedule' ? 'productivity' : card.type,
                        }),
                    });

                    if (resourceResponse.ok) {
                        const resourceData = await resourceResponse.json();
                        console.log("[FloatingAI] AI Î¶¨ÏÜå???∞Ïù¥??", resourceData);

                        // Send message to AI chat
                        const chatMessage = `??"${scheduleData.text}" ?ºÏ†ï??Ï∂îÍ??òÏóà?µÎãà??\n\n${resourceData.recommendation}`;

                        setIsOpen(true);
                        setMessages((prev) => [
                            ...prev,
                            { id: `system-${Date.now()}`, role: "assistant", content: chatMessage },
                        ]);
                    } else {
                        setIsOpen(true);
                        setMessages((prev) => [
                            ...prev,
                            { id: `system-${Date.now()}`, role: "assistant", content: `??"${scheduleData.text}" ?ºÏ†ï??Ï∂îÍ??òÏóà?µÎãà??` },
                        ]);
                    }
                }
            } catch (e) {
                console.error("Schedule add error:", e);
            }
        } else if (card.actionType === 'open_link' && card.actionUrl) {
            window.open(card.actionUrl, "_blank");
        }

        // Move to next card after action
        setCurrentCardIndex((prev) => (prev + 1) % cards.length);
    };

    const currentCard = cards[currentCardIndex];
    const CardIcon = currentCard ? CARD_ICONS[currentCard.icon] || Sparkles : Sparkles;

    // Handle swipe navigation
    const handleSwipe = (direction: 'left' | 'right') => {
        if (direction === 'left') {
            setCurrentCardIndex((prev) => (prev + 1) % cards.length);
        } else {
            setCurrentCardIndex((prev) => (prev - 1 + cards.length) % cards.length);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {/* Single Rotating Card with Swipe */}
            <AnimatePresence mode="wait">
                {showSuggestions && !isOpen && !isDismissed && currentCard && (
                    <motion.div
                        key={currentCard.id}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={(e, { offset, velocity }) => {
                            const swipe = offset.x * velocity.x;
                            if (swipe < -5000) {
                                handleSwipe('left');
                            } else if (swipe > 5000) {
                                handleSwipe('right');
                            }
                        }}
                        className={cn(
                            "relative w-96 backdrop-blur-xl rounded-2xl p-6 shadow-xl cursor-grab active:cursor-grabbing",
                            "border bg-white",
                            currentCard.color
                        )}
                    >
                        {/* Dismiss button */}
                        <button
                            onClick={() => setIsDismissed(true)}
                            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
                        >
                            <X className="w-4 h-4 text-foreground/70" />
                        </button>

                        {/* Card indicator dots - clickable */}
                        <div className="absolute top-3 left-4 flex gap-1.5">
                            {cards.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentCardIndex(idx)}
                                    className={cn(
                                        "w-2.5 h-2.5 rounded-full transition-all hover:scale-125",
                                        idx === currentCardIndex ? "bg-black" : "bg-black/20 hover:bg-black/40"
                                    )}
                                />
                            ))}
                        </div>

                        <div className="pt-5 pr-8">
                            <div className="flex items-center gap-3 mb-3">
                                <CardIcon className="w-6 h-6 text-foreground" />
                                <p className="font-bold text-lg text-foreground">
                                    {currentCard.title}
                                </p>
                            </div>
                            <p className="text-base text-muted-foreground mb-5 line-clamp-2 leading-relaxed">
                                {currentCard.message}
                            </p>
                            <Button
                                size="default"
                                variant="ghost"
                                onClick={() => handleCardAction(currentCard)}
                                className="h-10 px-5 text-base font-semibold bg-white hover:bg-black/5 text-foreground border border-black/10 rounded-full shadow-sm"
                            >
                                {currentCard.actionText}
                            </Button>
                        </div>

                        {/* Progress bar for 20s timer */}
                        <motion.div
                            className="absolute bottom-0 left-0 h-1 bg-black/10 rounded-full"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 20, ease: "linear" }}
                            key={`progress-${currentCardIndex}`}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="w-[380px] h-[500px] bg-white border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border bg-muted">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">AI ?¥Ïãú?§ÌÑ¥??/h3>
                                    <p className="text-[10px] text-muted-foreground">Î¨¥Ïóá?¥Îì† Î¨ºÏñ¥Î≥¥ÏÑ∏??/p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsOpen(false)}
                                className="h-8 w-8 rounded-lg hover:bg-black/5"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                                        <Bot className="w-8 h-8 text-foreground" />
                                    </div>
                                    <p className="text-sm font-medium mb-1">?àÎÖï?òÏÑ∏??</p>
                                    <p className="text-xs max-w-[200px]">
                                        ?ôÏäµ, ?ºÏ†ï, Î™©Ìëú???Ä??Î¨¥Ïóá?¥Îì† Î¨ºÏñ¥Î≥¥ÏÑ∏??
                                    </p>
                                </div>
                            )}
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={cn(
                                        "flex",
                                        message.role === "user" ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div
                                        className={cn(
                                            "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                                            message.role === "user"
                                                ? "bg-primary text-white rounded-br-md"
                                                : "bg-muted border border-border rounded-bl-md"
                                        )}
                                    >
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                        {message.actions && message.actions.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {message.actions.map((action, idx) => (
                                                    <Button
                                                        key={idx}
                                                        size="sm"
                                                        onClick={() => handleChatAction(action, message.id)}
                                                        className="h-8 px-3 text-xs bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded-lg"
                                                    >
                                                        {action.type === "add_schedule" && <Calendar className="w-3 h-3 mr-1.5" />}
                                                        {action.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-muted border border-border rounded-2xl rounded-bl-md px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                            <span className="text-sm text-muted-foreground">?ùÍ∞Å Ï§?..</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-border">
                            <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-4 py-2">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Î©îÏãúÏßÄÎ•??ÖÎ†•?òÏÑ∏??.."
                                    className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                                    disabled={isLoading}
                                />
                                <Button
                                    size="icon"
                                    onClick={handleSend}
                                    disabled={!input.trim() || isLoading}
                                    className="h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50"
                                >
                                    <Send className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                    setIsOpen(!isOpen);
                }}
                className={cn(
                    "w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all",
                    isOpen
                        ? "bg-muted border border-border"
                        : "bg-foreground"
                )}
            >
                {isOpen ? (
                    <X className="w-6 h-6 text-foreground" />
                ) : (
                    <Bot className="w-6 h-6 text-white" />
                )}
            </motion.button>

            {/* Trend Briefing Detail Modal - Same as Dashboard */}
            <TrendBriefingDetail
                briefing={selectedBriefing}
                isOpen={!!selectedBriefing}
                onClose={() => setSelectedBriefing(null)}
                userLevel=""
                userJob=""
            />
        </div>
    );
}



