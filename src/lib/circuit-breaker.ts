/**
 * Circuit Breaker for External Service Calls
 *
 * 상태: CLOSED → OPEN → HALF_OPEN → CLOSED
 * - CLOSED: 정상 (모든 요청 통과)
 * - OPEN: 차단 (모든 요청 즉시 실패, fallback 반환)
 * - HALF_OPEN: 시험 (1개 요청만 통과, 성공 시 CLOSED)
 *
 * OpenAI API 장애 시 30초 타임아웃 × N 요청 → 연쇄 장애 방지
 */

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
    /** 연속 실패 후 OPEN 전환 임계치 */
    failureThreshold: number;
    /** OPEN → HALF_OPEN 전환까지 대기 시간 (ms) */
    resetTimeoutMs: number;
    /** 서킷 이름 (로깅용) */
    name: string;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
    name: 'default',
};

/** HALF_OPEN에서 CLOSED로 돌아가기 위해 필요한 연속 성공 수 */
const HALF_OPEN_SUCCESS_THRESHOLD = 2;

export class CircuitBreaker {
    private state: CircuitState = 'CLOSED';
    private failureCount = 0;
    private halfOpenSuccesses = 0;
    private lastFailureTime = 0;
    private options: CircuitBreakerOptions;

    constructor(options?: Partial<CircuitBreakerOptions>) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * 서킷브레이커를 통해 함수 실행
     * OPEN 상태면 즉시 CircuitOpenError throw
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            // OPEN → HALF_OPEN 전환 시도
            if (Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs) {
                this.state = 'HALF_OPEN';
                this.halfOpenSuccesses = 0;
            } else {
                throw new CircuitOpenError(
                    `[CircuitBreaker:${this.options.name}] Circuit is OPEN. Retry after ${Math.ceil((this.options.resetTimeoutMs - (Date.now() - this.lastFailureTime)) / 1000)}s`
                );
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    /**
     * fallback 포함 실행
     * OPEN 상태면 fallback 반환, 실패 시에도 fallback 반환
     */
    async executeWithFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
        try {
            return await this.execute(fn);
        } catch (error) {
            if (error instanceof CircuitOpenError) {
                console.warn(error.message);
            }
            return fallback;
        }
    }

    private onSuccess(): void {
        this.failureCount = 0;
        if (this.state === 'HALF_OPEN') {
            this.halfOpenSuccesses++;
            if (this.halfOpenSuccesses >= HALF_OPEN_SUCCESS_THRESHOLD) {
                this.state = 'CLOSED';
                this.halfOpenSuccesses = 0;
            }
        }
    }

    private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.failureCount >= this.options.failureThreshold) {
            this.state = 'OPEN';
            console.error(
                `[CircuitBreaker:${this.options.name}] Opened after ${this.failureCount} failures. Will retry in ${this.options.resetTimeoutMs / 1000}s`
            );
        }
    }

    getState(): CircuitState {
        return this.state;
    }

    /** 수동 리셋 (테스트/관리용) */
    reset(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.halfOpenSuccesses = 0;
        this.lastFailureTime = 0;
    }
}

export class CircuitOpenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CircuitOpenError';
    }
}

// =============================================
// 미리 생성된 서킷브레이커 인스턴스
// =============================================

/** OpenAI Chat Completions (LLM) 서킷 */
export const llmCircuit = new CircuitBreaker({
    name: 'openai-llm',
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
});

/** OpenAI Embeddings 서킷 */
export const embeddingCircuit = new CircuitBreaker({
    name: 'openai-embedding',
    failureThreshold: 3,
    resetTimeoutMs: 20_000,
});
