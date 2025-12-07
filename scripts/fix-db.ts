
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    console.log("Fixing daily_briefings...");

    // 1. Get User
    const { data: users, error: uError } = await supabase.from('users').select('id, name, email').limit(1);

    if (uError || !users || users.length === 0) {
        console.error("No users found.", uError);
        return;
    }

    const user = users[0];
    const dateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

    console.log(`Inserting briefing for ${user.email} (${dateStr})...`);

    const content = {
        greeting: `좋은 아침입니다, ${user.name}님!`,
        yesterday_summary: "어제는 목표를 향해 꾸준히 노력한 하루였습니다.",
        yesterday_score: 85,
        today_schedule_summary: "오늘은 3개의 주요 일정이 있습니다.",
        trend_summary: "AI 기술의 발전이 가속화되고 있습니다.",
        cheering_message: "오늘도 당신의 성장을 응원합니다!"
    };

    const { error: iError } = await supabase.from('daily_briefings').upsert({
        user_id: user.id,
        date: dateStr,
        content: content,
        is_read: false
    }, { onConflict: 'user_id, date' });

    if (iError) {
        console.error("Insert failed:", iError);
    } else {
        console.log("Insert SUCCESS!");
    }
}

fix();
