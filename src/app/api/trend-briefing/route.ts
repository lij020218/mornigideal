import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getTrendsCache, getDetailCache, generateTrendId, saveTrendsCache } from "@/lib/newsCache";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

// Premium news sources for credibility
const PREMIUM_SOURCES = [
    'bloomberg.com',
    'ft.com',
    'wsj.com',
    'economist.com',
    'bbc.com',
    'reuters.com',
    'apnews.com',
    'nytimes.com',
    'washingtonpost.com',
    'asia.nikkei.com',
    'scmp.com',
    'techcrunch.com',
    'wired.com',
    'theinformation.com'
];

// Helper to check if URL is from a premium source
function isPremiumSource(url: string): boolean {
    try {
        const urlObj = new URL(url);
        return PREMIUM_SOURCES.some(source => urlObj.hostname.includes(source));
    } catch {
        return false;
    }
}

// Robust JSON cleaner and parser with stack-based extraction
function cleanAndParseJSON(text: string): any {
    // 1. Remove markdown code blocks
    let cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // 2. Stack-based extraction to find the exact end of the JSON structure
    const firstBrace = cleanText.indexOf('{');
    const firstBracket = cleanText.indexOf('[');

    let start = -1;
    let openChar = '';
    let closeChar = '';

    // Determine if we are looking for an object or array
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
        openChar = '{';
        closeChar = '}';
    } else if (firstBracket !== -1) {
        start = firstBracket;
        openChar = '[';
        closeChar = ']';
    }

    if (start !== -1) {
        let balance = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = start; i < cleanText.length; i++) {
            const char = cleanText[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }
            if (char === '\\') {
                escapeNext = true;
                continue;
            }
            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === openChar) {
                    balance++;
                } else if (char === closeChar) {
                    balance--;
                    if (balance === 0) {
                        // Found the matching close char - extract ONLY up to this point
                        const jsonCandidate = cleanText.substring(start, i + 1);
                        return JSON.parse(jsonCandidate);
                    }
                }
            }
        }
    }

    // Fallback: try parsing the entire text as-is
    return JSON.parse(cleanText);
}

// Helper to verify and get the final URL (follows redirects)
async function verifyAndGetFinalUrl(url: string): Promise<{ isValid: boolean; finalUrl: string | null }> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        clearTimeout(timeoutId);

        const finalUrl = response.url;
        const isValid = response.status >= 200 && response.status < 400;

        return { isValid, finalUrl: isValid ? finalUrl : null };
    } catch (error) {
        return { isValid: false, finalUrl: null };
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const job = searchParams.get("job") || "Marketer";
        const forceRefresh = searchParams.get("refresh") === "true";

        let excludedTitles: string[] = [];

        // Try to get cached data first
        const cachedData = await getTrendsCache();

        if (!forceRefresh) {
            if (cachedData && cachedData.trends.length > 0) {
                console.log('[API] Returning cached trends from', cachedData.lastUpdated);
                return NextResponse.json({
                    trends: cachedData.trends,
                    cached: true,
                    lastUpdated: cachedData.lastUpdated
                });
            }
        } else {
            // If refreshing, collect existing titles to exclude to ensure NEW content
            if (cachedData && cachedData.trends) {
                excludedTitles = cachedData.trends.map((t: any) => t.title);
                console.log(`[API] Refresh requested. Excluding ${excludedTitles.length} existing trends.`);
            }
        }

        console.log('[API] Starting SEARCH-FIRST generation process...');

        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
            // @ts-expect-error - googleSearch is a valid tool
            tools: [{ googleSearch: {} }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const today = new Date().toISOString().split('T')[0];

        // Single-Step Prompt: Search AND Select
        const prompt = `
        You are a professional trend analyst for a ${job}.
        Today's date is ${today}.

        **GOAL**: Find exactly 6 REAL, VERIFIED, and RECENT news articles relevant to a ${job}.

        **INSTRUCTIONS**:
        1. **SEARCH FIRST**: Use Google Search to find the latest news (last 3 days) about AI, Tech, Marketing, Business, or Economy.
        2. **FILTER**:
           - MUST be real news events from reputable sources.
           - MUST be from the last 3 days.
           - **EXCLUDE** these titles (already seen): ${excludedTitles.join(', ')}
        3. **PRIORITIZE PREMIUM SOURCES**:
           - Try to find articles from: Bloomberg, FT, WSJ, Economist, BBC, Reuters, NYT, TechCrunch, Wired, etc.
        4. **OUTPUT**:
           - Select the best 6 unique articles.
           - For each, provide the *exact* source URL you found.

        **Return JSON Array**:
        [
          {
            "title": "Headline in Korean",
            "category": "Category (English)",
            "summary": "Short summary in Korean",
            "originalUrl": "The ACTUAL URL found in search",
            "imageUrl": "Image URL if found (og:image), else empty string"
          }
        ]
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        let candidates = [];
        try {
            candidates = cleanAndParseJSON(text);
        } catch (parseError) {
            console.error("[API] Failed to parse candidates JSON", parseError);
            return NextResponse.json({ error: "Failed to parse trends" }, { status: 500 });
        }

        if (!Array.isArray(candidates)) {
            return NextResponse.json({ error: "Invalid response format" }, { status: 500 });
        }

        console.log(`[API] Found ${candidates.length} candidates directly from search.`);

        const validTrends: any[] = [];

        // Validate URLs and Format
        for (const candidate of candidates) {
            if (validTrends.length >= 6) break;

            // Basic validation
            if (!candidate.title || !candidate.originalUrl) continue;

            // Check URL accessibility (Head request) - fast check
            const { isValid, finalUrl } = await verifyAndGetFinalUrl(candidate.originalUrl);

            if (isValid && finalUrl) {
                const isPremium = isPremiumSource(finalUrl);
                validTrends.push({
                    title: candidate.title,
                    category: candidate.category || "General",
                    summary: candidate.summary || "",
                    time: "최근",
                    imageColor: "bg-blue-500/20",
                    originalUrl: finalUrl,
                    imageUrl: candidate.imageUrl || "",
                    id: generateTrendId(candidate.title),
                    isPremium: isPremium
                });
            }
        }

        // Sort by premium status
        validTrends.sort((a, b) => {
            if (a.isPremium && !b.isPremium) return -1;
            if (!a.isPremium && b.isPremium) return 1;
            return 0;
        });

        // Final check
        if (validTrends.length === 0) {
            return NextResponse.json({ error: "Failed to find valid trends" }, { status: 500 });
        }

        // Save to cache
        await saveTrendsCache(validTrends, forceRefresh);

        return NextResponse.json({
            trends: validTrends,
            cached: false,
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error("Error fetching trends:", error);
        return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { title, level, job, originalUrl, summary, trendId } = await request.json();

        if (trendId) {
            const cachedDetail = await getDetailCache(trendId);
            if (cachedDetail) {
                return NextResponse.json({ detail: cachedDetail, cached: true });
            }
        }

        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
      당신은 ${level} 수준의 ${job}를 위한 전문 멘토입니다.
      사용자는 "${title}"라는 뉴스를 이해하고 싶어합니다.
      ${summary ? `간략 요약: ${summary}` : ''}
      ${originalUrl ? `출처: ${originalUrl}` : ''}

      필요하다면 웹 검색을 통해 이 뉴스에 대한 추가 컨텍스트를 수집하세요.

      **핵심 목표**:
      1. 이 뉴스가 **${level} ${job}인 사용자에게 어떤 의미**인지 명확히 설명
      2. 사용자의 **현재 상황과 경력 단계에 어떻게 연결**되는지 제시
      3. 이 뉴스에서 **사용자가 구체적으로 얻을 수 있는 것**이 무엇인지 명시
      4. 실용적이고 **즉시 적용 가능한 액션 아이템** 제공

      **응답 형식**:
      {
        "title": "흥미롭고 명확한 한글 제목 (18px)",
        "content": "### 핵심 내용\\n\\n[내용]\\n\\n### ${level} ${job}인 당신에게\\n\\n[내용]\\n\\n### 이 브리핑에서 얻을 수 있는 것\\n\\n- **핵심 가치 1**\\n- **핵심 가치 2**",
        "keyTakeaways": ["포인트 1", "포인트 2", "포인트 3"],
        "actionItems": ["액션 1", "액션 2", "액션 3"]
      }
      JSON만 반환하세요.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        let detail;
        try {
            detail = cleanAndParseJSON(text);
        } catch (e) {
            console.error("Failed to parse detail JSON", e);
            // Fallback to simple clean if strict fails
            const simpleClean = text.replace(/```json/g, "").replace(/```/g, "").trim();
            detail = JSON.parse(simpleClean);
        }

        return NextResponse.json({
            detail: { ...detail, originalUrl: originalUrl || "" },
            cached: false
        });
    } catch (error) {
        console.error("Error reconstructing news:", error);
        return NextResponse.json({ error: "Failed to reconstruct news" }, { status: 500 });
    }
}
