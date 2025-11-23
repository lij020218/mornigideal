import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getTrendsCache, getDetailCache, generateTrendId, saveTrendsCache } from "@/lib/newsCache";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "");

// Helper to verify if a news item is REAL and RECENT using a dedicated search check
async function verifyTrendAuthenticity(title: string, category: string): Promise<{ isReal: boolean; url: string; imageUrl: string }> {
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

        const verificationPrompt = `
        ACT AS A FACT-CHECKER.
        
        Target News: "${title}" (Category: ${category})
        Current Date: ${new Date().toISOString().split('T')[0]}

        TASK:
        1. Search Google specifically for this news topic to verify if it is REAL and RECENT (within the last 7 days).
        2. If the news is false, old (older than 7 days), or a rumor that has been debunked, mark it as FALSE.
        3. If it is real, find the BEST, most authoritative source URL.
        4. Try to find a relevant image URL from the search results (og:image).

        Return JSON:
        {
            "isReal": boolean, // true ONLY if confirmed real and recent
            "verifiedUrl": "string", // The actual URL found during verification
            "verifiedImageUrl": "string", // Image URL if found, else empty
            "reason": "string" // Why it is true or false
        }
        `;

        const result = await model.generateContent(verificationPrompt);
        const response = await result.response;
        const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(text);

        if (data.isReal && data.verifiedUrl) {
            console.log(`[API] ✅ Verified: ${title} (${data.reason})`);
            return {
                isReal: true,
                url: data.verifiedUrl,
                imageUrl: data.verifiedImageUrl || ""
            };
        } else {
            console.warn(`[API] ❌ Rejected: ${title} (${data.reason})`);
            return { isReal: false, url: "", imageUrl: "" };
        }

    } catch (error) {
        console.error(`[API] Verification failed for "${title}":`, error);
        return { isReal: false, url: "", imageUrl: "" };
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

        console.log('[API] Starting STRICT generation process...');

        let validTrends: any[] = [];
        let retryCount = 0;
        const maxRetries = 3; // Increased retries since verification is strict

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
                const candidatesNeeded = needed * 2 + 2;

                const prompt = `
              You are a trend analyst for a ${job}.
              Today's date is ${today}.

              **TASK:**
              Find **${candidatesNeeded}** POTENTIAL trending news headlines relevant to a ${job}.
              
              **CRITERIA:**
              1. MUST be from the last 3 days.
              2. MUST be real news, not general advice.
              3. Focus on: AI, Tech, Marketing, Business, Economy.
              
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
                const text = response.text().replace(/```json/g, "").replace(/```/g, "").trim();

                let candidates = [];
                try {
                    candidates = JSON.parse(text);
                } catch (e) {
                    console.error("[API] Failed to parse candidates JSON", e);
                    continue;
                }

                if (!Array.isArray(candidates)) continue;

                console.log(`[API] Generated ${candidates.length} candidates. Starting strict verification...`);

                // Verify each candidate one by one
                for (const candidate of candidates) {
                    if (validTrends.length >= 6) break;

                    // Skip duplicates
                    if (validTrends.some(t => t.title === candidate.title)) continue;

                    // STRICT VERIFICATION STEP
                    const verification = await verifyTrendAuthenticity(candidate.title, candidate.category);

                    if (verification.isReal && verification.url) {
                        // Double check URL accessibility
                        const { isValid, finalUrl } = await verifyAndGetFinalUrl(verification.url);

                        if (isValid && finalUrl) {
                            validTrends.push({
                                title: candidate.title,
                                category: candidate.category,
                                summary: candidate.summary,
                                time: "최근", // Will be updated by client or generic
                                imageColor: "bg-blue-500/20", // Randomize this if needed
                                originalUrl: finalUrl,
                                imageUrl: verification.imageUrl || "",
                                id: generateTrendId(candidate.title)
                            });
                            console.log(`[API] Added verified trend. Total: ${validTrends.length}/6`);
                        }
                    }
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
