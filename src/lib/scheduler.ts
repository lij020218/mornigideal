import cron from 'node-cron';

let isSchedulerInitialized = false;

export function initializeScheduler() {
    if (isSchedulerInitialized) {
        return;
    }

    // Schedule to run every day at 5:00 AM — generate trend briefings
    cron.schedule('0 5 * * *', async () => {
        try {
            console.log('[Scheduler] Running daily trend briefing generation at 5:00 AM');
            const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/cron/generate-trend-briefings`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                console.log('[Scheduler] Trend briefings generated successfully');
            } else {
                console.error('[Scheduler] Trend briefing generation failed:', response.status);
            }
        } catch (error) {
            console.error('[Scheduler] Error calling trend briefing generation:', error);
        }
    }, {
        timezone: "Asia/Seoul"
    });

    isSchedulerInitialized = true;
}
