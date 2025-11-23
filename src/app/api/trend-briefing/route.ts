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

// Helper to verify if a news item is REAL and RECENT using a dedicated search check
async function verifyTrendAuthenticity(title: string, category: string, preferPremium: boolean = true): Promise<{ isReal: boolean; url: string; imageUrl: string; isPremium: boolean }> {
    try {
        console.log(`[API] Verifying authenticity of: "${title}"`);

        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
            // @ts-expect-error - googleSearch is a valid tool
            tools: [{ googleSearch: {} }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const premiumSourcesHint = preferPremium ? `
        **PREFERRED SOURCES (PRIORITY):**
        Bloomberg, Financial Times, WSJ, The Economist, BBC, Reuters, AP News,
        NYT, Washington Post, Nikkei Asia, SCMP, TechCrunch, Wired, The Information

        Try to find the article from these sources FIRST.
        ` : '';

        const verificationPrompt = `
        ACT AS A STRICT FACT-CHECKER.

        Target News: "${title}" (Category: ${category})
        Current Date: ${new Date().toISOString().split('T')[0]}

        TASK:
        1. Search Google specifically for this news topic.
        2. **CRITICAL**: Verify if this specific news event ACTUALLY HAPPENED within the last 7 days.
        3. **REJECT** if:
           - It is a rumor, prediction, or "leaked" info that hasn't been officially confirmed.
           - It is an old story (older than 7 days) being recycled.
           - The search results do not explicitly confirm the *exact* event described in the title.
           - It is a general "how-to" or "guide" article, not a news event.
        4. If verified as REAL and RECENT, find the BEST, most authoritative source URL.
        ${premiumSourcesHint}

        Return JSON:
        {
            "isReal": boolean, // true ONLY if confirmed real, recent, and specific
            "verifiedUrl": "string", // The actual URL found during verification
            "verifiedImageUrl": "string", // Image URL if found, else empty
            "reason": "string" // specific reason for acceptance or rejection
        }
        `;

        const result = await model.generateContent(verificationPrompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(text);

        if (data.isReal && data.verifiedUrl) {
            const isPremium = isPremiumSource(data.verifiedUrl);
            const sourceType = isPremium ? '🌟 PREMIUM' : 'Standard';
            console.log(`[API] ✅ Verified ${sourceType}: ${title} (${data.reason})`);
            return {
                isReal: true,
                url: data.verifiedUrl,
                imageUrl: data.verifiedImageUrl || "",
                isPremium
            };
        } else {
            console.warn(`[API] ❌ Rejected: ${title} (${data.reason})`);
            return { isReal: false, url: "", imageUrl: "", isPremium: false };
        }

    } catch (error) {
        console.error(`[API] Verification failed for "${title}":`, error);
        return { isReal: false, url: "", imageUrl: "", isPremium: false };
    }
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

        console.log('[API] Starting STRICT generation process...');

        let validTrends: any[] = [];
        let retryCount = 0;
        const maxRetries = 4; // Increased retries for stricter verification

        while (validTrends.length < 6 && retryCount <= maxRetries) {
            const needed = 6 - validTrends.length;
            console.log(`[API] Loop ${retryCount + 1}: Need ${needed} more verified trends.`);

            try {
                const model = genAI.getGenerativeModel({
                    model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
                    // @ts-expect-error - googleSearch is a valid tool
                    tools: [{ googleSearch: {} }],
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                });

                const today = new Date().toISOString().split('T')[0];

                // Ask for more candidates than needed to account for rejection
                const candidatesNeeded = needed * 3 + 2;

                const prompt = `
              You are a trend analyst for a ${job}.
              Today's date is ${today}.

              **TASK:**
              Find **${candidatesNeeded}** POTENTIAL trending news headlines relevant to a ${job}.
              
              **CRITERIA:**
              1. MUST be from the last 3 days.
              2. MUST be real news events, not general advice or "how-to" guides.
              3. Focus on: AI, Tech, Marketing, Business, Economy.
              ${excludedTitles.length > 0 ? `
              **EXCLUSIONS (DO NOT INCLUDE):**
              The user has already seen these. Find DIFFERENT news:
              ${excludedTitles.map(t => `- ${t}`).join('\n')}
              ` : ''}
              
              Return a JSON array of objects:
              [
                { 
                  "title": "Headline in Korean", 
                  "category": "Category (English)",
                  "summary": "Short summary in Korean",
                  "searchQuery": "English search query to find this news" 
                }
              ]
            `;

                const result = await model.generateContent(prompt);
                const response = await result.response;
                let text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();

                // Find JSON array in the text
                const arrayMatch = text.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                    text = arrayMatch[0];
                }

                // Remove any trailing non-JSON content
                const lastBracketIndex = text.lastIndexOf(']');
                if (lastBracketIndex !== -1 && lastBracketIndex < text.length - 1) {
                    text = text.substring(0, lastBracketIndex + 1);
                }

                let candidates = [];
                try {
                    candidates = JSON.parse(text);
                } catch (parseError: any) {
                    console.error("[API] Failed to parse candidates JSON", parseError);

                    // Try to salvage partial JSON
                    try {
                        const firstBracket = text.indexOf('[');
                        if (firstBracket === -1) {
                            continue;
                        }

                        let braceCount = 0;
                        let currentObject = '';
                        let inString = false;
                        let escapeNext = false;
                        const validObjects: string[] = [];

                        for (let i = firstBracket + 1; i < text.length; i++) {
                            const char = text[i];

                            if (char === '"' && !escapeNext) inString = !inString;
                            escapeNext = char === '\\' && !escapeNext;

                            if (!inString) {
                                if (char === '{') braceCount++;
                                if (char === '}') braceCount--;
                            }

                            currentObject += char;

                            if (braceCount === 0 && currentObject.trim().endsWith('}')) {
                                try {
                                    const testObj = JSON.parse(currentObject.trim().replace(/,\s*$/, ''));
                                    validObjects.push(currentObject.trim().replace(/,\s*$/, ''));
                                    currentObject = '';
                                } catch (e) {
                                    currentObject = '';
                                }
                            }
                        }

                        if (validObjects.length > 0) {
                            const validJson = '[' + validObjects.join(',') + ']';
                            candidates = JSON.parse(validJson);
                            console.log(`[API] Salvaged ${candidates.length} candidates from partial JSON`);
                        } else {
                            continue;
                        }
                    } catch (salvageError) {
                        console.error("[API] Salvage attempt failed");
                        continue;
                    }
                }

                if (!Array.isArray(candidates)) continue;

                console.log(`[API] Generated ${candidates.length} candidates. Starting strict verification...`);

                // Collect all verification results with their premium status
                const verificationResults = [];

                for (const candidate of candidates) {
                    // Skip duplicates
                    if (validTrends.some(t => t.title === candidate.title)) continue;
                    if (excludedTitles.includes(candidate.title)) continue;

                    // STRICT VERIFICATION STEP
                    const verification = await verifyTrendAuthenticity(candidate.title, candidate.category);

                    if (verification.isReal && verification.url) {
                        // Double check URL accessibility
                        const { isValid, finalUrl } = await verifyAndGetFinalUrl(verification.url);

                        if (isValid && finalUrl) {
                            verificationResults.push({
                                title: candidate.title,
                                category: candidate.category,
                                summary: candidate.summary,
                                time: "최근",
                                imageColor: "bg-blue-500/20",
                                originalUrl: finalUrl,
                                imageUrl: verification.imageUrl || "",
                                id: generateTrendId(candidate.title),
                                isPremium: verification.isPremium
                            });
                        }
                    }
                }

                // Sort by premium status (premium sources first)
                verificationResults.sort((a, b) => {
                    if (a.isPremium && !b.isPremium) return -1;
                    if (!a.isPremium && b.isPremium) return 1;
                    return 0;
                });

                // Add to validTrends (premium first)
                for (const result of verificationResults) {
                    if (validTrends.length >= 6) break;
                    const { isPremium, ...trendData } = result; // Remove isPremium before adding
                    validTrends.push(trendData);
                    const sourceType = isPremium ? '🌟 PREMIUM' : 'Standard';
                    console.log(`[API] Added ${sourceType} trend. Total: ${validTrends.length}/6`);
                }

            } catch (error) {
                console.error(`[API] Error in generation loop ${retryCount}:`, error);
            }

            retryCount++;
        }

        if (validTrends.length === 0) {
            return NextResponse.json({ error: "Failed to generate verified trends" }, { status: 500 });
        }

        // Finalize
        validTrends = validTrends.slice(0, 6);
        await saveTrendsCache(validTrends);

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
        const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const detail = JSON.parse(text);

        return NextResponse.json({
            detail: { ...detail, originalUrl: originalUrl || "" },
            cached: false
        });
    } catch (error) {
        console.error("Error reconstructing news:", error);
        return NextResponse.json({ error: "Failed to reconstruct news" }, { status: 500 });
    }
}
