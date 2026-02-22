/**
 * Shared Context Pool
 *
 * 동일 요청 수명 동안 generateUserContext(), detectDailyState() 등의
 * 중복 호출을 방지하는 30초 TTL 메모이제이션 캐시.
 *
 * Race condition 방지: 동일 키에 대한 동시 호출 시 진행 중인 promise를 재사용.
 */

interface CacheEntry<T> {
    data: T;
    createdAt: number;
}

const contextPool = new Map<string, CacheEntry<unknown>>();
const inflightRequests = new Map<string, Promise<unknown>>();
const DEFAULT_TTL_MS = 30_000; // 30초 — 단일 요청 수명 커버

function getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
    // 1. 캐시 히트
    const existing = contextPool.get(key);
    if (existing && Date.now() - existing.createdAt < ttlMs) {
        return Promise.resolve(existing.data as T);
    }

    // 2. 이미 진행 중인 요청이 있으면 재사용 (race condition 방지)
    const inflight = inflightRequests.get(key);
    if (inflight) {
        return inflight as Promise<T>;
    }

    // 3. 새 요청 시작 — promise를 즉시 등록
    const promise = fetcher()
        .then(data => {
            contextPool.set(key, { data, createdAt: Date.now() });
            return data;
        })
        .finally(() => {
            inflightRequests.delete(key);
        });

    inflightRequests.set(key, promise);
    return promise;
}

// 60초 주기 stale 정리
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of contextPool) {
            if (now - entry.createdAt > 60_000) {
                contextPool.delete(key);
            }
        }
    }, 60_000);
}

// === Public API ===

export function getSharedUserContext(email: string): Promise<unknown> {
    return getOrSet(`userContext:${email}`, async () => {
        const { generateUserContext } = await import('./user-context-service');
        return generateUserContext(email);
    });
}

export function getSharedDailyState(email: string): Promise<unknown> {
    return getOrSet(`dailyState:${email}`, async () => {
        const { detectDailyState } = await import('./stress-detector');
        return detectDailyState(email);
    });
}

export function getSharedWorkRestBalance(email: string): Promise<unknown> {
    return getOrSet(`workRest:${email}`, async () => {
        const { analyzeWorkRestBalance } = await import('./work-rest-analyzer');
        return analyzeWorkRestBalance(email);
    });
}

/**
 * 뮤테이션 후 사용자 컨텍스트 무효화
 */
export function invalidateUserContext(email: string): void {
    for (const key of contextPool.keys()) {
        if (key.endsWith(`:${email}`)) {
            contextPool.delete(key);
        }
    }
    // inflight도 무효화 (진행 중 요청 결과가 stale할 수 있음)
    for (const key of inflightRequests.keys()) {
        if (key.endsWith(`:${email}`)) {
            inflightRequests.delete(key);
        }
    }
}
