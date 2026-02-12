import cron from 'node-cron';

let isSchedulerInitialized = false;

export function initializeScheduler() {
    if (isSchedulerInitialized) {
        return;
    }

    // Schedule to run every day at 5:00 AM
    cron.schedule('0 5 * * *', async () => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/cron/generate-daily-news`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${process.env.CRON_SECRET || ''}`
                }
            });

            if (response.ok) {
                const result = await response.json();
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
}
