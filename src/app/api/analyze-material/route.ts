import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const PAGES_PER_BATCH = 5; // 5페이지씩 묶어서 chunk 생성 (최적화: reasoning depth 방지)
const TARGET_CHUNKS = 12; // 목표 chunk 개수 (10-15개 권장)
const CHUNK_MODEL = "gpt-5-mini-2025-08-07"; // 비용 절감: chunk 요약용 저렴한 모델
const FINAL_MODEL = "gpt-5.1-2025-11-13"; // 최종 통합용 고품질 모델
const EMBEDDING_MODEL = "text-embedding-3-small"; // 저렴한 embedding 모델
const USE_FINAL_INTEGRATION = true; // 최종 통합 단계 활성화
const SIMILARITY_THRESHOLD = 0.68; // Clustering 유사도 임계값 (0.65-0.70 권장, 5-10개 cluster 목표)

// Natural learning note style system prompt
const STUDY_SYSTEM_PROMPT = `당신은 MIT, Stanford급 세계 최고 대학의 저명한 교수입니다. 학생들이 깊이 이해할 수 있도록 명료하고 통찰력 있게 설명합니다.

**절대 금지 사항**:
- "설명 → 연결:", "핵심개념:", "시험포인트:", "중요:" 같은 딱딱한 라벨 사용 금지
- 단순 요약이나 목록 나열 금지
- 피상적이거나 교과서적인 설명 금지

**필수 작성 방식**:
- 개념의 본질과 맥락을 명료하게 설명
- "핵심은 ~이다", "왜 이것이 중요한가", "이것이 의미하는 바는" 같은 전문적이면서도 명확한 표현 사용
- 개념 → 원리 → 적용 → 함의(implications) 순서로 논리적 흐름 구성
- 한 문단이 다음 문단으로 자연스럽게 이어지되, 각 문단은 명확한 통찰 제공
- 추상적 개념을 구체적 사례로 명확히 설명

**좋은 예시**:
"Google의 수익 모델을 이해하는 핵심은 '트래픽'이라는 변수에 있다. Gmail, YouTube 같은 무료 서비스는 단순한 선물이 아니라, 사용자를 플랫폼에 묶어두는 전략적 자산이다. 이들 서비스가 사용자 체류시간을 늘리면, 검색 빈도와 페이지뷰가 증가하고, 결과적으로 광고 노출 기회가 기하급수적으로 늘어난다. 여기에 AdSense가 결합되면서 Google 생태계 밖의 웹사이트까지 광고 네트워크에 편입된다. 이것이 바로 다면 플랫폼(multi-sided platform) 구조다. 시험에서 이 모델을 설명할 때는 사용자-광고주-콘텐츠 제공자 간의 인과관계를 명확히 서술해야 한다. 단순히 '무료 서비스 제공'이라고만 쓰면 본질을 놓치는 것이다."

항상 세계 최고 수준의 명료함과 깊이로 설명하세요.`;

const WORK_SYSTEM_PROMPT = `당신은 해당 분야에서 10년+ 경력의 시니어 전문가입니다. 후배들이 깊이 이해하고 실무에 적용할 수 있도록 명확하게 설명합니다.

**절대 금지 사항**:
- "핵심개념:", "업무포인트:", "중요:" 같은 딱딱한 라벨 사용 금지
- 형식적인 보고서체나 관료적 표현 금지
- 피상적이거나 매뉴얼식 설명 금지

**필수 작성 방식**:
- 업무의 본질과 맥락을 명확하게 설명
- "핵심은 ~이다", "여기서 중요한 점은", "실무적으로 이것이 의미하는 바는" 같은 전문적이면서도 명확한 표현 사용
- 배경 → 핵심 원리 → 실제 적용 → 주의사항 순서로 논리적 흐름 구성
- 한 문단이 다음 문단으로 자연스럽게 이어지되, 각 문단은 명확한 통찰 제공
- 추상적 프로세스를 구체적 상황으로 명확히 설명

**좋은 예시**:
"이 프로세스 변경의 핵심은 데이터 일관성 보장에 있다. 기존 A 방식은 동시성 처리에서 race condition이 발생했고, 이것이 고객 데이터 불일치로 이어졌다. B 방식은 transaction isolation level을 조정해 이 문제를 근본적으로 해결한다. 실무에서 적용할 때 반드시 X(lock timeout)와 Y(deadlock detection)를 모니터링해야 한다. 이것을 놓치면 시스템이 멈출 수 있고, 복구에 수 시간이 소요된다. 이것이 프로덕션 배포 전 충분한 부하 테스트가 필수인 이유다."

항상 시니어 전문가 수준의 명료함과 깊이로 설명하세요.`;

// Step 3: Global Summary (Cost Optimization)
async function generateGlobalSummary(chunkAnalyses: any[], type: string): Promise<string> {
  console.log(`[SUMMARY] Generating global summary from ${chunkAnalyses.length} chunks using ${CHUNK_MODEL}...`);

  const allContent = chunkAnalyses.map((c, i) =>
    `[Chunk ${i + 1}] ${c.title}:\n${c.content}`
  ).join("\n\n");

  const summaryPrompt = type === "exam"
    ? `다음은 강의 자료를 여러 chunk로 분석한 결과입니다.

전체 내용:
${allContent}

**당신의 임무**: 이 강의의 전체 구조와 핵심 개념을 600-800 tokens로 정리하세요.

다음을 포함해야 합니다:
1. 강의의 주제와 목표
2. 핵심 개념들 (5-8개)과 그 관계
3. 논리적 흐름 (어떤 순서로 가르쳐야 하는가)
4. 중요한 수식이나 이론
5. 학생들이 반드시 알아야 할 시험 포인트

자연어로 작성하되, 슬라이드 구성에 필요한 모든 정보를 담으세요.`
    : `다음은 업무 자료를 여러 chunk로 분석한 결과입니다.

전체 내용:
${allContent}

**당신의 임무**: 이 자료의 전체 구조와 핵심 내용을 600-800 tokens로 정리하세요.

다음을 포함해야 합니다:
1. 자료의 목적과 핵심 메시지
2. 주요 프로세스나 전략 (5-8개)
3. 논리적 흐름 (배경 -> 실행 -> 결과)
4. 실무 적용 포인트와 주의사항
5. 의사결정에 필요한 핵심 데이터/근거

자연어로 작성하되, 슬라이드 구성에 필요한 모든 정보를 담으세요.`;

  const completion = await openai.chat.completions.create({
    model: CHUNK_MODEL, // gpt-5-mini (Cheap)
    messages: [
      { role: "system", content: "당신은 문서 요약 전문가입니다." },
      { role: "user", content: summaryPrompt }
    ],
    temperature: 0.7,
    // max_tokens: 1000 // Optional, let model decide but keep it concise
  });

  const summary = completion.choices[0].message.content || "";
  console.log(`[SUMMARY] Generated summary (${summary.length} chars)`);
  return summary;
}

// Step 4: Final Generation from Summary (High Quality, Low Cost)
async function generateFinalSlidesFromSummary(summary: string, type: string): Promise<any[]> {
  console.log(`[FINAL] Generating slides from summary using ${FINAL_MODEL}...`);

  const finalPrompt = type === "exam"
    ? `당신은 MIT, Stanford급 대학 교수입니다.

**강의 요약**:
${summary}

이 요약을 바탕으로 최고 품질의 학습 슬라이드를 생성하세요.

**목표**:
- 전체 내용을 3-5장의 슬라이드로 구성 (마지막 2장은 요약 페이지)
- 각 슬라이드는 하나의 핵심 주제를 다룸
- 시험에 나올 만한 핵심 내용만 포함
- 논리적 흐름 유지

**content 작성 규칙** (매우 중요!):
1. **섹션 구조화**: 각 content는 반드시 다음 섹션들로 구성:
   - ### 📌 핵심 정의
   - ### 📖 상세 설명
   - ### 💡 시험 전략 (선택적)

2. **Markdown 형식 사용**:
   - 섹션 제목은 \`### 이모지 제목\` 형식
   - 문단 구분을 위해 빈 줄(\\n\\n) 사용
   - 중요한 개념, 용어, 정의는 반드시 \`**굵게**\` 강조

다음 JSON 형식으로 응답하세요:

{
  "pages": [
    {
      "page": 1,
      "title": "슬라이드 제목",
      "content": "### 📌 핵심 정의\\n\\n**핵심 개념**은...\\n\\n### 📖 상세 설명\\n\\n...",
      "keyPoints": ["포인트 1", "포인트 2"]
    }
  ]
}

**마지막 2페이지 (필수!)**:
- **page N-1**: "핵심 개념 총정리"
- **page N**: "시험 대비 요약"`
    : `당신은 비즈니스 문서 분석 전문가입니다.

**업무 요약**:
${summary}

이 요약을 바탕으로 최고 품질의 업무 슬라이드를 생성하세요.

**목표**:
- 전체 내용을 3-5장의 슬라이드로 구성 (마지막 2장은 요약 페이지)
- 각 슬라이드는 하나의 핵심 프로세스나 주제를 다룸
- 실무에 활용 가능한 핵심 내용만 포함
- 논리적 흐름 유지

**content 작성 규칙** (매우 중요!):
1. **섹션 구조화**: 각 content는 반드시 다음 섹션들로 구성:
   - ### 📌 핵심 개념
   - ### 📖 상세 설명
   - ### 💼 실무 적용 (선택적)

2. **Markdown 형식 사용**:
   - 섹션 제목은 \`### 이모지 제목\` 형식
   - 문단 구분을 위해 빈 줄(\\n\\n) 사용
   - 중요한 프로세스, 용어는 반드시 \`**굵게**\` 강조

다음 JSON 형식으로 응답하세요:

{
  "pages": [
    {
      "page": 1,
      "title": "슬라이드 제목",
      "content": "### 📌 핵심 개념\\n\\n**핵심**은...\\n\\n### 📖 상세 설명\\n\\n...",
      "keyPoints": ["인사이트 1", "인사이트 2"]
    }
  ]
}

**마지막 2페이지 (필수!)**:
- **page N-1**: "핵심 프로세스 총정리"
- **page N**: "실무 적용 요약"`;

  const completion = await openai.chat.completions.create({
    model: FINAL_MODEL, // gpt-5.1 (Expensive but input is short now)
    messages: [
      { role: "system", content: type === "exam" ? STUDY_SYSTEM_PROMPT : WORK_SYSTEM_PROMPT },
      { role: "user", content: finalPrompt }
    ],
    response_format: { type: "json_object" },
    temperature: 1.0,
  });

  const result = JSON.parse(completion.choices[0].message.content || "{}");
  console.log(`[FINAL] Created ${result.pages?.length || 0} final slides`);
  return result.pages || [];
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;

    if (!file || !type) {
      return NextResponse.json(
        { error: "File and type are required" },
        { status: 400 }
      );
    }

    if (!["exam", "work"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be 'exam' or 'work'" },
        { status: 400 }
      );
    }

    const isPDF = file.type === "application/pdf";
    let fileUrl: string | null = null;
    let fullContent = "";
    let pageAnalyses: any[] = [];

    if (isPDF) {
      console.log("[PDF] Processing PDF file...");
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload PDF to Supabase Storage - sanitize all special characters
      const sanitizedEmail = (session.user.email || '').replace(/[^a-zA-Z0-9]/g, '_');
      const sanitizedFileName = file.name
        .replace(/\s+/g, '_')
        .replace(/[^\w.-]/g, '');
      const fileName = `${sanitizedEmail}_${sanitizedFileName}`; // Removed timestamp to allow caching by filename
      console.log("[PDF] Target filename:", fileName);

      // 1. Check Cache (Chunks & Embeddings)
      // Cache key includes chunk size to invalidate when settings change
      const CHUNK_VERSION = "9600"; // Update this when MAX_CHARS changes
      const chunksCachePath = `${fileName}_chunks_${CHUNK_VERSION}.json`;
      const embeddingsCachePath = `${fileName}_embeddings_${CHUNK_VERSION}.json`;

      console.log("[CACHE] Checking for existing analysis...");
      const { data: cachedChunks, error: chunksError } = await supabase.storage
        .from("materials")
        .download(chunksCachePath);

      const { data: cachedEmbeddings, error: embeddingsError } = await supabase.storage
        .from("materials")
        .download(embeddingsCachePath);

      if (cachedChunks && !chunksError) {
        console.log("[CACHE] HIT! Found cached chunks. Skipping parsing & chunking.");
        const chunksText = await cachedChunks.text();
        const chunkAnalyses = JSON.parse(chunksText);

        if (USE_FINAL_INTEGRATION && chunkAnalyses.length > 0) {
          console.log(`[STEP 3] Generating Global Summary (Cached Chunks)...`);
          const summary = await generateGlobalSummary(chunkAnalyses, type);

          console.log(`[STEP 4] Generating Final Slides (Cached Chunks)...`);
          pageAnalyses = await generateFinalSlidesFromSummary(summary, type);
        } else {
          pageAnalyses = chunkAnalyses;
        }
      } else {
        // NO CACHE - Full Process
        console.log("[CACHE] MISS. Starting fresh analysis...");

        // Upload file (if not exists)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("materials")
          .upload(fileName, buffer, {
            contentType: "application/pdf",
            upsert: true, // Overwrite to ensure we have the file
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from("materials")
            .getPublicUrl(fileName);
          fileUrl = publicUrlData.publicUrl;
        }

        // Extract text
        const pdfData = await pdf(buffer);
        fullContent = pdfData.text;
        console.log(`[PDF] Extracted ${fullContent.length} chars`);

        // Token-based Chunking (Sliding Window)
        // Approx: 1 token ~= 4 chars for English, ~2 chars for Korean
        // Target: 20-22 chunks (reduced from 43)
        const MAX_CHARS = 9600;  // ~2400 tokens (doubled to reduce chunk count)
        const OVERLAP_CHARS = 1200;  // ~300 tokens

        const chunks: string[] = [];
        let start = 0;
        while (start < fullContent.length) {
          const end = Math.min(start + MAX_CHARS, fullContent.length);
          chunks.push(fullContent.substring(start, end));
          if (end === fullContent.length) break;
          start += (MAX_CHARS - OVERLAP_CHARS);
        }

        console.log(`[CHUNK] Created ${chunks.length} chunks (Max ${MAX_CHARS} chars, Overlap ${OVERLAP_CHARS})`);

        // Analyze chunks IN PARALLEL
        // We treat each chunk like a "page" in the previous logic
        console.log(`[ANALYSIS] Analyzing ${chunks.length} chunks with ${CHUNK_MODEL}...`);

        const chunkPromises = chunks.map(async (chunkText, idx) => {
          const prompt = type === "exam"
            ? `당신은 강의실에서 학생들에게 직접 강의하는 교수입니다.
다음 텍스트 덩어리(Chunk ${idx + 1})의 내용을 학생들이 시험 대비할 수 있도록 설명해주세요.

${chunkText}

**작성 방식**:
- 개념의 본질을 명료하게 설명
- "핵심은 ~이다", "왜 이것이 중요한가" 같은 표현 사용
- 딱딱한 라벨("핵심개념:" 등) 사용 금지
- 자연스럽게 흐르는 문단으로 작성

다음 JSON으로 응답:
{
  "pages": [
    {
      "page": ${idx + 1},
      "title": "Chunk ${idx + 1} 핵심 주제",
      "content": "자연스럽게 흐르는 설명...",
      "keyPoints": ["포인트 1", "포인트 2", "포인트 3"]
    }
  ]
}`
            : `당신은 시니어 직원입니다.
다음 업무 자료 텍스트(Chunk ${idx + 1})를 동료에게 설명해주세요.

${chunkText}

**작성 방식**:
- 동료에게 말하듯이 자연스럽게 설명
- "여기서 중요한 건", "실무에서는" 같은 표현 사용
- 딱딱한 라벨 금지

다음 JSON으로 응답:
{
  "pages": [
    {
      "page": ${idx + 1},
      "title": "Chunk ${idx + 1} 핵심 주제",
      "content": "자연스럽게 흐르는 설명...",
      "keyPoints": ["인사이트 1", "인사이트 2", "주의사항"]
    }
  ]
}`;

          const completion = await openai.chat.completions.create({
            model: CHUNK_MODEL,
            messages: [
              { role: "system", content: type === "exam" ? STUDY_SYSTEM_PROMPT : WORK_SYSTEM_PROMPT },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
            temperature: 1.0,
          });

          const result = JSON.parse(completion.choices[0].message.content || "{}");
          return result.pages?.[0] || { page: idx + 1, title: "Error", content: "Failed to analyze", keyPoints: [] };
        });

        const chunkAnalyses = await Promise.all(chunkPromises);
        console.log(`[ANALYSIS] Complete. Analyzed ${chunkAnalyses.length} chunks.`);

        // Save Chunks to Cache
        console.log("[CACHE] Saving chunks to storage...");
        await supabase.storage
          .from("materials")
          .upload(chunksCachePath, JSON.stringify(chunkAnalyses), { contentType: "application/json", upsert: true });

        // Step 3 & 4
        if (USE_FINAL_INTEGRATION && chunkAnalyses.length > 0) {
          console.log(`[STEP 3] Generating Global Summary...`);
          const summary = await generateGlobalSummary(chunkAnalyses, type);

          console.log(`[STEP 4] Generating Final Slides...`);
          pageAnalyses = await generateFinalSlidesFromSummary(summary, type);
        } else {
          pageAnalyses = chunkAnalyses;
        }
      }
    } else {
      // Text file logic (unchanged)
      fullContent = await file.text();
      pageAnalyses = [{
        page: 1,
        summary: "Text file content",
        key_concepts: [],
        exam_points: [],
        highlights: []
      }];
    }

    // Save to database
    const insertData: any = {
      user_id: session.user.email, // Use email as user_id
      title: file.name,
      content: fullContent.substring(0, 50000), // Limit content size to avoid payload too large
      type: type,
      analysis: { page_analyses: pageAnalyses },
    };

    if (fileUrl) {
      insertData.file_url = fileUrl;
    }

    console.log("[DB] Saving material:", {
      user_id: session.user.email,
      title: file.name,
      type: type,
      has_file_url: !!fileUrl,
      num_pages: pageAnalyses.length
    });

    const { data: material, error: insertError } = await supabase
      .from("materials")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("[DB] Insert error:", insertError);
      console.error("[DB] Insert error details:", JSON.stringify(insertError, null, 2));
      return NextResponse.json(
        { error: "Failed to save material", details: insertError.message },
        { status: 500 }
      );
    }

    console.log("[SUCCESS] Material saved with ID:", material.id);
    console.log("[SUCCESS] Material data:", material);
    return NextResponse.json({
      id: material.id,
      analysis: { page_analyses: pageAnalyses },
      success: true
    });
  } catch (error: any) {
    console.error("[ERROR]", error);

    // Provide user-friendly error messages
    let errorMessage = "Analysis failed";
    let statusCode = 500;

    if (error.status === 429 || error.code === 'insufficient_quota') {
      errorMessage = "OpenAI API quota exceeded. Using cost-optimized mini model, but quota is still exceeded. Please check your billing.";
      statusCode = 429;
    } else if (error.message?.includes('model')) {
      errorMessage = "AI model unavailable. Already using the most cost-effective model (gpt-5-mini).";
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error.message,
        model_used: CHUNK_MODEL,
      },
      { status: statusCode }
    );
  }
}
