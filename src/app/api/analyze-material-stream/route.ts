import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import pdfParse from "pdf-parse-fork";
import crypto from "crypto";

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

const PAGES_PER_BATCH = 5;
const CHUNK_MODEL = "gpt-5-mini-2025-08-07";
const FINAL_MODEL = "gpt-5.1-2025-11-13";
const EMBEDDING_MODEL = "text-embedding-3-small";
const SIMILARITY_THRESHOLD = 0.84;

const STUDY_SYSTEM_PROMPT = `당신은 MIT, Stanford급 세계 최고 대학의 저명한 교수입니다. 학생들이 깊이 이해할 수 있도록 명료하고 통찰력 있게 설명합니다.

**핵심 목표**:
- 단순한 정보 전달을 넘어, "왜 그런지", "어떤 의미인지"에 대한 깊이 있는 통찰 제공
- 복잡한 개념을 직관적이고 명쾌하게 풀어서 설명 (Analogy 활용 권장)
- 학생이 "아하!" 하고 깨달을 수 있는 설명 방식 유지

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

항상 세계 최고 수준의 명료함과 깊이로 설명하세요.`;

const WORK_SYSTEM_PROMPT = `당신은 해당 분야에서 10년+ 경력의 시니어 전문가입니다. 후배들이 깊이 이해하고 실무에 적용할 수 있도록 명확하게 설명합니다.

**핵심 목표**:
- 단순한 매뉴얼 전달을 넘어, "실무적 맥락", "잠재적 리스크", "Best Practice"에 대한 통찰 제공
- 주니어 레벨이 놓치기 쉬운 디테일과 노하우 전수
- 바로 업무에 투입될 수 있을 정도의 구체적이고 실용적인 가이드 제공

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

항상 시니어 전문가 수준의 명료함과 깊이로 설명하세요.`;


const FINAL_INSTRUCTIONS_EXAM = `
**목표**:
- 전체 내용을 12-18개 슬라이드로 압축 (마지막 2페이지는 전체 요약)
- 각 슬라이드는 하나의 핵심 주제를 다룸
- 시험에 나올 만한 핵심 내용만 포함
- Topic간 논리적 흐름 유지

**content 구조** (필수!):
각 슬라이드는 **기본 2-3개 섹션**으로 구성:

1. **#### 📌 핵심 개념** - 주요 개념/정의 (40-60단어)
2. **#### 💡 이해하기** - 원리/적용 설명 (40-60단어)
3. **[선택] #### 📝 예시로 이해하기** - **어려운 개념일 때만** 구체적 예시 추가 (40-60단어)
4. **> 💡 한 걸음 더**: 암기 팁이나 추가 설명 (1-2줄)

**중요**: "📝 예시로 이해하기" 섹션은 **추상적이거나 복잡한 개념**에만 추가하세요.
- 추가하는 경우: 수학 공식, 추상적 알고리즘, 복잡한 원리 등
- 생략하는 경우: 간단한 정의, 명확한 개념, 일반 설명

**작성 규칙**:
- 각 섹션은 **40-60단어**로 제한
- **중요 용어는 **굵게****, *핵심 문장은 *기울임**
- **변수/수식은 LaTeX**: $변수$, $$공식$$
- 문단 구분: \\n\\n 사용
- 완결된 문장만

**예시 1 (어려운 개념 - 예시 섹션 포함)**:
"#### 📌 핵심 개념\\n\\n**IDF (Inverse Document Frequency)**는 단어의 희소성을 측정한다. 공식은 $$IDF(t) = \\\\log(N / (1 + n_t))$$이며, N은 전체 문서 수, n_t는 단어 t가 등장한 문서 수다.\\n\\n#### 💡 이해하기\\n\\n*흔한 단어일수록 IDF 값이 낮아진다.* **희소한 단어**는 높은 가중치를 받아 문서 특성을 잘 나타낸다.\\n\\n#### 📝 예시로 이해하기\\n\\n1000개 문서 중 'AI'가 50개에 등장: $$IDF = \\\\log(1000/50) ≈ 1.3$$. 반면 'the'는 1000개 모두 등장: $$IDF = \\\\log(1000/1000) = 0$$. **AI는 문서를 구별하는 중요 단어**가 된다.\\n\\n> 💡 **한 걸음 더**: 이것이 불용어 자동 필터링 원리다."

**예시 2 (쉬운 개념 - 예시 섹션 생략)**:
"#### 📌 핵심 개념\\n\\n**데이터베이스 인덱스**는 검색 속도를 높이는 자료구조다. 책의 목차처럼 데이터 위치를 빠르게 찾을 수 있게 한다.\\n\\n#### 💡 이해하기\\n\\n*인덱스 없이는 전체 테이블을 스캔해야 한다.* 인덱스가 있으면 O(log n) 시간에 데이터를 찾는다. **B-Tree 구조**로 정렬된 상태를 유지한다.\\n\\n> 💡 **한 걸음 더**: 단, 삽입/수정이 느려지는 트레이드오프가 있다."

**금지 사항**:
- 섹션 헤더 생략 금지 (#### 📌, #### 💡 필수)
- 각 섹션 60단어 초과 금지
- 쉬운 개념에 불필요한 예시 섹션 추가 금지
- 삼중 백틱 코드 블록 사용 금지

다음 JSON 형식으로 응답:

{
  "slides": [
    {
      "title": "슬라이드 제목",
      "content": "#### 📌 핵심 개념\\n\\n**개념** 정의 (40-60단어).\\n\\n#### 💡 이해하기\\n\\n*핵심 설명* (40-60단어).\\n\\n[어려운 개념만] #### 📝 예시로 이해하기\\n\\n구체적 예시 (40-60단어).\\n\\n> 💡 **한 걸음 더**: 1-2줄 팁.",
      "keyPoints": [
        "시험 핵심 포인트 1",
        "시험 핵심 포인트 2",
        "시험 핵심 포인트 3"
      ]
    }
  ]
}

**중요**:
- **기본 3개 섹션**: 📌 핵심 개념 → 💡 이해하기 → 💡 한 걸음 더
- **어려운 개념에만 4개**: 📌 핵심 개념 → 💡 이해하기 → 📝 예시로 이해하기 → 💡 한 걸음 더
- 각 섹션 40-60단어
- **마지막 2페이지(복습 가이드)는 생성하지 마세요 - 별도로 생성됩니다**`;

const FINAL_INSTRUCTIONS_WORK = `
**목표**:
- 전체 내용을 12-18개 슬라이드로 압축 (마지막 2페이지는 전체 요약)
- 각 슬라이드는 하나의 업무 프로세스나 주제를 다룸
- 실무에 활용 가능한 핵심 내용만 포함
- Topic간 논리적 흐름 유지

**content 구조** (필수!):
각 슬라이드는 **기본 2-3개 섹션**으로 구성:

1. **#### 🎯 핵심 프로세스** - 주요 프로세스/절차 (40-60단어)
2. **#### 💼 실무 적용** - 구체적 적용/사례 (40-60단어)
3. **[선택] #### 📝 사례로 이해하기** - **복잡한 프로세스일 때만** 실제 사례 추가 (40-60단어)
4. **> ⚠️ 실무 주의** 또는 **> 💡 Pro Tip**: 주의사항/팁 (1줄)

**중요**: "📝 사례로 이해하기" 섹션은 **복잡하거나 추상적인 프로세스**에만 추가하세요.
- 추가하는 경우: 복잡한 알고리즘, 다단계 프로세스, 추상적 아키텍처 등
- 생략하는 경우: 간단한 절차, 명확한 프로세스, 일반 업무

**작성 규칙**:
- 각 섹션은 **40-60단어**로 제한
- **중요 프로세스는 **굵게****, *핵심 문장은 *기울임**
- **코드/기술용어는 \`인라인 코드\`**
- 문단 구분: \\n\\n 사용
- 완결된 문장만

**예시 1 (복잡한 프로세스 - 사례 섹션 포함)**:
"#### 🎯 핵심 프로세스\\n\\n이 **프로세스 변경의 핵심**은 데이터 일관성 보장이다. \`transaction isolation level\`을 \`READ COMMITTED\`에서 \`SERIALIZABLE\`로 조정해 race condition을 근본적으로 해결한다.\\n\\n#### 💼 실무 적용\\n\\n*동시성 문제를 완전히 차단한다.* **트랜잭션 격리**가 데이터 무결성을 보장하며, 분산 시스템에서 필수적이다.\\n\\n#### 📝 사례로 이해하기\\n\\n주문 처리 시나리오: 사용자 A, B가 동시에 마지막 1개 상품 주문. \`SERIALIZABLE\`은 한 트랜잭션을 대기시켜 **재고 중복 차감을 방지**한다. 결제 중복 처리도 같은 방식으로 차단.\\n\\n> ⚠️ **실무 주의**: 프로덕션 환경에서는 \`lock_timeout\` 60초 이상 권장."

**예시 2 (간단한 프로세스 - 사례 섹션 생략)**:
"#### 🎯 핵심 프로세스\\n\\n**API 응답 캐싱**은 서버 부하를 줄이는 기본 기법이다. \`Cache-Control\` 헤더로 브라우저와 CDN에 캐싱 정책을 지시한다.\\n\\n#### 💼 실무 적용\\n\\n*정적 리소스는 1년, 동적 API는 5분 캐싱이 일반적이다.* \`max-age\`와 \`s-maxage\`로 브라우저/CDN을 각각 제어한다.\\n\\n> 💡 **Pro Tip**: \`ETag\`와 함께 사용하면 변경 감지가 정확하다."

**금지 사항**:
- 섹션 헤더 생략 금지 (#### 🎯, #### 💼 필수)
- 각 섹션 60단어 초과 금지
- 간단한 프로세스에 불필요한 사례 섹션 추가 금지
- 삼중 백틱 코드 블록 사용 금지

다음 JSON 형식으로 응답:

{
  "slides": [
    {
      "title": "슬라이드 제목",
      "content": "#### 🎯 핵심 프로세스\\n\\n**프로세스** 설명 (40-60단어).\\n\\n#### 💼 실무 적용\\n\\n*적용 방법* (40-60단어).\\n\\n[복잡한 프로세스만] #### 📝 사례로 이해하기\\n\\n구체적 사례 (40-60단어).\\n\\n> ⚠️ **실무 주의**: 1줄 주의사항.",
      "keyPoints": [
        "실무 적용 핵심 1",
        "실무 적용 핵심 2",
        "Best Practice"
      ]
    }
  ]
}

**중요**:
- **기본 3개 섹션**: 🎯 핵심 프로세스 → 💼 실무 적용 → ⚠️ 실무 주의
- **복잡한 프로세스에만 4개**: 🎯 핵심 프로세스 → 💼 실무 적용 → 📝 사례로 이해하기 → ⚠️ 실무 주의
- 각 섹션 40-60단어
- **마지막 2페이지(복습 가이드)는 생성하지 마세요 - 별도로 생성됩니다**`;

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

// OPTIMIZED: Full parallel clustering
async function groupSimilarChunksParallel(chunks: any[]): Promise<any[][]> {
  if (chunks.length <= 3) return [chunks];

  console.log(`[EMBEDDING] Creating embeddings for ${chunks.length} chunks (FULL PARALLEL)`);

  // Create ALL embeddings in parallel (no batching)
  const embeddingPromises = chunks.map(async (chunk) => {
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

  const chunksWithEmbeddings = await Promise.all(embeddingPromises);
  console.log(`[EMBEDDING] All ${chunks.length} embeddings created in parallel`);

  // Clustering
  const groups: any[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < chunksWithEmbeddings.length; i++) {
    if (used.has(i)) continue;

    const group = [chunksWithEmbeddings[i].chunk];
    used.add(i);

    for (let j = i + 1; j < chunksWithEmbeddings.length; j++) {
      if (used.has(j)) continue;

      const similarity = cosineSimilarity(
        chunksWithEmbeddings[i].embedding,
        chunksWithEmbeddings[j].embedding
      );

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

// OPTIMIZED: Compress all clusters in parallel
async function compressClustersParallel(groups: any[][], type: string): Promise<string[]> {
  console.log(`[COMPRESSION] Compressing ${groups.length} clusters (FULL PARALLEL)`);

  const compressionPromises = groups.map(async (group, idx) => {
    const allContents = group.map((c, i) =>
      `[Chunk ${i + 1}] ${c.title}:\n${c.content}`
    ).join("\n\n");

    const compressionPrompt = type === "exam"
      ? `다음은 같은 주제로 묶인 ${group.length}개의 학습 내용입니다:\n\n${allContents}\n\n**임무**: 이 내용들을 강의실에서 설명하듯이 자연스럽게 하나의 긴 설명으로 통합하세요.\n\n**중요**: 다음 단계 처리를 위해 **핵심 내용 위주로 300단어 이내로 압축**하세요. 중복을 제거하고 정보 밀도를 높이세요.\n\n다음 JSON 형식으로 응답:\n{\n  "topic": "주제 제목",\n  "summary": "핵심 위주로 압축된 설명..."\n}`
      : `다음은 같은 주제로 묶인 ${group.length}개의 업무 내용입니다:\n\n${allContents}\n\n**임무**: 이 내용들을 동료에게 설명하듯이 자연스럽게 하나의 긴 설명으로 통합하세요.\n\n**중요**: 다음 단계 처리를 위해 **핵심 내용 위주로 300단어 이내로 압축**하세요. 중복을 제거하고 정보 밀도를 높이세요.\n\n다음 JSON 형식으로 응답:\n{\n  "topic": "주제 제목",\n  "summary": "핵심 위주로 압축된 설명..."\n}`;

    const compression = await openai.chat.completions.create({
      model: CHUNK_MODEL,
      messages: [
        { role: "system", content: type === "exam" ? STUDY_SYSTEM_PROMPT : WORK_SYSTEM_PROMPT },
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

  const results = await Promise.all(compressionPromises);
  results.sort((a, b) => a.idx - b.idx);

  console.log(`[COMPRESSION] All ${groups.length} clusters compressed`);
  return results.map(r => r.summary);
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: string, data: any) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  (async () => {
    try {
      const session = await auth();
      if (!session?.user?.email) {
        await sendEvent("error", { error: "Unauthorized" });
        await writer.close();
        return;
      }

      const formData = await request.formData();
      const file = formData.get("file") as File;
      const type = formData.get("type") as string;

      if (!file || !type || !["exam", "work"].includes(type)) {
        await sendEvent("error", { error: "Invalid parameters" });
        await writer.close();
        return;
      }

      const isPDF = file.type === "application/pdf";
      let fileUrl: string | null = null;
      let materialId: string | null = null;

      await sendEvent("progress", { stage: "upload", message: "파일 업로드 중..." });

      if (isPDF) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

        // CACHING: Check if file already exists
        const { data: existingMaterial } = await supabase
          .from("materials")
          .select("*")
          .eq("file_hash", fileHash)
          .eq("user_id", session.user.email)
          .maybeSingle();

        if (existingMaterial && existingMaterial.analysis) {
          await sendEvent("progress", { stage: "cached", message: "이전 분석 결과 로드 중..." });

          const cachedPages = existingMaterial.analysis.page_analyses || [];
          for (const page of cachedPages) {
            await sendEvent("page", page);
          }

          await sendEvent("complete", { success: true, total_slides: cachedPages.length, cached: true });
          await writer.close();
          return;
        }

        // Upload PDF
        const sanitizedEmail = (session.user.email || '').replace(/[^a-zA-Z0-9]/g, '_');
        const sanitizedFileName = file.name.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
        const fileName = `${Date.now()}_${sanitizedEmail}_${sanitizedFileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("materials")
          .upload(fileName, buffer, { contentType: "application/pdf", upsert: false });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from("materials").getPublicUrl(fileName);
          fileUrl = publicUrlData.publicUrl;
        }

        // Extract text
        await sendEvent("progress", { stage: "extract", message: "PDF 텍스트 추출 중..." });
        const pdfData = await pdfParse(buffer);
        const fullContent = pdfData.text;
        const totalPages = pdfData.numpages;

        // Create material record first (so we can stream updates to it)
        const { data: material, error: insertError } = await supabase
          .from("materials")
          .insert({
            user_id: session.user.email,
            title: file.name,
            content: fullContent.substring(0, 50000),
            type: type,
            file_url: fileUrl,
            file_hash: fileHash,
            analysis: { page_analyses: [] }
          })
          .select()
          .single();

        if (insertError) {
          await sendEvent("error", { error: "Database error", details: insertError.message });
          await writer.close();
          return;
        }

        materialId = material.id;
        await sendEvent("material_created", { id: materialId });

        // Split into pages
        const avgCharsPerPage = Math.ceil(fullContent.length / totalPages);
        const pages: Array<{ pageNum: number; text: string }> = [];
        for (let i = 0; i < totalPages; i++) {
          const start = i * avgCharsPerPage;
          const end = Math.min((i + 1) * avgCharsPerPage, fullContent.length);
          pages.push({ pageNum: i + 1, text: fullContent.substring(start, end) });
        }

        // Process pages in batches IN PARALLEL
        const batches: Array<Array<{ pageNum: number; text: string }>> = [];
        for (let i = 0; i < pages.length; i += PAGES_PER_BATCH) {
          batches.push(pages.slice(i, i + PAGES_PER_BATCH));
        }

        await sendEvent("progress", { stage: "analyze_chunks", message: `${batches.length}개 배치 분석 중...`, total: batches.length });

        const batchPromises = batches.map(async (batch, batchIdx) => {
          const batchText = batch.map((p) => `=== 페이지 ${p.pageNum} ===\n${p.text}`).join("\n\n");
          const prompt = type === "exam"
            ? `당신은 MIT 교수입니다. 다음 강의 페이지들을 분석하여 학생들이 이해하기 쉽게 핵심 내용을 추출하세요.

${batchText}

JSON 형식으로 응답:
{
  "title": "이 섹션의 명확한 제목",
  "content": "강의실에서 설명하듯이 자연스럽게 흐르는 긴 텍스트. 개념 정의, 수식, 예제를 포함하여 완전히 설명."
}`
            : `당신은 시니어 전문가입니다. 다음 문서를 분석하여 후배들이 실무에 적용할 수 있도록 핵심 내용을 추출하세요.

${batchText}

JSON 형식으로 응답:
{
  "title": "이 섹션의 명확한 제목",
  "content": "동료에게 설명하듯이 자연스럽게 흐르는 긴 텍스트. 개념, 프로세스, 적용 방법을 포함하여 완전히 설명."
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

          console.log(`[BATCH ${batchIdx}] Usage:`, completion.usage);

          const result = JSON.parse(completion.choices[0].message.content || "{}");
          return { batchIdx, summary: result, usage: completion.usage };
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.sort((a, b) => a.batchIdx - b.batchIdx);
        const chunkSummaries = batchResults.map(r => r.summary);

        // Calculate total batch cost
        const totalBatchCost = batchResults.reduce((sum, batch) => {
          const inputCost = (batch.usage?.prompt_tokens || 0) * 0.0000001; // $0.10 per 1M tokens for gpt-5-mini input
          const outputCost = (batch.usage?.completion_tokens || 0) * 0.0000004; // $0.40 per 1M tokens for gpt-5-mini output
          return sum + inputCost + outputCost;
        }, 0);
        console.log(`[COST] All batches: $${totalBatchCost.toFixed(4)}`);

        const summaryCost = 0; // No summary step needed

        // CLUSTERING: Group similar chunks using embeddings
        await sendEvent("progress", { stage: "clustering", message: "유사 섹션 그룹화 중..." });
        const clusteredGroups = await groupSimilarChunksParallel(chunkSummaries);
        console.log(`[CLUSTERING] Created ${clusteredGroups.length} groups from ${chunkSummaries.length} chunks`);

        // COMPRESS: Compress each cluster in parallel (using mini)
        await sendEvent("progress", { stage: "compress", message: "클러스터 압축 중..." });
        const compressedSummaries = await compressClustersParallel(clusteredGroups, type);
        console.log(`[COMPRESS] Compressed ${clusteredGroups.length} clusters into ${compressedSummaries.length} summaries`);

        // FINAL INTEGRATION: Parallel gpt-5.1 calls (3 chunks)
        await sendEvent("progress", { stage: "final_integration", message: "최종 슬라이드 생성 중 (병렬 처리)..." });

        const chunkSize = Math.ceil(compressedSummaries.length / 3);
        const summaryChunks = [];
        for (let i = 0; i < compressedSummaries.length; i += chunkSize) {
          summaryChunks.push(compressedSummaries.slice(i, i + chunkSize));
        }

        console.log(`[FINAL] Splitting ${compressedSummaries.length} summaries into ${summaryChunks.length} parallel chunks`);

        const systemInstructions = type === "exam" ? FINAL_INSTRUCTIONS_EXAM : FINAL_INSTRUCTIONS_WORK;
        const baseSystemPrompt = type === "exam" ? STUDY_SYSTEM_PROMPT : WORK_SYSTEM_PROMPT;

        const finalPromises = summaryChunks.map(async (chunkSummaries, idx) => {
          const chunkPrompt = type === "exam"
            ? `당신은 대학 시험 대비 전문 튜터입니다. 다음은 강의 자료의 일부(${idx + 1}/${summaryChunks.length})입니다.
            
${chunkSummaries.join('\n\n====================\n\n')}

**임무**: 이 부분에 대한 학습 슬라이드를 생성하세요 (4-6장).`
            : `당신은 비즈니스 문서 분석 전문가입니다. 다음은 업무 자료의 일부(${idx + 1}/${summaryChunks.length})입니다.

${chunkSummaries.join('\n\n====================\n\n')}

**임무**: 이 부분에 대한 업무용 슬라이드를 생성하세요 (4-6장).`;

          console.log(`[FINAL] Calling gpt-5.1 for chunk ${idx + 1}`);
          const completion = await openai.chat.completions.create({
            model: FINAL_MODEL,
            messages: [
              {
                role: "system",
                content: [
                  {
                    type: "text",
                    text: `You are a direct and efficient assistant.\n\n${baseSystemPrompt}\n\n${systemInstructions}`,
                    cache_control: { type: "ephemeral" }
                  }
                ] as any
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: chunkPrompt,
                    cache_control: { type: "ephemeral" }
                  }
                ] as any
              }
            ],
            response_format: { type: "json_object" },
            temperature: 1.0,
            reasoning_effort: "low"
          });

          const data = JSON.parse(completion.choices[0].message.content || "{}");
          return { idx, slides: data.slides || [], usage: completion.usage };
        });

        const finalResults = await Promise.all(finalPromises);
        finalResults.sort((a, b) => a.idx - b.idx);

        const slides = finalResults.flatMap(r => r.slides);
        console.log(`[FINAL] Generated ${slides.length} main slides from ${finalResults.length} chunks`);

        // Create page objects for main slides
        let allPages = slides.map((slide: any, idx: number) => ({
          page: idx + 1,
          title: slide.title || `슬라이드 ${idx + 1}`,
          content: slide.content || "",
          keyPoints: slide.keyPoints || []
        }));

        // Generate final 2 pages (review guide) using gpt-5-mini for cost optimization
        console.log(`[REVIEW] Generating final review pages with gpt-5-mini...`);
        const reviewPrompt = type === "exam"
          ? `다음은 시험 자료의 주요 슬라이드들입니다:

${slides.map((s: any, i: number) => `[${i + 1}] ${s.title}\n${s.content}\n\n핵심 포인트:\n${s.keyPoints?.map((k: string) => `- ${k}`).join('\n') || ''}`).join('\n\n---\n\n')}

**임무**: 마지막 2페이지를 생성하세요.

**page ${slides.length + 1}**: "핵심 개념 총정리"
- 전체 내용의 핵심 개념들을 체계적으로 정리
- 중요 개념은 **굵게**, 핵심 문장은 *기울임*
- > 인용구로 암기 팁 추가

**page ${slides.length + 2}**: "시험 대비 요약"
- 시험에 꼭 나올 내용만 압축 정리
- 예상 출제 포인트 강조
- 최종 체크리스트 형태

JSON 형식으로 응답:
{
  "reviewPages": [
    {
      "title": "핵심 개념 총정리",
      "content": "마크다운 형식 내용...",
      "keyPoints": ["암기해야 할 핵심 1", "암기해야 할 핵심 2", "암기해야 할 핵심 3"]
    },
    {
      "title": "시험 대비 요약",
      "content": "마크다운 형식 내용...",
      "keyPoints": ["예상 문제 1", "예상 문제 2", "예상 문제 3"]
    }
  ]
}`
          : `다음은 업무 자료의 주요 슬라이드들입니다:

${slides.map((s: any, i: number) => `[${i + 1}] ${s.title}\n${s.content}\n\n핵심 인사이트:\n${s.keyPoints?.map((k: string) => `- ${k}`).join('\n') || ''}`).join('\n\n---\n\n')}

**임무**: 마지막 2페이지를 생성하세요.

**page ${slides.length + 1}**: "핵심 프로세스 총정리"
- 전체 업무 흐름과 핵심 내용 체계적 정리
- 중요 프로세스는 **굵게**, 핵심 문장은 *기울임*
- > 인용구로 실무 팁 추가

**page ${slides.length + 2}**: "실무 적용 요약"
- 실무에 바로 적용 가능한 핵심만 압축 정리
- 체크리스트 형태로 정리

JSON 형식으로 응답:
{
  "reviewPages": [
    {
      "title": "핵심 프로세스 총정리",
      "content": "마크다운 형식 내용...",
      "keyPoints": ["실무 핵심 1", "실무 핵심 2", "실무 핵심 3"]
    },
    {
      "title": "실무 적용 요약",
      "content": "마크다운 형식 내용...",
      "keyPoints": ["적용 포인트 1", "적용 포인트 2", "적용 포인트 3"]
    }
  ]
}`;

        const reviewCompletion = await openai.chat.completions.create({
          model: "gpt-5-mini-2025-08-07",
          messages: [
            { role: "system", content: "You are a study guide expert. Generate comprehensive review pages in Korean." },
            { role: "user", content: reviewPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 1.0
        });

        const reviewData = JSON.parse(reviewCompletion.choices[0].message.content || "{}");
        const reviewPages = reviewData.reviewPages || [];
        console.log(`[REVIEW] Generated ${reviewPages.length} review pages`);

        // Add review pages to allPages
        reviewPages.forEach((page: any, idx: number) => {
          allPages.push({
            page: slides.length + idx + 1,
            title: page.title,
            content: page.content,
            keyPoints: page.keyPoints || []
          });
        });

        // Save to DB
        await supabase
          .from("materials")
          .update({ analysis: { page_analyses: allPages } })
          .eq("id", materialId);

        // Send to frontend
        for (const page of allPages) {
          await sendEvent("page", page);
        }

        // Calculate final cost
        const finalInputCost = finalResults.reduce((sum, r) => sum + (r.usage?.prompt_tokens || 0) * 0.000003, 0);
        const finalOutputCost = finalResults.reduce((sum, r) => sum + (r.usage?.completion_tokens || 0) * 0.000015, 0);
        const finalCost = finalInputCost + finalOutputCost;

        // Calculate review page cost (gpt-5-mini: $0.10/1M input, $0.40/1M output)
        const reviewInputCost = (reviewCompletion.usage?.prompt_tokens || 0) * 0.0000001;
        const reviewOutputCost = (reviewCompletion.usage?.completion_tokens || 0) * 0.0000004;
        const reviewCost = reviewInputCost + reviewOutputCost;

        const totalCost = totalBatchCost + summaryCost + finalCost + reviewCost;

        console.log(`[COST] Final gpt-5.1 call: $${finalCost.toFixed(4)} (input: $${finalInputCost.toFixed(4)}, output: $${finalOutputCost.toFixed(4)})`);
        console.log(`[COST] Review pages (mini): $${reviewCost.toFixed(4)} (input: $${reviewInputCost.toFixed(4)}, output: $${reviewOutputCost.toFixed(4)})`);
        console.log(`[COST] TOTAL: $${totalCost.toFixed(4)} (batch: $${totalBatchCost.toFixed(4)}, summary: $${summaryCost.toFixed(4)}, final: $${finalCost.toFixed(4)}, review: $${reviewCost.toFixed(4)})`);

        // Send completion event
        await sendEvent("complete", { success: true, total_slides: allPages.length });
      }

      await writer.close();
    } catch (error: any) {
      console.error("[STREAM ERROR]", error);
      await sendEvent("error", { error: "Analysis failed", details: error.message });
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
