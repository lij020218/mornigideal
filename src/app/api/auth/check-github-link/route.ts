/**
 * GitHub 연동 상태 확인 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-handler';
import { isGitHubLinked } from '@/lib/githubService';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const linked = await isGitHubLinked(email);

    let username: string | null = null;
    if (linked) {
        const { data } = await supabaseAdmin
            .from('github_tokens')
            .select('github_username')
            .eq('user_email', email)
            .maybeSingle();
        username = data?.github_username || null;
    }

    return NextResponse.json({ linked, username });
});
