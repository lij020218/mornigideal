import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import pdfParse from "pdf-parse-fork";

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

// Step 3: Embedding + Clustering helper
async function groupSimilarChunks(chunks: any[]): Promise<any[][]> {
  if (chunks.length <= 3) return [chunks]; // Too few to cluster

  console.log(`[EMBEDDING] Creating embeddings for ${chunks.length} chunks (BATCH PARALLEL: 10 at a time)`);

  // Create embeddings in batches of 10 (parallel within batch)
  const chunksWithEmbeddings = [];
  const EMBEDDING_BATCH_SIZE = 10;

  for (let batchStart = 0; batchStart < chunks.length; batchStart += EMBEDDING_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + EMBEDDING_BATCH_SIZE, chunks.length);
    const batch = chunks.slice(batchStart, batchEnd);

    console.log(`[EMBEDDING BATCH] Processing chunks ${batchStart + 1}-${batchEnd} (${batch.length} parallel)...`);

    // Process this batch in parallel
    const batchPromises = batch.map(async (chunk) => {
      const text = `${chunk.title}\n${chunk.content}`;
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
      });
      return {
        chunk,
        embedding: response.data[0].embedding,
      };
    });

    const batchResults = await Promise.all(batchPromises);
    chunksWithEmbeddings.push(...batchResults);

    console.log(`[EMBEDDING BATCH] Complete. Total: ${chunksWithEmbeddings.length}/${chunks.length}`);
  }

  // Simple clustering: calculate similarity and group similar chunks
  const groups: any[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < chunksWithEmbeddings.length; i++) {
    if (used.has(i)) continue;

    const group = [chunksWithEmbeddings[i].chunk];
    used.add(i);

    // Find similar chunks
    for (let j = i + 1; j < chunksWithEmbeddings.length; j++) {
      if (used.has(j)) continue;

      const similarity = cosineSimilarity(
        chunksWithEmbeddings[i].embedding,
        chunksWithEmbeddings[j].embedding
      );

      // Group if similarity > threshold (high similarity)
      if (similarity > SIMILARITY_THRESHOLD) {
        group.push(chunksWithEmbeddings[j].chunk);
        used.add(j);
      }
    }

    groups.push(group);
  }

  console.log(`[CLUSTERING] Grouped ${chunks.length} chunks into ${groups.length} clusters`);
  return groups;
}

// Cosine similarity helper
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Step 4: Final integration with high-quality model
async function integrateClusters(groups: any[][], type: string): Promise<any[]> {
  console.log(`[INTEGRATION STEP 1/2] Compressing ${groups.length} clusters using ${CHUNK_MODEL} (BATCH PARALLEL: 3 at a time)`);

  // STEP 1: Compress each cluster into a topic summary using MINI model (batch parallel)
  const topicSummaries: string[] = [];
  const COMPRESSION_BATCH_SIZE = 3;

  for (let batchStart = 0; batchStart < groups.length; batchStart += COMPRESSION_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + COMPRESSION_BATCH_SIZE, groups.length);
    const batchGroups = groups.slice(batchStart, batchEnd);

    console.log(`[CLUSTER BATCH] Processing clusters ${batchStart + 1}-${batchEnd} (${batchGroups.length} parallel)...`);

    // Process this batch in parallel
    const batchPromises = batchGroups.map(async (group, batchIdx) => {
      const idx = batchStart + batchIdx;
      const mainTopic = group[0].title;

      // Combine all chunks in this cluster
      const allContents = group.map((c, i) =>
        `[Chunk ${i + 1}] ${c.title}:\n${c.content}`
      ).join("\n\n");

      // Use MINI to compress this cluster into a single topic summary
      const compressionPrompt = type === "exam"
        ? `다음은 같은 주제로 묶인 ${group.length}개의 학습 내용입니다:

${allContents}

**임무**: 이 내용들을 강의실에서 설명하듯이 자연스럽게 하나의 긴 설명으로 통합하세요.

**작성 방식**:
- 중복된 내용은 제거하되, 핵심 내용은 모두 포함
- 강의하듯이 자연스럽게 흐르는 설명 (딱딱한 라벨 금지)
- 시험에 중요한 내용을 자연스럽게 강조
- 500-800 단어 정도의 긴 설명

다음 JSON 형식으로 응답:
{
  "topic": "주제 제목",
  "summary": "강의실에서 설명하듯이 자연스럽게 흐르는 긴 텍스트..."
}`
        : `다음은 같은 주제로 묶인 ${group.length}개의 업무 내용입니다:

${allContents}

**임무**: 이 내용들을 동료에게 설명하듯이 자연스럽게 하나의 긴 설명으로 통합하세요.

**작성 방식**:
- 중복된 내용은 제거하되, 핵심 내용은 모두 포함
- 동료에게 말하듯이 자연스럽게 흐르는 설명 (딱딱한 라벨 금지)
- 실무에 필요한 내용을 자연스럽게 강조
- 500-800 단어 정도의 긴 설명

다음 JSON 형식으로 응답:
{
  "topic": "주제 제목",
  "summary": "동료에게 설명하듯이 자연스럽게 흐르는 긴 텍스트..."
}`;

      const compression = await openai.chat.completions.create({
        model: CHUNK_MODEL, // mini 사용으로 비용 절감
        messages: [
          {
            role: "system",
            content: type === "exam" ? STUDY_SYSTEM_PROMPT : WORK_SYSTEM_PROMPT
          },
          { role: "user", content: compressionPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 1.0,
      });

      const result = JSON.parse(compression.choices[0].message.content || "{}");
      return {
        idx: idx + 1,
        summary: `### Topic ${idx + 1}: ${result.topic}\n\n${result.summary}`
      };
    });

    const batchResults = await Promise.all(batchPromises);

    // Sort by index to maintain order
    batchResults.sort((a, b) => a.idx - b.idx);
    topicSummaries.push(...batchResults.map(r => r.summary));

    console.log(`[CLUSTER BATCH] Complete. Total: ${topicSummaries.length}/${groups.length}`);
  }

  // STEP 2: Use GPT-5.1 to integrate compressed topics (토큰 40-70% 감소)
  console.log(`[INTEGRATION STEP 2/2] Using ${FINAL_MODEL} for final integration (1 call only)`);

  const finalInput = topicSummaries.join("\n\n====================\n\n");

  const prompt = type === "exam"
    ? `당신은 대학 시험 대비 전문 튜터입니다. 다음은 강의 자료를 주제별로 압축한 ${topicSummaries.length}개의 Topic 요약입니다.

${finalInput}

**임무**: 이 Topic 요약들을 기반으로 대학생용 최종 학습 슬라이드를 생성하세요.

**목표**:
- 전체 내용을 슬라이드로 압축 (마지막 2페이지는 전체 요약)
- 각 슬라이드는 하나의 핵심 주제를 다룸
- 시험에 나올 만한 핵심 내용만 포함
- Topic간 논리적 흐름 유지

**content 작성 규칙** (매우 중요!):
1. **Markdown 형식 사용**: 문단 구분을 위해 빈 줄(\\n\\n) 사용
2. **중요한 개념, 용어, 정의는 반드시 \`**굵게**\` 강조**
3. **예시**: "**Google의 수익 모델**을 이해하는 핵심은 **트래픽**이라는 변수에 있다.\\n\\nGmail, YouTube 같은 무료 서비스는..."
4. 문단 사이에 빈 줄 넣어서 읽기 쉽게
5. 긴 설명은 2-3개 문단으로 나누기

다음 JSON 형식으로 응답하세요:

{
  "pages": [
    {
      "page": 1,
      "title": "슬라이드 제목",
      "content": "**핵심 개념**은 이렇다.\\n\\n첫 번째 문단 설명...\\n\\n두 번째 문단 설명...",
      "keyPoints": [
        "시험에 나올 핵심 포인트 1 (공식, 정의, 개념)",
        "시험에 나올 핵심 포인트 2 (적용 방법)",
        "시험에 나올 핵심 포인트 3 (주의사항이나 함정)"
      ]
    }
  ]
}

**마지막 2페이지 (필수!)**:
- **page N-1**: "핵심 개념 총정리" - 전체 내용의 핵심 개념들을 체계적으로 정리
- **page N**: "시험 대비 요약" - 시험에 꼭 나올 내용만 압축 정리

**중요**:
- content는 "핵심개념:", "시험포인트:" 같은 라벨 없이 자연스럽게 작성
- 중요한 개념은 **반드시** \`**굵게**\` 표시
- 문단 사이 빈 줄(\\n\\n) 필수`
    : `당신은 비즈니스 문서 분석 전문가입니다. 다음은 업무 자료를 주제별로 압축한 ${topicSummaries.length}개의 Topic 요약입니다.

${finalInput}

**임무**: 이 Topic 요약들을 기반으로 업무용 최종 슬라이드를 생성하세요.

**목표**:
- 전체 내용을 슬라이드로 압축 (마지막 2페이지는 전체 요약) 
- 각 슬라이드는 하나의 업무 프로세스나 주제를 다룸
- 실무에 활용 가능한 핵심 내용만 포함
- Topic간 논리적 흐름 유지

**content 작성 규칙** (매우 중요!):
1. **Markdown 형식 사용**: 문단 구분을 위해 빈 줄(\\n\\n) 사용
2. **중요한 프로세스, 용어, 주의사항은 반드시 \`**굵게**\` 강조**
3. **예시**: "이 **프로세스 변경의 핵심**은 데이터 일관성 보장에 있다.\\n\\n기존 A 방식은..."
4. 문단 사이에 빈 줄 넣어서 읽기 쉽게
5. 긴 설명은 2-3개 문단으로 나누기

다음 JSON 형식으로 응답하세요:

{
  "pages": [
    {
      "page": 1,
      "title": "슬라이드 제목",
      "content": "**핵심 프로세스**는 이렇다.\\n\\n첫 번째 문단 설명...\\n\\n두 번째 문단 설명...",
      "keyPoints": [
        "실무에 바로 적용 가능한 핵심 인사이트 1",
        "업무 효율을 높이는 핵심 인사이트 2",
        "주의사항이나 Best Practice"
      ]
    }
  ]
}

**마지막 2페이지 (필수!)**:
- **page N-1**: "핵심 프로세스 총정리" - 전체 업무 흐름과 핵심 내용 체계적 정리
- **page N**: "실무 적용 요약" - 실무에 바로 적용 가능한 핵심만 압축 정리

**중요**:
- content는 "핵심개념:", "업무포인트:" 같은 라벨 없이 자연스럽게 작성
- 중요한 프로세스/용어는 **반드시** \`**굵게**\` 표시
- 문단 사이 빈 줄(\\n\\n) 필수`;

  const completion = await openai.chat.completions.create({
    model: FINAL_MODEL, // 5.1 사용 (단 1회)
    messages: [
      {
        role: "system",
        content: type === "exam" ? STUDY_SYSTEM_PROMPT : WORK_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 1.0,
  });

  const result = JSON.parse(completion.choices[0].message.content || "{}");
  console.log(`[INTEGRATION] Created ${result.pages?.length || 0} final slides`);
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
      // Keep only alphanumeric, dot, dash, underscore
      const sanitizedFileName = file.name
        .replace(/\s+/g, '_')  // spaces to underscore
        .replace(/[^\w.-]/g, ''); // remove everything except word chars, dot, dash
      const fileName = `${Date.now()}_${sanitizedEmail}_${sanitizedFileName}`;
      console.log("[PDF] Uploading to storage:", fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("materials")
        .upload(fileName, buffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error("[PDF] Upload error:", uploadError);
        console.error("[PDF] Error details:", JSON.stringify(uploadError, null, 2));
      } else {
        console.log("[PDF] Upload success:", uploadData);
        const { data: publicUrlData } = supabase.storage
          .from("materials")
          .getPublicUrl(fileName);
        fileUrl = publicUrlData.publicUrl;
        console.log("[PDF] File URL:", fileUrl);
      }

      // Extract text
      const pdfData = await pdfParse(buffer);
      fullContent = pdfData.text;
      const totalPages = pdfData.numpages;
      console.log(`[PDF] Extracted ${fullContent.length} chars from ${totalPages} pages`);

      // Split text by pages (approximation)
      const avgCharsPerPage = Math.ceil(fullContent.length / totalPages);
      const pages: Array<{ pageNum: number; text: string }> = [];

      for (let i = 0; i < totalPages; i++) {
        const start = i * avgCharsPerPage;
        const end = Math.min((i + 1) * avgCharsPerPage, fullContent.length);
        pages.push({
          pageNum: i + 1,
          text: fullContent.substring(start, end),
        });
      }

      // Process pages in batches of 7
      const batches: Array<Array<{ pageNum: number; text: string }>> = [];
      for (let i = 0; i < pages.length; i += PAGES_PER_BATCH) {
        batches.push(pages.slice(i, i + PAGES_PER_BATCH));
      }

      console.log(`[PDF] Processing ${batches.length} batches IN PARALLEL (${PAGES_PER_BATCH} pages per batch)`);
      console.log(`[COST] Using ${CHUNK_MODEL} for chunk analysis (90% cost reduction)`);
      console.log(`[SPEED] Parallel batch processing for 10-20x speedup`);

      // Analyze all batches IN PARALLEL
      const batchPromises = batches.map(async (batch, batchIdx) => {
        console.log(`[BATCH ${batchIdx + 1}/${batches.length}] Starting pages ${batch[0].pageNum}-${batch[batch.length - 1].pageNum}...`);
        const batchText = batch.map((p, idx) =>
          `=== 페이지 ${p.pageNum} ===\n${p.text}`
        ).join("\n\n");

        const prompt = type === "exam"
          ? `당신은 강의실에서 학생들에게 직접 강의하는 교수입니다.
다음 ${batch.length}개 페이지의 내용을 학생들이 시험 대비할 수 있도록 자연스럽게 설명해주세요.

${batchText}

**작성 방식**:
- 개념의 본질을 명료하게 설명
- "핵심은 ~이다", "왜 이것이 중요한가", "이것이 의미하는 바는" 같은 전문적이면서도 명확한 표현 사용
- 개념 → 원리 → 적용 → 함의 순서로 논리적 흐름 구성
- "핵심개념:", "시험포인트:", "중요:" 같은 딱딱한 라벨 절대 사용 금지
- 한 문단이 다음 문단으로 자연스럽게 이어지되, 각 문단은 명확한 통찰 제공

**좋은 예시**:
"Bayes 정리를 이해하는 핵심은 조건부 확률의 방향성에 있다. P(A|B)는 B가 주어졌을 때 A의 확률이고, P(B|A)는 A가 주어졌을 때 B의 확률이다. 이 둘은 전혀 다른 의미를 가지며, 이것이 데이터 분석에서 critical한 이유는 원인과 결과의 방향을 정확히 파악해야 하기 때문이다. 예를 들어 질병 진단에서 '증상이 있을 때 질병일 확률'과 '질병이 있을 때 증상이 나타날 확률'은 완전히 다르다. 시험에서 이 개념을 설명할 때는 단순히 공식만 쓰는 것이 아니라, 이 방향성의 의미를 명확히 서술해야 한다."

다음 형식의 JSON 배열로 응답해주세요:

{
  "pages": [
    {
      "page": 1,
      "title": "슬라이드 제목 (핵심 주제를 한 문장으로)",
      "content": "세계 최고 수준의 명료함과 깊이로 자연스럽게 흐르는 긴 문단으로 작성하세요. 단락을 나누어 가독성을 높이되, 전체적으로 하나의 논리적 흐름으로 연결되어야 합니다.",
      "keyPoints": [
        "시험에 나올 핵심 포인트 1 (구체적으로)",
        "시험에 나올 핵심 포인트 2 (공식, 정의, 개념 등)",
        "시험에 나올 핵심 포인트 3 (적용 방법이나 주의사항)"
      ]
    }
  ]
}

**지침**:
1. ${batch.length}페이지를 2-3개의 슬라이드로 압축
2. 각 슬라이드는 하나의 주제를 깊이 있게 설명
3. 제목 페이지, 목차, 반복 내용은 생략
4. 시험에 critical한 내용을 자연스럽게 강조
5. keyPoints: 시험에 꼭 나올 만한 내용을 3-5개 추출 (공식, 정의, 개념, 적용법 등)`
          : `당신은 회사에서 동료에게 업무 내용을 설명하는 시니어 직원입니다.
다음 ${batch.length}개 페이지의 업무 자료를 동료가 이해할 수 있도록 자연스럽게 설명해주세요.

${batchText}

**작성 방식**:
- 동료에게 말하듯이 자연스럽게 설명
- "여기서 중요한 건", "실무에서는 이렇게", "주의할 점은" 같은 자연스러운 표현 사용
- 배경 → 핵심 내용 → 실제 적용 → 중요성 설명 순서로 자연스럽게 이어지게 작성
- "핵심개념:", "업무포인트:", "중요:" 같은 딱딱한 라벨 절대 사용 금지
- 한 문단이 다음 문단으로 자연스럽게 흐르도록 작성

**좋은 예시**:
"이 프로세스를 이해하려면 먼저 배경을 알아야 하는데요, 기존에는 A 방식으로 하다가 문제가 생겨서 B 방식으로 바꾼 거예요. 실무에서는 이렇게 적용하면 되는데, 여기서 주의할 점은 X와 Y를 반드시 확인해야 한다는 거죠. 이게 중요한 이유는 나중에 문제 생기면 되돌리기 어렵거든요."

다음 형식의 JSON 배열로 응답해주세요:

{
  "pages": [
    {
      "page": 1,
      "title": "슬라이드 제목 (핵심 주제를 한 문장으로)",
      "content": "동료에게 설명하듯이 자연스럽게 흐르는 긴 문단으로 작성하세요. 단락을 나누어 가독성을 높이되, 전체적으로 하나의 이야기처럼 연결되어야 합니다.",
      "keyPoints": [
        "실무에 바로 적용 가능한 핵심 인사이트 1",
        "업무 효율을 높이는 핵심 인사이트 2",
        "주의해야 할 중요 포인트나 Best Practice"
      ]
    }
  ]
}

**지침**:
1. ${batch.length}페이지를 2-3개의 슬라이드로 압축
2. 각 슬라이드는 하나의 업무 프로세스를 자연스럽게 설명
3. 제목 페이지, 목차, 반복 내용은 생략
4. 실무에 필요한 내용을 자연스럽게 강조
5. keyPoints: 실무에 바로 적용 가능한 핵심 인사이트 3-5개 추출`;

        // Use mini model for chunk analysis (cost-effective)
        const completion = await openai.chat.completions.create({
          model: CHUNK_MODEL, // gpt-5-mini로 비용 90% 절감
          messages: [
            {
              role: "system",
              content: type === "exam" ? STUDY_SYSTEM_PROMPT : WORK_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 1.0,
        });

        const result = JSON.parse(completion.choices[0].message.content || "{}");
        const batchPages = result.pages || [];

        console.log(`[BATCH ${batchIdx + 1}] Complete. Generated ${batchPages.length} chunks`);

        return {
          batchIdx,
          pages: batchPages
        };
      });

      // Wait for all batches to complete in parallel
      const batchResults = await Promise.all(batchPromises);

      // Sort by batch index to maintain page order
      batchResults.sort((a, b) => a.batchIdx - b.batchIdx);
      const chunkAnalyses = batchResults.flatMap(r => r.pages);

      console.log(`[PDF] Step 2 complete. ${chunkAnalyses.length} chunks analyzed with ${CHUNK_MODEL} (PARALLEL)`);

      // Step 3 & 4: Embedding + Clustering + Final Integration
      if (USE_FINAL_INTEGRATION && chunkAnalyses.length > 3) {
        try {
          console.log(`[STEP 3] Starting embedding and clustering...`);
          const groups = await groupSimilarChunks(chunkAnalyses);

          console.log(`[STEP 4] Starting final integration with ${FINAL_MODEL}...`);
          pageAnalyses = await integrateClusters(groups, type);

          console.log(`[SUCCESS] Final integration complete. ${pageAnalyses.length} slides created`);
        } catch (integrationError: any) {
          console.warn(`[FALLBACK] Integration failed, using chunk analyses directly:`, integrationError.message);
          pageAnalyses = chunkAnalyses; // Fallback to chunk analyses
        }
      } else {
        console.log(`[SKIP] Final integration disabled or too few chunks, using chunk analyses directly`);
        pageAnalyses = chunkAnalyses;
      }
    } else {
      // Text file
      fullContent = await file.text();
      // For text files, create single page analysis
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
