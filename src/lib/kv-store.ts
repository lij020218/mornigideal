/**
 * user_kv_store 헬퍼 유틸리티
 *
 * 반복되는 user_kv_store CRUD 패턴을 추출.
 * 테이블 구조: { user_email, key, value (JSONB), updated_at }
 * onConflict: 'user_email,key'
 */

import { supabaseAdmin } from './supabase-admin';

/**
 * KV 값 조회
 */
export async function kvGet<T = any>(email: string, key: string): Promise<T | null> {
    const { data } = await supabaseAdmin
        .from('user_kv_store')
        .select('value')
        .eq('user_email', email)
        .eq('key', key)
        .maybeSingle();

    return (data?.value as T) ?? null;
}

/**
 * KV 값 저장 (upsert)
 */
export async function kvSet(email: string, key: string, value: unknown): Promise<void> {
    await supabaseAdmin
        .from('user_kv_store')
        .upsert({
            user_email: email,
            key,
            value,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_email,key' });
}

/**
 * KV 배열에 아이템 추가 (최대 maxItems 유지)
 */
export async function kvAppend(
    email: string,
    key: string,
    item: unknown,
    maxItems: number = 500
): Promise<void> {
    const existing = await kvGet<unknown[]>(email, key);
    const arr = Array.isArray(existing) ? existing : [];
    arr.push(item);

    // 최대 개수 초과 시 오래된 항목 제거
    const trimmed = arr.length > maxItems ? arr.slice(arr.length - maxItems) : arr;

    await kvSet(email, key, trimmed);
}
