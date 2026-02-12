import { NextRequest, NextResponse } from "next/server";
import { getUserEmailWithAuth } from "@/lib/auth-utils";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getUserByEmail } from "@/lib/users";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface UserProfileData {
    userType?: string;
    major?: string;
    field?: string;
    experience?: string;
    goal?: string;
    interests?: string[];
    job?: string;
    level?: string;
}

export async function POST(request: NextRequest) {
    try {

        // Check authentication
        const email = await getUserEmailWithAuth(request);
        if (!email) {
            console.error("[AI News Alert] Unauthorized access attempt");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user profile from database
        let userProfile: UserProfileData = {};
        try {
            const user = await getUserByEmail(email);
            if (user?.profile) {
                userProfile = user.profile as UserProfileData;
            }
        } catch (error) {
            console.error("[AI News Alert] 프로필 로드 실패:", error);
        }

        // Build user context
        const interestMap: Record<string, string> = {
            ai: "AI/인공지능/딥러닝/머신러닝",
            startup: "스타트업/창업/벤처투자",
            marketing: "마케팅/브랜딩/광고",
            development: "소프트웨어 개발/프로그래밍",
            design: "디자인/UX/UI",
            finance: "금융/투자/주식/암호화폐",
            selfdev: "자기계발/생산성",
            health: "건강/피트니스/웰니스",
        };

        const interestLabels = (userProfile.interests || []).map(i => interestMap[i] || i);
        const job = userProfile.job || userProfile.field || "전문직";
        const goal = userProfile.goal || "";

        // Get current date for context
        const now = new Date();
        const currentMonth = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });

        // Use Gemini with Google Search grounding to find recent news
        const model = genAI.getGenerativeModel({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        });

        const prompt = `당신은 "${job}" 직업을 가진 사용자를 위한 뉴스 큐레이터입니다.

**사용자 정보:**
- 직업: ${job}
- 목표: ${goal || "자기계발"}
- 관심사: ${interestLabels.join(", ") || "기술, 비즈니스"}

**현재 시점:** ${currentMonth}

**임무:**
사용자의 직업과 관심사에 맞는 **최근 24시간 이내의 주요 뉴스나 업계 소식** 1개를 찾아주세요.

**규칙:**
1. **실제 뉴스만**: 가상의 뉴스를 만들지 마세요. 실제로 최근에 보도된 내용만 언급하세요.
2. **직업 연관성**: ${job}가 업무에 활용하거나 알아두면 좋을 소식이어야 합니다.
3. **구체적으로**: 행사명, 회사명, 제품명, 수치 등 구체적인 정보를 포함하세요.
4. **한국어로**: 모든 응답은 한국어로 작성하세요.
5. **톤**: 친근하고 흥미로운 톤으로 작성하세요. ("~했대요!", "~라고 하네요!")

**좋은 예시:**
- (AI 관심) "OpenAI가 GPT-5를 이번 주에 발표했대요! 특히 멀티모달 성능이 크게 향상됐다고 하네요 🤖"
- (개발자) "GitHub Copilot이 새로운 코드 리뷰 기능을 추가했어요! PR 자동 분석 기능이 특히 유용할 것 같아요 💻"
- (금융) "한국은행이 기준금리를 동결했어요. 하반기 인하 가능성에 대한 언급도 있었네요 📊"
- (마케팅) "틱톡이 새로운 쇼핑 기능을 한국에 출시했대요! 인앱 결제가 가능해졌어요 📱"
- (CES) "CES 2026에서 삼성이 투명 디스플레이 TV를 공개했어요! 실제로 창문처럼 보인다고 하네요 📺"

**나쁜 예시:**
- "AI 기술이 발전하고 있습니다" (너무 일반적, 구체적이지 않음)
- "최근 많은 기업들이..." (모호함, 실제 뉴스가 아님)

**출력 형식 (JSON):**
{
    "hasNews": true,
    "headline": "뉴스 제목 (10단어 이내)",
    "content": "친근한 톤의 뉴스 요약 (2-3문장, 이모지 1개 포함)",
    "source": "출처 (예: TechCrunch, 연합뉴스 등)",
    "relevance": "사용자에게 왜 중요한지 한 줄 설명"
}

만약 사용자의 관심사에 맞는 최근 뉴스를 찾을 수 없다면:
{
    "hasNews": false
}`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.7,
            },
        });

        const response = result.response;
        const text = response.text();
        const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();


        try {
            const newsData = JSON.parse(cleanText);

            if (!newsData.hasNews) {
                return NextResponse.json({
                    hasNews: false,
                    message: "현재 관련 뉴스가 없습니다."
                });
            }

            return NextResponse.json({
                hasNews: true,
                headline: newsData.headline,
                content: newsData.content,
                source: newsData.source,
                relevance: newsData.relevance,
            });
        } catch (parseError) {
            console.error("[AI News Alert] JSON 파싱 실패:", parseError);
            return NextResponse.json({
                hasNews: false,
                error: "뉴스 파싱 실패"
            });
        }

    } catch (error: any) {
        console.error("[AI News Alert] 에러 발생:", error);
        return NextResponse.json(
            { error: "Failed to fetch news" },
            { status: 500 }
        );
    }
}
