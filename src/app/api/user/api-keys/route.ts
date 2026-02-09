/**
 * User API Keys Management API
 *
 * GET: 저장된 API 키 상태 조회 (마스킹된 형태)
 * POST: 새 API 키 저장
 * DELETE: API 키 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserEmailWithAuth } from '@/lib/auth-utils';
import {
    saveUserAPIKey,
    deleteUserAPIKey,
    getUserAPIKeys,
    maskAPIKey,
    validateAPIKey,
    type AIProvider
} from '@/lib/apiKeyService';

export async function GET(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
    } catch (error: any) {
        console.error('[API Keys API] GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
    } catch (error: any) {
        console.error('[API Keys API] POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
    } catch (error: any) {
        console.error('[API Keys API] DELETE Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
