/**
 * Tests for auth-utils.ts
 *
 * Tests JWT token creation, verification, and request parsing.
 * Supabase is mocked — only pure JWT logic is tested.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { signToken, verifyToken, getJwtSecret } from '@/lib/auth-utils';

describe('getJwtSecret', () => {
    it('returns the JWT secret from env', () => {
        const secret = getJwtSecret();
        expect(secret).toBe('test-jwt-secret-for-vitest');
    });
});

describe('signToken + verifyToken', () => {
    let token: string;

    beforeAll(() => {
        token = signToken({ userId: 'user-123', email: 'test@example.com' });
    });

    it('creates a valid JWT string', () => {
        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('verifies and decodes the token correctly', () => {
        const decoded = verifyToken(token);
        expect(decoded).not.toBeNull();
        expect(decoded?.userId).toBe('user-123');
        expect(decoded?.email).toBe('test@example.com');
    });

    it('returns null for invalid token', () => {
        expect(verifyToken('invalid.token.here')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(verifyToken('')).toBeNull();
    });

    it('returns null for tampered token', () => {
        const tampered = token.slice(0, -5) + 'XXXXX';
        expect(verifyToken(tampered)).toBeNull();
    });

    it('respects custom expiry', () => {
        const shortToken = signToken({ userId: 'u', email: 'e@e.com' }, '1ms');
        // Wait a tiny bit and verify it's expired
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                expect(verifyToken(shortToken)).toBeNull();
                resolve();
            }, 50);
        });
    });
});
