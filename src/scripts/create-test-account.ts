/**
 * Google Play 심사용 테스트 계정 생성 스크립트
 *
 * 실행: npx tsx src/scripts/create-test-account.ts
 */

import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_EMAIL = 'review@fieri.app';
const TEST_PASSWORD = 'FieriReview2026!';
const TEST_NAME = 'Play Review';

async function main() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('환경변수 필요: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
        console.error('.env.local 파일을 로드하려면: npx dotenv -e .env.local -- npx tsx src/scripts/create-test-account.ts');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 기존 계정 확인
    const { data: existing } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', TEST_EMAIL)
        .maybeSingle();

    if (existing) {
        console.log(`이미 존재하는 계정: ${TEST_EMAIL} (id: ${existing.id})`);
        console.log('비밀번호를 재설정합니다...');

        const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);
        const { error } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('email', TEST_EMAIL);

        if (error) {
            console.error('비밀번호 업데이트 실패:', error);
            process.exit(1);
        }

        console.log('비밀번호 재설정 완료!');
    } else {
        // 신규 생성
        const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12);

        const { data: user, error } = await supabase
            .from('users')
            .insert({
                email: TEST_EMAIL,
                name: TEST_NAME,
                username: 'playreview',
                password: hashedPassword,
            })
            .select('id, email, name')
            .single();

        if (error) {
            console.error('계정 생성 실패:', error);
            process.exit(1);
        }

        console.log('테스트 계정 생성 완료:', user);
    }

    // 프로필 + 샘플 일정 설정 (심사관이 기능을 볼 수 있도록)
    const today = new Date().toISOString().slice(0, 10);
    const profile = {
        job: 'Software Developer',
        interests: ['개발', 'AI', '생산성'],
        wakeUpTime: '08:00',
        sleepTime: '23:00',
        customGoals: [
            { id: 'review-1', text: '팀 미팅', time: 'morning', startTime: '10:00', endTime: '11:00', specificDate: today, completed: false },
            { id: 'review-2', text: '점심 운동', time: 'afternoon', startTime: '12:30', endTime: '13:30', specificDate: today, completed: false },
            { id: 'review-3', text: '프로젝트 리뷰', time: 'afternoon', startTime: '15:00', endTime: '16:00', specificDate: today, completed: false },
        ],
    };

    const { error: profileError } = await supabase
        .from('users')
        .update({ profile })
        .eq('email', TEST_EMAIL);

    if (profileError) {
        console.warn('프로필 업데이트 실패 (무시 가능):', profileError.message);
    } else {
        console.log('프로필 + 샘플 일정 설정 완료');
    }

    console.log('\n========================================');
    console.log('Google Play 심사용 테스트 계정');
    console.log('========================================');
    console.log(`이메일:   ${TEST_EMAIL}`);
    console.log(`비밀번호: ${TEST_PASSWORD}`);
    console.log(`이름:     ${TEST_NAME}`);
    console.log('========================================');
}

main().catch(console.error);
