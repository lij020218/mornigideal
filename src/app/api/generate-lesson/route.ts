import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash-exp",
});

export async function POST(request: Request) {
    try {
        const { curriculumTitle, curriculumSubtitle, dayNumber, totalDays, userLevel, userJob } = await request.json();

        if (!curriculumTitle) {
            return NextResponse.json(
                { error: "Curriculum title is required" },
                { status: 400 }
            );
        }

        const levelDescription = {
            junior: "입문자/초급자 - 기초 개념부터 쉽게 설명",
            mid: "중급자 - 기본 개념은 알고 있으며 실무 적용 방법 위주",
            senior: "고급자 - 심화 내용과 전문적인 인사이트 위주"
        }[userLevel] || "중급자 수준";

        const prompt = `당신은 교육 콘텐츠 전문가이자 숙련된 강사입니다.
학습자가 몰입하고 쉽게 이해할 수 있도록, 풍부하고 자연스러운 한국어로 학습 콘텐츠를 작성해주세요.

**학습 정보:**
- 주제: ${curriculumTitle}
- 세부 내용: ${curriculumSubtitle || "전반적인 내용"}
- 학습 진도: ${dayNumber}일차 / 총 ${totalDays}일
- 대상: ${userJob || "직장인"}
- 수준: ${levelDescription}

**작성 원칙:**
1. 정확히 10개의 슬라이드를 구성하세요.

2. **자연스러운 문체:**
   - 단순 나열이 아닌, 이야기하듯 자연스럽게 풀어쓰세요
   - 문장과 문장 사이의 연결이 매끄럽게 이어지도록 작성하세요
   - 각 문단은 논리적 흐름을 갖추어 앞 내용에서 자연스럽게 이어져야 합니다
   - 마치 전문 강사가 친절하게 설명하는 것처럼 작성하세요

3. **풍부한 내용:**
   - content는 최소 4-6문장으로 구성하여 충분히 설명하세요
   - 구체적인 예시나 시나리오를 포함하세요
   - 추상적인 개념은 실생활이나 업무 상황에 빗대어 설명하세요
   - ${userLevel === 'junior' ? '초보자도 이해할 수 있도록 쉬운 비유와 단계별 설명을 사용하세요' : userLevel === 'senior' ? '전문적인 인사이트와 심화된 맥락, 실무 경험이 담긴 고급 내용을 포함하세요' : '실무에서 바로 활용할 수 있는 구체적인 방법론과 실전 팁을 중심으로 작성하세요'}

4. **슬라이드 구성:**
   - 1번 슬라이드: 오늘 배울 내용의 전체적인 그림을 그려주고, 왜 중요한지 동기부여
   - 2-8번 슬라이드: 핵심 개념을 단계적으로 깊이 있게 설명 (각 슬라이드는 이전 내용과 자연스럽게 연결)
   - 9번 슬라이드: 실전 활용 방법이나 케이스 스터디
   - 10번 슬라이드: 핵심 요약 + 실천 과제 + 다음 학습 예고

5. **세부 요구사항:**
   - bulletPoints는 3-5개로 구성하되, 단순 키워드가 아닌 완성된 문장 형태로 작성하세요
   - tip은 반드시 포함하며, 실무에서 놓치기 쉬운 포인트나 전문가의 조언을 담으세요
   - 전문 용어는 필요시 한글 설명을 병기하세요 (예: "API(Application Programming Interface, 응용 프로그램 인터페이스)")

**응답 형식:**
JSON 형식으로만 응답하세요. 예시:
{
  "lessonTitle": "구체적이고 매력적인 오늘의 학습 제목",
  "slides": [
    {
      "slideNumber": 1,
      "title": "명확하고 호기심을 자극하는 제목",
      "content": "이 슬라이드에서 다룰 내용을 자연스럽고 풍부하게 4-6문장으로 설명합니다.\n\n문장과 문장이 논리적으로 연결되어야 하며, 마치 강사가 직접 설명하는 것처럼 친근하면서도 전문적인 톤을 유지합니다. 구체적인 예시나 상황을 들어 이해를 돕고, 학습자가 왜 이것을 배워야 하는지 명확히 전달합니다.\n\n강조해야 할 키워드나 개념은 **키워드**로 감싸서 표시하세요. 전문 용어는 \`용어\`로 감싸세요.",
      "bulletPoints": [
        "단순 키워드가 아닌, 완성된 문장으로 작성된 첫 번째 핵심 포인트입니다",
        "두 번째 포인트는 첫 번째와 연결되며 추가적인 인사이트를 제공합니다",
        "세 번째 포인트는 실무 적용 가능성이나 구체적인 예시를 포함합니다",
        "네 번째 포인트는 추가적인 맥락이나 주의사항을 제공합니다"
      ],
      "summary": [
        "이 슬라이드의 핵심을 한 문장으로 요약한 첫 번째 내용",
        "두 번째 핵심 요약 - 실무 적용이나 중요성 강조",
        "세 번째 핵심 요약 - 다음 내용으로의 자연스러운 연결"
      ],
      "tip": "실무에서 자주 놓치는 부분이나 꼭 기억해야 할 실전 조언을 자연스럽게 작성합니다. 구체적인 상황이나 예시를 포함하면 더 좋습니다."
    }
  ]
}

**중요:**
- content는 여러 문단으로 구성하되, 각 문단 사이에 \\n\\n을 넣어 구분하세요
- 강조할 키워드는 **키워드** 형식으로 감싸세요
- 전문 용어나 중요 개념은 \`용어\` 형식으로 감싸세요
- summary는 반드시 정확히 3개 항목으로 구성하세요
- bulletPoints는 3-5개로 구성하세요`;

        console.log("📚 Generating lesson content...");

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("📡 Raw Gemini response:", text.substring(0, 500));

        // Extract JSON from response
        let jsonText = text.trim();
        jsonText = jsonText.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

        const match = jsonText.match(/\{[\s\S]*"slides"[\s\S]*\}/);
        if (match) {
            jsonText = match[0];
        }

        try {
            const data = JSON.parse(jsonText);

            if (!data.slides || !Array.isArray(data.slides)) {
                throw new Error("Invalid slides format");
            }

            console.log("✅ Generated", data.slides.length, "slides");

            return NextResponse.json({
                lessonTitle: data.lessonTitle,
                slides: data.slides
            });
        } catch (parseError) {
            console.error("❌ Failed to parse lesson response:", parseError);

            // Return fallback content
            return NextResponse.json({
                lessonTitle: `${curriculumTitle} - ${dayNumber}일차`,
                slides: [
                    {
                        slideNumber: 1,
                        title: "오늘의 학습 목표",
                        content: `${curriculumTitle}의 핵심 개념을 이해합니다.`,
                        bulletPoints: ["기본 개념 이해", "실무 적용 방법", "핵심 포인트 정리"],
                        tip: "천천히 따라오세요!"
                    },
                    {
                        slideNumber: 2,
                        title: "핵심 개념",
                        content: "이 주제의 가장 중요한 개념입니다.",
                        bulletPoints: ["개념 1", "개념 2", "개념 3"],
                        tip: ""
                    }
                ]
            });
        }

    } catch (error) {
        console.error("💥 Error generating lesson:", error);
        return NextResponse.json(
            { error: "Failed to generate lesson content" },
            { status: 500 }
        );
    }
}
