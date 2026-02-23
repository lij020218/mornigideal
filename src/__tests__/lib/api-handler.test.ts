/**
 * Tests for api-handler.ts (withAuth HOF)
 *
 * Verifies the auth wrapper returns proper status codes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withAuth } from '@/lib/api-handler';
import { NextRequest, NextResponse } from 'next/server';

// Mock auth-utils to control authentication outcome
vi.mock('@/lib/auth-utils', () => ({
    getUserEmailWithAuth: vi.fn(),
    getJwtSecret: () => 'test-secret',
    verifyToken: vi.fn(),
    signToken: vi.fn(),
}));

import { getUserEmailWithAuth } from '@/lib/auth-utils';

const mockGetUserEmail = vi.mocked(getUserEmailWithAuth);

function createMockRequest(url = 'http://localhost/api/test'): NextRequest {
    return new NextRequest(new URL(url));
}

describe('withAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calls handler with email when authenticated', async () => {
        mockGetUserEmail.mockResolvedValue('user@test.com');

        const handler = vi.fn().mockResolvedValue(
            NextResponse.json({ ok: true })
        );

        const wrapped = withAuth(handler);
        const response = await wrapped(createMockRequest());

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][1]).toBe('user@test.com');
        expect(response.status).toBe(200);
    });

    it('returns 401 when not authenticated', async () => {
        mockGetUserEmail.mockResolvedValue(null);

        const handler = vi.fn();
        const wrapped = withAuth(handler);
        const response = await wrapped(createMockRequest());

        expect(handler).not.toHaveBeenCalled();
        expect(response.status).toBe(401);

        const body = await response.json();
        expect(body.error).toBe('Unauthorized');
    });

    it('returns 500 when handler throws', async () => {
        mockGetUserEmail.mockResolvedValue('user@test.com');

        const handler = vi.fn().mockRejectedValue(new Error('boom'));
        const wrapped = withAuth(handler);
        const response = await wrapped(createMockRequest());

        expect(response.status).toBe(500);

        const body = await response.json();
        expect(body.error).toBe('Internal server error');
    });

    it('returns 500 when auth check throws', async () => {
        mockGetUserEmail.mockRejectedValue(new Error('auth failed'));

        const handler = vi.fn();
        const wrapped = withAuth(handler);
        const response = await wrapped(createMockRequest());

        expect(handler).not.toHaveBeenCalled();
        expect(response.status).toBe(500);
    });
});
