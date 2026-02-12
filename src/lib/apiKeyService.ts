/**
 * BYOK (Bring Your Own Key) Service
 *
 * 사용자가 자신의 API 키를 사용할 수 있도록 지원
 * - 암호화 저장
 * - 키 검증
 * - 사용량 추적
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

// 암호화 키 (환경 변수에서 가져오거나 기본값 사용)
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || 'fieri-default-encryption-key-2024';

export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface UserAPIKeys {
    openai?: string;
    anthropic?: string;
    google?: string;
}

export interface APIKeyStatus {
    provider: AIProvider;
    isValid: boolean;
    lastChecked: Date;
    errorMessage?: string;
}

// 암호화용 키를 32바이트로 정규화
function deriveKey(password: string): Buffer {
    return crypto.createHash('sha256').update(password).digest();
}

// API 키 암호화
function encryptKey(key: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', deriveKey(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(key, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return iv.toString('base64') + ':' + encrypted;
}

// API 키 복호화
function decryptKey(encryptedKey: string): string {
    const [ivBase64, encrypted] = encryptedKey.split(':');
    const iv = Buffer.from(ivBase64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', deriveKey(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// API 키 마스킹 (표시용)
export function maskAPIKey(key: string): string {
    if (!key || key.length < 8) return '********';
    return key.slice(0, 4) + '****' + key.slice(-4);
}

/**
 * API 키 유효성 검증
 */
export async function validateAPIKey(provider: AIProvider, key: string): Promise<APIKeyStatus> {
    try {
        switch (provider) {
            case 'openai':
                // OpenAI API 테스트
                const openaiRes = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${key}` }
                });
                return {
                    provider,
                    isValid: openaiRes.ok,
                    lastChecked: new Date(),
                    errorMessage: openaiRes.ok ? undefined : 'Invalid API key'
                };

            case 'anthropic':
                // Anthropic API 테스트 (간단한 요청)
                const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': key,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-haiku-20240307',
                        max_tokens: 1,
                        messages: [{ role: 'user', content: 'Hi' }]
                    })
                });
                // 401/403은 잘못된 키, 다른 에러는 키는 유효
                const isAnthropicValid = anthropicRes.ok || (anthropicRes.status !== 401 && anthropicRes.status !== 403);
                return {
                    provider,
                    isValid: isAnthropicValid,
                    lastChecked: new Date(),
                    errorMessage: isAnthropicValid ? undefined : 'Invalid API key'
                };

            case 'google':
                // Google AI API 테스트
                const googleRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1/models?key=${key}`
                );
                return {
                    provider,
                    isValid: googleRes.ok,
                    lastChecked: new Date(),
                    errorMessage: googleRes.ok ? undefined : 'Invalid API key'
                };

            default:
                return {
                    provider,
                    isValid: false,
                    lastChecked: new Date(),
                    errorMessage: 'Unknown provider'
                };
        }
    } catch (error: any) {
        return {
            provider,
            isValid: false,
            lastChecked: new Date(),
            errorMessage: error.message || 'Validation failed'
        };
    }
}

/**
 * 사용자 API 키 저장
 */
export async function saveUserAPIKey(
    userEmail: string,
    provider: AIProvider,
    key: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // 먼저 키 유효성 검증
        const validation = await validateAPIKey(provider, key);
        if (!validation.isValid) {
            return { success: false, error: validation.errorMessage || 'Invalid API key' };
        }

        // 암호화
        const encryptedKey = encryptKey(key);

        // 기존 키 가져오기
        const { data: existing } = await supabaseAdmin
            .from('user_api_keys')
            .select('keys')
            .eq('user_email', userEmail)
            .maybeSingle();

        const currentKeys = existing?.keys || {};
        currentKeys[provider] = encryptedKey;

        // 저장
        await supabaseAdmin
            .from('user_api_keys')
            .upsert({
                user_email: userEmail,
                keys: currentKeys,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_email' });

        return { success: true };
    } catch (error: any) {
        console.error('[APIKeyService] Failed to save key:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 사용자 API 키 삭제
 */
export async function deleteUserAPIKey(
    userEmail: string,
    provider: AIProvider
): Promise<{ success: boolean; error?: string }> {
    try {
        const { data: existing } = await supabaseAdmin
            .from('user_api_keys')
            .select('keys')
            .eq('user_email', userEmail)
            .maybeSingle();

        if (!existing?.keys) {
            return { success: true };
        }

        const currentKeys = existing.keys;
        delete currentKeys[provider];

        await supabaseAdmin
            .from('user_api_keys')
            .update({
                keys: currentKeys,
                updated_at: new Date().toISOString()
            })
            .eq('user_email', userEmail);

        return { success: true };
    } catch (error: any) {
        console.error('[APIKeyService] Failed to delete key:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 사용자 API 키 가져오기 (복호화)
 */
export async function getUserAPIKeys(userEmail: string): Promise<UserAPIKeys> {
    try {
        const { data } = await supabaseAdmin
            .from('user_api_keys')
            .select('keys')
            .eq('user_email', userEmail)
            .maybeSingle();

        if (!data?.keys) {
            return {};
        }

        const decryptedKeys: UserAPIKeys = {};

        for (const [provider, encryptedKey] of Object.entries(data.keys)) {
            if (encryptedKey) {
                try {
                    decryptedKeys[provider as AIProvider] = decryptKey(encryptedKey as string);
                } catch (e) {
                    console.error(`[APIKeyService] Failed to decrypt ${provider} key`);
                }
            }
        }

        return decryptedKeys;
    } catch (error) {
        console.error('[APIKeyService] Failed to get keys:', error);
        return {};
    }
}

/**
 * 사용자가 BYOK 모드인지 확인
 */
export async function isUserBYOK(userEmail: string): Promise<boolean> {
    const keys = await getUserAPIKeys(userEmail);
    return Object.keys(keys).length > 0;
}

/**
 * 사용자의 사용 가능한 제공자 목록
 */
export async function getAvailableProviders(userEmail: string): Promise<AIProvider[]> {
    const keys = await getUserAPIKeys(userEmail);
    return Object.keys(keys) as AIProvider[];
}
