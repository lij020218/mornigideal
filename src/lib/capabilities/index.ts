/**
 * Capabilities Barrel
 *
 * import 시 자동으로 registerCapability() 실행.
 * 사용처: API 라우트, ReAct tool-executor, Jarvis Hands.
 */

import './smart-suggestions';
import './schedule-prep';
import './habit-insights';
import './resource-recommend';

export {
    executeCapability,
    getRegisteredCapabilities,
    type CapabilityResult,
    type SmartSuggestionsParams,
    type SmartSuggestionsResult,
    type ScheduleSuggestion,
    type SchedulePrepParams,
    type SchedulePrepResult,
    type HabitInsightsParams,
    type HabitInsightsResult,
    type ResourceRecommendParams,
    type ResourceRecommendResult,
} from '@/lib/agent-capabilities';

export { generateSmartSuggestions } from './smart-suggestions';
export { generateSchedulePrep } from './schedule-prep';
export { generateHabitInsights } from './habit-insights';
export { generateResourceRecommendation } from './resource-recommend';
