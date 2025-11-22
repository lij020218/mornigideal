import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getTrendsCache, getDetailCache, generateTrendId, saveTrendsCache } from "@/lib/newsCache";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

// Helper to verify and get the final URL (follows redirects)
async function verifyAndGetFinalUrl(url: string): Promise<{ isValid: boolean; finalUrl: string | null }> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            redirect: 'follow', // Follow redirects
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        clearTimeout(timeoutId);

        // Get the final URL after redirects
        const finalUrl = response.url;
        const isValid = response.ok;

        if (isValid) {
            console.log(`[API] URL verified: ${url} -> ${finalUrl}`);
        } else {
            console.warn(`[API] URL returned status ${response.status}: ${url}`);
        }

        return { isValid, finalUrl: isValid ? finalUrl : null };
    } catch (error) {
        console.warn(`[API] URL verification failed for ${url}:`, error);
        return { isValid: false, finalUrl: null };
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const job = searchParams.get("job") || "Marketer";
        const forceRefresh = searchParams.get("refresh") === "true";

        // Try to get cached data first
        if (!forceRefresh) {
            const cachedData = await getTrendsCache();
            if (cachedData && cachedData.trends.length > 0) {
                console.log('[API] Returning cached trends from', cachedData.lastUpdated);
                return NextResponse.json({
                    trends: cachedData.trends,
                    cached: true,
                    lastUpdated: cachedData.lastUpdated
                });
            }
        }

        // If no cache or force refresh, generate new trends
        console.log('[API] Generating fresh trends');
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
            // @ts-expect-error - googleSearch is a valid tool but types might be outdated
            tools: [{ googleSearch: {} }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const today = new Date().toISOString().split('T')[0];

        const prompt = `
      You are a trend analyst for a ${job}.
      Today's date is ${today}.

      **PREMIUM SOURCES (STRICT PRIORITY):**
      You MUST prioritize news from the following high-quality sources. 
      **At least 8 out of 10 items MUST come from these domains:**
      1. Bloomberg
      2. Financial Times (FT)
      3. The Wall Street Journal (WSJ)
      4. The Economist
      5. BBC
      6. Reuters
      7. AP News
      8. The New York Times (NYT)
      9. The Washington Post (WP)
      10. Nikkei Asia
      11. South China Morning Post (SCMP)
      12. TechCrunch
      13. Wired
      14. The Information

      **TASK:**
      1. Use the 'googleSearch' tool to find **15-20** current, hot trending news items relevant to a ${job}.
      2. **CRITICAL:** Search specifically for these premium sources (e.g., "site:bloomberg.com OR site:ft.com ...").
      3. **ANTI-HALLUCINATION RULES (EXTREMELY IMPORTANT):**
         - **NEVER** modify, shorten, or rewrite the URL in ANY way.
         - **COPY** the complete originalUrl EXACTLY as it appears in the search result - every single character.
         - The URL must be the FULL, COMPLETE link including all query parameters and ID codes.
         - Example CORRECT: "https://apnews.com/article/jobs-unemployment-economy-trump-tariff-bf603d63e13d6dc1083e9a6616c7ffee"
         - Example WRONG: "https://apnews.com/article/jobs-report-september-unemployment-economy-inflation-fed-7a3c4b1b" (DO NOT DO THIS)
         - If the search gives you "https://example.com/article/very-long-id-12345-abcdef", return EXACTLY that.
         - If you cannot find or copy the exact complete URL, skip that article entirely.
         - Double-check: Does your URL contain the complete unique article identifier from the search result?
      4. Focus on news from the past 1-3 days.

      For each item, provide:
      - category: Short English category (e.g., "Marketing", "AI", "Tech").
      - title: Catchy Korean headline.
      - time: Relative time (e.g., "2시간 전").
      - imageColor: Tailwind CSS background color class (e.g., "bg-blue-500/20").
      - originalUrl: **THE EXACT URL** from the search result. Must start with http:// or https://.
      - imageUrl: **CRITICAL:** Try to find the actual image URL from the search result snippet or metadata (often og:image). If you absolutely cannot find a real image URL, leave this empty string "". DO NOT make up an image URL.
      - summary: 1-2 sentence Korean summary.

      Return ONLY a valid JSON array of objects.
      Example:
      [
        { "category": "AI", "title": "...", "time": "...", "imageColor": "...", "originalUrl": "https://actual-news-site.com/article", "imageUrl": "...", "summary": "..." }
      ]
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('[API] Raw response length:', text.length);

        // More robust JSON extraction
        let cleanedText = text.trim();

        // Remove markdown code blocks
        cleanedText = cleanedText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        // Try to find JSON array in the text
        const arrayMatch = cleanedText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            cleanedText = arrayMatch[0];
        }

        // Additional cleanup: remove any trailing non-JSON content
        // Find the last ] and cut everything after it
        const lastBracketIndex = cleanedText.lastIndexOf(']');
        if (lastBracketIndex !== -1 && lastBracketIndex < cleanedText.length - 1) {
            cleanedText = cleanedText.substring(0, lastBracketIndex + 1);
        }

        console.log('[API] Cleaned text length:', cleanedText.length);

        let allTrends;
        try {
            allTrends = JSON.parse(cleanedText);
        } catch (parseError: any) {
            console.error('[API] JSON Parse Error:', parseError);
            console.error('[API] Failed text (first 500 chars):', cleanedText.substring(0, 500));
            console.error('[API] Failed text (last 500 chars):', cleanedText.substring(cleanedText.length - 500));

            // Try to salvage partial JSON by finding valid array portion
            try {
                // Find the outermost array brackets and try parsing that
                const firstBracket = cleanedText.indexOf('[');
                const lastValidBracket = cleanedText.lastIndexOf(']');
                if (firstBracket !== -1 && lastValidBracket !== -1) {
                    const salvaged = cleanedText.substring(firstBracket, lastValidBracket + 1);
                    allTrends = JSON.parse(salvaged);
                    console.log('[API] Successfully salvaged partial JSON');
                } else {
                    throw parseError;
                }
            } catch (salvageError) {
                throw new Error(`Failed to parse JSON: ${parseError.message}`);
            }
        }

        if (!Array.isArray(allTrends)) {
            throw new Error('Response is not an array');
        }

        console.log(`[API] Generated ${allTrends.length} trends. Verifying URLs and following redirects...`);

        // Verify URLs and get final URLs after redirects
        const verificationPromises = allTrends.map(async (trend: any) => {
            if (!trend.originalUrl || !trend.originalUrl.startsWith('http')) {
                console.log(`[API] Dropping trend with invalid URL format: ${trend.originalUrl}`);
                return null;
            }

            // Verify URL and follow redirects to get the final URL
            const { isValid, finalUrl } = await verifyAndGetFinalUrl(trend.originalUrl);

            if (!isValid || !finalUrl) {
                console.log(`[API] Dropping unreachable URL: ${trend.originalUrl}`);
                return null;
            }

            // Return trend with the final URL (after redirects)
            return {
                ...trend,
                originalUrl: finalUrl // Use the final URL after redirects
            };
        });

        const results = await Promise.all(verificationPromises);
        const validTrends = results.filter((trend: any) => trend !== null).slice(0, 6);

        console.log(`[API] Retained ${validTrends.length} valid trends after verification.`);

        // Add IDs to trends
        const trendsWithIds = validTrends.map((trend: any) => ({
            ...trend,
            id: generateTrendId(trend.title)
        }));

        // Save to cache
        await saveTrendsCache(trendsWithIds);

        return NextResponse.json({
            trends: trendsWithIds,
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

        // Try to get cached detail first
        if (trendId) {
            const cachedDetail = await getDetailCache(trendId);
            if (cachedDetail) {
                console.log('[API] Returning cached detail for:', title);
                return NextResponse.json({
                    detail: cachedDetail,
                    cached: true
                });
            }
        }

        // If no cache, generate new detail
        console.log('[API] Generating fresh detail for:', title);
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
            generationConfig: {
                responseMimeType: "application/json"
            }
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

      **텍스트 크기 및 양식 규칙 (매우 중요)**:
      - 제목: 18px, 굵게 (# 사용)
      - 섹션 제목: 16px, 굵게 (## 사용)
      - 본문: 14px, 보통 (일반 텍스트)
      - 핵심 키워드: **굵게** 표시
      - 단락 간 충분한 공백 (각 섹션 사이에 빈 줄)
      - 길이: 본문 4-6개 단락 (너무 짧지도, 길지도 않게)

      **필수 구성**:

      ### 1. 핵심 내용 (2-3 단락)
      - 이 뉴스가 무엇인지 명확하고 이해하기 쉽게 설명
      - ${level} ${job}도 쉽게 이해할 수 있는 언어 사용
      - 기술적 용어는 간단히 풀어 설명

      ### 2. 나의 상황과의 연결 (2-3 단락)
      - "${level} ${job}인 당신에게 이 뉴스는..."로 시작
      - 사용자의 경력 단계에 맞춰 연결점 제시
      - 왜 이 뉴스에 주목해야 하는지 구체적으로 설명
      - 예: "3년차 마케터인 당신은 이 트렌드를 활용하여 다음 캠페인에서 ROI를 높일 수 있습니다"

      ### 3. 얻을 수 있는 가치
      - "이 브리핑에서 얻을 수 있는 것:"이라는 소제목 사용
      - 지식, 스킬, 인사이트, 기회 등 구체적으로 명시
      - 3-4개 bullet point로 정리

      **응답 형식**:
      {
        "title": "흥미롭고 명확한 한글 제목 (18px)",
        "content": "### 핵심 내용\n\n[2-3 단락]\n\n### ${level} ${job}인 당신에게\n\n[사용자 상황과의 연결 2-3 단락]\n\n### 이 브리핑에서 얻을 수 있는 것\n\n- **핵심 가치 1**\n- **핵심 가치 2**\n- **핵심 가치 3**",
        "keyTakeaways": [
          "${job} 관점에서의 핵심 포인트 1",
          "${job} 관점에서의 핵심 포인트 2",
          "${job} 관점에서의 핵심 포인트 3"
        ],
        "actionItems": [
          "${level} ${job}가 즉시 시도할 수 있는 액션 1",
          "${level} ${job}가 즉시 시도할 수 있는 액션 2",
          "${level} ${job}가 즉시 시도할 수 있는 액션 3"
        ]
      }

      **중요**: 
      - 모든 텍스트는 한글로 작성
      - 매 브리핑마다 **동일한 구조와 텍스트 크기** 유지
      - Markdown formatting 사용 (##, **, bullet points)
      - 사용자에게 직접 말하는 톤 ("당신", "귀하" 사용)
      JSON만 반환하세요.
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const detail = JSON.parse(cleanedText);

        return NextResponse.json({
            detail: {
                ...detail,
                originalUrl: originalUrl || ""
            },
            cached: false
        });
    } catch (error) {
        console.error("Error reconstructing news:", error);
        return NextResponse.json({ error: "Failed to reconstruct news" }, { status: 500 });
    }
}
