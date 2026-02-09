import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================
// CORS 화이트리스트
// ============================================

const ALLOWED_ORIGINS = [
    process.env.NEXT_PUBLIC_BASE_URL,
    'http://localhost:3000',
    'http://localhost:3001',
].filter(Boolean) as string[];

function getOriginIfAllowed(request: NextRequest): string | null {
    const origin = request.headers.get('origin');
    if (!origin) return null;
    return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

// ============================================
// 인메모리 레이트 리미터 (Edge 호환)
// ============================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
    auth: { max: 10, windowMs: 60_000 },
    default: { max: 60, windowMs: 60_000 },
};

// 주기적 정리 (메모리 누수 방지)
let lastCleanup = Date.now();
function cleanupStaleEntries() {
    const now = Date.now();
    if (now - lastCleanup < 60_000) return;
    lastCleanup = now;
    for (const [key, entry] of rateLimitMap) {
        if (now > entry.resetAt) rateLimitMap.delete(key);
    }
}

function checkRateLimit(ip: string, path: string): { allowed: boolean; remaining: number } {
    cleanupStaleEntries();

    const isAuth = path.startsWith('/api/auth');
    const limit = isAuth ? RATE_LIMITS.auth : RATE_LIMITS.default;
    const key = `${ip}:${isAuth ? 'auth' : 'default'}`;

    const now = Date.now();
    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + limit.windowMs });
        return { allowed: true, remaining: limit.max - 1 };
    }

    entry.count++;
    if (entry.count > limit.max) {
        return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: limit.max - entry.count };
}

// ============================================
// 보안 헤더
// ============================================

function setSecurityHeaders(response: NextResponse) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
}

function setCorsHeaders(response: NextResponse, origin: string | null) {
    if (origin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
}

// ============================================
// 웹사이트 공개 페이지 (나머지는 앱 전용)
// ============================================

const PUBLIC_PAGES = ['/', '/landing', '/login', '/signup', '/reset', '/privacy', '/terms'];

function isPublicPage(path: string): boolean {
    return PUBLIC_PAGES.includes(path);
}

// ============================================
// Middleware
// ============================================

export function middleware(request: NextRequest) {
    const origin = getOriginIfAllowed(request);
    const path = request.nextUrl.pathname;

    // 앱 기능 페이지 접근 시 랜딩으로 리다이렉트
    if (!path.startsWith('/api') && !path.startsWith('/_next') && !isPublicPage(path)) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // /landing 접근 시 루트로 리다이렉트 (루트가 랜딩 페이지)
    if (path === '/landing') {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // Preflight 요청
    if (request.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 200 });
        setCorsHeaders(response, origin);
        if (origin) {
            response.headers.set('Access-Control-Max-Age', '86400');
        }
        setSecurityHeaders(response);
        return response;
    }

    // API 요청에만 레이트 리미팅 적용
    if (path.startsWith('/api')) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';

        const { allowed, remaining } = checkRateLimit(ip, path);

        if (!allowed) {
            const response = NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429 }
            );
            setCorsHeaders(response, origin);
            setSecurityHeaders(response);
            response.headers.set('Retry-After', '60');
            return response;
        }

        const response = NextResponse.next();
        setCorsHeaders(response, origin);
        setSecurityHeaders(response);
        response.headers.set('X-RateLimit-Remaining', String(remaining));
        return response;
    }

    // 공개 페이지 요청
    const response = NextResponse.next();
    setSecurityHeaders(response);
    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)'],
};
