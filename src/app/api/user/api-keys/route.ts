/**
 * User API Keys Management API
 *
 * GET: 저장된 API 키 상태 조회 (마스킹된 형태)
 * POST: 새 API 키 저장
 * DELETE: API 키 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-handler';
import { logger } from '@/lib/logger';
import {
    saveUserAPIKey,
    deleteUserAPIKey,
    getUserAPIKeys,
    maskAPIKey,
    validateAPIKey,
    type AIProvider
} from '@/lib/apiKeyService';

export const GET = withAuth(async (request: NextRequest, email: string) => {
    const keys = await getUserAPIKeys(email);

    // 마스킹된 형태로 반환
    const maskedKeys: Record<string, { masked: string; hasKey: boolean }> = {};

    for (const provider of ['openai', 'anthropic', 'google'] as AIProvider[]) {
        const key = keys[provider];
        maskedKeys[provider] = {
            masked: key ? maskAPIKey(key) : '',
            hasKey: !!key
        };
    }

    return NextResponse.json({ keys: maskedKeys });
});

export const POST = withAuth(async (request: NextRequest, email: string) => {
    const { provider, key } = await request.json();

    if (!provider || !key) {
        return NextResponse.json(
            { error: 'Provider and key are required' },
            { status: 400 }
        );
    }

    if (!['openai', 'anthropic', 'google'].includes(provider)) {
        return NextResponse.json(
            { error: 'Invalid provider' },
            { status: 400 }
        );
    }

    const result = await saveUserAPIKey(email, provider as AIProvider, key);

    if (!result.success) {
        return NextResponse.json(
            { error: result.error || 'Failed to save API key' },
            { status: 400 }
        );
    }

    return NextResponse.json({
        success: true,
        masked: maskAPIKey(key)
    });
});

export const DELETE = withAuth(async (request: NextRequest, email: string) => {
    const { provider } = await request.json();

    if (!provider) {
        return NextResponse.json(
            { error: 'Provider is required' },
            { status: 400 }
        );
    }

    const result = await deleteUserAPIKey(email, provider as AIProvider);

    if (!result.success) {
        return NextResponse.json(
            { error: result.error || 'Failed to delete API key' },
            { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
});
