import cron from 'node-cron';

let isSchedulerInitialized = false;

export function initializeScheduler() {
    if (isSchedulerInitialized) {
        console.log('[Scheduler] Already initialized, skipping...');
        return;
    }

    // Schedule to run every day at 5:00 AM
    cron.schedule('0 5 * * *', async () => {
        console.log('[Scheduler] Running daily news generation at 5:00 AM');
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/cron/generate-daily-news`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                console.log('[Scheduler] Daily news generation completed:', result);
            } else {
                console.error('[Scheduler] Daily news generation failed:', await response.text());
            }
        } catch (error) {
            console.error('[Scheduler] Error calling daily news generation:', error);
        }
    }, {
        timezone: "Asia/Seoul" // Korean timezone
    });

    isSchedulerInitialized = true;
    console.log('[Scheduler] Initialized - Daily news will be generated at 5:00 AM KST');
}
